
var TIMEGEM_API_BASE = 'https://api.timegem.nl';

(function () {
    'use strict';

    var agendaPath = '/agenda/';
    var TIMEGEM_USER_STORAGE_KEY = 'timegem_ven_id';

    /** event_slug -> event row, filled from whichever events call we made. */
    var eventsBySlug = {};

    // Recommendations change only when the visitor reconnects or the venue
    // re-imports, so they are cheap to keep. localStorage, not sessionStorage:
    // 12 hours has to survive closing the tab.
    // Bump the version suffix if the cached payload shape ever changes.
    var CACHE_PREFIX = 'timegem_ven_cache_v1:';
    var CACHE_TTL_MS = 12 * 60 * 60 * 1000;

    function cacheKey(timegemId, venueId, eventSlug) {
        return CACHE_PREFIX + timegemId + ':' + (venueId || '-') + ':' + (eventSlug || '*');
    }

    function cacheRead(key) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            var entry = JSON.parse(raw);
            if (!entry || typeof entry.t !== 'number') return null;
            if (Date.now() - entry.t > CACHE_TTL_MS) {
                localStorage.removeItem(key);
                return null;
            }
            return entry.d;
        } catch (e) {
            return null; // private mode, disabled storage, corrupt entry
        }
    }

    function cacheWrite(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
        } catch (e) {
            // Out of quota (or storage blocked): clear our own entries so the
            // next page view can try again, and carry on without a cache.
            cacheClear();
        }
    }

    /** Drops our cache entries. With a prefix, only those for one visitor. */
    function cacheClear(prefix) {
        try {
            var wanted = prefix || CACHE_PREFIX;
            var doomed = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(wanted) === 0) doomed.push(k);
            }
            doomed.forEach(function (k) { localStorage.removeItem(k); });
        } catch (e) {}
    }

    function getConfigIdFromCommand(cmd) {
        if (!cmd || cmd[0] !== 'config') return null;
        var id = cmd[1];
        return typeof id === 'string' && id ? id : null;
    }

    /** Collect queue items from window.timegem (array) and/or timegem.q (widget stub). */
    function getTimegemQueueItems() {
        var items = [];
        try {
            var queue = window.timegem;
            if (!queue) return items;
            if (Array.isArray(queue)) items = items.concat(queue);
            if (queue.q && Array.isArray(queue.q)) items = items.concat(queue.q);
        } catch (e) {}
        return items;
    }

    /** venue_id: which venue's events to load (from tg('config', venue_id) in page head). */
    function getVenueIdFromQueue() {
        try {
            var items = getTimegemQueueItems();
            for (var i = 0; i < items.length; i++) {
                var id = getConfigIdFromCommand(items[i]);
                if (id) return id;
            }
        } catch (e) {}
        return null;
    }

    /** timegem_id: logged-in user profile (URL param, then localStorage). */
    function getTimegemIdFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search);
            return params.get('timegem_id') || null;
        } catch (e) {
            return null;
        }
    }

    function getTimegemId() {
        var fromUrl = getTimegemIdFromUrl();
        if (fromUrl) {
            try { localStorage.setItem(TIMEGEM_USER_STORAGE_KEY, fromUrl); } catch (e) {}
            return fromUrl;
        }

        try {
            return localStorage.getItem(TIMEGEM_USER_STORAGE_KEY) || null;
        } catch (e) {
            return null;
        }
    }

    // ─── Page / URL helpers ───────────────────────────────────────────────────

    function isAgendaPage() {
        try {
            return (window.location.pathname || '').indexOf(agendaPath) !== -1;
        } catch (e) {
            return false;
        }
    }

    function getSlugFromCurrentPath() {
        try {
            var path = window.location.pathname || '';
            var i = path.indexOf(agendaPath);
            if (i === -1) return null;
            var after = path.slice(i + agendaPath.length);
            var slug = after.split('/')[0] || null;
            return slug ? slug.trim() : null;
        } catch (e) {
            return null;
        }
    }

    function getSlugFromHref(href) {
        if (!href || typeof href !== 'string') return null;
        try {
            var url = new URL(href, window.location.origin);
            var path = url.pathname || '';
            var i = path.indexOf(agendaPath);
            if (i === -1) return null;
            var after = path.slice(i + agendaPath.length);
            var slug = after.split('/')[0] || null;
            return slug ? slug.trim() : null;
        } catch (e) {
            return null;
        }
    }

    // ─── API calls (all go through your Netlify API — no credentials in browser) ──

    var LOG_PREFIX = '[Timegem]';

    function fetchVenue(venueId) {
        var url = TIMEGEM_API_BASE + '/api/venue/' + encodeURIComponent(venueId);
        return fetch(url, { method: 'GET' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .catch(function () { return null; });
    }

    function fetchVenueEvents(venueId) {
        var url = TIMEGEM_API_BASE + '/api/venue/' + encodeURIComponent(venueId) + '/events';
        return fetch(url, { method: 'GET' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .catch(function () { return null; });
    }

    function fetchArtistRecommendations(timegemId, venueId, eventSlug) {
        var key = cacheKey(timegemId, venueId, eventSlug);
        var hit = cacheRead(key);
        if (hit) return Promise.resolve({ ok: true, status: 200, data: hit, cached: true });

        // A cached full payload already describes every event, so a single-event
        // page can answer from it rather than making its own request.
        if (eventSlug) {
            var full = cacheRead(cacheKey(timegemId, venueId, null));
            if (full) return Promise.resolve({ ok: true, status: 200, data: full, cached: true });
        }

        var url = TIMEGEM_API_BASE + '/api/artist-recommendations-v4/' + encodeURIComponent(timegemId) + '?gem=venue';
        if (venueId) url += '&venue_id=' + encodeURIComponent(venueId);
        // Scores the whole venue either way; this just trims the response to one
        // event. Older API builds ignore the param and return everything, which
        // still works because we look the slug up in the payload below.
        if (eventSlug) url += '&event_slug=' + encodeURIComponent(eventSlug);
        return fetch(url, { method: 'GET' })
            .then(function (res) {
                return res.json().then(function (data) {
                    if (res.ok) cacheWrite(key, data);
                    return { ok: res.ok, status: res.status, data: data };
                });
            })
            .catch(function (err) {
                return { ok: false, status: 0, data: null, error: err };
            });
    }

    /** Profile + top artists/tracks for a connected visitor (spotify_profiles_ven). */
    function fetchVenueProfile(timegemId, venueId) {
        var url = TIMEGEM_API_BASE + '/api/venue-profile/' + encodeURIComponent(timegemId) + '?limit=10';
        if (venueId) url += '&venue_id=' + encodeURIComponent(venueId);
        return fetch(url, { method: 'GET' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .catch(function () { return null; });
    }

    // Calls your NEW Netlify proxy — Supabase key stays server-side
    function fetchEventBySlug(slug) {
        var url = TIMEGEM_API_BASE + '/api/event/' + encodeURIComponent(slug);
        return fetch(url, { method: 'GET' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .catch(function () { return null; });
    }

    // ─── Rendering helpers ────────────────────────────────────────────────────

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function slugToRecommendation(apiData) {
        var map = {};
        if (!apiData || !Array.isArray(apiData.recommendations)) return map;
        apiData.recommendations.forEach(function (rec) {
            var slug = rec.artist && rec.artist.event_slug;
            if (slug) map[slug] = rec;
        });
        return map;
    }

    function getMatchTypeSymbol(matchType) {
        var diamond = '\u25C6';
        var star = '\u2605';
        if (!matchType) return '';
        var t = String(matchType).toLowerCase();
        if (t === 'none') return '';
        if (t === 'direct') return star;
        if (t === 'light') return diamond;
        if (t === 'medium') return diamond + diamond;
        if (t === 'heavy') return diamond + diamond + diamond;
        return '';
    }

    function appendMatchDetails(block, recommendation) {
        var matchType = recommendation && recommendation.matchType;
        var symbol = getMatchTypeSymbol(matchType);
        if (matchType === 'none' || !symbol) return;

        var container = block.querySelector('.wp__theater') || block;
        if (!container.style.position || container.style.position === 'static') {
            container.style.position = 'relative';
        }

        var div = document.createElement('div');
        div.className = 'timegem-ven-match-details';
        div.textContent = symbol;
        container.appendChild(div);
    }

    function prependMatchDetailsToDetails(recommendation) {
        if (!recommendation || !Array.isArray(recommendation.matchDetails) || recommendation.matchDetails.length === 0) return;
        var dateEl = document.querySelector('.details .wp_theatre_event_startdate, .details .wp_theatre_event_date');
        if (!dateEl) return;
        var detailsSection = dateEl.parentElement;
        if (!detailsSection || !detailsSection.classList.contains('details')) return;

        var wrap = document.createElement('div');
        wrap.className = 'timegem-ven-why';
        wrap.innerHTML = recommendation.matchDetails.map(function (s) { return escapeHtml(s); }).join('<br>');
        detailsSection.insertBefore(wrap, dateEl);
    }

    // ─── Main flow ────────────────────────────────────────────────────────────

    function applyRecommendations(timegemId, venueId) {
        // Only ask for the single event when there is nothing else on the page
        // that needs badging \u2014 otherwise we still need the full list.
        var pageSlug = getSlugFromCurrentPath();
        var scopeToEvent = pageSlug && document.querySelectorAll('.wp_theatre_event').length === 0
            ? pageSlug
            : null;

        fetchArtistRecommendations(timegemId, venueId, scopeToEvent).then(function (result) {
            var apiData = result && result.ok ? result.data : null;
            if (!apiData) {
                updateAgendaBlock(null, 'unavailable');
                return;
            }
            var bySlug = slugToRecommendation(apiData);
            var blocks = document.querySelectorAll('.wp_theatre_event');
            blocks.forEach(function (block) {
                var link = block.querySelector('a');
                if (!link || !link.href) return;
                var slug = getSlugFromHref(link.href);
                if (!slug) return;
                var rec = bySlug[slug];
                if (rec) appendMatchDetails(block, rec);
            });
            if (isAgendaPage()) {
                if (pageSlug) {
                    updateAgendaBlock(bySlug[pageSlug] || null, 'ok');
                    if (bySlug[pageSlug]) prependMatchDetailsToDetails(bySlug[pageSlug]);
                }
            }
        });
    }

    /**
     * Builds the slug -> event lookup. Every block on the page is already
     * described by this payload, so nothing needs a per-event request.
     */
    function indexEventsBySlug(events) {
        (events || []).forEach(function (ev) {
            if (ev && ev.event_slug) eventsBySlug[ev.event_slug] = ev;
        });
        return eventsBySlug;
    }

    /** Event row for a block, straight from memory. */
    function getEventForBlock(block) {
        var link = block && block.querySelector('a');
        if (!link || !link.href) return null;
        var slug = getSlugFromHref(link.href);
        return slug ? (eventsBySlug[slug] || null) : null;
    }

    function runTimegemFlow(attempt) {
        attempt = attempt || 0;
        var venueId = getVenueIdFromQueue();
        var timegemId = getTimegemId();

        if (!venueId && attempt < 20) {
            setTimeout(function () { runTimegemFlow(attempt + 1); }, 50);
            return;
        }

        if (!venueId) return;

        // A listing page needs every event (one bulk call, ~130KB). A single
        // event page needs exactly one row (~0.5KB), so ask for just that.
        var pageSlug = getSlugFromCurrentPath();
        var isSingleEvent = pageSlug && document.querySelectorAll('.wp_theatre_event').length === 0;

        var eventsRequest = isSingleEvent
            ? fetchEventBySlug(pageSlug).then(function (ev) {
                return ev ? { events: [ev] } : null;
            })
            : fetchVenueEvents(venueId);

        Promise.all([
            fetchVenue(venueId),
            eventsRequest
        ]).then(function (results) {
            var venue = results[0];
            var eventsPayload = results[1];

            if (venue && venue.name) {
                console.log(LOG_PREFIX, 'Venue is loaded: ' + venue.name);
            } else if (eventsPayload && eventsPayload.venue && eventsPayload.venue.name) {
                console.log(LOG_PREFIX, 'Venue is loaded: ' + eventsPayload.venue.name);
            }

            if (eventsPayload && Array.isArray(eventsPayload.events)) {
                indexEventsBySlug(eventsPayload.events);
                console.log(LOG_PREFIX, 'Events are loaded: ' + eventsPayload.events.length);
            }

            if (!timegemId) {
                console.log(LOG_PREFIX, 'No personal Timegem ID found');
                return;
            }

            applyRecommendations(timegemId, venueId);
        });
    }

    // ─── "Find your gems" dialog ──────────────────────────────────────

    /** The nav button always opens the dialog; the discover CTA only does so when logged out. */
    var NAV_CTA_SELECTOR = 'nav .button-cta';
    var DISCOVER_CTA_SELECTOR = '.cta-discover';
    var CTA_SELECTOR = NAV_CTA_SELECTOR + ', ' + DISCOVER_CTA_SELECTOR;
    var DIALOG_ID = 'timegem-ven-dialog';
    var HAS_ID_ATTR = 'data-timegem-has-id';
    var NAV_CTA_LABEL_LOGGED_IN = 'Your profile';
    var ORIGINAL_LABEL_ATTR = 'data-timegem-label';
    var BLOCK_CLASS = 'timegem-ven-block';
    var MATCH_COPY = {
        direct: 'This one is yours',
        heavy: 'This is a strong match',
        medium: 'This could be for you',
        light: 'There is a light match here',
        none: 'This is not a match'
    };
    var CONNECT_PORTAL_URL = 'https://my.personaltimetable.com/';
    var profileCache = {};
    var dialogRenderToken = 0;

    /**
     * Link into the connect portal.
     *
     * The portal takes venue_id + venue_url, runs the Spotify OAuth, writes the
     * visitor to spotify_profiles_ven (plus user_top_artists_ven / _tracks_ven),
     * then sends them back to venue_url with ?timegem_id=<that profile row id>.
     * getTimegemId() picks that up off the URL and stores it — so venue_url is
     * simply wherever the visitor is standing right now.
     *
     * Passing venue_url explicitly matters: the portal's own venue config falls
     * back to https://rotown.nl, which would drop a staging visitor onto prod.
     */
    function buildConnectUrl() {
        var venueId = getVenueIdFromQueue();
        if (!venueId) return null;

        var returnUrl;
        try {
            var here = new URL(window.location.href);
            here.searchParams.delete('timegem_id'); // never hand back a stale id
            returnUrl = here.toString();
        } catch (e) {
            returnUrl = window.location.href;
        }

        return CONNECT_PORTAL_URL +
            '?venue_id=' + encodeURIComponent(venueId) +
            '&venue_url=' + encodeURIComponent(returnUrl);
    }

    /** One <li> per artist/track: artwork on the left, two lines of text. */
    function appendProfileSection(body, heading, items) {
        if (!items.length) return;

        var subhead = document.createElement('h3');
        subhead.className = 'timegem-ven-subhead';
        subhead.textContent = heading;
        body.appendChild(subhead);

        var list = document.createElement('ul');
        list.className = 'timegem-ven-list';

        items.forEach(function (item) {
            var li = document.createElement('li');

            if (item.image) {
                var img = document.createElement('img');
                img.src = item.image;
                img.alt = '';
                img.loading = 'lazy';
                li.appendChild(img);
            }

            var text = document.createElement('div');

            var primary = document.createElement('span');
            primary.className = 'timegem-ven-list-primary';
            primary.textContent = item.primary || '';
            text.appendChild(primary);

            if (item.secondary) {
                var secondary = document.createElement('span');
                secondary.className = 'timegem-ven-list-secondary';
                secondary.textContent = item.secondary;
                text.appendChild(secondary);
            }

            li.appendChild(text);
            list.appendChild(li);
        });

        body.appendChild(list);
    }

    /** textContent everywhere — artist and track names come from Spotify, not from us. */
    function renderProfile(body, data) {
        body.innerHTML = '';

        var profile = (data && data.profile) || {};

        var head = document.createElement('div');
        head.className = 'timegem-ven-profile-head';

        if (profile.image_url) {
            var avatar = document.createElement('img');
            avatar.className = 'timegem-ven-avatar';
            avatar.src = profile.image_url;
            avatar.alt = '';
            head.appendChild(avatar);
        }

        var name = document.createElement('h2');
        name.textContent = profile.display_name || 'Your profile';
        head.appendChild(name);
        body.appendChild(head);

        var genres = (data && data.topGenres) || [];
        if (genres.length) {
            var genreLine = document.createElement('p');
            genreLine.className = 'timegem-ven-genres';
            genreLine.textContent = genres.slice(0, 5).map(function (g) { return g.genre; }).join(' \u00B7 ');
            body.appendChild(genreLine);
        }

        appendProfileSection(body, 'Top artists', ((data && data.topArtists) || []).map(function (a) {
            return {
                image: a.image_url,
                primary: a.artist_name,
                secondary: (a.genres || []).slice(0, 2).join(', ')
            };
        }));

        appendProfileSection(body, 'Top tracks', ((data && data.topTracks) || []).map(function (t) {
            return {
                image: t.album_image_url,
                primary: t.track_name,
                secondary: t.artist_name
            };
        }));
    }

    /** Dialog contents depend on whether we already know the visitor. */
    function renderDialogBody(hasId) {
        var dialog = document.getElementById(DIALOG_ID);
        var body = dialog && dialog.querySelector('.timegem-ven-dialog-body');
        if (!body) return;

        body.innerHTML = '';

        // Every render gets a token. A slow fetch that resolves after the dialog
        // was closed and reopened must not paint over the newer contents.
        var token = ++dialogRenderToken;

        var title = document.createElement('h2');
        var intro = document.createElement('p');

        if (hasId) {
            var timegemId = getTimegemId();
            var cached = profileCache[timegemId];

            if (cached) {
                renderProfile(body, cached);
                return;
            }

            title.textContent = 'Your profile';
            intro.className = 'timegem-ven-fineprint';
            intro.textContent = 'Loading your top artists and tracks\u2026';
            body.appendChild(title);
            body.appendChild(intro);

            fetchVenueProfile(timegemId, getVenueIdFromQueue()).then(function (data) {
                if (token !== dialogRenderToken || !body.isConnected) return;

                if (!data || !data.profile) {
                    intro.textContent = "We couldn't load your profile right now. Please try again later.";
                    return;
                }

                profileCache[timegemId] = data;
                renderProfile(body, data);
            });

            return;
        }

        title.textContent = 'Find your gems';
        intro.textContent = "Connect your Spotify account and we'll show you which shows actually match your taste.";
        body.appendChild(title);
        body.appendChild(intro);

        var connectUrl = buildConnectUrl();
        var fine = document.createElement('p');
        fine.className = 'timegem-ven-fineprint';

        if (!connectUrl) {
            fine.textContent = 'No venue is configured for this page, so connecting is unavailable.';
            body.appendChild(fine);
            return;
        }

        var link = document.createElement('a');
        link.className = 'timegem-ven-connect';
        link.href = connectUrl;
        link.textContent = 'Connect with Spotify';
        body.appendChild(link);

        fine.textContent = 'You will be sent to my.personaltimetable.com to connect. We store your Spotify ' +
            'profile, top artists and top tracks to build your recommendations, and send you straight back here ' +
            'afterwards.';
        body.appendChild(fine);
    }

    function buildDialog() {
        var dialog = document.createElement('dialog');
        dialog.id = DIALOG_ID;
        dialog.className = 'timegem-ven-dialog';
        dialog.innerHTML =
            '<div class="timegem-ven-dialog-inner">' +
                '<button type="button" class="timegem-ven-dialog-close" aria-label="Sluiten">&times;</button>' +
                '<div class="timegem-ven-dialog-body"></div>' +
            '</div>';

        dialog.querySelector('.timegem-ven-dialog-close').addEventListener('click', closeDialog);

        // Clicking the backdrop (i.e. outside the inner box) closes the dialog.
        dialog.addEventListener('click', function (e) {
            if (e.target === dialog) closeDialog();
        });

        document.body.appendChild(dialog);
        return dialog;
    }

    function getDialog() {
        return document.getElementById(DIALOG_ID) || buildDialog();
    }

    function openDialog() {
        var dialog = getDialog();
        renderDialogBody(!!getTimegemId());
        if (dialog.open) return;
        if (typeof dialog.showModal === 'function') dialog.showModal(); // Escape closes it for free
        else dialog.setAttribute('open', '');
    }

    function closeDialog() {
        var dialog = document.getElementById(DIALOG_ID);
        if (!dialog) return;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    /**
     * Flags <html> when we know who the visitor is. A CSS rule keyed off that
     * attribute hides .cta-discover, which also covers CTAs rendered after this
     * runs — no element loop, nothing to re-run when the DOM changes.
     */
    function syncDiscoverCta() {
        var hasId = !!getTimegemId();
        if (hasId) document.documentElement.setAttribute(HAS_ID_ATTR, '');
        else document.documentElement.removeAttribute(HAS_ID_ATTR);
        return hasId;
    }

    /** True on the agenda listing and on any single /agenda/<slug> event page. */
    function isAgendaContext() {
        try {
            var path = window.location.pathname || '';
            return path === '/agenda' || path.indexOf(agendaPath) !== -1;
        } catch (e) {
            return false;
        }
    }

    /**
     * Renders our own block in the slot the theme gives .cta-discover. That CTA is
     * hidden once we know the visitor, so this takes its place rather than sitting
     * next to it. Placeholder copy for now.
     */
    function renderAgendaBlock(hasId) {
        if (!hasId || !isAgendaContext()) return;

        var anchors = document.querySelectorAll(DISCOVER_CTA_SELECTOR);
        Array.prototype.forEach.call(anchors, function (anchor) {
            var prev = anchor.previousElementSibling;
            if (prev && prev.classList.contains(BLOCK_CLASS)) return; // already rendered

            var block = document.createElement('section');
            block.className = BLOCK_CLASS;

            // On a single event we wait for the recommendation; on the listing there
            // is no single slug to match, so the per-event badges do the talking.
            var line = document.createElement('p');
            line.className = BLOCK_CLASS + '__text';
            line.textContent = getSlugFromCurrentPath()
                ? 'Checking your match\u2026'
                : 'Your matches are marked in the list below.';
            block.appendChild(line);

            anchor.parentNode.insertBefore(block, anchor);
        });
    }

    /**
     * Fills the agenda block with the result for the event being viewed.
     * `recommendation` is null when the event is absent from the payload, which
     * means the same thing as matchType 'none'.
     */
    var MATCH_ITEM_LIMIT = 6;

    /**
     * The "why" behind a match, following the timetable's split: genre matches
     * render as plain chips, artist matches as avatar + name.
     *
     * detailedMatches carries {name, spotify_id, rel_strength, image_url} for
     * related/direct matches and {name, type} for genre ones, so the presence of
     * `type` is what tells the two apart.
     */
    function buildMatchDetails(recommendation) {
        var detailed = (recommendation && recommendation.detailedMatches) || [];
        if (!detailed.length) return null;

        var isGenre = detailed.every(function (m) { return m && m.type; });

        var fragment = document.createDocumentFragment();

        var caption = document.createElement('p');
        caption.className = BLOCK_CLASS + '__caption';
        caption.textContent = isGenre ? 'Matching genres' : 'Because you listen to';
        fragment.appendChild(caption);

        var list = document.createElement('div');
        list.className = BLOCK_CLASS + '__matches ' + (isGenre ? 'is-genres' : 'is-artists');

        detailed.slice(0, MATCH_ITEM_LIMIT).forEach(function (match) {
            var item = document.createElement('span');
            item.className = BLOCK_CLASS + '__match';

            if (!isGenre && match.image_url) {
                var img = document.createElement('img');
                img.src = match.image_url;
                img.alt = '';
                img.loading = 'lazy';
                // A dead Spotify image should leave the name, not a broken icon.
                img.addEventListener('error', function () {
                    if (img.parentNode) img.parentNode.removeChild(img);
                });
                item.appendChild(img);
            }

            var label = document.createElement('span');
            label.textContent = match.name || ''; // API copy, never innerHTML
            item.appendChild(label);
            list.appendChild(item);
        });

        if (detailed.length > MATCH_ITEM_LIMIT) {
            var more = document.createElement('span');
            more.className = BLOCK_CLASS + '__match is-more';
            more.textContent = '+' + (detailed.length - MATCH_ITEM_LIMIT);
            list.appendChild(more);
        }

        fragment.appendChild(list);
        return fragment;
    }

    function updateAgendaBlock(recommendation, state) {
        var blocks = document.querySelectorAll('.' + BLOCK_CLASS);
        if (!blocks.length) return;

        var matchType = recommendation && recommendation.matchType
            ? String(recommendation.matchType).toLowerCase()
            : 'none';
        var headline = MATCH_COPY[matchType] || MATCH_COPY.none;
        var symbol = getMatchTypeSymbol(matchType);
        var details = (recommendation && recommendation.matchDetails) || [];

        if (state === 'unavailable') {
            headline = 'We could not check this one right now';
            matchType = 'unknown';
            symbol = '';
            details = [];
        }

        Array.prototype.forEach.call(blocks, function (block) {
            block.setAttribute('data-match', matchType);
            block.innerHTML = '';

            var line = document.createElement('p');
            line.className = BLOCK_CLASS + '__text';

            if (symbol) {
                var sym = document.createElement('span');
                sym.className = BLOCK_CLASS + '__symbol';
                sym.textContent = symbol;
                line.appendChild(sym);
            }
            line.appendChild(document.createTextNode(headline));
            block.appendChild(line);

            var matchDetailNodes = state === 'unavailable' ? null : buildMatchDetails(recommendation);

            if (matchDetailNodes) {
                // Keep the API's own wording as the tooltip.
                if (details.length) block.title = details.join(' \u00B7 ');
                block.appendChild(matchDetailNodes);
            } else if (details.length) {
                // No structured matches (older payloads): show the text reasons.
                var reasons = document.createElement('ul');
                reasons.className = BLOCK_CLASS + '__reasons';
                details.forEach(function (detail) {
                    var li = document.createElement('li');
                    li.textContent = detail; // API copy, never innerHTML
                    reasons.appendChild(li);
                });
                block.appendChild(reasons);
            }
        });
    }

    /**
     * Swaps the nav button's label once we know who the visitor is. The original
     * text is stashed on the element the first time, so this stays correct if it
     * ever runs twice or the visitor's id goes away mid-session.
     */
    function syncNavCtaLabel(hasId) {
        var ctas = document.querySelectorAll(NAV_CTA_SELECTOR);
        Array.prototype.forEach.call(ctas, function (cta) {
            var label = cta.querySelector('span') || cta;

            if (!cta.hasAttribute(ORIGINAL_LABEL_ATTR)) {
                cta.setAttribute(ORIGINAL_LABEL_ATTR, label.textContent.trim());
            }

            var next = hasId ? NAV_CTA_LABEL_LOGGED_IN : cta.getAttribute(ORIGINAL_LABEL_ATTR);
            if (label.textContent !== next) label.textContent = next;
        });
    }

    /**
     * Delegated, so it keeps working if the nav is re-rendered or loaded late.
     *
     * Bound on `window` in the CAPTURE phase, which is the first thing to see the
     * click — before any handler the theme bound on the button itself. That matters
     * because the CTA is <a class="button button-cta" href=""> and an empty href
     * resolves to the *current* URL, so a plain click reloads the page.
     *
     *   preventDefault()          — stops the anchor's own navigation
     *   stopImmediatePropagation() — stops the theme's click handlers from running,
     *                                in case one of them navigates via location.href
     *                                (preventDefault alone would not help there)
     */
    function bindGemsCta() {
        if (document.documentElement.hasAttribute('data-timegem-cta-bound')) return;
        document.documentElement.setAttribute('data-timegem-cta-bound', '');

        window.addEventListener('click', function (e) {
            var cta = e.target && e.target.closest ? e.target.closest(CTA_SELECTOR) : null;
            if (!cta) return;

            // The discover CTA is hidden once we have a timegem_id, but don't
            // hijack it if some other stylesheet puts it back on screen.
            if (!cta.matches(NAV_CTA_SELECTOR) && getTimegemId()) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            e.stopPropagation();

            openDialog();
        }, true);
    }

    /**
     * Empties .tease-icons inside every event block. Runs on every page, whether
     * or not we know the visitor. The element itself is kept so the theme's
     * layout and spacing are untouched — only its contents go.
     */
    function clearTeaseIcons(root) {
        var scope = root || document;
        var icons = scope.querySelectorAll('.wp_theatre_event .tease-icons');
        Array.prototype.forEach.call(icons, function (el) {
            if (el.childNodes.length) el.innerHTML = '';
        });
        return icons.length;
    }

    function run() {
        // Arriving with ?timegem_id= means the visitor just came back from the
        // connect portal with freshly imported tops \u2014 anything cached for them
        // is already out of date.
        var freshId = getTimegemIdFromUrl();
        if (freshId) cacheClear(CACHE_PREFIX + freshId);

        clearTeaseIcons();
        var hasId = syncDiscoverCta();
        syncNavCtaLabel(hasId);
        renderAgendaBlock(hasId);
        bindGemsCta();
        runTimegemFlow();
    }

    function injectStyles() {
        if (document.getElementById('timegem-ven-styles')) return;
        var style = document.createElement('style');
        style.id = 'timegem-ven-styles';
        style.textContent = '.wpt_listing .wp_theatre_event{position:relative;}.timegem-ven-match-details{position:absolute;top:16px;right:16px;background:#000;color:greenyellow;padding:4px 10px 9px 10px;border-radius:0;font-size:24px;line-height:1;}.timegem-ven-why{background:black;color:white;padding:10px 14px;margin-bottom:12px;}.timegem-ven-dialog{border:none;padding:0;background:transparent;max-width:520px;width:calc(100% - 32px);}.timegem-ven-dialog::backdrop{background:rgba(0,0,0,0.6);}.timegem-ven-dialog-inner{background:#000;color:#fff;padding:28px 28px 24px;position:relative;}.timegem-ven-dialog-inner h2{margin:0 0 12px;font-size:24px;line-height:1.1;color:greenyellow;}.timegem-ven-dialog-inner p{margin:0 0 8px;font-size:15px;line-height:1.5;}.timegem-ven-dialog-close{position:absolute;top:8px;right:10px;background:none;border:none;color:#fff;font-size:26px;line-height:1;cursor:pointer;padding:4px 8px;}.timegem-ven-dialog-close:hover{color:greenyellow;}.timegem-ven-dialog-inner a{color:greenyellow;}.timegem-ven-connect{display:inline-block;background:greenyellow;color:#000 !important;padding:14px 22px;margin:6px 0 16px;text-decoration:none;font-weight:800;text-transform:uppercase;letter-spacing:.02em;}.timegem-ven-connect:hover{background:#fff;}.timegem-ven-fineprint{font-size:12px;line-height:1.5;opacity:.7;margin:0;}.timegem-ven-dialog-body{max-height:70vh;overflow-y:auto;}.timegem-ven-profile-head{display:flex;align-items:center;gap:14px;margin-bottom:10px;}.timegem-ven-profile-head h2{margin:0;}.timegem-ven-avatar{width:56px;height:56px;border-radius:50%;object-fit:cover;flex:none;}.timegem-ven-genres{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:greenyellow;}.timegem-ven-subhead{margin:20px 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:greenyellow;}.timegem-ven-list{list-style:none;margin:0;padding:0;}.timegem-ven-list li{display:flex;align-items:center;gap:12px;padding:6px 0;}.timegem-ven-list img{width:40px;height:40px;object-fit:cover;flex:none;}.timegem-ven-list-primary{display:block;font-weight:700;font-size:14px;line-height:1.3;}.timegem-ven-list-secondary{display:block;font-size:12px;opacity:.65;line-height:1.3;}.cta-discover{cursor:pointer;}.timegem-ven-block{background:#000;color:#fff;padding:28px 32px;margin:24px 0;border-left:6px solid greenyellow;}.timegem-ven-block__text{margin:0;font-size:22px;line-height:1.15;font-weight:800;text-transform:uppercase;letter-spacing:.01em;}.timegem-ven-block__symbol{color:greenyellow;margin-right:12px;}.timegem-ven-block__reasons{margin:12px 0 0;padding:0 0 0 18px;font-size:14px;line-height:1.5;}.timegem-ven-block__reasons li{margin:2px 0;}.timegem-ven-block__caption{margin:16px 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.65;}.timegem-ven-block__matches{display:flex;flex-wrap:wrap;gap:8px;}.timegem-ven-block__match{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.12);padding:5px 14px 5px 5px;border-radius:999px;font-size:13px;font-weight:700;line-height:1.2;}.timegem-ven-block__matches.is-genres .timegem-ven-block__match{padding:6px 14px;text-transform:uppercase;letter-spacing:.04em;}.timegem-ven-block__match img{width:28px;height:28px;border-radius:50%;object-fit:cover;flex:none;display:block;}.timegem-ven-block__match.is-more{opacity:.6;padding:6px 14px;}html[data-timegem-has-id] .cta-discover{display:none !important;}';
        document.head.appendChild(style);
    }

    // Set the flag before waiting on the DOM: <html> already exists, so the hide
    // rule can apply the moment the stylesheet lands.
    syncDiscoverCta();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            injectStyles();
            run();
        });
    } else {
        injectStyles();
        run();
    }
})();
