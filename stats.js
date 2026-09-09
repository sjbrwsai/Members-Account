function parseNum(s) {
    var n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? 0 : n;
}

(function() {
    var page = document.getElementById('statsPage');
    var loading = document.getElementById('statsLoading');

    var MEMBERS = [];
    var BLOCKS = [];
    var overall = null;
    var TREND = [];
    var trendTotalCycles = 0;
    var trendRange = '12'; /* '6', '12', '24', 'all' */
    var PAGE_SIZE = 10;
    var currentBlock = null;
    var currentPage = 1;
    var searchQuery = '';
    var calMonth = null;
    var calPayList = [];
    var payPage = 1;

    var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function calDateKey(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }

    function calTodayKey() {
        var t = new Date();
        return calDateKey(t.getFullYear(), t.getMonth(), t.getDate());
    }

    function currentMonthKey() {
        var t = new Date();
        return t.getFullYear() + '-' + pad2(t.getMonth() + 1);
    }

    function normAcct(a) {
        if (!a) return '';
        try { return String(parseInt(a)); } catch (e) { return String(a); }
    }

    function cleanName(n) {
        return String(n || '')
            .toLowerCase()
            .replace(/\([^)]*\)/g, ' ')
            .replace(/#/g, ' ')
            .replace(/\b(unit|apt|apartment|rm|room)\b/g, ' ')
            .replace(/[^a-z ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    var memberNameIndex = {}; /* cleanName -> member index (unique names only) */

    function findMemberIdx(arMember) {
        /* Link a stats row to member.html when a real member profile exists.
           Priority: account-number match, then unique cleaned-name match. */
        var acct = String(arMember.acct || '');
        for (var i = 0; i < MEMBERS.length; i++) {
            if (String(MEMBERS[i].a) === acct) return i;
        }
        var rec = acct;
        if (/^\d+-\d+$/.test(rec)) rec = normAcct(rec.split('-').pop());
        else rec = normAcct(acct);
        for (var j = 0; j < MEMBERS.length; j++) {
            if (normAcct(MEMBERS[j].a) === rec || String(MEMBERS[j].a) === rec) return j;
        }
        var digitsOnly = acct.replace(/[^0-9]/g, '');
        if (digitsOnly && digitsOnly !== rec) {
            for (var k = 0; k < MEMBERS.length; k++) {
                if (normAcct(MEMBERS[k].a) === digitsOnly) return k;
            }
        }
        var cn = cleanName(arMember.name);
        if (cn && memberNameIndex[cn] !== undefined) return memberNameIndex[cn];
        if (cn && cn.length >= 3) {
            /* fall back to the longest member cleaned-name that is a leading part of
               this row's cleaned name (handles "#1", "-B", unit suffixes, parentheticals
               appended to a real member profile). Choosing the longest prefix avoids
               short-name false positives. */
            var best = -1;
            var bestLen = -1;
            for (var nm in memberNameIndex) {
                if (!nm) continue;
                if (cn.indexOf(nm) === 0 && nm.length > bestLen) {
                    best = memberNameIndex[nm];
                    bestLen = nm.length;
                }
            }
            if (best >= 0) return best;
        }
        return -1;
    }

    function memberLink(m) {
        var idx = findMemberIdx(m);
        if (idx >= 0) {
            return '<a class="member-link" href="member.html?i=' + idx + '">' + esc(m.name) + '<span class="ml-acct">' + esc(String(m.acct)) + '</span></a>';
        }
        return '<span>' + esc(m.name) + ' <span style="color:#aaa;font-size:12px">' + esc(String(m.acct)) + '</span></span>';
    }

    function renderStructure() {
        var html = '';
        html += '<div class="overall-cards">';
        html += statCard('With Balance', overall.withBalance + '');
        html += statCard('Without Balance', overall.withoutBalance + '', 'green');
        html += statCard('Total Members', overall.total + '');
        html += statCard('Total Outstanding', overall.totalBalance + '', 'orange', true);
        html += '</div>';

        html += '<div class="fill-bar-wrap">' +
            '<div class="fill-bar" title="' + overall.withBalance + ' with balance / ' + overall.withoutBalance + ' without balance">' +
            '<div class="fill-seg seg-with" style="width:' + fillPct(overall.withBalance, overall.total) + '%"></div>' +
            '<div class="fill-seg seg-without" style="width:' + fillPct(overall.withoutBalance, overall.total) + '%"></div>' +
            '</div>' +
            '<div class="fill-legend">' +
            '<span class="fl-item"><i class="fl-dot fl-with"></i>With balance (' + overall.withBalance + ')</span>' +
            '<span class="fl-item"><i class="fl-dot fl-without"></i>Without balance (' + overall.withoutBalance + ')</span>' +
            '</div>' +
            '</div>';

        html += renderTrend();

        html += renderCalendar();

        html += '<div class="block-tabs">';
        html += '<button class="block-tab' + (currentBlock === null ? ' active' : '') + '" onclick="window.__stats.selectBlock(null)">All Blocks</button>';
        BLOCKS.forEach(function(b) {
            html += '<button class="block-tab' + (currentBlock === b.block ? ' active' : '') + '" onclick="window.__stats.selectBlock(\'' + esc(b.block) + '\')">Block ' + esc(String(b.block).replace('block', '')) + ' (' + b.withBalance + ')</button>';
        });
        html += '</div>';

        html += '<div id="statsBody"></div>';
        page.innerHTML = html;
        renderBody();
        animateCardCounts();
        bindTrendTooltip();
    }

    function fillPct(v, total) {
        if (!total) return 0;
        return Math.round((Number(v) / Number(total)) * 1000) / 10;
    }

    function cycleMonth(c) {
        var start = String(c.date || '').split(' - ')[0] || '';
        return start.slice(0, 7); /* YYYY-MM of the bill start date */
    }

    function monthlyWindow() {
        /* aggregate the requested range into one row per year-month */
        var n = trendRange === 'all' ? Infinity : parseInt(trendRange, 10);
        var months = {};
        TREND.forEach(function(c) {
            var key = cycleMonth(c);
            if (!months[key]) months[key] = { date: key, billed: 0.0, paid: 0.0, balance: 0.0 };
            months[key].billed += Number(c.billed || 0);
            months[key].paid += Number(c.paid || 0);
            months[key].balance += Number(c.balance || 0);
        });
        var rows = [];
        for (var k in months) rows.push(months[k]);
        rows.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
        rows.forEach(function(r) {
            r.billed = Math.round(r.billed * 100) / 100;
            r.paid = Math.round(r.paid * 100) / 100;
            r.balance = Math.round(r.balance * 100) / 100;
        });
        return Number.isFinite(n) ? rows.slice(-n) : rows;
    }

    function renderTrend() {
        var data = monthlyWindow();
        if (!TREND.length) {
            return '<div class="trend-wrap"><div class="stats-title">Billed vs Paid by Month</div><div class="trend-empty">No billing data available.</div></div>';
        }

        var maxBilled = 0, maxPaid = 0;
        data.forEach(function(c) {
            if (c.billed > maxBilled) maxBilled = c.billed;
            if (c.paid > maxPaid) maxPaid = c.paid;
        });
        var maxVal = Math.max(maxBilled, maxPaid, 1);

        var W = 1000, H = 320, PL = 44, PR = 14, PT = 20, PB = 46;
        var chartW = W - PL - PR;
        var chartH = H - PT - PB;
        var n = data.length;
        var bw = chartW / n;
        var barW = Math.min(26, (bw / 2) * 0.8);

        var html = '<div class="trend-wrap">';

        html += '<div class="trend-head">' +
            '<div class="stats-title">Billed vs Paid by Month</div>' +
            '<div class="range-selector">' +
            '<button class="range-btn' + (trendRange === '6' ? ' active' : '') + '" onclick="window.__stats.selectRange(\'6\')">6 mo</button>' +
            '<button class="range-btn' + (trendRange === '12' ? ' active' : '') + '" onclick="window.__stats.selectRange(\'12\')">12 mo</button>' +
            '<button class="range-btn' + (trendRange === '24' ? ' active' : '') + '" onclick="window.__stats.selectRange(\'24\')">24 mo</button>' +
            '<button class="range-btn' + (trendRange === 'all' ? ' active' : '') + '" onclick="window.__stats.selectRange(\'all\')">All (' + trendTotalCycles + ')</button>' +
            '</div>' +
            '</div>';

        html += '<div class="trend-chart-wrap">';
        html += '<svg class="trend-chart" id="trendChart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';

        var gridLines = 5;
        for (var g = 0; g <= gridLines; g++) {
            var y = PT + (chartH * g / gridLines);
            var val = maxVal * (1 - g / gridLines);
            html += '<line x1="' + PL + '" y1="' + y + '" x2="' + (W - PR) + '" y2="' + y + '" class="grid-line"/>';
            html += '<text x="' + (PL - 7) + '" y="' + (y + 4) + '" class="axis-label" text-anchor="end">' + formatAxis(val) + '</text>';
        }

        data.forEach(function(c, i) {
            var cx = PL + (i * bw) + (bw / 2);
            var bar1x = cx - barW - 1;
            var bar2x = cx + 1;
            var paidH = (c.paid / maxVal) * chartH;
            var billedH = (c.billed / maxVal) * chartH;
            var paidY = PT + chartH - paidH;
            var billedY = PT + chartH - billedH;

            html += '<rect x="' + bar1x + '" y="' + paidY + '" width="' + barW + '" height="' + Math.max(0, paidH) + '" class="bar-paid trend-bar" rx="2" data-kind="paid" data-month="' + esc(c.date) + '" data-paid="' + c.paid + '" data-billed="' + c.billed + '"></rect>';
            html += '<rect x="' + bar2x + '" y="' + billedY + '" width="' + barW + '" height="' + Math.max(0, billedH) + '" class="bar-billed trend-bar" rx="2" data-kind="billed" data-month="' + esc(c.date) + '" data-paid="' + c.paid + '" data-billed="' + c.billed + '"></rect>';

            html += '<text x="' + cx + '" y="' + (PT + chartH + 18) + '" class="x-label" text-anchor="middle">' + esc(shortDate(c.date)) + '</text>';
        });

        html += '</svg>';
        html += '<div class="trend-legend">' +
            '<span class="fl-item"><i class="fl-dot fl-paid"></i>Paid</span>' +
            '<span class="fl-item"><i class="fl-dot fl-bal"></i>Billed</span>' +
            '</div>';
        html += '<div class="trend-tip" id="trendTip" style="display:none;"></div>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    function bindTrendTooltip() {
        var tip = document.getElementById('trendTip');
        if (!tip) return;
        var wrap = tip.parentElement;
        var bars = document.querySelectorAll('.trend-bar');
        for (var i = 0; i < bars.length; i++) {
            (function(bar) {
                bar.addEventListener('mouseenter', function() {
                    var month = bar.getAttribute('data-month') || '';
                    var paid = Number(bar.getAttribute('data-paid') || 0);
                    var billed = Number(bar.getAttribute('data-billed') || 0);
                    var kind = bar.getAttribute('data-kind');
                    var paidHl = (kind === 'paid') ? ' class="tip-hl"' : '';
                    var billedHl = (kind === 'billed') ? ' class="tip-hl"' : '';
                    tip.innerHTML = '<div class="tip-month">' + esc(shortDate(month)) + '</div>' +
                        '<div class="tip-row' + (paidHl ? ' tip-hl' : '') + '"><span class="tip-dot tip-dot-paid"></span>Paid: ' + formatPeso(paid) + '</div>' +
                        '<div class="tip-row' + (billedHl ? ' tip-hl' : '') + '"><span class="tip-dot tip-dot-billed"></span>Billed: ' + formatPeso(billed) + '</div>';
                    tip.style.display = 'block';
                });
                bar.addEventListener('mousemove', function(e) {
                    var wrapRect = wrap.getBoundingClientRect();
                    var tipW = tip.offsetWidth || 160;
                    var tipH = tip.offsetHeight || 70;
                    var x = e.clientX - wrapRect.left + 14;
                    var y = e.clientY - wrapRect.top + 14;
                    if (x + tipW > wrapRect.width - 4) x = e.clientX - wrapRect.left - tipW - 14;
                    if (y + tipH > wrapRect.height - 4) y = e.clientY - wrapRect.top - tipH - 14;
                    if (x < 4) x = 4;
                    if (y < 4) y = 4;
                    tip.style.left = x + 'px';
                    tip.style.top = y + 'px';
                });
                bar.addEventListener('mouseleave', function() {
                    tip.style.display = 'none';
                });
            })(bars[i]);
        }
    }

    function formatAxis(val) {
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
        return Math.round(val).toString();
    }

    function shortDate(s) {
        var start = String(s || '').split(' - ')[0] || '';
        var p = start.split('-');
        if (p.length < 2) return start;
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var m = parseInt(p[1], 10) - 1;
        var mo = (m >= 0 && m < 12) ? months[m] : p[1];
        var yr = p[0].slice(2);
        return mo + " '" + yr;
    }

    function applyFilter(list) {
        var q = String(searchQuery || '').trim().toLowerCase();
        if (!q) return list;
        return list.filter(function(m) {
            var name = String(m.name || '').toLowerCase();
            var acct = String(m.acct || '').toLowerCase();
            return name.indexOf(q) !== -1 || acct.indexOf(q) !== -1;
        });
    }

    function renderBody() {
        var body = document.getElementById('statsBody');
        if (!body) return;

        var block = null;
        if (currentBlock !== null) {
            for (var i = 0; i < BLOCKS.length; i++) {
                if (BLOCKS[i].block === currentBlock) { block = BLOCKS[i]; break; }
            }
        }

        if (!block) {
            var all = [];
            BLOCKS.forEach(function(b) { all = all.concat(b.members); });
            all.sort(function(a, b2) { return (a.name || '').toLowerCase().localeCompare((b2.name || '').toLowerCase()); });
            renderMemberTable(body, applyFilter(all), null);
            return;
        }

        renderMemberTable(body, applyFilter(block.members), block);
    }

    function renderMemberTable(body, members, block) {
        var totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;
        var start = (currentPage - 1) * PAGE_SIZE;
        var pageData = members.slice(start, start + PAGE_SIZE);

        var html = '';
        if (block) {
            html += '<div class="block-header">' +
                '<div class="bh-title">Block ' + esc(String(block.block).replace('block', '')) + ' &mdash; ' + block.withBalance + ' with balance</div>' +
                '<div class="bh-bal">' + formatPeso(block.totalBalance) + '</div>' +
                '</div>';
        } else {
            html += '<div class="block-header">' +
                '<div class="bh-title">All Members &mdash; ' + members.length + ' with balance</div>' +
                '</div>';
        }

        html += '<div class="block-search">' +
            '<input type="text" class="block-search-input" id="blockSearchInput" placeholder="Search name or account..." value="' + esc(searchQuery) + '" oninput="window.__stats.onSearch(this.value)" onkeydown="if(event.key===\'Enter\'){this.blur();}">' +
            (searchQuery ? '<button class="block-search-clear" onclick="window.__stats.onSearch(\'\')">&#10005;</button>' : '') +
            '</div>';

        html += '<div class="table-wrap"><table class="bal-table"><thead><tr>' +
            '<th>Name</th><th class="num">Total Balance</th><th class="num">Paid This Bill</th>' +
            '</tr></thead><tbody>';
        if (pageData.length === 0) {
            html += '<tr><td colspan="3" style="color:#999">No members found</td></tr>';
        }
        pageData.forEach(function(m) {
            html += '<tr>' +
                '<td>' + memberLink(m) + '</td>' +
                '<td class="num bal-val">' + formatPeso(m.totalBalance) + '</td>' +
                '<td class="num paid-val">' + formatPeso(m.curPaid) + (m.curPayDate ? ' <span class="paid-date">' + esc(m.curPayDate) + '</span>' : '') + '</td>' +
                '</tr>';
        });
        html += '</tbody></table></div>';

        if (totalPages > 1) {
            html += '<div class="pagination">';
            html += '<button class="page-btn"' + (currentPage === 1 ? ' disabled' : '') + ' onclick="window.__stats.goPage(' + (currentPage - 1) + ')">&larr;</button>';
            for (var p = 1; p <= totalPages; p++) {
                if (totalPages > 12 && p > 3 && p < totalPages - 2 && Math.abs(p - currentPage) > 2) {
                    if (p === 4 || p === totalPages - 3) html += '<span class="page-ellipsis">&hellip;</span>';
                    continue;
                }
                html += '<button class="page-btn' + (p === currentPage ? ' active' : '') + '" onclick="window.__stats.goPage(' + p + ')">' + p + '</button>';
            }
            html += '<button class="page-btn"' + (currentPage === totalPages ? ' disabled' : '') + ' onclick="window.__stats.goPage(' + (currentPage + 1) + ')">&rarr;</button>';
            html += '</div>';
        }

        body.innerHTML = html;
    }

    function statCard(label, value, cls, isMoney) {
        return '<div class="overall-card" data-val="' + esc(value) + '"' + (isMoney ? ' data-money="1"' : '') + '>' +
            '<div class="oc-value' + (cls ? ' ' + cls : '') + '">0</div>' +
            '<div class="oc-label">' + esc(label) + '</div>' +
            '</div>';
    }

    function animateCardCounts() {
        var cards = page.querySelectorAll('.overall-card');
        if (!cards.length) return;
        cards.forEach(function(card, index) {
            var target = parseFloat(card.getAttribute('data-val') || '0');
            var isMoney = card.hasAttribute('data-money');
            var el = card.querySelector('.oc-value');
            var dur = 1100 + index * 120;
            var startTime = null;
            function step(ts) {
                if (!startTime) startTime = ts;
                var p = Math.min((ts - startTime) / dur, 1);
                var eased = 1 - Math.pow(1 - p, 3);
                var val = target * eased;
                if (isMoney) {
                    el.textContent = '\u20B1' + Number(val).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                } else {
                    el.textContent = (p < 1 ? Math.round(val) : target).toLocaleString('en-PH');
                }
                if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });
    }

    function renderCalendar() {
        var cal = (typeof PAY_CALENDAR !== 'undefined' && PAY_CALENDAR) ? PAY_CALENDAR : null;
        if (!cal || !cal.days || !cal.months || !cal.months.length) return '';
        var cur = currentMonthKey();
        var list = cal.months.filter(function(mm) { return mm <= cur; });
        if (list.indexOf(cur) === -1) list.unshift(cur);
        if (calMonth === null || list.indexOf(calMonth) === -1) calMonth = list[0];
        var p = calMonth.split('-');
        var y = parseInt(p[0], 10);
        var m = parseInt(p[1], 10) - 1;
        var mi = list.indexOf(calMonth);

        var todayKey = calTodayKey();

        var firstDow = new Date(y, m, 1).getDay();
        var dim = new Date(y, m + 1, 0).getDate();
        var html = '<div class="cal-wrap">' +
            '<div class="cal-head"><span class="stats-title">Payment Calendar</span>' +
            '<div class="cal-nav">' +
            '<button type="button" class="cal-nav-btn" onclick="window.__stats.calGo(\'' + (mi < list.length - 1 ? list[mi + 1] : '') + '\')"' + (mi < list.length - 1 ? '' : ' disabled') + ' title="Previous month">&lsaquo;</button>' +
            '<span class="cal-month">' + esc(MONTH_NAMES[m]) + ' ' + y + '</span>' +
            '<button type="button" class="cal-nav-btn" onclick="window.__stats.calGo(\'' + (mi > 0 ? list[mi - 1] : '') + '\')"' + (mi > 0 ? '' : ' disabled') + ' title="Next month">&rsaquo;</button>' +
            '<button type="button" class="cal-nav-btn cal-today-btn" onclick="window.__stats.calGo(\'' + esc(cur) + '\')">This month</button>' +
            '</div></div>';
        html += '<div class="cal-grid">';
        DOW_NAMES.forEach(function(d) { html += '<div class="cal-dow">' + d + '</div>'; });
        for (var b = 0; b < firstDow; b++) html += '<div class="cal-cell cal-empty"></div>';
        for (var d = 1; d <= dim; d++) {
            var key = calDateKey(y, m, d);
            var entries = cal.days[key];
            var active = !!(entries && entries.length) && key <= todayKey;
            if (active) {
                html += '<button type="button" class="cal-cell cal-btn' + (key === todayKey ? ' cal-today' : '') + '" onclick="window.__stats.calOpen(\'' + key + '\')" title="' + entries.length + ' paid on ' + esc(MONTH_NAMES[m]) + ' ' + d + '">' +
                    '<span class="cal-day-num">' + d + '</span>' +
                    '<span class="cal-badge">' + entries.length + '</span>' +
                    '</button>';
            } else {
                html += '<div class="cal-cell' + (key === todayKey ? ' cal-today' : '') + '">' +
                    '<span class="cal-day-num">' + d + '</span>' +
                    '</div>';
            }
        }
        var trail = (firstDow + dim) % 7;
        if (trail) for (var t = 0; t < 7 - trail; t++) html += '<div class="cal-cell cal-empty"></div>';
        html += '</div></div>';
        return html;
    }

    function openDayModal(dateKey) {
        var cal = (typeof PAY_CALENDAR !== 'undefined' && PAY_CALENDAR) ? PAY_CALENDAR : null;
        if (!cal || !cal.days || !cal.days[dateKey]) return;
        if (String(dateKey) > calTodayKey()) return;

        var entries = cal.days[dateKey];
        var list = [];
        var total = 0;
        entries.forEach(function(e) {
            list.push({ idx: e[0], amt: e[1] });
            total += Number(e[1] || 0);
        });
        list.sort(function(a, b) {
            var na = (MEMBERS[a.idx] ? (MEMBERS[a.idx].n || '') : '').toLowerCase();
            var nb = (MEMBERS[b.idx] ? (MEMBERS[b.idx].n || '') : '').toLowerCase();
            return na < nb ? -1 : na > nb ? 1 : 0;
        });
        calPayList = list;

        var dt = new Date(dateKey + 'T00:00:00');
        var title = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        var modal = document.getElementById('payModal');
        modal.innerHTML = '<div class="pay-modal-box">' +
            '<div class="pay-modal-head">' +
            '<div class="pay-modal-titles">' +
            '<div class="pay-modal-title">' + esc(title) + '</div>' +
            '<div class="pay-modal-sub">' + list.length + ' member' + (list.length !== 1 ? 's' : '') + ' paid &middot; Total ' + formatPeso(total) + '</div>' +
            '</div>' +
            '<button type="button" class="pay-modal-close" onclick="window.__stats.calClose()" title="Close">&times;</button>' +
            '</div>' +
            '<div class="pay-modal-search"><input type="text" id="payModalSearch" placeholder="Search name or account..." autocomplete="off" oninput="window.__stats.calSearch(this.value)"></div>' +
            '<div class="pay-modal-list" id="payModalList"></div>' +
            '</div>';
        modal.onclick = function(e) { if (e.target === modal) closeDayModal(); };
        payPage = 1;
        renderPayList('');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        var inp = document.getElementById('payModalSearch');
        if (inp) setTimeout(function() { inp.focus(); }, 30);
    }

    function renderPayList(q) {
        var listEl = document.getElementById('payModalList');
        if (!listEl) return;
        q = String(q || '').trim().toLowerCase();
        var rows = calPayList.filter(function(e) {
            if (!q) return true;
            var m = MEMBERS[e.idx] || {};
            return String(m.n || '').toLowerCase().indexOf(q) !== -1 ||
                String(m.a || '').toLowerCase().indexOf(q) !== -1;
        });
        if (!rows.length) {
            listEl.innerHTML = '<div class="pay-list-empty">No payers found</div>';
            return;
        }
        var totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
        if (payPage > totalPages) payPage = totalPages;
        if (payPage < 1) payPage = 1;
        var start = (payPage - 1) * PAGE_SIZE;
        var html = '';
        rows.slice(start, start + PAGE_SIZE).forEach(function(e) {
            var m = MEMBERS[e.idx] || {};
            html += '<a class="pay-row" href="member.html?i=' + e.idx + '">' +
                '<span class="pay-row-main"><span class="pay-row-name">' + esc(m.n || 'Unknown') + '</span>' +
                '<span class="pay-row-meta">' + (m.a ? 'Acct ' + esc(String(m.a)) : 'Acct \u2014') + (m.b ? ' &middot; Block ' + esc(m.b) : '') + '</span></span>' +
                '<span class="pay-row-amt">' + formatPeso(e.amt) + '</span>' +
                '</a>';
        });
        if (totalPages > 1) {
            html += '<div class="pagination">' +
                '<button type="button" class="page-btn' + (payPage === 1 ? ' disabled' : '') + '" onclick="window.__stats.calPage(' + (payPage - 1) + ')">&larr;</button>';
            for (var p = 1; p <= totalPages; p++) {
                if (totalPages > 12 && p > 3 && p < totalPages - 2 && Math.abs(p - payPage) > 2) {
                    if (p === 4 || p === totalPages - 3) html += '<span class="page-ellipsis">&hellip;</span>';
                    continue;
                }
                html += '<button type="button" class="page-btn' + (p === payPage ? ' active' : '') + '" onclick="window.__stats.calPage(' + p + ')">' + p + '</button>';
            }
            html += '<button type="button" class="page-btn' + (payPage === totalPages ? ' disabled' : '') + '" onclick="window.__stats.calPage(' + (payPage + 1) + ')">&rarr;</button>' +
                '</div>';
        }
        listEl.innerHTML = html;
    }

    function closeDayModal() {
        var modal = document.getElementById('payModal');
        if (modal) {
            modal.style.display = 'none';
            modal.innerHTML = '';
        }
        document.body.style.overflow = '';
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeDayModal();
    });

    window.__stats = {
        selectBlock: function(block) {
            currentBlock = block;
            currentPage = 1;
            renderStructure();
        },
        goPage: function(p) {
            currentPage = p;
            renderBody();
        },
        onSearch: function(v) {
            searchQuery = String(v || '');
            currentPage = 1;
            var input = document.getElementById('blockSearchInput');
            var caret = input ? (input.selectionStart || (input.value ? input.value.length : 0)) : 0;
            renderBody();
            input = document.getElementById('blockSearchInput');
            if (input) {
                input.focus();
                var pos = Math.min(caret, input.value.length);
                try { input.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
            }
        },
        selectRange: function(r) {
            trendRange = String(r || '12');
            renderStructure();
        },
        calGo: function(monthKey) {
            if (!monthKey) return;
            if (String(monthKey) > currentMonthKey()) return;
            calMonth = String(monthKey);
            renderStructure();
        },
        calOpen: openDayModal,
        calSearch: function(v) {
            payPage = 1;
            renderPayList(v);
        },
        calPage: function(p) {
            payPage = Number(p) || 1;
            var inp = document.getElementById('payModalSearch');
            renderPayList(inp ? inp.value : '');
        },
        calClose: closeDayModal
    };

    /* Static site: stats/members/trend are pre-generated JS globals
       (stats_data.js, members_data.js, trend_data.js) loaded first. */
    try {
        var data = (typeof STATS !== 'undefined' && STATS) ? STATS : null;
        if (!data) throw new Error('No stats data');
        var globalMembers = (typeof window !== 'undefined' && window.MEMBERS) ? window.MEMBERS : [];
        MEMBERS = (typeof globalMembers !== 'undefined' && globalMembers) ? globalMembers : [];
        memberNameIndex = {};
        var tmpName = {};
        for (var mi = 0; mi < MEMBERS.length; mi++) {
            var cn = cleanName(MEMBERS[mi] ? MEMBERS[mi].n : '');
            if (!cn) continue;
            if (tmpName[cn] === undefined) tmpName[cn] = mi;
            else tmpName[cn] = -1; /* ambiguous: multiple members share the same cleaned name */
        }
        for (var cnk in tmpName) {
            if (tmpName[cnk] >= 0) memberNameIndex[cnk] = tmpName[cnk];
        }
        var trendData = (typeof window !== 'undefined' && typeof window.TREND !== 'undefined' && window.TREND) ? window.TREND : null;
        TREND = (trendData && trendData.trend) ? trendData.trend : [];
        trendTotalCycles = (trendData && trendData.totalCycles) ? trendData.totalCycles : TREND.length;
        overall = data.overall;
        BLOCKS = data.blocks.slice().sort(function(a, b) {
            return (parseNum(a.block) - parseNum(b.block));
        });
        loading.style.display = 'none';
        renderStructure();
    } catch (e) {
        loading.textContent = 'Could not load statistics.';
    }
})();
