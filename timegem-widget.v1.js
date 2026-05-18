
var TIMEGEM_API_BASE = 'https://api.timegem.nl';

(function () {
    'use strict';

    var agendaPath = '/agenda/';
    var TIMEGEM_STORAGE_KEY = 'timegem_ven_id';

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

    function getVentureIdFromQueue() {
        try {
            var items = getTimegemQueueItems();
            for (var i = 0; i < items.length; i++) {
                var id = getConfigIdFromCommand(items[i]);
                if (id) return id;
            }
        } catch (e) {}
        return null;
    }

    function getTimegemIdFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search);
            return params.get('timegem_id') || null;
        } catch (e) {
            return null;
        }
    }

    function getTimegemId() {
        var fromQueue = getVentureIdFromQueue();
        if (fromQueue) {
            try { localStorage.setItem(TIMEGEM_STORAGE_KEY, fromQueue); } catch (e) {}
            return fromQueue;
        }

        var fromUrl = getTimegemIdFromUrl();
        if (fromUrl) {
            try { localStorage.setItem(TIMEGEM_STORAGE_KEY, fromUrl); } catch (e) {}
            return fromUrl;
        }

        try {
            return localStorage.getItem(TIMEGEM_STORAGE_KEY) || null;
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

    var LOG_PREFIX = '[Timegem Venue]';

    function logVenueStatus(gemId, result) {
        if (!result || !result.ok) {
            var apiError = result && result.data && result.data.error;
            console.log(LOG_PREFIX, 'API connection: incorrect', {
                gemId: gemId,
                status: result ? result.status : 0,
                error: apiError || (result && result.error ? String(result.error) : 'Network or parse error')
            });
            console.log(LOG_PREFIX, 'Venue found: no');
            return;
        }

        var data = result.data;
        var venueFound = !!(data && data.gem === 'venue' && data.profile && data.profile.id);
        console.log(LOG_PREFIX, 'API connection: correct', { gemId: gemId, status: result.status });
        if (venueFound) {
            console.log(LOG_PREFIX, 'Venue found: yes', {
                profileId: data.profile.id,
                displayName: data.profile.display_name,
                venueId: data.profile.venue_id,
                recommendations: Array.isArray(data.recommendations) ? data.recommendations.length : 0
            });
        } else {
            console.log(LOG_PREFIX, 'Venue found: no', {
                reason: data && data.error ? data.error : 'No venue profile in API response'
            });
        }
    }

    function fetchArtistRecommendations(gemId) {
        var url = TIMEGEM_API_BASE + '/api/artist-recommendations-v4/' + encodeURIComponent(gemId) + '?gem=venue';
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

    function runTimegemFlow(attempt) {
        attempt = attempt || 0;
        var gemId = getTimegemId();
        if (!gemId && attempt < 20) {
            setTimeout(function () { runTimegemFlow(attempt + 1); }, 50);
            return;
        }
        if (!gemId) {
            console.log(LOG_PREFIX, 'No venue ID configured (timegem queue, URL param, or localStorage)', {
                queueLength: getTimegemQueueItems().length,
                timegemType: window.timegem ? typeof window.timegem : 'undefined'
            });
            return;
        }

        fetchArtistRecommendations(gemId).then(function (result) {
            logVenueStatus(gemId, result);
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
