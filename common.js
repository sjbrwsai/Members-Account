function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
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

document.addEventListener('dragstart', function(e) { e.preventDefault(); });

/* Editing was removed for the public static site. A fixed value here would
   just leak a password into the source, so admin mode is disabled entirely. */
var ADMIN_PASS = '';

function isAdmin() {
    return sessionStorage.getItem('admin') === '1';
}

function doLogin() {
    var input = document.getElementById('adminPassInput');
    var err = document.getElementById('loginError');
    if (!input) return;
    var val = input.value.trim();
    if (val === ADMIN_PASS) {
        sessionStorage.setItem('admin', '1');
        closeLoginModal();
        updateAdminUI();
    } else {
        err.style.display = 'block';
        input.value = '';
        input.focus();
    }
}

function doLogout() {
    sessionStorage.removeItem('admin');
    updateAdminUI();
}

function openLoginModal() {
    var modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('active');
        var input = document.getElementById('adminPassInput');
        if (input) { input.value = ''; input.focus(); }
        var err = document.getElementById('loginError');
        if (err) err.style.display = 'none';
    }
}

function closeLoginModal() {
    var modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
}

function updateAdminUI() {
    var logged = isAdmin();
    var loginBtns = document.querySelectorAll('.admin-login-btn');
    var adminPanels = document.querySelectorAll('.admin-controls');
    loginBtns.forEach(function(b) { b.style.display = logged ? 'none' : ''; });
    adminPanels.forEach(function(p) { p.style.display = logged ? '' : 'none'; });
    var logoutBtns = document.querySelectorAll('.admin-logout-btn');
    logoutBtns.forEach(function(b) { b.style.display = logged ? '' : 'none'; });
    if (typeof renderProfile === 'function') renderProfile();
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

function handleLoginKey(e) {
    if (e.key === 'Enter') doLogin();
    if (e.key === 'Escape') closeLoginModal();
}

function buildWorkbook() {
    if (typeof XLSX === 'undefined') return null;
    var members = [];
    var seniors = [];
    for (var i = 0; i < MEMBERS.length; i++) {
        var m = MEMBERS[i];
        var row = {
            'First Name': m.fn || '',
            'Middle Name': m.mn || '',
            'Last Name': m.ln || '',
            'Acct No.': m.a || '',
            'BLOCK': m.b || '',
            'Contact No.': m.c || '',
            'Address': m.d || '',
            'Birthdate': m.r || '',
            'Gender': m.g || '',
            'SCID No.': m.scid || '',
            'Member Type': m.mt || '',
            'Date of Installation': m.doi || '',
            'Date Issued': m.di || ''
        };
        if (m.mt === 'Senior Member') seniors.push(row);
        else members.push(row);
    }
    var wb = XLSX.utils.book_new();
    if (members.length) {
        var ws1 = XLSX.utils.json_to_sheet(members);
        XLSX.utils.book_append_sheet(wb, ws1, 'Members');
    }
    if (seniors.length) {
        var ws2 = XLSX.utils.json_to_sheet(seniors);
        XLSX.utils.book_append_sheet(wb, ws2, 'Seniors');
    }
    return wb;
}

function exportToXLSX() {
    if (typeof XLSX === 'undefined') { alert('SheetJS library not loaded.'); return; }
    var wb = buildWorkbook();
    if (!wb) { alert('No member data to export.'); return; }
    XLSX.writeFile(wb, 'SJBRWSAI_Members_Export.xlsx');
}

function showToast(msg, isError) {
    var existing = document.querySelector('.save-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'save-toast' + (isError ? ' save-toast-error' : '');
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('active'); });
    setTimeout(function() {
        toast.classList.remove('active');
        setTimeout(function() { toast.remove(); }, 400);
    }, isError ? 4000 : 2500);
}

async function loadMembers() {
    /* Static site: member data is pre-generated into members_data.js
       (see generate_static_data.py), loaded before this file. */
    window.MEMBERS = (typeof MEMBERS !== 'undefined' && MEMBERS) ? MEMBERS : [];
    return MEMBERS;
}

async function saveToServer(acctNo, changes) {
    /* Edit persistence was removed for the static (server-less) site.
       This stub exists so any leftover callers resolve without error. */
    return { ok: false, error: 'Editing is not available in the online version.' };
}
