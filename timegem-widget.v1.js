/**
 * TimeGem VEN Events – enrich .wp_theatre_event with data from Supabase vp__events.
 * When timegem_id is in the URL, fetches artist recommendations and appends matchDetails.
 */


var TIMEGEM_SUPABASE_URL = 'https://gcrgokyyeahltyieyugm.supabase.co';
var TIMEGEM_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjcmdva3l5ZWFobHR5aWV5dWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyMzI5NDcsImV4cCI6MjA2MDgwODk0N30.UPdk5zIihoRPdLkMQO29YBnIxZ4xoemgIxkatgNLXrI';

var TIMEGEM_API_BASE = 'https://mpt-api.netlify.app';

(function () {
    'use strict';

    var supabaseUrl = (TIMEGEM_SUPABASE_URL || '').replace(/\/$/, '');
    var supabaseKey = TIMEGEM_SUPABASE_ANON_KEY || '';

    var agendaPath = '/agenda/';
    var TIMEGEM_STORAGE_KEY = 'timegem_ven_id';

    /**
     * Whether current page path contains /agenda/ (single event page).
     */
    function isAgendaPage() {
        try {
            return (window.location.pathname || '').indexOf(agendaPath) !== -1;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get event slug from current page URL (e.g. /agenda/nightbus/ -> nightbus).
     */
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

    /**
     * Get timegem_id from URL query string (e.g. ?timegem_id=xxx).
     */
    function getTimegemIdFromUrl() {
        try {
            var params = new URLSearchParams(window.location.search);
            return params.get('timegem_id') || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get timegem_id: from URL first (and store in localStorage), else from localStorage.
     */
    function getTimegemId() {
        var fromUrl = getTimegemIdFromUrl();
        if (fromUrl) {
            try {
                localStorage.setItem(TIMEGEM_STORAGE_KEY, fromUrl);
            } catch (e) {}
            return fromUrl;
        }
        try {
            return localStorage.getItem(TIMEGEM_STORAGE_KEY) || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Extract slug from href: path after '/agenda/' (e.g. rotown.nl/agenda/snayx/ -> snayx).
     */
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

    /**
     * Fetch artist recommendations for venue gem.
     */
    function fetchArtistRecommendations(gemId) {
        var url = TIMEGEM_API_BASE + '/api/artist-recommendations-v4/' + encodeURIComponent(gemId) + '?gem=venue';
        return fetch(url, { method: 'GET' })
            .then(function (res) { return res.json(); })
            .catch(function () { return null; });
    }

    /**
     * Fetch one event from Supabase vp__events by slug.
     */
    function fetchEventBySlug(slug) {
        var url = supabaseUrl + '/rest/v1/vp__events?event_slug=eq.' + encodeURIComponent(slug) + '&limit=1';
        return fetch(url, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': 'Bearer ' + supabaseKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .then(function (res) { return res.json(); })
            .then(function (rows) {
                return Array.isArray(rows) && rows.length ? rows[0] : null;
            })
            .catch(function () { return null; });
    }

    /**
     * Render event data into a yellow block div (text only; no HTML from API for safety).
     */
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

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    /**
     * Build a map slug -> recommendation from API response.
     */
    function slugToRecommendation(apiData) {
        var map = {};
        if (!apiData || !Array.isArray(apiData.recommendations)) return map;
        apiData.recommendations.forEach(function (rec) {
            var slug = rec.artist && rec.artist.event_slug;
            if (slug) map[slug] = rec;
        });
        return map;
    }

    /**
     * Symbol for match types: light=1, medium=2, heavy=3 diamonds; direct=star.
     */
    function getMatchTypeSymbol(matchType) {
        var diamond = '\u25C6'; // &#9830; ♦
        var star = '\u2605';    // &#9733; ★
        if (!matchType) return '';
        var t = String(matchType).toLowerCase();
        if (t === 'none') return '';
        if (t === 'direct') return star;
        if (t === 'light') return diamond;
        if (t === 'medium') return diamond + diamond;
        if (t === 'heavy') return diamond + diamond + diamond;
        return '';
    }

    /**
     * Append match badge by matchType (direct=★, light=♦, medium=♦♦, heavy=♦♦♦, none=hide).
     * Black background, yellow text. Target: .wp__theater or block, absolute right top.
     */
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

    /**
     * On /agenda/ page: insert matchDetails above .wp_theatre_event_startdate inside .details (div.timegem-ven-why).
     */
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

    /**
     * When timegem_id is in URL: fetch recommendations and append matchDetails to each event.
     * On /agenda/ page, also prepend matchDetails to .details.
     */
    function runTimegemFlow() {
        var gemId = getTimegemId();
        if (!gemId) return;

        fetchArtistRecommendations(gemId).then(function (apiData) {
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

    /**
     * Process a single .wp_theatre_event element (Supabase data).
     */
    function processEventBlock(block) {
        if (!supabaseUrl || !supabaseKey) return;
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

    /**
     * Run when DOM is ready.
     */
    function run() {
        runTimegemFlow();
        var blocks = document.querySelectorAll('.wp_theatre_event');
        blocks.forEach(processEventBlock);
    }

    /**
     * Inject styles for the yellow block and match-type badge (self-contained in this script).
     */
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
