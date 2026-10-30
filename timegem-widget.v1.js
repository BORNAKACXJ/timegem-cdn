
var TIMEGEM_API_BASE = 'https://api.timegem.nl';

(function () {
    'use strict';

    // ─── Copy ─────────────────────────────────────────────────────────────────
    // Every visible text lives here. Use \n inside a text for a line break.
    // {placeholders} are filled in by the code, so keep them as they are.
    var TEXT = {
        // Nav button
        navCtaLoggedIn: 'Your profile',
        navCtaLoggedOut: 'Ontdek jouw must-sees',
        navCtaStaleTitle: 'Update your profile',

        // Connect dialog (logged out)
        dialogClose: 'Sluiten',
        connectTitle: 'Ontdek jouw must-sees',
        connectIntro:
            'Koppel je Spotify of Apple Music aan de agenda van Rotown en ontdek een wereld vol persoonlijke concerttips. ' +
            'Op basis van jouw luistergedrag krijg je suggesties die perfect aansluiten bij jouw smaak, ' +
            'van je favoriete artiesten tot verborgen parels die je nog niet kende.',
        connectPrivacy:
            'En geen zorgen, jouw geheime meezingers blijven gewoon tussen jou en Apple Music/Spotify. ' +
            'We vragen Apple Music/Spotify alleen om een kijkje te nemen in je profiel, zodat we jouw muzieksmaak beter leren kennen. ' +
            'Zo kunnen we je nog beter matchen met concerten die écht bij je passen. ' +
            'Geen spam, geen gedoe met data delen, gewoon de perfecte concerttips voor jou.',
        connectSpotify: 'Connect met Spotify',
        connectApple: 'Connect met Apple Music',
        connectUnavailable: 'No venue is configured for this page, so connecting is unavailable.',

        // Profile (dialog and profile page)
        profileDialogTitle: 'Your profile',
        profileName: 'Jouw profiel',
        profileGenres: 'Genres',
        profileTopArtists: 'Top artists',
        profileTopTracks: 'Top tracks',
        profileLoading: 'Loading your profile…',
        profileError: "We couldn't load your profile right now. Please try again later.",
        profileSignedOut: 'Connect your music account under My settings to see your top artists and tracks.',

        // Danger zone (disconnect)
        disconnectHeading: 'Danger zone',
        disconnectText: 'Wil je je account ontkoppelen? En geen mooie concerttips meer krijgen? Klik dan hieronder op ontkoppelen.',
        disconnectButton: 'Disconnect',

        // Home must-sees block and recommendations list
        homeTitle: 'Dit zijn jouw must-sees voor de komende periode',
        homeOverview: 'Toon volledige overzicht',
        gemTickets: 'Meer info',
        gemsLoading: 'Loading your gems…',
        gemsUpdating: 'Updating your gems…',
        gemsError: 'We could not load your gems right now.',
        gemsEmpty: 'No matches coming up yet \u2014 check back when new shows go on sale.',
        gemsSignedOut: 'Connect to see which shows match your taste this month.',
        monthsLabel: 'Months with matches',
        moreMonthsOne: '+{count} more month with matches',
        moreMonthsMany: '+{count} more months with matches',

        // Agenda block
        agendaListing: 'Your matches are marked in the list below.',
        match: {
            direct: 'This is one of your favorite artists',
            heavy: 'AANBEVELING GEBASEERD OP GERELATEERDE ARTIESTEN',
            medium: 'AANBEVELING GEBASEERD OP GERELATEERDE ARTIEST',
            light: 'RECOMMENDED BASED ON GENRE',
            none: 'This is not a match'
        },
        matchUnavailable: 'We could not check this one right now',
        matchCaptionGenres: 'Matching genres',
        matchCaptionArtists: 'Because you listen to',
        helpLabel: 'Meer over deze match',
        helpText: 'Dit is gebaseerd op jouw Spotify of Apple Music luistergedrag.',
        helpLink: 'lees meer',
        like: 'Like',
        liked: 'Liked',

        // Profile page menu
        profileNavLabel: 'Mijn profiel',
        navRecommendations: 'Mijn concerttips',
        navSettings: 'Mijn instellingen',
        navAbout: 'Over',
        recommendationsTitle: 'Mijn concerttips',

        // About
        aboutTitle: 'Over',
        aboutIntro:
            'The lightning bolts tell you how good a match is. More bolts means the show fits your taste better. ' +
            'A star is a direct match: one of your favorite artists.',
        aboutLight: 'One bolt \u2014 a lighter match.',
        aboutMedium: 'Two bolts \u2014 a stronger match.',
        aboutHeavy: 'Three bolts \u2014 the strongest match.',
        aboutDirect: 'A star \u2014 a direct match.',

        // Settings
        settingsTitle: 'My settings',
        settingsSignedOut: 'Connect a music account to see your profile and recommendations on this device.',
        settingsConnected:
            'Je aanbevelingen zijn gekoppeld aan {name} via Spotify. ' +
            'De koppeling is alleen actief in deze browser op dit apparaat. ' +
            'Je kunt altijd ontkoppelen en later opnieuw verbinden.',
        settingsConnectedFallbackName: 'jouw Spotify-account',

        // Refresh (on My settings)
        refreshTitle: 'Vernieuw je muzieksmaak.',
        refreshText:
            'De laatste tijd nieuwe muziek geluisterd? Werk je gegevens bij om je favoriete artiesten, nummers en aanbevelingen ' +
            'te vernieuwen op basis van je nieuwste Spotify-luistergedrag.',
        refreshButton: 'Refresh my data',
        refreshButtonBusy: 'Refreshing…',
        refreshFetching: 'Fetching your latest listening data from Spotify…',
        refreshDone: 'Done \u2014 your profile was updated at {time}.',
        refreshExpired: 'Your Spotify connection has expired. Connect again to refresh \u2014 you will keep the same profile and likes.',
        refreshRateLimited: 'Spotify is busy right now. Please try again in a minute.',
        refreshError: "We couldn't refresh your data right now. Please try again later.",
        lastUpdate: 'Laatste update is {date}',
        lastUpdateUnknown: 'Laatste update is onbekend',

        // My likes
        likesTitle: 'My likes',
        likesSignedOut: 'Connect your music account under My settings to save likes.',
        likesLoading: 'Loading your likes…',
        likesEmpty: 'You have not liked a show yet.',
        likesError: "We couldn't load your likes right now.",
        unlike: 'Unlike'
    };

    /** Fills {placeholders} in a TEXT entry. */
    function fmt(text, values) {
        return String(text).replace(/\{(\w+)\}/g, function (match, key) {
            return values && Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
        });
    }

    /** Appends text to an element, turning every \n into a <br>. */
    function appendText(el, text) {
        String(text == null ? '' : text).split('\n').forEach(function (line, i) {
            if (i) el.appendChild(document.createElement('br'));
            el.appendChild(document.createTextNode(line));
        });
    }

    /** Like textContent =, but a \n in the copy becomes a line break. */
    function setText(el, text) {
        el.textContent = '';
        appendText(el, text);
    }

    var STYLESHEET_URL = 'https://cdn.timegem.nl/tg__main.css';

    var agendaPath = '/agenda/';
    var TIMEGEM_USER_STORAGE_KEY = 'timegem_ven_id';
    var TIMEGEM_VENUE_STORAGE_KEY = 'timegem_ven_venue_id';
    var TIMEGEM_PROFILE_UPDATED_KEY = 'timegem_ven_profile_updated';
    var CTA_STALE_DOT_CLASS = 'timegem-ven-cta-dot';
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
        '2c3e7f89-3813-4e26-8e5a-2bcc97e4f762': {
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

    /**
     * Asks the API to re-pull this visitor's top artists/tracks from Spotify
     * (using the token stored in spotify_profiles_ven) and replace what is
     * stored. Resolves { ok, status, reconnect, data }. reconnect:true means
     * the stored Spotify token has expired and there is no refresh token, so
     * the only way forward is the connect portal again.
     */
    function refreshVenueProfile(timegemId, venueId) {
        var url = TIMEGEM_API_BASE + '/api/venue-profile/' + encodeURIComponent(timegemId) + '/refresh';
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ venue_id: venueId || null, limit: 10 })
        })
            .then(function (res) {
                return res.json().catch(function () { return null; }).then(function (data) {
                    return {
                        ok: res.ok,
                        status: res.status,
                        reconnect: !!(data && data.reconnect),
                        data: data
                    };
                });
            })
            .catch(function (err) {
                return { ok: false, status: 0, reconnect: false, data: null, error: err };
            });
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
                renderHomeGemsMessage(TEXT.gemsError);
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
    var ORIGINAL_LABEL_ATTR = 'data-timegem-label';
    var ORIGINAL_HREF_ATTR = 'data-timegem-href';
    var BLOCK_CLASS = 'timegem-ven-block';
    var CONNECT_PORTAL_URL = 'https://my.personaltimetable.com/';
    // dsp values the portal understands ('spotify' | 'apple'). A provider the
    // venue has not enabled in connect_providers lands on the normal picker.
    var CONNECT_ICONS = {
        spotify:
            '<svg class="timegem-ven-connect__icon" viewBox="0 0 236.05 225.25" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
                '<path fill="currentColor" d="m122.37,3.31C61.99.91,11.1,47.91,8.71,108.29c-2.4,60.38,44.61,111.26,104.98,113.66,60.38,2.4,111.26-44.6,113.66-104.98C229.74,56.59,182.74,5.7,122.37,3.31Zm46.18,160.28c-1.36,2.4-4.01,3.6-6.59,3.24-.79-.11-1.58-.37-2.32-.79-14.46-8.23-30.22-13.59-46.84-15.93-16.62-2.34-33.25-1.53-49.42,2.4-3.51.85-7.04-1.3-7.89-4.81-.85-3.51,1.3-7.04,4.81-7.89,17.78-4.32,36.06-5.21,54.32-2.64,18.26,2.57,35.58,8.46,51.49,17.51,3.13,1.79,4.23,5.77,2.45,8.91Zm14.38-28.72c-2.23,4.12-7.39,5.66-11.51,3.43-16.92-9.15-35.24-15.16-54.45-17.86-19.21-2.7-38.47-1.97-57.26,2.16-1.02.22-2.03.26-3.01.12-3.41-.48-6.33-3.02-7.11-6.59-1.01-4.58,1.89-9.11,6.47-10.12,20.77-4.57,42.06-5.38,63.28-2.4,21.21,2.98,41.46,9.62,60.16,19.74,4.13,2.23,5.66,7.38,3.43,11.51Zm15.94-32.38c-2.1,4.04-6.47,6.13-10.73,5.53-1.15-.16-2.28-.52-3.37-1.08-19.7-10.25-40.92-17.02-63.07-20.13-22.15-3.11-44.42-2.45-66.18,1.97-5.66,1.15-11.17-2.51-12.32-8.16-1.15-5.66,2.51-11.17,8.16-12.32,24.1-4.89,48.74-5.62,73.25-2.18,24.51,3.44,47.99,10.94,69.81,22.29,5.12,2.66,7.11,8.97,4.45,14.09Z"/>' +
            '</svg>',
        apple:
            '<svg class="timegem-ven-connect__icon" viewBox="0 0 73 73" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
                '<path fill="currentColor" fill-rule="evenodd" d="M72,19.9v-2.2c0-1.6,0-3.2-.4-4.7-.3-1.6-.8-3.1-1.5-4.5-.7-1.4-1.7-2.7-2.8-3.8-1.1-1.1-2.4-2.1-3.8-2.8-1.4-.7-2.9-1.2-4.5-1.5C57.4,0,55.8,0,54.3,0H17.7C16.1,0,14.5,0,13,.4c-1.6.3-3.1.8-4.5,1.5-1.4.7-2.7,1.7-3.8,2.8s-2.1,2.4-2.8,3.8c-.7,1.4-1.2,2.9-1.5,4.5C0,14.6,0,16.2,0,17.7v36.5C0,55.8,0,57.4.4,58.9c.3,1.6.8,3.1,1.5,4.5s1.7,2.7,2.8,3.8,2.4,2.1,3.8,2.8c1.4.7,2.9,1.2,4.5,1.5,1.6.3,3.2.4,4.7.4h36.5c1.6,0,3.2,0,4.7-.4,1.6-.3,3.1-.8,4.5-1.5s2.7-1.7,3.8-2.8,2.1-2.4,2.8-3.8c.7-1.4,1.2-2.9,1.5-4.5s.4-3.2.4-4.7V19.9h0ZM52.7,46.8c0,.9,0,1.7-.2,2.7-.2.9-.5,1.7-1,2.5s-1.2,1.4-2,1.8c-.8.5-1.6.7-2.5.9-1.7.3-2.8.4-3.9.2-1-.2-1.9-.7-2.6-1.3-1-1-1.7-2.2-1.8-3.6-.2-1.6.4-3.2,1.5-4.5.6-.6,1.3-1.1,2.3-1.5s2.2-.7,4-1c.5,0,.9-.2,1.4-.3.6,0,1.1-.3,1.6-.8.4-.5.4-1.2.4-1.8v-15.9c0-1.2-.5-1.5-1.7-1.3-.8.2-18.6,3.8-18.6,3.8-1,.2-1.4.6-1.4,1.8v23.2c0,.9,0,1.7-.2,2.7-.2.9-.5,1.7-1,2.5s-1.2,1.4-2,1.8c-.8.5-1.6.7-2.5.9-1.7.3-2.8.4-3.9.2-1-.2-1.9-.7-2.6-1.3-1-1-1.6-2.2-1.8-3.6-.2-1.6.3-3.2,1.5-4.5.6-.6,1.3-1.1,2.3-1.5s2.2-.7,4-1c.5,0,.9-.2,1.4-.3.6,0,1.1-.3,1.6-.8s.5-1.1.5-1.8v-27.5c0-.6.3-1,.7-1.4.3-.3.8-.5,1.3-.6h0l21.4-4.3c.2,0,1.7-.3,1.9-.3,1.2-.1,1.8.7,1.8,1.9v34h0Z"/>' +
            '</svg>'
    };
    var CONNECT_PROVIDERS = [
        { dsp: 'spotify', label: TEXT.connectSpotify },
        { dsp: 'apple', label: TEXT.connectApple }
    ];

    /** One connect button, styled like the onboarding .spotify-connect-btn (icon + label). */
    function buildConnectButton(provider) {
        var link = document.createElement('a');
        link.className = 'timegem-ven-connect is-' + provider.dsp;
        link.href = buildConnectUrl(provider.dsp);
        link.innerHTML = (CONNECT_ICONS[provider.dsp] || '') + '<span></span>';
        setText(link.querySelector('span'), provider.label);
        return link;
    }
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
        setText(subhead, heading);
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
        try {
            localStorage.removeItem(TIMEGEM_USER_STORAGE_KEY);
            localStorage.removeItem(TIMEGEM_PROFILE_UPDATED_KEY);
        } catch (e) {}
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
        setText(name, TEXT.profileName);
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

        appendProfileSection(body, TEXT.profileTopArtists, ((data && data.topArtists) || []).map(function (a) {
            return {
                image: a.image_url,
                primary: a.artist_name,
                secondary: (a.genres || []).slice(0, 2).join(', ')
            };
        }), featured);

        appendProfileSection(body, TEXT.profileTopTracks, ((data && data.topTracks) || []).map(function (t) {
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
        setText(subhead, TEXT.profileGenres);
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

        var heading = document.createElement('p');
        setText(heading, TEXT.disconnectHeading);
        footer.appendChild(heading);

        var copy = document.createElement('p');
        setText(copy, TEXT.disconnectText);
        footer.appendChild(copy);

        var disconnect = document.createElement('button');
        disconnect.type = 'button';
        disconnect.className = 'timegem-ven-disconnect';
        setText(disconnect, TEXT.disconnectButton);
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

        // Logged-out "connect" state borrows the Rotown onboarding look
        // (yellow panel with a notch cut out at the bottom).
        setDialogConnectState(dialog, !hasId);

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

            setText(title, TEXT.profileDialogTitle);
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
                    setText(intro, TEXT.profileError);
                    return;
                }

                profileCache[timegemId] = data;
                applyProfileFreshness(data);
                renderProfile(body, data);
            });

            return;
        }

        setText(title, TEXT.connectTitle);
        body.appendChild(title);

        //var hook = document.createElement('p');
        //hook.className = 'timegem-ven-hook';
        //hook.appendChild(document.createTextNode('Wil je nooit meer een tof concert missen dat'));
        //hook.appendChild(document.createElement('br'));
        //hook.appendChild(document.createTextNode('écht bij je past?'));
       // body.appendChild(hook);

        setText(intro, TEXT.connectIntro);
        body.appendChild(intro);

        var privacy = document.createElement('p');
        setText(privacy, TEXT.connectPrivacy);
        body.appendChild(privacy);

        if (!buildConnectUrl()) {
            var fine = document.createElement('p');
            fine.className = 'timegem-ven-fineprint';
            setText(fine, TEXT.connectUnavailable);
            body.appendChild(fine);
            return;
        }

        var choices = document.createElement('div');
        choices.className = 'timegem-ven-connect-choices';

        CONNECT_PROVIDERS.forEach(function (provider) {
            choices.appendChild(buildConnectButton(provider));
        });

        body.appendChild(choices);
    }

    function buildDialog() {
        var dialog = document.createElement('dialog');
        dialog.id = DIALOG_ID;
        dialog.className = 'timegem-ven-dialog';
        dialog.innerHTML =
            '<div class="timegem-ven-dialog-inner">' +
                '<button type="button" class="timegem-ven-dialog-close" aria-label="' + escapeHtml(TEXT.dialogClose) + '">&times;</button>' +
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

    /** Mirrors the connect state on the <dialog> and its inner box. */
    function setDialogConnectState(dialog, isConnect) {
        if (!dialog) return;
        dialog.classList.toggle('is-connect', !!isConnect);
        var inner = dialog.querySelector('.timegem-ven-dialog-inner');
        if (inner) inner.classList.toggle('is-connect', !!isConnect);
    }

    function openDialog() {
        var dialog = getDialog();
        var hasId = !!getTimegemId();
        setDialogConnectState(dialog, !hasId);
        renderDialogBody(hasId);
        if (dialog.open) return;
        if (typeof dialog.showModal === 'function') dialog.showModal(); // Escape closes it for free
        else dialog.setAttribute('open', '');
    }

    function closeDialog() {
        var dialog = document.getElementById(DIALOG_ID);
        if (!dialog) return;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
        setDialogConnectState(dialog, false);
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
    /** Home page shows a short preview; the full list lives on /my-profile. */
    var HOME_GEMS_PREVIEW_LIMIT = 8;
    var gemsRenderId = 0;

    /** Month names follow the page's own language rather than the browser's. */
    function pageLocale() {
        try { return document.documentElement.lang || undefined; } catch (e) { return undefined; }
    }

    var MATCH_RANK = { heavy: 0, medium: 1, light: 2, direct: 3 };

    function matchRank(rec) {
        var t = rec && rec.matchType ? String(rec.matchType).toLowerCase() : '';
        return Object.prototype.hasOwnProperty.call(MATCH_RANK, t) ? MATCH_RANK[t] : 99;
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
        months.forEach(function (month) {
            month.gems.sort(function (a, b) {
                var rank = matchRank(a.rec) - matchRank(b.rec);
                if (rank) return rank;
                return a.date - b.date;
            });
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
        setText(line, text);
        body.appendChild(line);
    }

    function buildGemDate(date, locale) {
        var wrap = document.createElement('span');
        wrap.className = 'timegem-ven-gem__date';

        var num = document.createElement('span');
        num.className = 'timegem-ven-gem__day';
        num.textContent = date.toLocaleDateString(locale, { day: 'numeric' });
        wrap.appendChild(num);

        var month = document.createElement('span');
        month.className = 'timegem-ven-gem__month';
        month.textContent = date.toLocaleDateString(locale, { month: 'short' }).replace(/\.$/, '');
        wrap.appendChild(month);

        return wrap;
    }

    function buildGemList(month, locale) {
        var list = document.createElement('ul');
        list.className = 'timegem-ven-month__list';

        month.gems.forEach(function (gem) {
            var item = document.createElement('li');
            item.className = 'timegem-ven-gem';
            item.setAttribute('data-match', String(gem.rec.matchType).toLowerCase());

            var symbol = buildMatchSymbol(gem.rec.matchType);
            if (symbol) item.appendChild(symbol);

            var eventUrl = agendaPath + gem.slug + '/';

            var link = document.createElement('a');
            link.className = 'timegem-ven-gem__name';
            link.href = eventUrl;
            link.textContent = gem.event.event_name || gem.slug; // API copy, never innerHTML
            item.appendChild(link);

            item.appendChild(buildGemDate(gem.date, locale));

            var tickets = document.createElement('a');
            tickets.className = 'timegem-ven-gem__tickets';
            tickets.href = eventUrl;
            setText(tickets, TEXT.gemTickets);
            item.appendChild(tickets);

            list.appendChild(item);
        });

        return list;
    }

    /** Short tab label: month name only. */
    function monthTabLabel(date, locale) {
        return date.toLocaleDateString(locale, { month: 'short' }).replace(/\.$/, '');
    }

    /**
     * Home only: the first few upcoming matches as a flat list, with a button
     * to the full overview on /my-profile. The month tabs live on the profile.
     */
    function renderHomeGemsPreview(body, gems, locale) {
        var shown = gems.slice(0, HOME_GEMS_PREVIEW_LIMIT);
        body.appendChild(buildGemList({ gems: shown }, locale));

        var more = document.createElement('a');
        more.className = BLOCK_CLASS + '__overview';
        more.href = PROFILE_PATH + '/';
        setText(more, TEXT.homeOverview);
        body.appendChild(more);
    }

    /** Fills the home block with the visitor's upcoming matches, by month. */
    function renderHomeGems(bySlug) {
        var body = homeGemsBody();
        if (!body) return;

        var gems = collectUpcomingGems(bySlug);
        if (!gems.length) {
            renderHomeGemsMessage(TEXT.gemsEmpty);
            return;
        }

        body.innerHTML = '';
        var locale = pageLocale();

        if (isHomePage()) {
            renderHomeGemsPreview(body, gems, locale);
            return;
        }

        var months = groupGemsByMonth(gems);
        var shown = months.slice(0, HOME_GEMS_MONTHS);

        var tablist = document.createElement('div');
        tablist.className = 'timegem-ven-tabs';
        tablist.setAttribute('role', 'tablist');
        tablist.setAttribute('aria-label', TEXT.monthsLabel);

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
            setText(more, fmt(rest === 1 ? TEXT.moreMonthsOne : TEXT.moreMonthsMany, { count: rest }));
            body.appendChild(more);
        }
    }

    /** Home only: takes the place of the hidden .cta-discover. */
    function renderHomeGemsBlock(hasId) {
        if (!hasId || !isHomePage()) return;

        insertBlockBeforeDiscoverCta(function (block) {
            block.className += ' timegem-ven-home';

            var wrap = document.createElement('div');
            wrap.className = 'timegem-ven-block_wrapper';

            var title = document.createElement('h3');
            title.className = BLOCK_CLASS + '__text';
            setText(title, TEXT.homeTitle);
            wrap.appendChild(title);

            var body = document.createElement('div');
            body.className = BLOCK_CLASS + '__body';
            body.setAttribute(GEMS_BODY_ATTR, '');
            wrap.appendChild(body);

            block.appendChild(wrap);
            mountBlockHelp(block);
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
                setText(line, TEXT.agendaListing);
                block.appendChild(line);
                mountBlockHelp(block);
            }
        });
    }

    /**
     * Fills the agenda block with the result for the event being viewed.
     * `recommendation` is null when the event is absent from the payload, which
     * means the same thing as matchType 'none'.
     */
    var MATCH_ITEM_LIMIT = 6;
    var MATCH_ARTIST_LIMIT = 3;
    var SKELETON_BADGE_CLASS = 'timegem-ven-badge-loading';
    /** Never leave a skeleton up forever if a request hangs. */
    var SKELETON_TIMEOUT_MS = 12000;
    var blockHelpDismissBound = false;

    function bindBlockHelpDismiss() {
        if (blockHelpDismissBound) return;
        blockHelpDismissBound = true;

        document.addEventListener('click', function (e) {
            var open = document.querySelectorAll('.' + BLOCK_CLASS + '__help.is-open');
            if (!open.length) return;
            Array.prototype.forEach.call(open, function (el) {
                if (el.contains(e.target)) return;
                el.classList.remove('is-open');
                var btn = el.querySelector('.' + BLOCK_CLASS + '__help-btn');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' && e.keyCode !== 27) return;
            var open = document.querySelectorAll('.' + BLOCK_CLASS + '__help.is-open');
            Array.prototype.forEach.call(open, function (el) {
                el.classList.remove('is-open');
                var btn = el.querySelector('.' + BLOCK_CLASS + '__help-btn');
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                    btn.focus();
                }
            });
        });
    }

    /**
     * "?" in the top-right of the yellow block. Hover/focus/click opens a
     * short note with a link to the About page.
     */
    function mountBlockHelp(block) {
        if (!block || block.querySelector('.' + BLOCK_CLASS + '__help')) return;

        var wrap = document.createElement('div');
        wrap.className = BLOCK_CLASS + '__help';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = BLOCK_CLASS + '__help-btn';
        btn.setAttribute('aria-label', TEXT.helpLabel);
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '?';

        var tip = document.createElement('div');
        tip.className = BLOCK_CLASS + '__help-tip';
        tip.setAttribute('role', 'tooltip');

        var copy = document.createElement('p');
        setText(copy, TEXT.helpText);
        tip.appendChild(copy);

        var more = document.createElement('a');
        more.className = BLOCK_CLASS + '__help-link';
        more.href = PROFILE_PATH + '/about/';
        setText(more, TEXT.helpLink);
        tip.appendChild(more);

        wrap.appendChild(btn);
        wrap.appendChild(tip);

        if (block.firstChild) block.insertBefore(wrap, block.firstChild);
        else block.appendChild(wrap);

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var open = !wrap.classList.contains('is-open');
            wrap.classList.toggle('is-open', open);
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        bindBlockHelpDismiss();
    }

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
        var limit = isGenre ? MATCH_ITEM_LIMIT : MATCH_ARTIST_LIMIT;

        var fragment = document.createDocumentFragment();

        var caption = document.createElement('p');
        caption.className = BLOCK_CLASS + '__caption';
        setText(caption, isGenre ? TEXT.matchCaptionGenres : TEXT.matchCaptionArtists);
        //fragment.appendChild(caption);

        var list = document.createElement('div');
        list.className = BLOCK_CLASS + '__matches ' + (isGenre ? 'is-genres' : 'is-artists');

        detailed.slice(0, limit).forEach(function (match) {
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

        if (isGenre && detailed.length > limit) {
            var more = document.createElement('span');
            more.className = BLOCK_CLASS + '__match is-more';
            more.textContent = '+' + (detailed.length - limit);
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
        var headline = TEXT.match[matchType] || TEXT.match.none;
        var showSymbol = state !== 'unavailable';
        var details = (recommendation && recommendation.matchDetails) || [];

        if (state === 'unavailable') {
            headline = TEXT.matchUnavailable;
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
                mountBlockHelp(block);
                mountLikeControl(block);
            });
            return;
        }

        Array.prototype.forEach.call(blocks, function (block) {
            block.hidden = false;
            block.setAttribute('data-match', matchType);
            block.innerHTML = '';
            mountBlockHelp(block);

            // Built per block: one node cannot live in two places.
            var sym = showSymbol ? buildMatchSymbol(matchType) : null;
            if (sym) {
                sym.className += ' ' + BLOCK_CLASS + '__symbol';
                block.appendChild(sym);
            }

            var line = document.createElement('h3');
            line.className = BLOCK_CLASS + '__text';
            appendText(line, headline);
            block.appendChild(line);

            var matchDetailNodes = state === 'unavailable' ? null : buildMatchDetails(recommendation);

            if (matchDetailNodes) {
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
            setText(button, liked ? TEXT.liked : TEXT.like);
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

            var next = hasId ? TEXT.navCtaLoggedIn : TEXT.navCtaLoggedOut;
            if (label.textContent !== next) label.textContent = next;

            if (cta.tagName === 'A') {
                if (!cta.hasAttribute(ORIGINAL_HREF_ATTR)) {
                    cta.setAttribute(ORIGINAL_HREF_ATTR, cta.getAttribute('href') || '');
                }
                cta.setAttribute('href', hasId ? PROFILE_PATH : cta.getAttribute(ORIGINAL_HREF_ATTR));
            }
        });
        if (!hasId) syncNavCtaStaleDot(false);
        else loadProfileFreshness();
    }

    function readStoredProfileUpdated() {
        try {
            var raw = localStorage.getItem(TIMEGEM_PROFILE_UPDATED_KEY);
            if (!raw) return null;
            var date = new Date(raw);
            return isNaN(date.getTime()) ? null : date;
        } catch (e) {
            return null;
        }
    }

    function writeStoredProfileUpdated(date) {
        try {
            localStorage.setItem(TIMEGEM_PROFILE_UPDATED_KEY, (date || new Date()).toISOString());
        } catch (e) {}
    }

    function profileUpdatedFromData(data) {
        var profile = data && data.profile;
        if (!profile) return null;
        var raw = profile.updated_at || profile.updatedAt || profile.created_at || profile.createdAt;
        if (!raw) return null;
        var date = new Date(raw);
        return isNaN(date.getTime()) ? null : date;
    }

    function isOlderThanOneMonth(date) {
        if (!date) return false;
        var cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 1);
        return date.getTime() < cutoff.getTime();
    }

    function syncNavCtaStaleDot(stale) {
        var ctas = document.querySelectorAll(NAV_CTA_SELECTOR);
        Array.prototype.forEach.call(ctas, function (cta) {
            var dot = cta.querySelector('.' + CTA_STALE_DOT_CLASS);
            if (!stale) {
                if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
                cta.removeAttribute('data-timegem-stale');
                if (cta.getAttribute('title') === TEXT.navCtaStaleTitle) cta.removeAttribute('title');
                return;
            }
            cta.setAttribute('data-timegem-stale', '');
            cta.setAttribute('title', TEXT.navCtaStaleTitle);
            if (dot) return;
            dot = document.createElement('span');
            dot.className = CTA_STALE_DOT_CLASS;
            dot.setAttribute('aria-hidden', 'true');
            cta.appendChild(dot);
        });
    }

    function currentProfileUpdatedAt(data) {
        var fromApi = profileUpdatedFromData(data);
        if (!fromApi && getTimegemId()) {
            fromApi = profileUpdatedFromData(profileCache[getTimegemId()]);
        }
        var stored = readStoredProfileUpdated();
        var when = fromApi;
        if (stored && (!when || stored.getTime() > when.getTime())) when = stored;
        return when;
    }

    function lastUpdateCopy(date) {
        if (!date) return TEXT.lastUpdateUnknown;
        return fmt(TEXT.lastUpdate, {
            date: date.toLocaleDateString(pageLocale(), {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })
        });
    }

    function paintLastUpdateLine(date) {
        var lines = document.querySelectorAll('.timegem-ven-refresh__updated');
        var copy = lastUpdateCopy(date);
        Array.prototype.forEach.call(lines, function (el) {
            setText(el, copy);
        });
    }

    /** Red dot on "Your profile" when Spotify data is older than a month. */
    function applyProfileFreshness(data) {
        var when = currentProfileUpdatedAt(data);
        if (when) writeStoredProfileUpdated(when);
        syncNavCtaStaleDot(isOlderThanOneMonth(when));
        paintLastUpdateLine(when);
        paintSettingsConnectedIntro(data);
    }

    function spotifyDisplayName(data) {
        var profile = (data && data.profile) || null;
        if (!profile && getTimegemId() && profileCache[getTimegemId()]) {
            profile = profileCache[getTimegemId()].profile;
        }
        return (profile && (profile.display_name || profile.displayName)) || '';
    }

    function fillSettingsConnectedIntro(intro, data) {
        var name = spotifyDisplayName(data);
        var parts = TEXT.settingsConnected.split('{name}');
        intro.textContent = '';
        appendText(intro, parts[0]);
        if (parts.length < 2) return;
        var who = document.createElement('strong');
        who.textContent = name || TEXT.settingsConnectedFallbackName;
        intro.appendChild(who);
        appendText(intro, parts.slice(1).join(who.textContent));
    }

    function paintSettingsConnectedIntro(data) {
        var intro = document.querySelector('.timegem-ven-settings-intro');
        if (intro) fillSettingsConnectedIntro(intro, data);
    }

    function loadProfileFreshness() {
        var timegemId = getTimegemId();
        if (!timegemId) {
            syncNavCtaStaleDot(false);
            return;
        }

        if (getTimegemIdFromUrl()) writeStoredProfileUpdated(new Date());

        var cached = profileCache[timegemId];
        if (cached) {
            applyProfileFreshness(cached);
            return;
        }

        fetchVenueProfile(timegemId, getVenueIdFromQueue()).then(function (data) {
            if (data && data.profile) profileCache[timegemId] = data;
            applyProfileFreshness(data);
        });
    }

    var PROFILE_PAGE_ID = 'timegem-ven-profile-page';

    function profileIdentity() {
        var page = document.getElementById(PROFILE_PAGE_ID);
        return page && page.querySelector('[data-timegem-profile]');
    }

    var PROFILE_NAV = [
        { id: 'recommendations', label: TEXT.navRecommendations, slug: 'my-recommendations' },
        { id: 'settings', label: TEXT.navSettings, slug: 'my-settings' },
        { id: 'about', label: TEXT.navAbout, slug: 'about', aliases: ['my-about'] }
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
            setText(missing, TEXT.connectUnavailable);
            slot.appendChild(missing);
            return;
        }

        var choices = document.createElement('div');
        choices.className = 'timegem-ven-connect-choices';
        CONNECT_PROVIDERS.forEach(function (provider) {
            choices.appendChild(buildConnectButton(provider));
        });
        slot.appendChild(choices);
    }

    function renderProfileAbout(slot) {
        var title = document.createElement('h2');
        setText(title, TEXT.aboutTitle);
        slot.appendChild(title);

        var intro = document.createElement('p');
        setText(intro, TEXT.aboutIntro);
        slot.appendChild(intro);

        var list = document.createElement('ul');
        list.className = 'timegem-ven-about-legend';

        [
            { type: 'light', text: TEXT.aboutLight },
            { type: 'medium', text: TEXT.aboutMedium },
            { type: 'heavy', text: TEXT.aboutHeavy },
            { type: 'direct', text: TEXT.aboutDirect }
        ].forEach(function (row) {
            var item = document.createElement('li');
            var symbol = buildMatchSymbol(row.type);
            if (symbol) item.appendChild(symbol);
            var label = document.createElement('span');
            setText(label, row.text);
            item.appendChild(label);
            list.appendChild(item);
        });

        slot.appendChild(list);
    }

    function renderProfileSettings(slot, hasId) {
        var title = document.createElement('h2');
        setText(title, TEXT.settingsTitle);
        slot.appendChild(title);

        var intro = document.createElement('p');
        if (!hasId) {
            setText(intro, TEXT.settingsSignedOut);
            slot.appendChild(intro);
            appendConnectChoices(slot);
            return;
        }

        intro.className = 'timegem-ven-settings-intro';
        fillSettingsConnectedIntro(intro);
        slot.appendChild(intro);
        // Disconnect lives inside the refresh card so settings is one block.
        appendDisconnect(appendRefresh(slot));
    }

    /**
     * "Refresh" on My settings: pulls the visitor's latest top artists and
     * tracks from Spotify through the API, then repaints the profile panel and
     * re-scores the recommendations so the gems reflect the new data.
     *
     * If the API says the Spotify token has expired (no refresh token on
     * file), we show the connect buttons instead — the portal refetches
     * everything and sends the visitor back with the same timegem_id.
     */
    function appendRefresh(parent) {
        var wrap = document.createElement('div');
        wrap.className = 'timegem-ven-refresh';

        var title = document.createElement('h3');
        setText(title, TEXT.refreshTitle);
        wrap.appendChild(title);

        var updated = document.createElement('p');
        updated.className = 'timegem-ven-refresh__updated';
        setText(updated, lastUpdateCopy(currentProfileUpdatedAt()));
        wrap.appendChild(updated);

        var text = document.createElement('p');
        setText(text, TEXT.refreshText);
        wrap.appendChild(text);

        

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'timegem-ven-refresh__button';
        setText(button, TEXT.refreshButton);
        wrap.appendChild(button);

        var status = document.createElement('p');
        status.className = 'timegem-ven-refresh__status timegem-ven-fineprint';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        wrap.appendChild(status);

        var reconnectSlot = document.createElement('div');
        reconnectSlot.className = 'timegem-ven-refresh__reconnect';
        wrap.appendChild(reconnectSlot);

        button.addEventListener('click', function () {
            var timegemId = getTimegemId();
            if (!timegemId) return;

            button.disabled = true;
            setText(button, TEXT.refreshButtonBusy);
            setText(status, TEXT.refreshFetching);
            reconnectSlot.innerHTML = '';

            var venueId = getVenueIdFromQueue();

            refreshVenueProfile(timegemId, venueId).then(function (result) {
                button.disabled = false;
                setText(button, TEXT.refreshButton);

                if (result.ok && result.data && result.data.profile) {
                    // Stored data changed, so every cached derivation of it is stale.
                    profileCache[timegemId] = result.data;
                    writeStoredProfileUpdated(new Date());
                    applyProfileFreshness(result.data);
                    cacheClear(CACHE_PREFIX + timegemId + ':');

                    var slot = profileIdentity();
                    if (slot) renderProfile(slot, result.data, { disconnect: false, featured: true });

                    renderHomeGemsMessage(TEXT.gemsUpdating);
                    applyRecommendations(timegemId, venueId);

                    var when = new Date();
                    setText(status, fmt(TEXT.refreshDone, {
                        time: when.toLocaleTimeString(pageLocale(), { hour: '2-digit', minute: '2-digit' })
                    }));
                    return;
                }

                if (result.reconnect) {
                    setText(status, TEXT.refreshExpired);
                    appendConnectChoices(reconnectSlot);
                    return;
                }

                if (result.status === 429) {
                    setText(status, TEXT.refreshRateLimited);
                    return;
                }

                setText(status, TEXT.refreshError);
            });
        });

        parent.appendChild(wrap);
        return wrap;
    }

    var profileLikesView = { body: null, likes: null, failed: false };

    function paintProfileLikes() {
        var body = profileLikesView.body;
        var likes = profileLikesView.likes;
        if (!body || !body.isConnected || !likes) return;

        body.innerHTML = '';

        function message(text) {
            var line = document.createElement('p');
            setText(line, text);
            body.appendChild(line);
        }

        if (profileLikesView.failed) {
            message(TEXT.likesError);
            return;
        }
        if (!likes.length) {
            message(TEXT.likesEmpty);
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
                item.appendChild(buildGemDate(when, locale));
            }

            var link = document.createElement('a');
            link.className = 'timegem-ven-gem__name';
            link.href = slug ? agendaPath + slug + '/' : '/agenda/';
            link.textContent = name || slug;
            item.appendChild(link);

            var unlike = document.createElement('button');
            unlike.type = 'button';
            unlike.className = 'timegem-ven-gem__unlike';
            setText(unlike, TEXT.unlike);
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
            message(TEXT.likesLoading);
            return;
        }
        body.appendChild(list);
    }

    function renderProfileLikes(slot, hasId) {
        var title = document.createElement('h2');
        setText(title, TEXT.likesTitle);
        slot.appendChild(title);

        var body = document.createElement('div');
        slot.appendChild(body);
        profileLikesView.body = body;

        if (!hasId) {
            var signedOut = document.createElement('p');
            setText(signedOut, TEXT.likesSignedOut);
            body.appendChild(signedOut);
            return;
        }

        var loading = document.createElement('p');
        setText(loading, TEXT.likesLoading);
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

    /**
     * The WordPress page is laid out in two columns: the theme's sidebar nav
     * (`.nav--sidebar`) in the first, the page content in the second. Mount in
     * the second column so the sidebar stays put.
     */
    function getProfileMount() {
        var article = document.querySelector('article');
        if (article) {
            var columns = article.querySelectorAll('.column');
            if (columns.length > 1) {
                var inSecond = columns[1].querySelector(PROFILE_MOUNT);
                if (inSecond) return inSecond;
            }
            var blocks = article.querySelectorAll(PROFILE_MOUNT);
            for (var i = 0; i < blocks.length; i++) {
                if (!blocks[i].querySelector('.nav--sidebar')) return blocks[i];
            }
            if (blocks.length) return blocks[blocks.length - 1];
        }
        return document.querySelector(PROFILE_MOUNT);
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
        nav.setAttribute('aria-label', TEXT.profileNavLabel);
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
            setText(tab, item.label);
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
        setText(gemsTitle, TEXT.recommendationsTitle);
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
                setText(signedOut, TEXT.profileSignedOut);
                panels.profile.appendChild(signedOut);
            }
            renderHomeGemsMessage(TEXT.gemsSignedOut);
            return;
        }

        if (panels.profile) {
            var loading = document.createElement('p');
            loading.className = 'timegem-ven-fineprint';
            setText(loading, TEXT.profileLoading);
            panels.profile.appendChild(loading);
        }
        renderHomeGemsMessage(TEXT.gemsLoading);

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
                setText(fail, TEXT.profileError);
                slot.appendChild(fail);
                return;
            }
            profileCache[timegemId] = data;
            applyProfileFreshness(data);
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
        var link = document.createElement('link');
        link.id = 'timegem-ven-styles';
        link.rel = 'stylesheet';
        link.href = STYLESHEET_URL;
        document.head.appendChild(link);
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
