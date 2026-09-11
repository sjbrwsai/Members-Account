(async function() {
    try {
        await loadMembers();
    } catch (e) {
        document.getElementById('content').innerHTML = '<div class="not-found"><p>Failed to load member data.</p><p>Please try refreshing the page.</p></div>';
        return;
    }

    var searchInput = document.getElementById('headerSearch');
    var searchDropdown = document.getElementById('searchDropdown');
    var searchTimeout;

    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        var q = this.value.trim().toLowerCase();
        if (q.length < 1) { searchDropdown.classList.remove('active'); return; }

        searchTimeout = setTimeout(function() {
            var results = [];
            for (var i = 0; i < MEMBERS.length && results.length < 8; i++) {
                if (memberMatches(MEMBERS[i], q)) results.push({ idx: i, m: MEMBERS[i] });
            }
            var suggested = false;
            if (results.length === 0 && /[a-z]/.test(q)) {
                for (var k = 0; k < MEMBERS.length && results.length < 8; k++) {
                    if (memberNearMatches(MEMBERS[k], q)) { results.push({ idx: k, m: MEMBERS[k] }); suggested = true; }
                }
            }

            if (results.length === 0) {
                searchDropdown.innerHTML = '<div class="search-no-results">No members found</div>';
            } else {
                var html = '';
                if (suggested) html += '<div class="search-no-results" style="color:#e65100;font-weight:600">No exact match &mdash; close spellings:</div>';
                for (var j = 0; j < results.length; j++) {
                    var r = results[j];
                    var m = r.m;
                    var photo = m.i ? imgFolder(m, 'photo') + m.i : '';
                    var age = getAge(m);
                    var bits = ['Acct No. ' + esc(String(m.a || '\u2014'))];
                    if (m.mt) bits.push('<span class="si-badge' + (m.mt === 'Senior Member' ? ' si-senior' : '') + '">' + esc(m.mt) + '</span>');
                    if (age !== null) bits.push(esc(age) + ' yrs');
                    if (m.d) bits.push(esc(snippet(m.d, 32)));
                    html += '<a class="search-item" href="member.html?i=' + r.idx + '">' +
                        (photo ? '<img class="si-photo" src="' + esc(photo) + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
                        '<div class="si-info"><div class="si-name">' + esc(m.n) + '</div>' +
                        '<div class="si-detail">' + bits.join(' &middot; ') + '</div></div></a>';
                }
                searchDropdown.innerHTML = html;
            }
            searchDropdown.classList.add('active');
        }, 100);
    });

    searchInput.addEventListener('blur', function() {
        setTimeout(function() { searchDropdown.classList.remove('active'); }, 200);
    });

    var params = new URLSearchParams(window.location.search);
    var idx = parseInt(params.get('i'));
    var m = MEMBERS[idx];

    if (!m) {
        document.getElementById('content').innerHTML =
            '<div class="not-found"><p>Member not found.</p><br><a href="index.html">&larr; Go back to search</a></div>';
        document.title = 'Member Not Found';
        return;
    }

    document.title = m.n + ' - Member Details';

    window.renderProfile = function() {
        paymentsLoaded = false;
        var member = MEMBERS[idx];
        if (!member) return;
        var initials = member.n.split(' ').map(function(w) { return w[0] || ''; }).join('').substring(0, 2).toUpperCase();
        var imgSrc = member.i ? imgFolder(member, 'photo') + member.i : '';
        var sigSrc = member.s ? imgFolder(member, 'sig') + member.s : '';

        var photoHtml;
        if (imgSrc) {
            photoHtml = '<img class="profile-photo" src="' + esc(imgSrc) + '" onclick="openLightbox(\'' + esc(imgSrc).replace(/'/g, '%27') + '\')" onerror="this.outerHTML=\'<div class=profile-photo-placeholder>' + esc(initials) + '</div>\'" alt="' + esc(member.n) + '">';
        } else {
            photoHtml = '<div class="profile-photo-placeholder">' + esc(initials) + '</div>';
        }

        var sigHtml = '';
        if (sigSrc) {
            sigHtml = '<div class="profile-signature">' +
                '<div class="sig-frame"><img src="' + esc(sigSrc) + '" onclick="openLightbox(\'' + esc(sigSrc).replace(/'/g, '%27') + '\')" onerror="handleSigError(this)" alt="Signature"></div>' +
                '<span class="sig-label">Signature</span></div>';
        } else {
            sigHtml = '<div class="profile-signature">' +
                '<div class="sig-frame sig-empty">No Signature</div>' +
                '<span class="sig-label">Signature</span></div>';
        }

        var dv = 'dt-value';
        var de = 'dt-value empty';

        document.getElementById('content').innerHTML =
            '<div class="profile-card">' +

            '<div class="profile-top">' +
            '<div class="photo-wrapper">' + photoHtml + '</div>' +
            '<div class="profile-name-section">' +
            (member.mt ? '<div class="verify-banner' + (member.mt === 'Senior Member' ? ' senior' : '') + '">' + esc(member.mt) + '</div>' : '') +
            ((member.pr || member.di) ? '<div class="id-status has-id"><span class="id-dot"></span>ID Printed' + (member.di ? ': ' + esc(member.di) : '') + '</div>' : '<div class="id-status no-id"><span class="id-dot"></span>No ID</div>') +
            '<div class="profile-name">' + esc(member.n) + '</div>' +
            (member.a ? '<div class="profile-acct"><span>Acct No. ' + esc(String(member.a)) + '</span></div>' : '') +
            (member.b ? '<div class="profile-block-badge">BLOCK ' + esc(member.b) + '</div>' : '') +
            '</div>' +
            sigHtml +
            '</div>' +

            '<div class="detail-tabs">' +
            '<button class="detail-tab active" onclick="switchTab(\'profile\')">Profile</button>' +
            '<button class="detail-tab" onclick="switchTab(\'payments\')">Payments</button>' +
            '</div>' +

            '<div class="tab-panel tab-active" id="tabProfile">' +
            '<div class="profile-details" id="profileDetails">' +

            '<div class="section-title">Name</div>' +
            '<div class="info-row">' +
            '<div class="info-item"><div class="dt-label">First Name</div><div class="' + (member.fn ? dv : de) + '">' + (member.fn ? esc(member.fn) : '\u2014') + '</div></div>' +
            '<div class="info-item"><div class="dt-label">Middle Name</div><div class="' + (member.mn ? dv : de) + '">' + (member.mn ? esc(member.mn) : '\u2014') + '</div></div>' +
            '<div class="info-item"><div class="dt-label">Last Name</div><div class="' + (member.ln ? dv : de) + '">' + (member.ln ? esc(member.ln) : '\u2014') + '</div></div>' +
            '</div>' +

            '<div class="section-title">Details</div>' +
            '<div class="info-row">' +
            '<div class="info-item"><div class="dt-label">Acct No.</div><div class="' + (member.a ? dv : de) + '">' + (member.a ? esc(String(member.a)) : '\u2014') + '</div></div>' +
            '<div class="info-item"><div class="dt-label">Block</div><div class="' + (member.b ? dv : de) + '">' + (member.b ? esc(member.b) : '\u2014') + '</div></div>' +
            (member.mt === 'Senior Member' ? '<div class="info-item"><div class="dt-label">SCID</div><div class="' + (member.scid ? dv : de) + '">' + (member.scid ? esc(member.scid) : '\u2014') + '</div></div>' : '') +
            '</div>' +

            '<div class="info-row">' +
            '<div class="info-item"><div class="dt-label">Gender</div><div class="' + (member.g ? dv : de) + '">' + (member.g ? esc(member.g) : '\u2014') + '</div></div>' +
            '<div class="info-item"><div class="dt-label">Birthdate</div><div class="' + (member.r ? dv : de) + '">' + (member.r ? esc(member.r) + (getAge(member) !== null ? ' <span class="age-chip">' + getAge(member) + ' years old</span>' : '') : '\u2014') + '</div></div>' +
            '<div class="info-item"><div class="dt-label">Contact No.</div><div class="' + (member.c ? dv : de) + '">' + (member.c ? esc(member.c) : '\u2014') + '</div></div>' +
            '</div>' +

            '<div class="info-row">' +
            '<div class="info-item"><div class="dt-label">Address</div><div class="' + (member.d ? dv : de) + '">' + (member.d ? esc(member.d) : '\u2014') + '</div></div>' +
            '</div>' +

            '<div class="info-row">' +
            '<div class="info-item"><div class="dt-label">Date of Installation</div><div class="' + (member.doi ? dv : de) + '">' + (member.doi ? esc(member.doi) : '\u2014') + '</div></div>' +
            '<div class="info-item"><div class="dt-label">Use</div><div class="' + (member.u ? dv : de) + '">' + (member.u ? esc(member.u) : '\u2014') + '</div></div>' +
            '</div>' +

            '</div>' +
            '</div>' +

            '<div class="tab-panel" id="tabPayments">' +
            '<div class="profile-details">' +
            '<div id="paymentsContent">' +
            '<div class="placeholder-msg">Loading payment data...</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';
    };

    window.switchTab = function(tab) {
        document.querySelectorAll('.detail-tab').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('tab-active'); });
        if (tab === 'profile') {
            document.querySelector('.detail-tab').classList.add('active');
            document.getElementById('tabProfile').classList.add('tab-active');
        } else {
            document.querySelectorAll('.detail-tab')[1].classList.add('active');
            document.getElementById('tabPayments').classList.add('tab-active');
            loadPayments(idx);
        }
    };

    var paymentsLoaded = false;
    var paymentsData = [];
    var paymentsTotalBalance = 0;
    var paymentsPage = 1;
    var paymentsPerPage = 10;
    var payChartRange = '3'; /* '3', '6', '12', 'all' */
    var payShowPayment = true;
    var payShowBalance = true;
    var payDates = [];         /* one per paid billing row: { d: 'YYYY-MM-DD', a: payment }, newest first; dates may repeat */
    var payItems = [];         /* row items: { type: 'p', d, a } or { type: 'y', y }; year markers occupy an item slot */
    var todayKey = '';         /* 'YYYY-MM-DD' for the current date */
    var payDatePage = 0;       /* current page index (5 items per page) */
    var payDatesPerPage = 5;

    window.loadPayments = async function(memberIdx) {
        var container = document.getElementById('paymentsContent');
        if (!container) return;

        if (!paymentsLoaded) {
            container.innerHTML = '<div class="placeholder-msg">Loading payment data...</div>';
            try {
                var data = (typeof PAYMENTS_BY_INDEX !== 'undefined' && PAYMENTS_BY_INDEX[memberIdx]) ? PAYMENTS_BY_INDEX[memberIdx] : {};
                if (!data.billing || data.billing.length === 0) {
                    container.innerHTML = '<div class="placeholder-msg">No payment records found for this member.</div>';
                    paymentsTotalBalance = data.totalBalance || 0;
                    payDates = [];
                    payItems = [];
                    todayKey = '';
                    payDatePage = 0;
                    paymentsLoaded = true;
                    return;
                }
                paymentsData = data.billing.slice().reverse();
                paymentsTotalBalance = data.totalBalance || 0;
                buildPayDates();
                paymentsLoaded = true;
                paymentsPage = 1;
            } catch (e) {
                container.innerHTML = '<div class="placeholder-msg">Failed to load payment data.</div>';
                return;
            }
        }

        renderPayments();
    };

    function buildPayDates() {
        payDates = [];
        var t = new Date();
        var tk = t.getFullYear() + '-' + (t.getMonth() + 1 < 10 ? '0' : '') + (t.getMonth() + 1) + '-' + (t.getDate() < 10 ? '0' : '') + t.getDate();
        todayKey = tk;
        paymentsData.forEach(function(b) {
            var pd = String(b.payDate || '').trim();
            var pay = Number(b.payment || 0);
            if (!pd || pay <= 0) return;
            if (pd > tk) return;
            payDates.push({ d: pd, a: pay });
        });
        payDates.sort(function(a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
        payItems = [];
        var prevY = null;
        payDates.forEach(function(pd) {
            var y = parseInt(String(pd.d).split('-')[0], 10);
            if (prevY !== null && y !== prevY) payItems.push({ type: 'y', y: y });
            payItems.push({ type: 'p', d: pd.d, a: pd.a });
            prevY = y;
        });
        if (payDatePage >= Math.max(1, Math.ceil(payItems.length / payDatesPerPage))) payDatePage = 0;
    }

    function fmtPayDate(pd) {
        var p = String(pd || '').split('-');
        if (p.length < 3) return esc(pd || '\u2014');
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var mo = months[parseInt(p[1], 10) - 1] || p[1];
        return mo + ' ' + parseInt(p[2], 10) + ', ' + p[0];
    }

    function payDatesHtml() {
        if (!payItems.length) return '';
        var totalPages = Math.max(1, Math.ceil(payItems.length / payDatesPerPage));
        if (payDatePage >= totalPages) payDatePage = totalPages - 1;
        var html = '<div class="pdates-wrap">' +
            '<button type="button" class="pdates-arrow' + (payDatePage === 0 ? ' disabled' : '') + '" id="pdatesPrev" onclick="window.mpayPage(-1)" title="Previous">&lsaquo;</button>' +
            '<div class="pdates-viewport"><div class="pdates-track" id="pdatesTrack" style="transform: translateX(-' + (payDatePage * 100) + '%)">';
        for (var p = 0; p < totalPages; p++) {
            html += '<div class="pdates-page">';
            var start = p * payDatesPerPage;
            var end = Math.min(start + payDatesPerPage, payItems.length);
            for (var i = start; i < end; i++) {
                var it = payItems[i];
                if (it.type === 'y') {
                    html += '<div class="pdates-card pdates-year"><span class="pdates-year-label">' + esc(it.y) + '</span></div>';
                    continue;
                }
                html += '<div class="pdates-card' + (i === 0 ? ' pdates-latest' : '') + (it.d === todayKey ? ' pdates-today' : '') + '">' +
                    '<div class="pdates-card-inner">' +
                    '<span class="pdates-date">' + fmtPayDate(it.d) + '</span>' +
                    '<span class="pdates-amt">' + formatPeso(it.a) + '</span>' +
                    '</div>' +
                    '</div>';
            }
            html += '</div>';
        }
        html += '</div></div>' +
            '<button type="button" class="pdates-arrow' + (payDatePage >= totalPages - 1 ? ' disabled' : '') + '" id="pdatesNext" onclick="window.mpayPage(1)" title="Next">&rsaquo;</button>' +
            '</div>';
        return html;
    }

    function renderPayments() {
        var container = document.getElementById('paymentsContent');
        if (!container) return;

        var lastPayment = null;
        var lastPayAmt = 0;
        var lastPayDate = '\u2014';
        for (var i = 0; i < paymentsData.length; i++) {
            if (paymentsData[i].payment > 0) {
                lastPayment = paymentsData[i];
                lastPayAmt = lastPayment.payment;
                lastPayDate = lastPayment.payDate || lastPayment.date || '\u2014';
                break;
            }
        }
        var currentBalance = paymentsTotalBalance;

        var totalPages = Math.ceil(paymentsData.length / paymentsPerPage);
        var start = (paymentsPage - 1) * paymentsPerPage;
        var pageData = paymentsData.slice(start, start + paymentsPerPage);

        var chartHtml = paymentChartHtml();

        var html = '<div class="payments-summary">' +
            '<div class="payment-stat"><div class="payment-stat-label">Total Balance</div><div class="payment-stat-value' + (currentBalance > 0 ? ' overdue' : ' paid') + '">' + formatPeso(currentBalance) + '</div></div>' +
            '<div class="payment-stat"><div class="payment-stat-label">Last Payment</div><div class="payment-stat-value">' + formatPeso(lastPayAmt) + '</div></div>' +
            '<div class="payment-stat"><div class="payment-stat-label">Last Date Paid</div><div class="payment-stat-value date-stat">' + esc(lastPayDate) + '</div></div>' +
            '</div>';

        if (chartHtml) {
            html += '<div class="section-title">Payment Trend</div>';
            html += chartHtml;
        }

        var pdatesHtml = payDatesHtml();
        if (pdatesHtml) {
            html += '<div class="section-title">Payment Dates</div>';
            html += pdatesHtml;
        }

        html += '<div class="section-title">Billing History</div>';
        html += '<div class="payments-table-wrap"><table class="payments-table"><thead><tr>' +
            '<th>Bill Date</th><th>Cubic</th><th>Amount</th><th>Payment Date</th><th>Payment</th><th>Balance</th>' +
            '</tr></thead><tbody>';
        pageData.forEach(function(b) {
            var balClass = b.balance > 0 ? 'overdue' : 'paid';
            html += '<tr>' +
                '<td>' + esc(b.date || '\u2014') + '</td>' +
                '<td>' + (b.cubic > 0 ? b.cubic : '\u2014') + '</td>' +
                '<td>' + formatPeso(b.amount) + '</td>' +
                '<td>' + esc(b.payDate || '\u2014') + '</td>' +
                '<td>' + (b.payment > 0 ? formatPeso(b.payment) : '\u2014') + '</td>' +
                '<td class="' + balClass + '">' + formatPeso(b.balance) + '</td>' +
                '</tr>';
        });
        html += '</tbody></table></div>';

        if (totalPages > 1) {
            html += '<div class="payments-pagination">';
            html += '<button class="pay-page-btn" onclick="goPaymentsPage(' + (paymentsPage - 1) + ')"' + (paymentsPage <= 1 ? ' disabled' : '') + '>&laquo; Prev</button>';
            for (var p = 1; p <= totalPages; p++) {
                if (totalPages > 7 && p > 2 && p < totalPages - 1 && Math.abs(p - paymentsPage) > 1) {
                    if (p === 3 || p === totalPages - 2) html += '<span class="pay-page-dots">...</span>';
                    continue;
                }
                html += '<button class="pay-page-btn' + (p === paymentsPage ? ' active' : '') + '" onclick="goPaymentsPage(' + p + ')">' + p + '</button>';
            }
            html += '<button class="pay-page-btn" onclick="goPaymentsPage(' + (paymentsPage + 1) + ')"' + (paymentsPage >= totalPages ? ' disabled' : '') + '>Next &raquo;</button>';
            html += '<span class="pay-page-info">Page ' + paymentsPage + ' of ' + totalPages + '</span>';
            html += '</div>';
        }

        container.innerHTML = html;
        bindPayChartHover();
    }

    function payChartRangeData(rows) {
        if (payChartRange === 'all') return rows;
        var months = parseInt(payChartRange, 10);
        if (!months) return rows;
        /* find cutoff: latest bill-start date minus N months */
        var latest = '';
        rows.forEach(function(r) {
            var s = String(r.date || '').split(' - ')[0] || '';
            if (s > latest) latest = s;
        });
        if (!latest) return rows;
        var p = latest.split('-');
        if (p.length < 3) return rows;
        var y = parseInt(p[0], 10), m = parseInt(p[1], 10);
        var total = y * 12 + (m - 1) - months;
        var cutYear = Math.floor(total / 12);
        var cutMonth = (total % 12) + 1;
        var cutKey = String(cutYear) + '-' + (cutMonth < 10 ? '0' : '') + cutMonth;
        return rows.filter(function(r) {
            var s = String(r.date || '').split(' - ')[0] || '';
            return s.slice(0, 7) >= cutKey;
        });
    }

    function paymentChartHtml() {
        var allRows = paymentsData.slice().reverse();
        if (allRows.length < 2) return '';

        var rows = payChartRangeData(allRows);
        if (rows.length < 1) return '';

        /* total balance AFTER payment: running sum of amount minus payment,
           offset-reconciled so the last point equals the member's true balance */
        var rawRun = 0;
        var balSeries = [];
        rows.forEach(function(r) {
            rawRun += (Number(r.amount || 0) - Number(r.payment || 0));
            balSeries.push(rawRun);
        });
        var balOffset = paymentsTotalBalance - rawRun;
        balSeries = balSeries.map(function(v) { return v + balOffset; });

        var maxPay = 0, maxBal = 0;
        rows.forEach(function(r, i) {
            var p = Number(r.payment || 0);
            if (payShowPayment && p > maxPay) maxPay = p;
            if (payShowBalance && balSeries[i] > maxBal) maxBal = balSeries[i];
        });

        var dataMax = Math.max(maxPay, maxBal);
        var controlsHtml = '<div class="pay-chart-controls">' +
            '<div class="pay-range-selector">' +
            '<button class="pay-range-btn' + (payChartRange === '3' ? ' active' : '') + '" onclick="window.setPayChartRange(\'3\')">3 mo</button>' +
            '<button class="pay-range-btn' + (payChartRange === '6' ? ' active' : '') + '" onclick="window.setPayChartRange(\'6\')">6 mo</button>' +
            '<button class="pay-range-btn' + (payChartRange === '12' ? ' active' : '') + '" onclick="window.setPayChartRange(\'12\')">1 yr</button>' +
            '<button class="pay-range-btn' + (payChartRange === 'all' ? ' active' : '') + '" onclick="window.setPayChartRange(\'all\')">All</button>' +
            '</div>' +
            '<div class="pay-range-selector">' +
            '<button class="pay-range-btn pay-toggle' + (payShowPayment ? ' active' : '') + '" onclick="window.togglePaySeries(\'payment\')">Payment</button>' +
            '<button class="pay-range-btn pay-toggle' + (payShowBalance ? ' active' : '') + '" onclick="window.togglePaySeries(\'balance\')">Total Balance</button>' +
            '</div>' +
            '</div>';
        if (dataMax <= 0) {
            return '<div class="pay-chart-wrap">' +
                '<div class="pay-chart-head"><span class="pay-chart-title">Payment vs Balance</span>' + controlsHtml + '</div>' +
                '<div class="placeholder-msg">Turn on a series to see the chart.</div>' +
                '</div>';
        }
        var step = nicePayStep(dataMax, 4);
        var vMax = step * 4;
        var vMin = 0;
        var vRange = vMax || 1;

        var W = 820, H = 240, PL = 56, PR = 16, PT = 16, PB = 36;
        var chartW = W - PL - PR;
        var chartH = H - PT - PB;
        var n = rows.length;
        var xAt = function(i) { return PL + (n === 1 ? 0 : (i / (n - 1)) * chartW); };
        var yAt = function(v) { return PT + chartH * ((vMax - Number(v)) / vRange); };

        var payPts = [], balPts = [];
        var payPoly = [], balPoly = [];
        rows.forEach(function(r, i) {
            var p = Number(r.payment || 0);
            var b = balSeries[i];
            var x = xAt(i);
            payPts.push({ x: x, y: yAt(p), r: r });
            balPts.push({ x: x, y: yAt(b), r: r, bal: b });
            payPoly.push(x.toFixed(2) + ',' + yAt(p).toFixed(2));
            balPoly.push(x.toFixed(2) + ',' + yAt(b).toFixed(2));
        });

        var html = '<div class="pay-chart-wrap">';

        html += '<div class="pay-chart-head">' +
            '<span class="pay-chart-title">Payment vs Balance</span>' +
            controlsHtml +
            '</div>';

        html += '<svg class="pay-chart" id="payChart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';

        var gridLines = 4;
        for (var g = 0; g <= gridLines; g++) {
            var y = PT + (chartH * g / gridLines);
            var val = step * (gridLines - g);
            html += '<line x1="' + PL + '" y1="' + y + '" x2="' + (W - PR) + '" y2="' + y + '" class="pay-grid"/>';
            html += '<text x="' + (PL - 7) + '" y="' + (y + 4) + '" class="pay-axis" text-anchor="end">' + formatPayAxis(val) + '</text>';
        }

        if (payShowBalance) {
            html += '<polyline points="' + balPoly.join(' ') + '" class="pay-line-bal" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
        }
        if (payShowPayment) {
            html += '<polyline points="' + payPoly.join(' ') + '" class="pay-line" fill="none" stroke-linejoin="round" stroke-linecap="round"/>';
        }

        var labelEvery = Math.max(1, Math.ceil(n / 7));
        if (payShowBalance) {
            balPts.forEach(function(pt, i) {
                var attrs = 'data-i="' + i + '" data-range="' + payChartRange + '" data-month="' + esc(String(pt.r.date || '').split(' - ')[0]) + '" data-pay="' + (Number(pt.r.payment || 0)) + '" data-bal="' + pt.bal + '"';
                html += '<circle cx="' + pt.x.toFixed(2) + '" cy="' + pt.y.toFixed(2) + '" r="9" class="pay-hit" ' + attrs + '></circle>';
                html += '<circle cx="' + pt.x.toFixed(2) + '" cy="' + pt.y.toFixed(2) + '" r="2.5" class="pay-dot-bal"></circle>';
            });
        }
        if (payShowPayment) {
            payPts.forEach(function(pt, i) {
                var attrs = 'data-i="' + i + '" data-range="' + payChartRange + '" data-month="' + esc(String(pt.r.date || '').split(' - ')[0]) + '" data-pay="' + (Number(pt.r.payment || 0)) + '" data-bal="' + balSeries[i] + '"';
                html += '<circle cx="' + pt.x.toFixed(2) + '" cy="' + pt.y.toFixed(2) + '" r="9" class="pay-hit" ' + attrs + '></circle>';
                html += '<circle cx="' + pt.x.toFixed(2) + '" cy="' + pt.y.toFixed(2) + '" r="3" class="pay-dot"></circle>';
            });
        }
        for (var li = 0; li < n; li++) {
            if (li % labelEvery === 0 || li === n - 1) {
                var lx = xAt(li);
                html += '<text x="' + lx.toFixed(2) + '" y="' + (H - 10) + '" class="pay-xlabel" text-anchor="middle">' + esc(shortPayDate(rows[li])) + '</text>';
            }
        }

        html += '</svg>';
        html += '<div class="pay-chart-legend">' +
            '<span class="pay-legend-item"><i class="pay-legend-dot pay-legend-dot-pay"></i>Payment</span>' +
            '<span class="pay-legend-item"><i class="pay-legend-dot pay-legend-dot-bal"></i>Total Balance</span>' +
            '</div>';
        html += '<div class="pay-tip" id="payTip" style="display:none;"></div>';
        html += '</div>';

        return html;
    }

    function nicePayStep(maxVal, divisions) {
        var span = maxVal || 1;
        var raw = span / divisions;
        if (raw <= 0) return 1;
        var pow = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
        var cands = [1, 2, 5, 10];
        for (var i = 0; i < cands.length; i++) {
            var s = pow * cands[i];
            if (s >= raw) return s;
        }
        return pow * 10;
    }

    function formatPayAxis(val) {
        var v = Number(val);
        var abs = Math.abs(v);
        var s;
        if (abs >= 1000) s = (v / 1000).toFixed(0) + 'k';
        else s = String(Math.round(v));
        return s;
    }

    function shortPayDate(r) {
        var s = String(r.date || '').split(' - ')[0] || '';
        var p = s.split('-');
        if (p.length < 2) return s;
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var m = parseInt(p[1], 10) - 1;
        var mo = (m >= 0 && m < 12) ? months[m] : p[1];
        var yr = p[0].slice(2);
        return mo + " '" + yr;
    }

    window.setPayChartRange = function(range) {
        payChartRange = String(range || 'all');
        renderPayments();
    };

    window.togglePaySeries = function(kind) {
        if (kind === 'payment') payShowPayment = !payShowPayment;
        else payShowBalance = !payShowBalance;
        renderPayments();
    };

    function bindPayChartHover() {
        var tip = document.getElementById('payTip');
        if (!tip) return;
        var wrap = tip.parentElement;
        var dots = document.querySelectorAll('#payChart .pay-hit');
        for (var i = 0; i < dots.length; i++) {
            (function(dot) {
                dot.addEventListener('mouseenter', function() {
                    var month = dot.getAttribute('data-month') || '';
                    var pay = Number(dot.getAttribute('data-pay') || 0);
                    var bal = Number(dot.getAttribute('data-bal') || 0);
                    var html = '<div class="pay-tip-month">' + esc(shortPayDate({ date: month })) + '</div>';
                    if (payShowPayment) {
                        html += '<div class="pay-tip-row"><span class="pay-legend-dot pay-legend-dot-pay"></span>Payment: ' + formatPeso(pay) + '</div>';
                    }
                    if (payShowBalance) {
                        html += '<div class="pay-tip-row"><span class="pay-legend-dot pay-legend-dot-bal"></span>Balance: ' + formatPeso(bal) + '</div>';
                    }
                    tip.innerHTML = html;
                    tip.style.display = 'block';
                });
                dot.addEventListener('mousemove', function(e) {
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
                dot.addEventListener('mouseleave', function() {
                    tip.style.display = 'none';
                });
            })(dots[i]);
        }
    }

    window.goPaymentsPage = function(page) {
        var totalPages = Math.ceil(paymentsData.length / paymentsPerPage);
        if (page < 1 || page > totalPages) return;
        paymentsPage = page;
        renderPayments();
    };

    window.mpayPage = function(delta) {
        var total = Math.ceil(payItems.length / payDatesPerPage);
        if (total < 1) return;
        delta = Number(delta) || 0;
        var target = payDatePage + delta;
        if (target < 0 || target > total - 1 || target === payDatePage) return;
        payDatePage = target;
        var track = document.getElementById('pdatesTrack');
        if (track) track.style.transform = 'translateX(-' + (payDatePage * 100) + '%)';
        var prev = document.getElementById('pdatesPrev');
        var next = document.getElementById('pdatesNext');
        if (prev) prev.classList.toggle('disabled', payDatePage === 0);
        if (next) next.classList.toggle('disabled', payDatePage >= total - 1);
    };

    function snippet(s, len) {
        s = String(s).trim().replace(/\s+/g, ' ');
        if (s.length <= len) return s;
        var cut = s.substring(0, len);
        var sp = cut.lastIndexOf(' ');
        return (sp > len * 0.6 ? cut.substring(0, sp) : cut) + '\u2026';
    }

    window.openLightbox = function(src) {
        document.getElementById('lightboxImg').src = src;
        document.getElementById('lightbox').classList.add('active');
    };

    window.closeLightbox = function() {
        var lb = document.getElementById('lightbox');
        lb.classList.remove('active');
        document.getElementById('lightboxImg').src = '';
    };

    window.handleSigError = function(img) {
        img.outerHTML = '<div class="sig-frame sig-empty">No Signature</div>';
    };

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeLightbox();
    });

    function saveRecent() {
        if (typeof idx === 'undefined' || isNaN(idx)) return;
        var member = MEMBERS[idx];
        if (!member) return;
        var acc = String(member.a);
        var recent = JSON.parse(localStorage.getItem('recentMembers') || '[]');
        recent = recent.filter(function(r) { return String(r) !== acc; });
        recent.unshift(acc);
        if (recent.length > 4) recent = recent.slice(0, 4);
        localStorage.setItem('recentMembers', JSON.stringify(recent));
    }

    renderProfile();
    saveRecent();
})();
