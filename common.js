function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function formatPeso(val) {
    return '\u20B1' + Number(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function splitTokens(s) {
    return String(s).toLowerCase().replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
}

function tokenHits(qt, tokens) {
    for (var j = 0; j < tokens.length; j++) {
        var t = tokens[j];
        if (t.indexOf(qt) === 0) return true;
    }
    return false;
}

function editDistance(a, b) {
    var m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 3;
    var prev = [], curr = [];
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
        curr[0] = i;
        for (var k = 1; k <= n; k++) {
            var cost = a[i - 1] === b[k - 1] ? 0 : 1;
            curr[k] = Math.min(prev[k] + 1, curr[k - 1] + 1, prev[k - 1] + cost);
        }
        var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
}

function nearToken(qt, tokens) {
    var maxD = qt.length <= 4 ? 1 : 2;
    for (var j = 0; j < tokens.length; j++) {
        if (tokens[j].length > 2 && editDistance(qt, tokens[j]) <= maxD) return true;
    }
    return false;
}

function memberMatches(m, query) {
    var q = String(query || '').toLowerCase().trim();
    if (!q) return true;
    if (String(m.a).toLowerCase().indexOf(q) !== -1) return true;
    if (q.length >= 3 && String(m.scid || '').toLowerCase().indexOf(q) !== -1) return true;
    if (q.length >= 3 && String(m.c || '').replace(/\D/g, '').indexOf(q.replace(/\D/g, '')) !== -1 && q.replace(/\D/g, '').length >= 3) return true;
    var nameTokens = splitTokens(m.n);
    var qTokens = splitTokens(q);
    if (!qTokens.length) return false;
    for (var i = 0; i < qTokens.length; i++) {
        if (!tokenHits(qTokens[i], nameTokens)) return false;
    }
    return true;
}

function memberNearMatches(m, query) {
    var qTokens = splitTokens(query);
    if (!qTokens.length) return false;
    var nameTokens = splitTokens(m.n);
    for (var i = 0; i < qTokens.length; i++) {
        if (!nearToken(qTokens[i], nameTokens)) return false;
    }
    return true;
}

function getAge(m) {
    if (!m.r) return null;
    var b = new Date(m.r);
    if (isNaN(b.getTime())) return null;
    var t = new Date();
    var age = t.getFullYear() - b.getFullYear();
    var mm = t.getMonth() - b.getMonth();
    if (mm < 0 || (mm === 0 && t.getDate() < b.getDate())) age--;
    return age >= 0 && age < 130 ? age : null;
}

/* Images are committed to the repo and served by GitHub Pages at their
   relative paths, so imgFolder() returns repo-relative paths. */
var IMAGE_BASE = '';

function imgFolder(m, kind) {
    var senior = m.mt === 'Senior Member';
    if (kind === 'sig') return IMAGE_BASE + (senior ? 'Senior_Signature/' : 'Signature_Image/');
    return IMAGE_BASE + (senior ? 'Senior_2x2/' : '2x2_Image/');
}

function updateThemeToggleIcon() {
    var isDark = document.body.classList.contains('dark');
    var t = document.getElementById('themeToggle');
    if (t) t.innerHTML = isDark ? '&#9788;' : '&#9790;';
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    updateThemeToggleIcon();
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

function loadTheme() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
    updateThemeToggleIcon();
}

/* Handle the reveal-on-scroll hero ticker if present. */
document.addEventListener('DOMContentLoaded', function() {
    loadTheme();
    startHeaderClock();
});

function startHeaderClock() {
    var el = document.getElementById('headerClock');
    if (!el) return;
    var dateEl = document.createElement('span');
    var timeEl = document.createElement('span');
    el.appendChild(dateEl);
    el.appendChild(timeEl);
    function tick() {
        var d = new Date();
        dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        timeEl.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
}

function getMemberEdits() {
    try { return JSON.parse(localStorage.getItem('memberEdits') || '{}'); } catch (e) { return {}; }
}

function saveMemberEdit(acctNo, fieldData) {
    var edits = getMemberEdits();
    if (!edits[acctNo]) edits[acctNo] = {};
    var keys = Object.keys(fieldData);
    for (var i = 0; i < keys.length; i++) {
        edits[acctNo][keys[i]] = fieldData[keys[i]];
    }
    localStorage.setItem('memberEdits', JSON.stringify(edits));
}

function applyAllOverrides() {
    var edits = getMemberEdits();
    var accts = Object.keys(edits);
    for (var i = 0; i < accts.length; i++) {
        var acct = accts[i];
        var changes = edits[acct];
        for (var j = 0; j < MEMBERS.length; j++) {
            if (String(MEMBERS[j].a) === String(acct)) {
                var fields = Object.keys(changes);
                for (var k = 0; k < fields.length; k++) {
                    MEMBERS[j][fields[k]] = changes[fields[k]];
                }
                break;
            }
        }
    }
}

function getMemberIndex(acctNo) {
    for (var j = 0; j < MEMBERS.length; j++) {
        if (String(MEMBERS[j].a) === String(acctNo)) return j;
    }
    return -1;
}

function getPendingEditCount() {
    return Object.keys(getMemberEdits()).length;
}

function updateEditCounter() {
    var counters = document.querySelectorAll('.edit-counter');
    var count = getPendingEditCount();
    counters.forEach(function(el) {
        el.textContent = count > 0 ? count + ' edit' + (count !== 1 ? 's' : '') : '';
        el.style.display = count > 0 ? '' : 'none';
    });
}

async function loadMembers() {
    /* Static site: member data is pre-generated into members_data.js
       (see generate_static_data.py), loaded before this file. */
    window.MEMBERS = (typeof MEMBERS !== 'undefined' && MEMBERS) ? MEMBERS : [];
    return MEMBERS;
}
