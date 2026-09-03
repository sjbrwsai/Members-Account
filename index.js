var focusedIdx = -1;
var lastQuery = '';
var lastBlock = '';
var lastType = '';
var lastIdStatus = '';
var lastSuggested = false;
var currentResults = [];
var PAGE_SIZE = 20;
var currentPage = 1;
var BALANCES = {};
var revealedOnce = false;

function getBalance(m) {
    if (typeof PAYMENTS_BY_INDEX !== 'undefined' && PAYMENTS_BY_INDEX && typeof MEMBERS !== 'undefined') {
        var idx = MEMBERS.indexOf(m);
        if (idx !== -1 && PAYMENTS_BY_INDEX[idx] && PAYMENTS_BY_INDEX[idx].totalBalance !== undefined) {
            var pb = PAYMENTS_BY_INDEX[idx].totalBalance;
            return (pb === null || pb === '') ? null : Number(pb);
        }
    }
    var acct = String(m.a || '');
    if (BALANCES[acct] !== undefined) return BALANCES[acct];
    var num = acct;
    try { num = String(parseInt(acct)); } catch(e) {}
    if (BALANCES[num] !== undefined) return BALANCES[num];
    if (acct.indexOf('-') !== -1) {
        var suffix = acct.split('-').pop();
        if (BALANCES[suffix] !== undefined) return BALANCES[suffix];
    }
    return null;
}

