
var TIMEGEM_API_BASE = 'https://api.timegem.nl';

(function () {
    'use strict';

    var agendaPath = '/agenda/';
    var TIMEGEM_USER_STORAGE_KEY = 'timegem_ven_id';
    var TIMEGEM_VENUE_STORAGE_KEY = 'timegem_ven_venue_id';
    /** Shimmer placeholders while recommendations / profile load. Off for now. */
    var SHOW_LOADING_STATES = false;

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
        if (typeof id === 'string' && id) return id;
        if (id && typeof id === 'object') {
            var fromObj = id.venue_id || id.venueId || id.id;
            if (typeof fromObj === 'string' && fromObj) return fromObj;
        }
        return null;
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
                if (id) {
                    try { localStorage.setItem(TIMEGEM_VENUE_STORAGE_KEY, id); } catch (e) {}
                    return id;
                }
            }
        } catch (e) {}
        try {
            return localStorage.getItem(TIMEGEM_VENUE_STORAGE_KEY) || null;
        } catch (e) {}
        return null;
    }

    /**
     * Per-venue feature flags. Missing keys default to on.
     * likes: like button, My likes page, and the no-match event block
     * (that block is only there so a visitor can still like the show).
     */
    var VENUE_OPTIONS = {
        'a70188ca-9d8f-442e-89fb-955f231c7a54': {
            likes: false
        }
    };

    function venueOption(name, fallback) {
        var id = getVenueIdFromQueue();
        var opts = id && VENUE_OPTIONS[id];
        if (!opts || !Object.prototype.hasOwnProperty.call(opts, name)) return fallback;
        return opts[name];
    }

    function likesEnabled() {
        return venueOption('likes', true) !== false;
    }

    function syncLikesFlag() {
        try {
            if (likesEnabled()) document.documentElement.removeAttribute('data-timegem-likes');
            else document.documentElement.setAttribute('data-timegem-likes', '0');
        } catch (e) {}
        hideDisabledLikesNav();
    }

    /** Theme / WP child-page links to My likes, plus a tab built before we knew the venue. */
    function hideDisabledLikesNav() {
        if (likesEnabled()) return;
        var nodes = document.querySelectorAll(
            '#timegem-ven-tab-likes, #timegem-ven-panel-likes, a[href*="/my-likes"]'
        );
        Array.prototype.forEach.call(nodes, function (el) {
            if (el.id === 'timegem-ven-panel-likes') {
                el.hidden = true;
                return;
            }
            el.style.display = 'none';
            el.setAttribute('hidden', '');
            var item = el.closest && (el.closest('li') || el.closest('.menu-item'));
            if (item && item !== el) {
                item.style.display = 'none';
                item.setAttribute('hidden', '');
            }
        });
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

    function isHomePage() {
        try {
            var path = (window.location.pathname || '').replace(/\/+$/, '');
            return path === '';
        } catch (e) {
            return false;
        }
    }

    /** WordPress page at /my-profile and its child slugs. */
    var PROFILE_PATH = '/my-profile';
    var PROFILE_MOUNT = '.article__content-block';

    function normalizePathname(pathname) {
        return (pathname || '').replace(/\/+$/, '') || '/';
    }

    function isProfilePage() {
        try {
            var path = normalizePathname(window.location.pathname);
            return path === PROFILE_PATH || path.indexOf(PROFILE_PATH + '/') === 0;
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

    function fetchVenueLikes(timegemId) {
        var url = TIMEGEM_API_BASE + '/api/venue-like/' + encodeURIComponent(timegemId);
        return fetch(url, { method: 'GET' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) { return data && Array.isArray(data.likes) ? data.likes : null; })
            .catch(function () { return null; });
    }

    function fetchEventLike(timegemId, eventId) {
        var url = TIMEGEM_API_BASE + '/api/venue-like/' + encodeURIComponent(timegemId) +
            '?event_id=' + encodeURIComponent(eventId);
        return fetch(url, { method: 'GET' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (data) { return !!(data && data.liked); })
            .catch(function () { return false; });
    }

    function saveEventLike(timegemId, eventId, liked) {
        var url = TIMEGEM_API_BASE + '/api/venue-like/' + encodeURIComponent(timegemId);
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: eventId, liked: !!liked })
        }).then(function (res) { return res.ok; }).catch(function () { return false; });
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

    // One bolt per level. Static markup, so insertAdjacentHTML is safe here.
    var MATCH_ICON_SVG =
        '<svg class="timegem-ven-icon" viewBox="0 0 373.36 767.12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
            '<polygon class="st0" points="115.63 11.26 14.93 374.46 137.83 375.06 39.03 706.06 351.13 269.36 213.93 267.76 354.93 11.26 115.63 11.26"/>' +
            '<path class="st1" d="M354.93,11.26H115.63L14.93,374.36l122.9.6-98.8,331,312.1-436.7-137.2-1.6L354.93,11.26h0Z"/>' +
        '</svg>';

    var MATCH_ICON_COUNT = { light: 1, medium: 2, heavy: 3 };

    /**
     * The strength indicator as elements rather than text. Returns null when
     * there is nothing to show. Build one per placement \u2014 a node cannot be
     * appended to two blocks at once.
     */
    function buildMatchSymbol(matchType) {
        var t = matchType ? String(matchType).toLowerCase() : '';
        if (!t || t === 'none') return null;

        var wrap = document.createElement('span');
        wrap.className = 'timegem-ven-symbols is-' + t;

        if (t === 'direct') {
            wrap.textContent = '\u2605'; // a direct hit stays a star, not a count of bolts
            return wrap;
        }

        var count = MATCH_ICON_COUNT[t] || 0;
        if (!count) return null;
        for (var i = 0; i < count; i++) wrap.insertAdjacentHTML('beforeend', MATCH_ICON_SVG);
        return wrap;
    }

    /**
     * The positioned ancestor a badge (real or skeleton) is pinned to.
     * .tease-agenda is the card wrapper in the current theme and is already
     * position:relative; .wp__theater is kept as a fallback for older markup.
     */
    function ensureBadgeContainer(block) {
        var container = block.querySelector('.tease-agenda') ||
                        block.querySelector('.wp__theater') ||
                        block;
        if (!container.style.position || container.style.position === 'static') {
            container.style.position = 'relative';
        }
        return container;
    }

    /**
     * A placeholder in each badge slot while the recommendations are in flight.
     * Only shown when we know the visitor \u2014 without a timegem_id no badge is
     * ever coming, so a skeleton would be a lie.
     */
    function renderBadgeSkeletons() {
        var blocks = document.querySelectorAll('.wp_theatre_event');
        Array.prototype.forEach.call(blocks, function (block) {
            var container = ensureBadgeContainer(block);
            if (container.querySelector('.' + SKELETON_BADGE_CLASS)) return;

            var ghost = document.createElement('div');
            ghost.className = 'timegem-ven-match-details ' + SKELETON_BADGE_CLASS + ' timegem-ven-skeleton';
            ghost.setAttribute('aria-hidden', 'true');
            container.appendChild(ghost);
        });
    }

    function clearBadgeSkeletons() {
        var ghosts = document.querySelectorAll('.' + SKELETON_BADGE_CLASS);
        Array.prototype.forEach.call(ghosts, function (g) {
            if (g.parentNode) g.parentNode.removeChild(g);
        });
    }

    function appendMatchDetails(block, recommendation) {
        var matchType = recommendation && recommendation.matchType;
        var symbol = buildMatchSymbol(matchType);
        if (!symbol) return;

        var container = ensureBadgeContainer(block);

        var div = document.createElement('div');
        div.className = 'timegem-ven-match-details';
        div.appendChild(symbol);
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
            clearBadgeSkeletons();

            var apiData = result && result.ok ? result.data : null;
            if (!apiData) {
                updateAgendaBlock(null, 'unavailable');
                renderHomeGemsMessage('We could not load your gems right now.');
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
            if (isHomePage() || isProfilePage()) renderHomeGems(bySlug);

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
        if (isProfilePage()) paintProfileLikes();
        return eventsBySlug;
    }

    function eventById(id) {
        if (!id) return null;
        var slugs = Object.keys(eventsBySlug);
        for (var i = 0; i < slugs.length; i++) {
            var ev = eventsBySlug[slugs[i]];
            if (ev && ev.id === id) return ev;
        }
        return null;
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

        syncLikesFlag();

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
    var NAV_CTA_LABEL_LOGGED_OUT = 'Ontdek jouw must-sees';
    var ORIGINAL_LABEL_ATTR = 'data-timegem-label';
    var ORIGINAL_HREF_ATTR = 'data-timegem-href';
    var BLOCK_CLASS = 'timegem-ven-block';
    var MATCH_COPY = {
        direct: 'This is one of your favorite artists',
        heavy: 'RECOMMENDED BASED ON RELATED ARTISTS',
        medium: 'RECOMMENDED BASED ON RELATED ARTISTS',
        light: 'RECOMMENDED BASED ON GENRE',
        none: 'This is not a match'
    };
    var CONNECT_PORTAL_URL = 'https://my.personaltimetable.com/';
    // dsp values the portal understands ('spotify' | 'apple'). A provider the
    // venue has not enabled in connect_providers lands on the normal picker.
    var CONNECT_PROVIDERS = [
        { dsp: 'spotify', label: 'Connect with Spotify' },
        { dsp: 'apple', label: 'Connect with Apple Music' }
    ];
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
    /**
     * @param {string} [dsp] 'spotify' | 'apple' — auto-starts that provider on
     *   arrival. The portal ignores a dsp the venue has not enabled in
     *   connect_providers, so it falls back to the normal picker.
     */
    function buildConnectUrl(dsp) {
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

        var url = CONNECT_PORTAL_URL +
            '?venue_id=' + encodeURIComponent(venueId) +
            '&venue_url=' + encodeURIComponent(returnUrl);

        if (dsp) url += '&dsp=' + encodeURIComponent(dsp);
        return url;
    }

    function appendItemText(parent, item) {
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

        parent.appendChild(text);
    }

    function appendItemImage(parent, item) {
        if (!item.image) return;
        var img = document.createElement('img');
        img.src = item.image;
        img.alt = '';
        img.loading = 'lazy';
        parent.appendChild(img);
    }

    /**
     * Artists or tracks. On the profile page the first three are large covers
     * and the rest stay in a list underneath.
     */
    function appendProfileSection(body, heading, items, featured) {
        if (!items.length) return;

        var subhead = document.createElement('h3');
        subhead.className = 'timegem-ven-subhead';
        subhead.textContent = heading;
        body.appendChild(subhead);

        var lead = featured ? items.slice(0, 3) : [];
        var rest = featured ? items.slice(3) : items;

        if (lead.length) {
            var row = document.createElement('div');
            row.className = 'timegem-ven-featured';
            lead.forEach(function (item, index) {
                var card = document.createElement('div');
                card.className = 'timegem-ven-featured__item';
                var rank = document.createElement('span');
                rank.className = 'timegem-ven-list-rank';
                rank.textContent = String(index + 1);
                card.appendChild(rank);
                appendItemImage(card, item);
                appendItemText(card, item);
                row.appendChild(card);
            });
            body.appendChild(row);
        }

        if (!rest.length) return;

        var list = document.createElement('ul');
        list.className = 'timegem-ven-list';

        rest.forEach(function (item, index) {
            var li = document.createElement('li');
            var media = document.createElement('span');
            media.className = 'timegem-ven-list-media';
            var rank = document.createElement('span');
            rank.className = 'timegem-ven-list-rank';
            rank.textContent = String(lead.length + index + 1);
            media.appendChild(rank);
            appendItemImage(media, item);
            li.appendChild(media);
            appendItemText(li, item);
            list.appendChild(li);
        });

        body.appendChild(list);
    }

    /**
     * Forgets the visitor on this device. Their Spotify data stays in
     * spotify_profiles_ven — reconnecting brings the same id back.
     *
     * Reloading afterwards is deliberate: badges, the gems block and the nav
     * label are all already rendered, and a reload resets every one of them
     * without us having to unpick each by hand.
     */
    function disconnectTimegem() {
        try { localStorage.removeItem(TIMEGEM_USER_STORAGE_KEY); } catch (e) {}
        cacheClear();

        try {
            var here = new URL(window.location.href);
            if (here.searchParams.has('timegem_id')) {
                // Otherwise the id in the URL is read straight back on reload.
                here.searchParams.delete('timegem_id');
                window.location.replace(here.toString());
                return;
            }
        } catch (e) {}

        window.location.reload();
    }

    /** textContent everywhere — artist and track names come from Spotify, not from us. */
    function renderProfile(body, data, options) {
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
        name.textContent = 'Jouw profiel';
        head.appendChild(name);
        body.appendChild(head);

        var genres = (data && data.topGenres) || [];
        var featured = !!(options && options.featured);
        if (genres.length && featured) {
            appendGenreCards(body, genres.slice(0, 6));
        } else if (genres.length) {
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
        }), featured);

        appendProfileSection(body, 'Top tracks', ((data && data.topTracks) || []).map(function (t) {
            return {
                image: t.album_image_url,
                primary: t.track_name,
                secondary: t.artist_name
            };
        }), featured);

        if (!options || options.disconnect !== false) appendDisconnect(body);
    }

    var GENRE_CARD_BG = 'https://staging.rotown.nl/wp-content/themes/rotown_2025/dist/bg_gradient_pink.29387821.png';

    function appendGenreCards(body, genres) {
        var subhead = document.createElement('h3');
        subhead.className = 'timegem-ven-subhead';
        subhead.textContent = 'Genres';
        body.appendChild(subhead);

        var row = document.createElement('div');
        row.className = 'timegem-ven-featured';

        genres.forEach(function (g) {
            var card = document.createElement('div');
            card.className = 'timegem-ven-genre-card';
            card.style.backgroundImage = 'url(' + GENRE_CARD_BG + ')';

            var title = document.createElement('span');
            title.textContent = g.genre || '';
            card.appendChild(title);
            row.appendChild(card);
        });

        body.appendChild(row);
    }

    function appendDisconnect(parent) {
        var footer = document.createElement('div');
        footer.className = 'timegem-ven-profile-foot';

        var disconnect = document.createElement('button');
        disconnect.type = 'button';
        disconnect.className = 'timegem-ven-disconnect';
        disconnect.textContent = DISCONNECT_LABEL;
        disconnect.addEventListener('click', disconnectTimegem);
        footer.appendChild(disconnect);

        parent.appendChild(footer);
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
            body.appendChild(title);

            if (SHOW_LOADING_STATES) {
                var ghostRows = document.createElement('ul');
                ghostRows.className = 'timegem-ven-list';
                for (var i = 0; i < 4; i++) {
                    var row = document.createElement('li');
                    var avatar = document.createElement('span');
                    avatar.className = 'timegem-ven-skeleton is-avatar';
                    avatar.setAttribute('aria-hidden', 'true');
                    row.appendChild(avatar);
                    row.appendChild(skeletonBar((55 + i * 8) + '%', '14px'));
                    ghostRows.appendChild(row);
                }
                body.appendChild(ghostRows);
            }

            // Kept so the failure path below has something to write into.
            intro.className = 'timegem-ven-fineprint';
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

        title.textContent = 'Ontdek jouw must-sees';
        body.appendChild(title);

        var hook = document.createElement('p');
        hook.className = 'timegem-ven-hook';
        hook.appendChild(document.createTextNode('Wil je nooit meer een tof concert missen dat'));
        hook.appendChild(document.createElement('br'));
        hook.appendChild(document.createTextNode('écht bij je past?'));
        body.appendChild(hook);

        intro.textContent = 'Koppel je Apple Music of Spotify aan de agenda van Rotown en ontdek een wereld vol persoonlijke concerttips. Op basis van jouw luistergedrag krijg je suggesties die perfect aansluiten bij jouw smaak, van je favoriete artiesten tot verborgen parels die je nog niet kende.';
        body.appendChild(intro);

        var privacy = document.createElement('p');
        privacy.textContent = 'En geen zorgen, jouw geheime meezingers blijven gewoon tussen jou en Apple Music/Spotify. We vragen Apple Music/Spotify alleen om een kijkje te nemen in je profiel, zodat we jouw muzieksmaak beter leren kennen. Zo kunnen we je nog beter matchen met concerten die écht bij je passen. Geen spam, geen gedoe met data delen, gewoon de perfecte concerttips voor jou.';
        body.appendChild(privacy);

        if (!buildConnectUrl()) {
            var fine = document.createElement('p');
            fine.className = 'timegem-ven-fineprint';
            fine.textContent = 'No venue is configured for this page, so connecting is unavailable.';
            body.appendChild(fine);
            return;
        }

        var choices = document.createElement('div');
        choices.className = 'timegem-ven-connect-choices';

        CONNECT_PROVIDERS.forEach(function (provider) {
            var link = document.createElement('a');
            link.className = 'timegem-ven-connect is-' + provider.dsp;
            link.href = buildConnectUrl(provider.dsp);
            link.textContent = provider.label;
            choices.appendChild(link);
        });

        body.appendChild(choices);
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

    /** A single shimmering placeholder bar. */
    function skeletonBar(width, height) {
        var bar = document.createElement('span');
        bar.className = 'timegem-ven-skeleton is-bar';
        bar.style.width = width;
        bar.style.height = height;
        bar.setAttribute('aria-hidden', 'true');
        return bar;
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

    function insertBlockBeforeDiscoverCta(fill) {
        var anchors = document.querySelectorAll(DISCOVER_CTA_SELECTOR);
        Array.prototype.forEach.call(anchors, function (anchor) {
            var prev = anchor.previousElementSibling;
            if (prev && prev.classList.contains(BLOCK_CLASS)) return;

            var block = document.createElement('section');
            block.className = BLOCK_CLASS;
            fill(block);
            anchor.parentNode.insertBefore(block, anchor);
        });
    }

    var GEMS_BODY_ATTR = 'data-timegem-gems';
    var HOME_GEMS_MONTHS = 12;
    var gemsRenderId = 0;
    var TICKETS_LABEL = 'Meer info';
    var DISCONNECT_LABEL = 'Disconnect';

    /** Month names follow the page's own language rather than the browser's. */
    function pageLocale() {
        try { return document.documentElement.lang || undefined; } catch (e) { return undefined; }
    }

    /**
     * Matched events still to come, oldest first.
     * The recommendation carries the match, eventsBySlug carries the date \u2014 the
     * join is why this needs no extra request.
     */
    function collectUpcomingGems(bySlug) {
        var startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        var gems = [];
        Object.keys(bySlug || {}).forEach(function (slug) {
            var rec = bySlug[slug];
            if (!rec || !rec.matchType || String(rec.matchType).toLowerCase() === 'none') return;

            var ev = eventsBySlug[slug];
            if (!ev || !ev.event_date) return; // nothing to group it under

            var date = new Date(ev.event_date);
            if (isNaN(date.getTime()) || date < startOfToday) return;

            gems.push({ slug: slug, rec: rec, event: ev, date: date });
        });

        gems.sort(function (a, b) { return a.date - b.date; });
        return gems;
    }

    function groupGemsByMonth(gems) {
        var months = [];
        var seen = {};
        gems.forEach(function (gem) {
            var key = gem.date.getFullYear() + '-' + gem.date.getMonth();
            if (!seen[key]) {
                seen[key] = { date: gem.date, gems: [] };
                months.push(seen[key]);
            }
            seen[key].gems.push(gem);
        });
        return months;
    }

    function homeGemsBody() {
        return document.querySelector('[' + GEMS_BODY_ATTR + ']');
    }

    function renderHomeGemsMessage(text) {
        var body = homeGemsBody();
        if (!body) return;
        body.innerHTML = '';
        var line = document.createElement('p');
        line.className = BLOCK_CLASS + '__empty';
        line.textContent = text;
        body.appendChild(line);
    }

    function buildGemList(month, locale) {
        var list = document.createElement('ul');
        list.className = 'timegem-ven-month__list';

        month.gems.forEach(function (gem) {
            var item = document.createElement('li');
            item.className = 'timegem-ven-gem';
            item.setAttribute('data-match', String(gem.rec.matchType).toLowerCase());

            var day = document.createElement('span');
            day.className = 'timegem-ven-gem__date';
            day.textContent = gem.date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
            item.appendChild(day);

            var symbol = buildMatchSymbol(gem.rec.matchType);
            if (symbol) item.appendChild(symbol);

            var eventUrl = agendaPath + gem.slug + '/';

            var link = document.createElement('a');
            link.className = 'timegem-ven-gem__name';
            link.href = eventUrl;
            link.textContent = gem.event.event_name || gem.slug; // API copy, never innerHTML
            item.appendChild(link);

            var tickets = document.createElement('a');
            tickets.className = 'timegem-ven-gem__tickets';
            tickets.href = eventUrl;
            tickets.textContent = TICKETS_LABEL;
            item.appendChild(tickets);

            list.appendChild(item);
        });

        return list;
    }

    /**
     * Short tab label. The year is only added when the month falls outside the
     * current one, so "jan '27" cannot be mistaken for this January.
     */
    function monthTabLabel(date, locale) {
        var label = date.toLocaleDateString(locale, { month: 'short' }).replace(/\.$/, '');
        var thisYear = new Date().getFullYear();
        if (date.getFullYear() !== thisYear) {
            label += " '" + String(date.getFullYear()).slice(-2);
        }
        return label;
    }

    /** Fills the home block with the visitor's upcoming matches, by month. */
    function renderHomeGems(bySlug) {
        var body = homeGemsBody();
        if (!body) return;

        var months = groupGemsByMonth(collectUpcomingGems(bySlug));
        if (!months.length) {
            renderHomeGemsMessage('No matches coming up yet \u2014 check back when new shows go on sale.');
            return;
        }

        body.innerHTML = '';
        var locale = pageLocale();
        var shown = months.slice(0, HOME_GEMS_MONTHS);

        var tablist = document.createElement('div');
        tablist.className = 'timegem-ven-tabs';
        tablist.setAttribute('role', 'tablist');
        tablist.setAttribute('aria-label', 'Months with matches');

        var panelWrap = document.createElement('div');
        panelWrap.className = 'timegem-ven-panels';

        var tabs = [];
        var panels = [];
        // Unique per render so repeated renders cannot collide on ids.
        var uid = 'timegem-ven-m' + (++gemsRenderId) + '-';

        function selectMonth(index) {
            tabs.forEach(function (tab, i) {
                var active = i === index;
                tab.classList.toggle('is-active', active);
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
                tab.tabIndex = active ? 0 : -1;  // one stop for the whole tablist
                panels[i].hidden = !active;
            });
        }

        shown.forEach(function (month, i) {
            var id = uid + i;

            var tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'timegem-ven-tab';
            tab.id = id + '-tab';
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', id);

            var label = document.createElement('span');
            label.textContent = monthTabLabel(month.date, locale);
            tab.appendChild(label);

            var count = document.createElement('span');
            count.className = 'timegem-ven-tab__count';
            count.textContent = month.gems.length;
            tab.appendChild(count);

            tab.addEventListener('click', function () { selectMonth(i); });
            tab.addEventListener('keydown', function (e) {
                var next = null;
                if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
                else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
                else if (e.key === 'Home') next = 0;
                else if (e.key === 'End') next = tabs.length - 1;
                if (next === null) return;
                e.preventDefault();
                selectMonth(next);
                tabs[next].focus();
            });

            var panel = document.createElement('div');
            panel.className = 'timegem-ven-panel';
            panel.id = id;
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', id + '-tab');

            var name = document.createElement('h4');
            name.className = 'timegem-ven-month__name';
            name.textContent = month.date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
            //panel.appendChild(name);
            panel.appendChild(buildGemList(month, locale));

            tabs.push(tab);
            panels.push(panel);
            tablist.appendChild(tab);
            panelWrap.appendChild(panel);
        });

        body.appendChild(tablist);
        body.appendChild(panelWrap);
        selectMonth(0); // nearest month first

        var rest = months.length - shown.length;
        if (rest > 0) {
            var more = document.createElement('p');
            more.className = BLOCK_CLASS + '__caption';
            more.textContent = '+' + rest + ' more month' + (rest === 1 ? '' : 's') + ' with matches';
            body.appendChild(more);
        }
    }

    /** Home only: takes the place of the hidden .cta-discover. */
    function renderHomeGemsBlock(hasId) {
        if (!hasId || !isHomePage()) return;

        insertBlockBeforeDiscoverCta(function (block) {
            var title = document.createElement('h3');
            title.className = BLOCK_CLASS + '__text';
            title.textContent = 'Dit zijn jouw must-sees voor de komende periode';
            block.appendChild(title);

            var body = document.createElement('div');
            body.className = BLOCK_CLASS + '__body';
            body.setAttribute(GEMS_BODY_ATTR, '');
            block.appendChild(body);
        });
    }

    /**
     * Agenda only: our own block in the slot the theme gives .cta-discover.
     * That CTA is hidden once we know the visitor, so this takes its place.
     */
    function renderAgendaBlock(hasId) {
        if (!hasId || !isAgendaContext()) return;

        insertBlockBeforeDiscoverCta(function (block) {
            // On a single event we wait for the recommendation; on the listing
            // there is no single slug to match, so the per-event badges do the talking.
            if (getSlugFromCurrentPath()) {
                if (SHOW_LOADING_STATES) {
                    block.setAttribute('data-match', 'loading');
                    var ghostLine = document.createElement('p');
                    ghostLine.className = BLOCK_CLASS + '__text';
                    ghostLine.appendChild(skeletonBar('60%', '22px'));
                    block.appendChild(ghostLine);

                    var ghostCaption = document.createElement('p');
                    ghostCaption.className = BLOCK_CLASS + '__caption';
                    ghostCaption.appendChild(skeletonBar('30%', '12px'));
                    block.appendChild(ghostCaption);

                    var ghostChips = document.createElement('div');
                    ghostChips.className = BLOCK_CLASS + '__matches is-artists';
                    ['92px', '118px', '76px'].forEach(function (w) {
                        var chip = document.createElement('span');
                        chip.className = BLOCK_CLASS + '__match timegem-ven-skeleton is-chip';
                        chip.style.width = w;
                        chip.setAttribute('aria-hidden', 'true');
                        ghostChips.appendChild(chip);
                    });
                    block.appendChild(ghostChips);
                } else {
                    block.hidden = true;
                }
            } else {
                var line = document.createElement('p');
                line.className = BLOCK_CLASS + '__text';
                line.textContent = 'Your matches are marked in the list below.';
                block.appendChild(line);
            }
        });
    }

    /**
     * Fills the agenda block with the result for the event being viewed.
     * `recommendation` is null when the event is absent from the payload, which
     * means the same thing as matchType 'none'.
     */
    var MATCH_ITEM_LIMIT = 6;
    var SKELETON_BADGE_CLASS = 'timegem-ven-badge-loading';
    /** Never leave a skeleton up forever if a request hangs. */
    var SKELETON_TIMEOUT_MS = 12000;

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
        //fragment.appendChild(caption);

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
        var showSymbol = state !== 'unavailable';
        var details = (recommendation && recommendation.matchDetails) || [];

        if (state === 'unavailable') {
            headline = 'We could not check this one right now';
            matchType = 'unknown';
            details = [];
        }

        // Nothing matched: on a single event the visitor can still like it.
        // The listing has no one event, so that block stays hidden. Same when
        // likes are off for this venue — an empty block would have no purpose.
        if (state !== 'unavailable' && matchType === 'none') {
            Array.prototype.forEach.call(blocks, function (block) {
                if (!getSlugFromCurrentPath() || !likesEnabled()) {
                    block.hidden = true;
                    block.innerHTML = '';
                    return;
                }
                block.hidden = false;
                block.removeAttribute('data-match');
                block.innerHTML = '';
                mountLikeControl(block);
            });
            return;
        }

        Array.prototype.forEach.call(blocks, function (block) {
            block.hidden = false;
            block.setAttribute('data-match', matchType);
            block.innerHTML = '';

            var line = document.createElement('h3');
            line.className = BLOCK_CLASS + '__text';
            line.appendChild(document.createTextNode(headline));
            block.appendChild(line);

            // Built per block: one node cannot live in two places.
            var sym = showSymbol ? buildMatchSymbol(matchType) : null;
            if (sym) {
                sym.className += ' ' + BLOCK_CLASS + '__symbol';
                block.appendChild(sym);
            }

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

            mountLikeControl(block);
        });
    }

    /** Like / unlike on a single event page. No-op without a connected visitor or event id. */
    function mountLikeControl(block) {
        if (!likesEnabled()) return;
        var timegemId = getTimegemId();
        var slug = getSlugFromCurrentPath();
        var eventRow = slug && eventsBySlug[slug];
        var eventId = eventRow && eventRow.id;
        if (!timegemId || !eventId || !block) return;
        if (block.querySelector('.' + BLOCK_CLASS + '__like')) return;

        var wrap = document.createElement('div');
        wrap.className = BLOCK_CLASS + '__like';

        var button = document.createElement('button');
        button.type = 'button';
        button.className = BLOCK_CLASS + '__like-btn';

        function paint(liked) {
            button.classList.toggle('is-liked', !!liked);
            button.setAttribute('aria-pressed', liked ? 'true' : 'false');
            button.textContent = liked ? 'Liked' : 'Like';
        }

        paint(false);
        button.addEventListener('click', function () {
            var next = button.getAttribute('aria-pressed') !== 'true';
            paint(next);
            button.disabled = true;
            saveEventLike(timegemId, eventId, next).then(function (ok) {
                button.disabled = false;
                if (!ok) paint(!next);
            });
        });

        wrap.appendChild(button);
        block.appendChild(wrap);

        fetchEventLike(timegemId, eventId).then(function (liked) {
            if (button.isConnected) paint(liked);
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

            var next = hasId ? NAV_CTA_LABEL_LOGGED_IN : NAV_CTA_LABEL_LOGGED_OUT;
            if (label.textContent !== next) label.textContent = next;

            if (cta.tagName === 'A') {
                if (!cta.hasAttribute(ORIGINAL_HREF_ATTR)) {
                    cta.setAttribute(ORIGINAL_HREF_ATTR, cta.getAttribute('href') || '');
                }
                cta.setAttribute('href', hasId ? PROFILE_PATH : cta.getAttribute(ORIGINAL_HREF_ATTR));
            }
        });
    }

    var PROFILE_PAGE_ID = 'timegem-ven-profile-page';

    function profileIdentity() {
        var page = document.getElementById(PROFILE_PAGE_ID);
        return page && page.querySelector('[data-timegem-profile]');
    }

    var PROFILE_NAV = [
        { id: 'recommendations', label: 'My recommendations', slug: 'my-recommendations' },
        { id: 'settings', label: 'My settings', slug: 'my-settings' },
        { id: 'about', label: 'About', slug: 'about', aliases: ['my-about'] }
    ];

    function profileNavSlugMatches(item, slug) {
        if (!item || !slug) return false;
        if (item.slug === slug) return true;
        var aliases = item.aliases || [];
        for (var i = 0; i < aliases.length; i++) {
            if (aliases[i] === slug) return true;
        }
        return false;
    }

    function profileNavItems() {
        return PROFILE_NAV.filter(function (item) {
            return item.id !== 'likes' || likesEnabled();
        });
    }

    function profilePanelPath(id) {
        var slug = '';
        for (var i = 0; i < PROFILE_NAV.length; i++) {
            if (PROFILE_NAV[i].id === id) {
                slug = PROFILE_NAV[i].slug || '';
                break;
            }
        }
        return slug ? PROFILE_PATH + '/' + slug + '/' : PROFILE_PATH + '/';
    }

    function appendConnectChoices(slot) {
        if (!buildConnectUrl()) {
            var missing = document.createElement('p');
            missing.className = 'timegem-ven-fineprint';
            missing.textContent = 'No venue is configured for this page, so connecting is unavailable.';
            slot.appendChild(missing);
            return;
        }

        var choices = document.createElement('div');
        choices.className = 'timegem-ven-connect-choices';
        CONNECT_PROVIDERS.forEach(function (provider) {
            var link = document.createElement('a');
            link.className = 'timegem-ven-connect is-' + provider.dsp;
            link.href = buildConnectUrl(provider.dsp);
            link.textContent = provider.label;
            choices.appendChild(link);
        });
        slot.appendChild(choices);
    }

    function renderProfileAbout(slot) {
        var title = document.createElement('h2');
        title.textContent = 'About';
        slot.appendChild(title);

        var intro = document.createElement('p');
        intro.textContent = 'The lightning bolts tell you how good a match is. More bolts means the show fits your taste better. A star is a direct match: one of your favorite artists.';
        slot.appendChild(intro);

        var list = document.createElement('ul');
        list.className = 'timegem-ven-about-legend';

        [
            { type: 'light', text: 'One bolt — a lighter match.' },
            { type: 'medium', text: 'Two bolts — a stronger match.' },
            { type: 'heavy', text: 'Three bolts — the strongest match.' },
            { type: 'direct', text: 'A star — a direct match.' }
        ].forEach(function (row) {
            var item = document.createElement('li');
            var symbol = buildMatchSymbol(row.type);
            if (symbol) item.appendChild(symbol);
            var label = document.createElement('span');
            label.textContent = row.text;
            item.appendChild(label);
            list.appendChild(item);
        });

        slot.appendChild(list);
    }

    function renderProfileSettings(slot, hasId) {
        var title = document.createElement('h2');
        title.textContent = 'My settings';
        slot.appendChild(title);

        var intro = document.createElement('p');
        if (!hasId) {
            intro.textContent = 'Connect a music account to see your profile and recommendations on this device.';
            slot.appendChild(intro);
            appendConnectChoices(slot);
            return;
        }

        intro.textContent = 'Your music account is connected on this device. Disconnect to stop recommendations here. Reconnecting brings the same profile back.';
        slot.appendChild(intro);
        appendDisconnect(slot);
    }

    var profileLikesView = { body: null, likes: null, failed: false };

    function paintProfileLikes() {
        var body = profileLikesView.body;
        var likes = profileLikesView.likes;
        if (!body || !body.isConnected || !likes) return;

        body.innerHTML = '';

        function message(text) {
            var line = document.createElement('p');
            line.textContent = text;
            body.appendChild(line);
        }

        if (profileLikesView.failed) {
            message("We couldn't load your likes right now.");
            return;
        }
        if (!likes.length) {
            message('You have not liked a show yet.');
            return;
        }

        var list = document.createElement('ul');
        list.className = 'timegem-ven-month__list';
        var locale = pageLocale();

        likes.forEach(function (like) {
            var ev = eventById(like.event_id);
            var name = (ev && ev.event_name) || like.event_name || '';
            var slug = (ev && ev.event_slug) || like.event_slug || '';
            var dateValue = (ev && ev.event_date) || like.event_date || null;
            if (!name && !slug) return;

            var item = document.createElement('li');
            item.className = 'timegem-ven-gem';

            var when = dateValue ? new Date(dateValue) : null;
            if (when && !isNaN(when.getTime())) {
                var day = document.createElement('span');
                day.className = 'timegem-ven-gem__date';
                day.textContent = when.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
                item.appendChild(day);
            }

            var link = document.createElement('a');
            link.className = 'timegem-ven-gem__name';
            link.href = slug ? agendaPath + slug + '/' : '/agenda/';
            link.textContent = name || slug;
            item.appendChild(link);

            var unlike = document.createElement('button');
            unlike.type = 'button';
            unlike.className = 'timegem-ven-gem__unlike';
            unlike.textContent = 'Unlike';
            unlike.addEventListener('click', function () {
                var timegemId = getTimegemId();
                if (!timegemId || !like.event_id) return;
                unlike.disabled = true;
                saveEventLike(timegemId, like.event_id, false).then(function (ok) {
                    unlike.disabled = false;
                    if (!ok) return;
                    profileLikesView.likes = (profileLikesView.likes || []).filter(function (row) {
                        return row.event_id !== like.event_id;
                    });
                    paintProfileLikes();
                });
            });
            item.appendChild(unlike);

            list.appendChild(item);
        });

        if (!list.childNodes.length) {
            message('Loading your likes…');
            return;
        }
        body.appendChild(list);
    }

    function renderProfileLikes(slot, hasId) {
        var title = document.createElement('h2');
        title.textContent = 'My likes';
        slot.appendChild(title);

        var body = document.createElement('div');
        slot.appendChild(body);
        profileLikesView.body = body;

        if (!hasId) {
            var signedOut = document.createElement('p');
            signedOut.textContent = 'Connect your music account under My settings to save likes.';
            body.appendChild(signedOut);
            return;
        }

        var loading = document.createElement('p');
        loading.textContent = 'Loading your likes…';
        body.appendChild(loading);

        fetchVenueLikes(getTimegemId()).then(function (likes) {
            if (!body.isConnected) return;
            profileLikesView.failed = !likes;
            profileLikesView.likes = likes || [];
            paintProfileLikes();
        });
    }

    function profilePanelFromPath() {
        var path = '/';
        var hash = '';
        var items = profileNavItems();
        try {
            path = normalizePathname(window.location.pathname);
            hash = (window.location.hash || '').replace(/^#/, '');
        } catch (e) {}

        // /my-profile and /my-profile/my-recommendations both open recommendations.
        if (path === PROFILE_PATH) return 'recommendations';

        if (path.indexOf(PROFILE_PATH + '/') === 0) {
            var slug = path.slice(PROFILE_PATH.length + 1).split('/')[0] || '';
            if (!slug || slug === 'my-recommendations') return 'recommendations';
            for (var i = 0; i < items.length; i++) {
                if (profileNavSlugMatches(items[i], slug)) return items[i].id;
            }
        }

        for (var j = 0; j < items.length; j++) {
            if (items[j].id === hash) return hash;
        }

        return 'recommendations';
    }

    function getProfileMount() {
        return document.querySelector('article ' + PROFILE_MOUNT)
            || document.querySelector(PROFILE_MOUNT);
    }

    function renderProfilePageWhenReady(hasId, attempt) {
        attempt = attempt || 0;
        if (getVenueIdFromQueue() || attempt >= 20) {
            renderProfilePage(hasId);
            syncLikesFlag();
            return;
        }
        setTimeout(function () { renderProfilePageWhenReady(hasId, attempt + 1); }, 50);
    }

    /**
     * Fills the WordPress article on /my-profile and its child slugs. A side
     * menu switches between recommendations, profile, and settings.
     */
    function renderProfilePage(hasId) {
        var mount = getProfileMount();
        if (!isProfilePage() || !mount || document.getElementById(PROFILE_PAGE_ID)) return;

        var page = document.createElement('div');
        page.id = PROFILE_PAGE_ID;
        page.className = 'timegem-ven-profile-page';

        var frame = document.createElement('div');
        frame.className = 'timegem-ven-profile-page__frame';

        var side = document.createElement('aside');
        side.className = 'timegem-ven-profile-page__side';

        var nav = document.createElement('div');
        nav.className = 'timegem-ven-profile-nav';
        nav.setAttribute('role', 'tablist');
        nav.setAttribute('aria-label', 'My profile');
        side.appendChild(nav);

        var main = document.createElement('div');
        main.className = 'timegem-ven-profile-page__main';

        var panels = {};
        var tabs = [];
        var navItems = profileNavItems();

        navItems.forEach(function (item) {
            var panel = document.createElement('section');
            panel.className = 'timegem-ven-profile-page__panel';
            panel.id = 'timegem-ven-panel-' + item.id;
            panel.setAttribute('data-panel', item.id);
            panel.setAttribute('role', 'tabpanel');
            panel.classList.add('timegem-ven-profile-page__gems');
            if (item.id === 'profile') {
                panel.classList.add('timegem-ven-profile-page__identity');
                panel.setAttribute('data-timegem-profile', '');
            }
            main.appendChild(panel);
            panels[item.id] = panel;

            var tab = document.createElement('a');
            tab.href = profilePanelPath(item.id);
            tab.className = 'timegem-ven-profile-nav__tab';
            tab.id = 'timegem-ven-tab-' + item.id;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', panel.id);
            tab.textContent = item.label;
            panel.setAttribute('aria-labelledby', tab.id);
            nav.appendChild(tab);
            tabs.push(tab);
        });

        function selectPanel(id) {
            if (!panels[id]) id = (navItems[0] && navItems[0].id) || 'recommendations';
            navItems.forEach(function (item, i) {
                var active = item.id === id;
                tabs[i].classList.toggle('is-active', active);
                tabs[i].setAttribute('aria-selected', active ? 'true' : 'false');
                tabs[i].tabIndex = active ? 0 : -1;
                panels[item.id].hidden = !active;
            });
            try {
                var next = profilePanelPath(id);
                var here = normalizePathname(window.location.pathname);
                var want = normalizePathname(next);
                var hereSlug = here.indexOf(PROFILE_PATH + '/') === 0
                    ? here.slice(PROFILE_PATH.length + 1).split('/')[0] || ''
                    : '';
                var item = null;
                for (var n = 0; n < navItems.length; n++) {
                    if (navItems[n].id === id) { item = navItems[n]; break; }
                }
                // Leave the current child slug if it already belongs to this panel.
                if (id === 'recommendations' && here === PROFILE_PATH) {
                    if (window.location.hash) history.replaceState(null, '', PROFILE_PATH + '/');
                } else if (item && profileNavSlugMatches(item, hereSlug)) {
                    if (window.location.hash) history.replaceState(null, '', here + '/');
                } else if (here !== want || window.location.hash) {
                    history.replaceState(null, '', next);
                }
            } catch (e) {}
        }

        tabs.forEach(function (tab, i) {
            tab.addEventListener('click', function (e) {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
                e.preventDefault();
                selectPanel(navItems[i].id);
            });
            tab.addEventListener('keydown', function (e) {
                var next = null;
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % tabs.length;
                else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
                else if (e.key === 'Home') next = 0;
                else if (e.key === 'End') next = tabs.length - 1;
                if (next === null) return;
                e.preventDefault();
                selectPanel(navItems[next].id);
                tabs[next].focus();
            });
        });

        var gemsTitle = document.createElement('h2');
        gemsTitle.textContent = 'My recommendations';
        panels.recommendations.appendChild(gemsTitle);
        var gemsBody = document.createElement('div');
        gemsBody.className = 'timegem-ven-profile-page__gems-body';
        gemsBody.setAttribute(GEMS_BODY_ATTR, '');
        panels.recommendations.appendChild(gemsBody);

        renderProfileSettings(panels.settings, hasId);
        if (panels.likes) renderProfileLikes(panels.likes, hasId);
        renderProfileAbout(panels.about);

        //frame.appendChild(side);
        //frame.appendChild(main);
        page.appendChild(main);
        mount.innerHTML = '';
        mount.appendChild(page);
        selectPanel(profilePanelFromPath());

        window.addEventListener('popstate', function () {
            if (!isProfilePage() || !document.getElementById(PROFILE_PAGE_ID)) return;
            selectPanel(profilePanelFromPath());
        });

        if (!hasId) {
            if (panels.profile) {
                var signedOut = document.createElement('p');
                signedOut.textContent = 'Connect your music account under My settings to see your top artists and tracks.';
                panels.profile.appendChild(signedOut);
            }
            renderHomeGemsMessage('Connect to see which shows match your taste this month.');
            return;
        }

        if (panels.profile) {
            var loading = document.createElement('p');
            loading.className = 'timegem-ven-fineprint';
            loading.textContent = 'Loading your profile…';
            panels.profile.appendChild(loading);
        }
        renderHomeGemsMessage('Loading your gems…');

        var timegemId = getTimegemId();
        var cached = profileCache[timegemId];
        if (cached) {
            if (panels.profile) renderProfile(panels.profile, cached, { disconnect: false, featured: true });
            return;
        }

        fetchVenueProfile(timegemId, getVenueIdFromQueue()).then(function (data) {
            var slot = profileIdentity();
            if (!slot) return;
            if (!data || !data.profile) {
                slot.innerHTML = '';
                var fail = document.createElement('p');
                fail.textContent = "We couldn't load your profile right now. Please try again later.";
                slot.appendChild(fail);
                return;
            }
            profileCache[timegemId] = data;
            renderProfile(slot, data, { disconnect: false, featured: true });
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

            // Logged in, "Your profile" is a real link to /my-profile.
            if (cta.matches(NAV_CTA_SELECTOR) && getTimegemId()) return;

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
        syncLikesFlag();
        if (isProfilePage()) renderProfilePageWhenReady(hasId);
        else {
            renderHomeGemsBlock(hasId);
            renderAgendaBlock(hasId);
        }
        bindGemsCta();

        if (hasId && SHOW_LOADING_STATES) {
            renderBadgeSkeletons();
            // If the venue or recommendations request never resolves, the
            // placeholders still go away rather than pulsing forever.
            setTimeout(clearBadgeSkeletons, SKELETON_TIMEOUT_MS);
        }

        runTimegemFlow();
    }

    function injectStyles() {
        if (document.getElementById('timegem-ven-styles')) return;
        var style = document.createElement('style');
        style.id = 'timegem-ven-styles';
        style.textContent = `
            .wpt_listing .wp_theatre_event {
                position: relative;
            }
            .timegem-ven-match-details {
                position: absolute;
                top: 0px;
                right: 16px;
                background: #000;
                color: #e5fa4d;
                padding: 12px 12px 0px 12px;
                border-radius: 0;
                font-size: 24px;
                line-height: 1;
                display: inline-flex;
                align-items: center;
                z-index: 2;
                pointer-events: none;
            }

            .timegem-ven-match-details:after {
        content: "";
    clip-path: polygon(50% 100%, 0 0, 100% 0);
    background-color:black;
    width: 100%;
    height: 24px;
    transition: none;
    position: absolute;
    bottom: calc(.5px - 24px);
    left: 0;
}

            .timegem-ven-symbols {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                line-height: 1;
            }
            .timegem-ven-about-legend {
                list-style: none;
                margin: 16px 0 0;
                padding: 0;
            }
            .timegem-ven-about-legend li {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 8px 0;
            }
            .timegem-ven-about-legend .timegem-ven-symbols {
                min-width: 4.2em;
                color: greenyellow;
                font-size: 18px;
            }

            .wp_theatre_event:hover .timegem-ven-match-details {
                background:red;
            }

            .wp_theatre_event:hover .timegem-ven-match-details:after {
                background-color:red;
            }

            .timegem-ven-icon {
                width: .62em;
                height: 1.28em;
                display: block;
                flex: none;
            }
            .timegem-ven-icon .st0,
            .timegem-ven-icon .st1 {
                fill: currentColor;
            }
            .timegem-ven-why {
                background: black;
                color: white;
                padding: 10px 14px;
                margin-bottom: 12px;
            }
            .timegem-ven-dialog {
                border: none;
                padding: 0;
                background: transparent;
                max-width: 520px;
                width: calc(100% - 32px);
            }
            .timegem-ven-dialog::backdrop {
                background: rgba(0, 0, 0, 0.6);
            }
            .timegem-ven-dialog-inner {
                background: #000;
                color: #fff;
                padding: 28px 28px 24px;
                position: relative;
            }
            .timegem-ven-dialog-inner h2 {
                margin: 0 0 12px;
                
                color: greenyellow;
            }
            .timegem-ven-hook {
                margin: 0 0 14px;
                font-size: 17px;
                font-weight: 800;
                line-height: 1.3;
                text-transform: uppercase;
                letter-spacing: .02em;
            }
            .timegem-ven-dialog-inner p {
                margin: 0 0 12px;
                font-size: 15px;
                line-height: 1.5;
            }
            .timegem-ven-dialog-close {
                position: absolute;
                top: 8px;
                right: 10px;
                background: none;
                border: none;
                color: #fff;
                font-size: 26px;
                line-height: 1;
                cursor: pointer;
                padding: 4px 8px;
            }
            .timegem-ven-dialog-close:hover {
                color: greenyellow;
            }
            .timegem-ven-dialog-inner a {
                color: greenyellow;
            }
            .timegem-ven-connect {
                display: inline-block;
                background: greenyellow;
                color: #000 !important;
                padding: 14px 22px;
                margin: 6px 0 16px;
                text-decoration: none;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: .02em;
            }
            .timegem-ven-connect-choices {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin: 6px 0 16px;
            }
            .timegem-ven-connect-choices .timegem-ven-connect {
                margin: 0;
            }
            .timegem-ven-connect.is-apple {
                background: #fff;
            }
            .timegem-ven-connect:hover {
                background: #fff;
            }
            .timegem-ven-fineprint {
                font-size: 12px;
                line-height: 1.5;
                opacity: .7;
                margin: 0;
            }
            .timegem-ven-dialog-body {
                max-height: 70vh;
                overflow-y: auto;
            }
            .timegem-ven-profile-head {
                display: flex;
                align-items: center;
                gap: 14px;
                margin-bottom: 10px;
            }
            .timegem-ven-profile-head h2 {
                margin: 0;
            }
            .timegem-ven-avatar {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                object-fit: cover;
                flex: none;
            }
            .timegem-ven-genres {
                margin: 0 0 8px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: .06em;
                color: greenyellow;
            }
            .timegem-ven-subhead {
                margin: 48px 0 8px;
                font-size: 20px;
                text-transform: uppercase;
            }
            .timegem-ven-subhead:first-of-type {
                margin-top: 20px;
            }
            .timegem-ven-list {
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .timegem-ven-list li {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 6px 0;
            }
            .timegem-ven-list-media {
                position: relative;
                flex: none;
                width: 40px;
                height: 40px;
            }
            .timegem-ven-list-media img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .timegem-ven-list-media .timegem-ven-list-rank {
                position: absolute;
                top: 0;
                left: 0;
                z-index: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                aspect-ratio: 1;
                margin: 0;
                background: #e5fa4d;
                color: #111;
                font-size: 11px;
                font-weight: 800;
                line-height: 1;
                opacity: 1;
            }
            .timegem-ven-list img {
                width: 40px;
                height: 40px;
                object-fit: cover;
                flex: none;
            }
            .timegem-ven-list-primary {
                display: block;
                font-weight: 700;
                font-size: 14px;
                line-height: 1.3;
            }
            .timegem-ven-profile-foot {
                margin-top: 22px;
                padding-top: 16px;
                border-top: 1px solid rgba(255, 255, 255, .15);
            }
            .timegem-ven-disconnect {
                -webkit-appearance: none;
                appearance: none;
                background: red;
                color: black;
                font: ;
                font-size: 24px;
                font-weight: 800;
                line-height: 1;
                text-transform: uppercase;
                
                font-family: 'ABC Gravity', sans-serif;
                
                padding: 8px 16px;
                cursor: pointer;
            }
            .timegem-ven-disconnect:hover,
            .timegem-ven-disconnect:focus-visible {
                background: black;
                color: white;
                
            }
            .timegem-ven-list-secondary {
                display: block;
                font-size: 12px;
                opacity: .65;
                line-height: 1.3;
            }
            .cta-discover {
                cursor: pointer;
            }
            .timegem-ven-block {
                background: white;
                color: black;
                padding: 28px 32px;
                margin: 0px 0;
                border-top: 8px solid #e5fa4d;
                
            }
            .timegem-ven-block__like {
                margin-top: 20px;
            }
            .timegem-ven-block__like-btn {
                -webkit-appearance: none;
                appearance: none;
                background: black;
                color: white;
                
                font-family: 'ABC Gravity', sans-serif;
                font-size: 24px;
                font-weight: 800;
                
                text-transform: uppercase;
                padding: 6px 16px;
                cursor: pointer;
            }
            .timegem-ven-block__like-btn.is-liked {
                background: red;
                
            }
            .timegem-ven-block__like-btn:disabled {
                opacity: .6;
                cursor: default;
            }
            .timegem-ven-block__text {
                margin: 0;
                
                text-transform: uppercase;
               
            }
            .timegem-ven-block__body {
                margin: 8px 0 0;
                font-size: 15px;
                line-height: 1.5;
                font-weight: 400;
                text-transform: none;
            }
            .timegem-ven-block__symbol {
                color: greenyellow;
                margin: 8px 0 0;
                vertical-align: -0.18em;
            }
            .timegem-ven-block__reasons {
                margin: 12px 0 0;
                padding: 0 0 0 18px;
                font-size: 14px;
                line-height: 1.5;
            }
            .timegem-ven-block__reasons li {
                margin: 2px 0;
            }
            .timegem-ven-block__empty {
                margin: 8px 0 0;
                font-size: 15px;
                line-height: 1.5;
                text-transform: none;
            }
            .timegem-ven-tabs {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin: 16px 0 4px;
            }
            .timegem-ven-tab {
                -webkit-appearance: none;
                appearance: none;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-family: 'ABC Gravity', sans-serif;
                background: transparent;
                color: inherit;
                font: inherit;
                font-size: 20px;
                font-weight: 800;
                line-height: 1;
                text-transform: uppercase;
                letter-spacing: .06em;
                padding: 8px 13px;
                
                cursor: pointer;
            }

            .timegem-ven-tab span {
                font-family: 'ABC Gravity', sans-serif;
            }

            .timegem-ven-tab:hover {
                background: #00000020;
            }
            .timegem-ven-tab.is-active {
                background: #000;
                color: #fff;
                border-color: #000;
            }
            .timegem-ven-tab__count {
                font-size: 11px;
                font-weight: 700;
                opacity: .55;
            }
            .timegem-ven-tab.is-active .timegem-ven-tab__count {
                opacity: .75;
            }

            

            .timegem-ven-tab:focus-visible {
                outline: 2px solid #000;
                outline-offset: 2px;
            }
            .timegem-ven-panel[hidden] {
                display: none;
            }
            .timegem-ven-month {
                margin-top: 20px;
            }
            .timegem-ven-month:first-child {
                margin-top: 10px;
            }
            .timegem-ven-month__name {
                margin: 0 0 6px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .08em;
                opacity: .55;
            }
            .timegem-ven-month__list {
                list-style: none;
                margin: 0;
                padding: 0;
            }
            .timegem-ven-gem {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 12px;
                padding: 8px 0;
                border-top: 1px solid rgba(0, 0, 0, .12);
            }
            .timegem-ven-gem:first-child {
                border-top: 0;
            }
            .timegem-ven-gem__date {
                flex: none;
                min-width: 64px;
                font-size: 13px;
                font-weight: 700;
                text-transform: uppercase;
                opacity: .65;
            }
            .timegem-ven-gem .timegem-ven-symbols {
                flex: none;
                font-size: 17px;
            }
            .timegem-ven-gem__name {
                font-weight: 800;
                text-transform: uppercase;
                text-decoration: none;
                color: inherit;
                line-height: 1.2;
            }
            .timegem-ven-gem__name:hover {
                text-decoration: underline;
            }
            .timegem-ven-gem__tickets {
                margin-left: auto;
                flex: none;
                background: #ff7b00;
                
                padding: 7px 14px;
                font-size: 12px;
                font-weight: 800;
                line-height: 1;
                text-transform: uppercase;
                letter-spacing: .06em;
                text-decoration: none;
                color: inherit;
                white-space: nowrap;
            }
            .timegem-ven-gem__tickets:hover,
            .timegem-ven-gem__tickets:focus-visible {
                background: red;
                color: #fff;
                
            }
            .timegem-ven-gem__unlike {
                -webkit-appearance: none;
                appearance: none;
                margin-left: auto;
                flex: none;
                background: transparent;
                color: inherit;
                border: 1px solid currentColor;
                font: inherit;
                font-size: 12px;
                font-weight: 800;
                line-height: 1;
                text-transform: uppercase;
                letter-spacing: .06em;
                padding: 7px 14px;
                cursor: pointer;
            }
            .timegem-ven-gem__unlike:hover,
            .timegem-ven-gem__unlike:focus-visible {
                background: #111;
                color: #fff;
            }
            .timegem-ven-gem__unlike:disabled {
                opacity: .5;
                cursor: default;
            }
            .timegem-ven-block[hidden] {
                display: none;
            }
            .timegem-ven-block__caption {
                margin: 16px 0 10px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: .08em;
                opacity: .65;
            }
            .timegem-ven-block__matches {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 24px;
            }
            .timegem-ven-block__match {
                display: inline-flex;
    align-items: flex-start;
    gap: 8px;
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    flex-direction: column;
    justify-content: flex-start;
    width: 80px;
            }
            .timegem-ven-block__matches.is-genres .timegem-ven-block__match {
                padding: 6px 14px;
                text-transform: uppercase;
                letter-spacing: .04em;
            }
            .timegem-ven-block__match img {
                width: 64px;
                height: 64px;
                border-radius: 0%;
                object-fit: cover;
                flex: none;
                display: block;
            }
            .timegem-ven-block__match.is-more {
                opacity: .6;
                padding: 6px 14px;
            }
            @keyframes timegem-ven-shimmer {
                0% { background-position: -200px 0; }
                100% { background-position: calc(200px + 100%) 0; }
            }
            .timegem-ven-skeleton {
                display: inline-block;
                border-radius: 4px;
                background: rgba(255, 255, 255, 0.13);
                background-image: linear-gradient(90deg, rgba(255, 255, 255, 0) 0, rgba(255, 255, 255, 0.18) 50%, rgba(255, 255, 255, 0) 100%);
                background-repeat: no-repeat;
                background-size: 200px 100%;
                animation: timegem-ven-shimmer 1.2s ease-in-out infinite;
            }
            .timegem-ven-skeleton.is-bar {
                vertical-align: middle;
            }
            .timegem-ven-skeleton.is-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                flex: none;
            }
            .timegem-ven-skeleton.is-chip {
                height: 38px;
                border-radius: 999px;
                background-color: rgba(255, 255, 255, 0.12);
            }
            .timegem-ven-badge-loading {
                min-width: 54px;
                height: 33px;
                background-color: rgba(0, 0, 0, 0.55);
                background-image: linear-gradient(90deg, rgba(255, 255, 255, 0) 0, rgba(173, 255, 47, 0.28) 50%, rgba(255, 255, 255, 0) 100%);
            }
            @media (prefers-reduced-motion: reduce) {
                .timegem-ven-skeleton {
                    animation: none;
                }
            }
            html[data-timegem-has-id] .cta-discover {
                display: none !important;
            }
            html[data-timegem-likes="0"] #timegem-ven-tab-likes,
            html[data-timegem-likes="0"] #timegem-ven-panel-likes,
            html[data-timegem-likes="0"] a[href*="/my-likes"] {
                display: none !important;
            }
            .timegem-ven-profile-page {
                color: inherit;
            }
            .timegem-ven-profile-page__frame {
                display: grid;
                grid-template-columns: 240px minmax(0, 1fr);
                column-gap: 48px;
                box-sizing: border-box;
            }
            .timegem-ven-profile-page__side {
                position: sticky;
                top: 24px;
                align-self: start;
            }
            .timegem-ven-profile-nav {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 4px;
                margin-top: 0;
            }
            .timegem-ven-profile-nav__tab {
                -webkit-appearance: none;
                appearance: none;
                display: block;
                background: transparent;
                color: inherit;
                border: 0;
                text-align: left;
                text-decoration: none;
                font-family: 'ABC Gravity', sans-serif;
                font-size: 24px;
                font-weight: 800;
                
                text-transform: uppercase;
                padding: 12px 14px;
                cursor: pointer;
            }
            .timegem-ven-profile-nav__tab:hover {
                background: rgba(0, 0, 0, .06);
            }
            .timegem-ven-profile-nav__tab.is-active {
                background: #e5fa4d;
                color: #111;
            }
            .timegem-ven-profile-nav__tab:focus-visible {
                outline: 2px solid #e5fa4d;
                outline-offset: 2px;
            }
            .timegem-ven-profile-page__main {
                min-width: 0;
            }
            .timegem-ven-profile-page__panel[hidden] {
                display: none;
            }
            .timegem-ven-profile-page__identity h2,
            .timegem-ven-profile-page__panel > h2 {
                margin: 0 0 20px;
                font-size: 40px;
                line-height: 1;
                text-transform: uppercase;
            }
            .timegem-ven-profile-page__identity > p,
            .timegem-ven-profile-page__panel > p {
                margin: 0 0 16px;
                font-size: 16px;
                line-height: 1.5;
            }
            .timegem-ven-profile-page .timegem-ven-avatar {
                width: 88px;
                height: 88px;
            }
            .timegem-ven-profile-page .timegem-ven-list-media {
                width: 48px;
                height: 48px;
            }
            .timegem-ven-profile-page .timegem-ven-list img {
                width: 48px;
                height: 48px;
            }
            .timegem-ven-featured {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 18px;
                margin: 0 0 12px;
            }
            .timegem-ven-featured__item {
                position: relative;
            }
            .timegem-ven-featured__item .timegem-ven-list-rank {
                position: absolute;
                top: 0;
                left: 0;
                z-index: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                aspect-ratio: 1;
                margin: 0;
                background: #e5fa4d;
                color: #111;
                font-size: 14px;
                opacity: 1;
            }
            .timegem-ven-featured__item img {
                width: 100%;
                aspect-ratio: 1;
                height: auto;
                object-fit: cover;
                display: block;
                margin-bottom: 10px;
            }
            .timegem-ven-featured__item .timegem-ven-list-primary {
                font-size: 15px;
                font-weight: 700;
                line-height: 1.25;
            }
            .timegem-ven-featured__item .timegem-ven-list-secondary {
                margin-top: 2px;
                font-size: 13px;
                opacity: .6;
            }
            .timegem-ven-genre-card {
                aspect-ratio: 1;
                background-color: #e7b4d8;
                background-size: cover;
                background-position: center;
                display: flex;
                align-items: flex-end;
                justify-content: flex-start;
                padding: 14px;
                box-sizing: border-box;
            }
            .timegem-ven-genre-card span {
                color: #fff;
                font-family: 'ABC Gravity', sans-serif;
                font-size: 32px;
                font-weight: 800;
                line-height: 1;
                text-transform: uppercase;
            }
            @media (max-width: 640px) {
                .timegem-ven-featured {
                    gap: 12px;
                }
            }
            .timegem-ven-profile-page__gems {
                background: #fff;
                color: #111;
                padding: 28px 28px 20px;
                border-top: 8px solid #e5fa4d;
            }
            .timegem-ven-profile-page__gems h2,
            .timegem-ven-profile-page__gems .timegem-ven-profile-head h2 {
                color: #111;
            }
            .timegem-ven-profile-page__gems > h2 {
                margin: 0 0 8px;
            }
            .timegem-ven-profile-page__gems .timegem-ven-disconnect {
                color: #111;
                border-color: rgba(0, 0, 0, .25);
            }
            .timegem-ven-profile-page__gems .timegem-ven-tab.is-active {
                background: #000;
                color: #fff;
            }
            .timegem-ven-profile-page__gems .timegem-ven-gem {
                border-top-color: rgba(0, 0, 0, .12);
            }
            @media (max-width: 860px) {
                .timegem-ven-profile-page__frame {
                    grid-template-columns: 1fr;
                    column-gap: 0;
                }
                .timegem-ven-profile-page__side {
                    position: static;
                }
                .timegem-ven-profile-nav {
                    flex-direction: row;
                    flex-wrap: wrap;
                    margin-top: 20px;
                    margin-bottom: 28px;
                }
                .timegem-ven-profile-page__identity h2,
                .timegem-ven-profile-page__panel > h2 {
                    font-size: 32px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Set the flag before waiting on the DOM: <html> already exists, so the hide
    // rule can apply the moment the stylesheet lands.
    syncDiscoverCta();
    syncLikesFlag();

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
