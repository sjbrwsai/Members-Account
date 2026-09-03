function esc(s) {
    return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPeso(val) {
    return '\u20B1' + Number(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

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

    function normAcct(a) {
        if (!a) return '';
        try { return String(parseInt(a)); } catch (e) { return String(a); }
    }

    function findMemberIdx(arMember) {
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
        var target = String(arMember.name || '').toLowerCase();
        if (!target) return -1;
        for (var b = 0; b < MEMBERS.length; b++) {
            if (String(MEMBERS[b].b || '') !== String(arMember.block || '')) continue;
            var nm = String(MEMBERS[b].n || '').toLowerCase();
            if (target && nm && (target.indexOf(nm) !== -1 || nm.indexOf(target) !== -1)) return b;
        }
        for (var g = 0; g < MEMBERS.length; g++) {
            var gnm = String(MEMBERS[g].n || '').toLowerCase();
            if (target && gnm && (target.indexOf(gnm) !== -1 || gnm.indexOf(target) !== -1)) return g;
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
                    var rect = tip.getBoundingClientRect();
                    var x = e.clientX + 16;
                    var y = e.clientY - rect.height - 10;
                    if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - 16;
                    if (y < 8) y = e.clientY + 18;
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
            if (input) input.value = searchQuery;
            renderBody();
        },
        selectRange: function(r) {
            trendRange = String(r || '12');
            renderStructure();
        }
    };

    /* Static site: stats/members/trend are pre-generated JS globals
       (stats_data.js, members_data.js, trend_data.js) loaded first. */
    try {
        var data = (typeof STATS !== 'undefined' && STATS) ? STATS : null;
        if (!data) throw new Error('No stats data');
        MEMBERS = (typeof MEMBERS !== 'undefined' && MEMBERS) ? MEMBERS : [];
        var trendData = (typeof TREND !== 'undefined' && TREND) ? TREND : null;
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
