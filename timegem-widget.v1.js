
var TIMEGEM_API_BASE = 'https://api.timegem.nl';

(function () {
    'use strict';

    var agendaPath = '/agenda/';
    var TIMEGEM_USER_STORAGE_KEY = 'timegem_ven_id';

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

    function fetchArtistRecommendations(timegemId, venueId) {
        var url = TIMEGEM_API_BASE + '/api/artist-recommendations-v4/' + encodeURIComponent(timegemId) + '?gem=venue';
        if (venueId) url += '&venue_id=' + encodeURIComponent(venueId);
        return fetch(url, { method: 'GET' })
            .then(function (res) {
                return res.json().then(function (data) {
                    return { ok: res.ok, status: res.status, data: data };
                });
            })
            .catch(function (err) {
                return { ok: false, status: 0, data: null, error: err };
            });
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

    function renderYellowBlock(data) {
        if (!data || typeof data !== 'object') return '';
        var parts = [];
        Object.keys(data).forEach(function (key) {
            var val = data[key];
            if (val == null) return;
            if (typeof val === 'object') val = JSON.stringify(val);
            else val = String(val);
            parts.push('<div class="timegem-ven-field"><strong>' + escapeHtml(key) + ':</strong> ' + escapeHtml(val) + '</div>');
        });
        if (!parts.length) return '';
        return '<div class="timegem-ven-yellow-block">' + parts.join('') + '</div>';
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
        fetchArtistRecommendations(timegemId, venueId).then(function (result) {
            var apiData = result && result.ok ? result.data : null;
            if (!apiData) return;
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
                var pageSlug = getSlugFromCurrentPath();
                if (pageSlug && bySlug[pageSlug]) prependMatchDetailsToDetails(bySlug[pageSlug]);
            }
        });
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

        Promise.all([
            fetchVenue(venueId),
            fetchVenueEvents(venueId)
        ]).then(function (results) {
            var venue = results[0];
            var eventsPayload = results[1];

            if (venue && venue.name) {
                console.log(LOG_PREFIX, 'Venue is loaded: ' + venue.name);
            } else if (eventsPayload && eventsPayload.venue && eventsPayload.venue.name) {
                console.log(LOG_PREFIX, 'Venue is loaded: ' + eventsPayload.venue.name);
            }

            if (eventsPayload && Array.isArray(eventsPayload.events)) {
                console.log(LOG_PREFIX, 'Events are loaded');
            }

            if (!timegemId) {
                console.log(LOG_PREFIX, 'No personal Timegem ID found');
                return;
            }

            applyRecommendations(timegemId, venueId);
        });
    }

    function processEventBlock(block) {
        var link = block.querySelector('a');
        if (!link || !link.href) return;
        var slug = getSlugFromHref(link.href);
        if (!slug) return;

        fetchEventBySlug(slug).then(function (eventData) {
            if (!eventData) return;
            var html = renderYellowBlock(eventData);
            if (!html) return;
            var wrap = document.createElement('div');
            wrap.className = 'timegem-ven-data';
            wrap.innerHTML = html;
            //block.appendChild(wrap);
        });
    }

    function run() {
        runTimegemFlow();
        var blocks = document.querySelectorAll('.wp_theatre_event');
        blocks.forEach(processEventBlock);
    }

    function injectStyles() {
        if (document.getElementById('timegem-ven-styles')) return;
        var style = document.createElement('style');
        style.id = 'timegem-ven-styles';
        style.textContent = '.wpt_listing .wp_theatre_event{position:relative;}.timegem-ven-data{position:absolute;top:4px;right:4px;}.timegem-ven-yellow-block{background:#ffeb3b;border:1px solid #fbc02d;padding:12px 16px;margin-top:12px;border-radius:4px;}.timegem-ven-field{margin:4px 0;}.timegem-ven-field:first-child{margin-top:0;}.timegem-ven-match-details{position:absolute;top:16px;right:16px;background:#000;color:greenyellow;padding:4px 10px 9px 10px;border-radius:0;font-size:24px;line-height:1;}.timegem-ven-why{background:black;color:white;padding:10px 14px;margin-bottom:12px;}';
        document.head.appendChild(style);
    }

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