function formatPeso(val) {
    return '\u20B1' + Number(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function getChipValue(containerId) {
    var active = document.querySelector('#' + containerId + ' .chip.active');
    return active ? active.getAttribute('data-value') : '';
}

function setChipValue(containerId, value) {
    Array.prototype.forEach.call(document.querySelectorAll('#' + containerId + ' .chip'), function(b) {
        b.classList.toggle('active', b.getAttribute('data-value') === value);
    });
}

function getLastName(m) { return m.ln || ''; }

function highlightText(text, query) {
    if (!query) return esc(text);
    var escaped = esc(text);
    var lq = query.toLowerCase();
    var lt = text.toLowerCase();
    var idx = lt.indexOf(lq);
    if (idx === -1) return escaped;
    var before = esc(text.substring(0, idx));
    var match = esc(text.substring(idx, idx + query.length));
    var after = esc(text.substring(idx + query.length));
    return before + '<span class="highlight">' + match + '</span>' + after;
}

function computeStats() {
    var member = 0, senior = 0, hasID = 0;
    var blockCounts = {};
    MEMBERS.forEach(function(m) {
        if (m.mt && m.mt.toLowerCase() === 'member') member++;
        else if (m.mt && m.mt.toLowerCase() === 'senior member') senior++;
        if (m.di) hasID++;
        if (m.b) blockCounts[m.b] = (blockCounts[m.b] || 0) + 1;
    });
    var noID = MEMBERS.length - hasID;

    document.getElementById('statTotal').textContent = MEMBERS.length;

    renderPie('typePie', 'typeLegend', [
        { value: member, color: '#1a237e', label: 'Member' },
        { value: senior, color: '#e65100', label: 'Senior' }
    ]);
    renderPie('idPie', 'idLegend', [
        { value: hasID, color: '#4caf50', label: 'Has ID' },
        { value: noID, color: '#f44336', label: 'No ID' }
    ]);

    var blockColors = ['#1a237e','#e65100','#1565c0','#4caf50','#9c27b0','#f44336','#00897b','#ff9800','#5c6bc0','#c62828','#2e7d32','#6a1b9a','#d84315','#0277bd','#4e342e','#37474f'];
    var blockKeys = Object.keys(blockCounts).sort();
    var blockSegments = [];
    for (var i = 0; i < blockKeys.length; i++) {
        blockSegments.push({
            value: blockCounts[blockKeys[i]],
            color: blockColors[i % blockColors.length],
            label: 'Block ' + blockKeys[i]
        });
    }
    renderPie('blockPie', 'blockLegend', blockSegments);
}

function renderPie(elementId, legendId, segments) {
    var total = 0;
    var i;
    for (i = 0; i < segments.length; i++) total += segments[i].value;

    var gradient = [];
    var cumulative = 0;
    for (i = 0; i < segments.length; i++) {
        var pct = total > 0 ? segments[i].value / total * 100 : 0;
        gradient.push(segments[i].color + ' ' + cumulative + '% ' + (cumulative + pct) + '%');
        cumulative += pct;
    }

    var el = document.getElementById(elementId);
    el.style.background = 'conic-gradient(' + gradient.join(', ') + ')';

    var legend = document.getElementById(legendId);
    if (legend) {
        var lhtml = '';
        for (i = 0; i < segments.length; i++) {
            var p = total > 0 ? Math.round(segments[i].value / total * 100) : 0;
            lhtml += '<span class="legend-item"><span class="legend-dot" style="background:' + segments[i].color + '"></span>' + segments[i].label + ': ' + segments[i].value + '<span class="legend-pct">' + p + '%</span></span>';
        }
        legend.innerHTML = lhtml;
    }
}

function updateFilterUI(query, block, mtype, idStatus) {
    var bar = document.getElementById('filterBar');
    var clearBtn = document.getElementById('clearFilters');
    var pillsContainer = document.getElementById('activeFilters');
    var hasFilters = block || mtype || idStatus;

    bar.classList.toggle('has-filters', !!hasFilters);
    clearBtn.classList.toggle('visible', !!hasFilters);
    setChipValue('blockChips', block);
    setChipValue('typeChips', mtype);
    setChipValue('idChips', idStatus);

    var pills = '';
    if (query) {
        pills += '<span class="filter-pill"><span class="filter-label-text">Search:</span> "' + esc(query) + '" <span class="pill-remove" onclick="document.getElementById(\'searchInput\').value=\'\';performSearch()">&#10005;</span></span>';
    }
    if (block) {
        pills += '<span class="filter-pill"><span class="filter-label-text">Block:</span> ' + esc(block) + ' <span class="pill-remove" onclick="setChipValue(\'blockChips\',\'\');performSearch()">&#10005;</span></span>';
    }
    if (mtype) {
        pills += '<span class="filter-pill"><span class="filter-label-text">Type:</span> ' + esc(mtype) + ' <span class="pill-remove" onclick="setChipValue(\'typeChips\',\'\');performSearch()">&#10005;</span></span>';
    }
    if (idStatus) {
        pills += '<span class="filter-pill"><span class="filter-label-text">ID:</span> ' + esc(idStatus) + ' <span class="pill-remove" onclick="setChipValue(\'idChips\',\'\');performSearch()">&#10005;</span></span>';
    }
    pillsContainer.innerHTML = pills;
}

function performSearch() {
    if (!window.MEMBERS) return;
    var query = document.getElementById('searchInput').value.trim();
    var block = getChipValue('blockChips');
    var mtype = getChipValue('typeChips');
    var idStatus = getChipValue('idChips');
    var sort = document.getElementById('sortBy').value;

    lastQuery = query;
    lastBlock = block;
    lastType = mtype;
    lastIdStatus = idStatus;
    focusedIdx = -1;
    currentPage = 1;

    var lq = query.toLowerCase();

    var filtered = MEMBERS.filter(function(m) {
        if (lq && !memberMatches(m, lq)) return false;
        if (block && m.b !== block) return false;
        if (mtype && m.mt !== mtype) return false;
        if (idStatus === 'Has ID' && !m.di) return false;
        if (idStatus === 'No ID' && m.di) return false;
        return true;
    });

    lastSuggested = false;
    if (filtered.length === 0 && lq && /[a-z]/.test(lq)) {
        filtered = MEMBERS.filter(function(m) { return memberNearMatches(m, lq); });
        if (filtered.length) lastSuggested = true;
    }

    filtered.sort(function(a, b) {
        var key = sort.split('-')[0];
        var dir = sort.split('-')[1] === 'desc' ? -1 : 1;
        var va, vb;
        if (key === 'name') { va = a.fn.toLowerCase(); vb = b.fn.toLowerCase(); }
        else { va = getLastName(a).toLowerCase(); vb = getLastName(b).toLowerCase(); }
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
    });

    currentResults = filtered;
    updateFilterUI(query, block, mtype, idStatus);
    showResults(filtered);
}

function clearAllFilters() {
    setChipValue('blockChips', '');
    setChipValue('typeChips', '');
    setChipValue('idChips', '');
    performSearch();
}

function showResults(members) {
    var grid = document.getElementById('resultsGrid');
    var info = document.getElementById('resultsInfo');
    var total = MEMBERS.length;
    var count = members.length;
    var hasFilters = lastQuery || lastBlock || lastType;

    var totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    var startIdx = (currentPage - 1) * PAGE_SIZE;
    var pageMembers = members.slice(startIdx, startIdx + PAGE_SIZE);

    info.innerHTML = !hasFilters
        ? 'Showing all ' + total + ' member' + (total !== 1 ? 's' : '')
        : count === 0
            ? 'No matches found'
            : (lastSuggested
                ? 'No exact match &mdash; showing close spellings (' + count + ')'
                : 'Showing ' + (startIdx + 1) + '\u2013' + (startIdx + pageMembers.length) + ' of ' + count + ' match' + (count !== 1 ? 'es' : ''));

    if (members.length === 0) {
        grid.innerHTML =
            '<div class="no-results">' +
            '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>' +
            '<p>No members found.</p></div>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    grid.innerHTML = pageMembers.map(function(m, idx) {
        var initials = getInitials(m.n);
        var imgSrc = m.i ? imgFolder(m, 'photo') + m.i : '';
        var photoHtml;
        if (imgSrc) {
            photoHtml = '<img class="member-photo" src="' + esc(imgSrc) + '" onerror="handleImgError(this,\'' + esc(initials) + '\')" alt="' + esc(m.n) + '">';
        } else {
            photoHtml = '<div class="member-photo-placeholder">' + esc(initials) + '</div>';
        }

        return '<a href="member.html?i=' + MEMBERS.indexOf(m) + '" style="text-decoration:none;color:inherit" class="card-link">' +
            '<div class="member-card" data-idx="' + idx + '">' +
            '<div class="photo-col">' +
            photoHtml +
            (m.mt ? '<span class="card-type' + (m.mt === 'Senior Member' ? ' senior' : '') + '">' + esc(m.mt) + '</span>' : '') +
            '</div>' +
            '<div class="member-info">' +
            '<div class="member-name">' + highlightText(m.n, lastQuery) + '</div>' +
            '<div class="member-acct">Acct No. ' + highlightText(String(m.a), lastQuery) + (m.mt === 'Senior Member' && m.scid ? ' | SCID ' + esc(m.scid) : '') + '</div>' +
            '<div class="details-grid">' +
            '<span class="detail-label">BLOCK</span><span class="detail-value">' + (m.b ? esc(m.b) : '\u2014') + '</span>' +
            '<span class="detail-label">Balance</span><span class="detail-value balance-cell' + (getBalance(m) !== null && getBalance(m) > 0 ? ' balance-orange' : '') + '">' + (getBalance(m) !== null ? formatPeso(getBalance(m)) : '\u2014') + '</span>' +
            '<span class="detail-label">Gender</span><span class="detail-value">' + (m.g ? esc(m.g) : '\u2014') + '</span>' +
            '<span class="detail-label">ID Printed</span><span class="detail-value' + (m.di ? ' id-yes' : ' id-no') + '">' + (m.di ? 'Yes' : 'No') + '</span>' +
            '<span class="detail-label">Age</span><span class="detail-value">' + (getAge(m) !== null ? getAge(m) : '\u2014') + '</span>' +
            '</div></div></div></a>';
    }).join('');

    if (!revealedOnce) {
        revealedOnce = true;
        var cards = grid.querySelectorAll('.member-card');
        cards.forEach(function(c, i) {
            c.classList.add('reveal');
            setTimeout(function() { c.classList.add('visible'); }, i * 45);
        });
    }

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    var pag = document.getElementById('pagination');
    if (totalPages <= 1) { pag.innerHTML = ''; return; }
    var html = '<button class="page-btn"' + (currentPage === 1 ? ' disabled' : '') + ' onclick="goToPage(' + (currentPage - 1) + ')">&larr;</button>';
    getPageNumbers(currentPage, totalPages).forEach(function(p) {
        if (p === '\u2026') html += '<span class="page-ellipsis">\u2026</span>';
        else html += '<button class="page-btn' + (p === currentPage ? ' active' : '') + '" onclick="goToPage(' + p + ')">' + p + '</button>';
    });
    html += '<button class="page-btn"' + (currentPage === totalPages ? ' disabled' : '') + ' onclick="goToPage(' + (currentPage + 1) + ')">&rarr;</button>';
    pag.innerHTML = html;
}

function getPageNumbers(cur, total) {
    var out = [];
    for (var i = 1; i <= total; i++) {
        if (i === 1 || i === total || Math.abs(i - cur) <= 2) out.push(i);
        else if (out[out.length - 1] !== '\u2026') out.push('\u2026');
    }
    return out;
}

function goToPage(p) {
    currentPage = p;
    focusedIdx = -1;
    showResults(currentResults);
    var searchBar = document.querySelector('.search-section');
    var offset = searchBar ? searchBar.getBoundingClientRect().top + window.pageYOffset - 12 : 0;
    window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
}

function handleSearchKey(e) {
    if (e.key === 'Enter') { performSearch(); return; }
    var cards = document.querySelectorAll('.results-grid .member-card');
    if (!cards.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        focusedIdx = Math.min(focusedIdx + 1, cards.length - 1);
        updateFocus(cards);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        focusedIdx = Math.max(focusedIdx - 1, 0);
        updateFocus(cards);
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
        e.preventDefault();
        var link = cards[focusedIdx].closest('a');
        if (link) window.location.href = link.href;
    } else if (e.key === 'Escape') {
        clearAllFilters();
        focusedIdx = -1;
    }
}

function updateFocus(cards) {
    cards.forEach(function(c, i) {
        c.classList.toggle('focused', i === focusedIdx);
        if (i === focusedIdx) c.scrollIntoView({ block: 'nearest' });
    });
}

function getInitials(name) {
    return name.split(' ').map(function(w) { return w[0] || ''; }).join('').substring(0, 2).toUpperCase();
}

function handleImgError(img, initials) {
    img.outerHTML = '<div class="member-photo-placeholder">' + initials + '</div>';
}

function buildChips(containerId, values, withAll) {
    var container = document.getElementById(containerId);
    var html = '';
    if (withAll !== false) {
        html += '<button type="button" class="chip active" data-value="">All</button>';
    }
    values.forEach(function(v) {
        html += '<button type="button" class="chip" data-value="' + esc(v) + '">' + esc(v) + '</button>';
    });
    container.innerHTML = html;
    Array.prototype.forEach.call(container.querySelectorAll('.chip'), function(btn) {
        btn.addEventListener('click', function() {
            var v = this.getAttribute('data-value');
            var wasActive = this.classList.contains('active');
            setChipValue(containerId, wasActive ? '' : v);
            performSearch();
        });
    });
}

loadTheme();

function loadRecent() {
    if (!window.MEMBERS) return;
    var recent = JSON.parse(localStorage.getItem('recentMembers') || '[]');
    var section = document.getElementById('recentSection');
    var list = document.getElementById('recentList');
    if (!recent.length) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    var html = '';
    recent.forEach(function(idx) {
        var m = MEMBERS[idx];
        if (!m) return;
        var photo = m.i ? imgFolder(m, 'photo') + m.i : '';
        html += '<a href="member.html?i=' + idx + '" class="recent-item">' +
            (photo ? '<img class="ri-photo" src="' + esc(photo) + '" onerror="this.style.display=\'none\'">' : '') +
            '<span class="ri-name">' + esc(m.n) + '</span></a>';
    });
    list.innerHTML = html;
}

window.addEventListener('scroll', function() {
    document.getElementById('backToTop').classList.toggle('visible', window.scrollY > 400);
});

function animateCount(el, target, prefix, isMoney, dur) {
    var start = 0;
    var startTime = null;
    var duration = dur || 1100;
    function step(ts) {
        if (!startTime) startTime = ts;
        var p = Math.min((ts - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = target * eased;
        var txt = prefix + (isMoney
            ? '₱' + Number(val).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})
            : Math.round(val).toLocaleString('en-PH'));
        el.textContent = txt;
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function populateHero() {
    var el = document.getElementById('statTotal');
    if (el && typeof MEMBERS !== 'undefined' && MEMBERS) {
        animateCount(el, MEMBERS.length, '', false, 1000);
    }
}

(async function() {
    try {
        await loadMembers();
    } catch (e) {
        document.getElementById('resultsGrid').innerHTML =
            '<div class="no-results"><p>Failed to load member data.</p><p>Please try refreshing the page.</p></div>';
        return;
    }

    applyAllOverrides();
    updateAdminUI();
    updateEditCounter();

    try {
        BALANCES = (typeof BALANCES !== 'undefined' && BALANCES) ? BALANCES : {};
    } catch (e) {
        BALANCES = {};
    }

    var allBlocks = [];
    MEMBERS.forEach(function(m) {
        if (m.b && allBlocks.indexOf(m.b) === -1) allBlocks.push(m.b);
    });
    allBlocks.sort();

    buildChips('blockChips', allBlocks);
    buildChips('typeChips', ['Member', 'Senior Member'], false);
    buildChips('idChips', ['Has ID', 'No ID'], false);

    populateHero();
    computeStats();
    populateHero();
    performSearch();
    loadRecent();

    var urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) {
        document.getElementById('searchInput').value = urlQ;
        performSearch();
    }
})();
