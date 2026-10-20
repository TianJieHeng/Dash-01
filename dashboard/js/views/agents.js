// Provider Rail: fixed illustrative quota snapshots, never live account telemetry.
(function () {
  'use strict';
  var D = window.DATA, V = { el: null, updated: new Date() };
  var IDS = ['claude', 'codex', 'cursor', 'gemini', 'copilot'];
  var COLORS = ['#83C8AE', '#9583BB', '#7A9FC9', '#E0B35A', '#7D8C96'];
  var DATES = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'];
  var esc = function (s) { return App.esc(s == null ? '' : s); };
  function valid(n) { return typeof n === 'number' && isFinite(n); }
  function providers() { return IDS.map(function (id) { return (D.agentUsage || D.agents).filter(function (a) { return a.id === id; })[0] || { id: id, name: id, meters: [] }; }); }
  function compact(n, precision) {
    if (!valid(n)) return 'Unavailable';
    if (n >= 1000000) return (n / 1000000).toFixed(precision == null ? 1 : precision).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K';
    return String(n);
  }
  function percent(m) { return valid(m.used) && valid(m.quota) && m.quota > 0 ? m.used / m.quota * 100 : null; }
  function pct(n) { return Math.round(n * 10) / 10; }
  function meter(m) {
    m = m || {};
    var used = percent(m), target = valid(m.pace) ? Math.max(0, Math.min(100, m.pace)) : null;
    var pace = used == null || target == null ? 'Pace unavailable' : Math.abs(used - target) <= 2 ? 'On pace' : used > target ? 'Over pace' : 'Under pace';
    var detail = used == null ? 'Quota unavailable' : compact(m.used) + ' / ' + compact(m.quota) + ' ' + (m.unit || 'units');
    var reset = m.reset || 'Unavailable';
    var description = (m.label || 'Quota') + ': ' + detail + (used == null ? '' : ', ' + pct(used) + '% consumed') + '. Reset ' + reset + '. ' + pace + (target == null ? '.' : ', target ' + pct(target) + '%.');
    return '<div class="ag-meter' + (used >= 90 ? ' is-hot' : '') + '" aria-label="' + esc(description) + '">' +
      '<div class="ag-meter-top"><span class="ag-label">' + esc(m.label || 'Quota unavailable') + '</span><b class="ag-pct num">' + (used == null ? 'N/A' : pct(used) + '<small>%</small>') + '</b></div>' +
      (used == null ? '<div class="ag-bar ag-bar--unknown" aria-hidden="true"></div>' : '<div class="ag-bar" role="progressbar" aria-label="' + esc(m.label || 'Quota') + ' consumed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, used) + '" aria-valuetext="' + pct(used) + '% consumed"><i style="width:' + Math.max(0, Math.min(100, used)) + '%"></i>' + (target == null ? '' : '<em style="left:' + target + '%" title="Even pace: ' + target + '%"></em>') + '</div>') +
      '<div class="ag-quota">' + esc(detail) + '<span>Reset ' + esc(reset) + '</span></div>' +
      '<div class="ag-meter-foot"><span class="ag-pace' + (pace === 'Over pace' ? ' is-over' : '') + '">' + pace + (used > 100 ? ' · Over quota' : '') + '</span><span>' + (target == null ? '' : 'Target ' + pct(target) + '%') + '</span></div></div>';
  }
  function series(a) { return Array.isArray(a.week) && a.week.length === 7 && a.week.every(valid) ? a.week : null; }
  function spark(a) {
    var vals = series(a);
    if (!vals) return '<div class="ag-spark-empty">7D unavailable</div>';
    var max = Math.max.apply(null, vals) || 1;
    var points = vals.map(function (v, i) { return (3 + i * 12) + ',' + (31 - v / max * 25).toFixed(1); });
    return '<div class="ag-spark-wrap"><small>7D</small><svg class="ag-spark" viewBox="0 0 78 36" role="img" aria-label="' + esc(a.name + ', seven-day tokens: ' + vals.join(', ')) + '"><polyline points="' + points.join(' ') + '"/></svg></div>';
  }
  function card(a, index) {
    var hot = (a.meters || []).filter(function (m) { return percent(m) >= 90; })[0];
    var status = a.status === 'ok' ? 'Operational' : a.status === 'degraded' ? 'Degraded' : 'Unknown';
    var notice = a.incident || (hot ? 'Near limit · ' + hot.label + ' quota' : '');
    return '<section class="ag-card" aria-label="' + esc(a.name) + ' illustrative usage" style="--series:' + COLORS[index] + '">' +
      '<header class="ag-head"><div class="ag-id"><h2>' + esc(a.name) + '</h2><span class="ag-plan">' + esc(a.plan || 'Plan unavailable') + '</span></div><span class="ag-status' + (status !== 'Operational' ? ' is-warn' : '') + '"><i aria-hidden="true"></i>' + status + '</span></header>' +
      '<div class="ag-notice-slot">' + (notice ? '<div class="ag-incident">' + App.icon('bolt', 15) + '<span>' + esc(notice) + '</span></div>' : '') + '</div>' +
      '<div class="ag-meters">' + [0, 1].map(function (i) { return meter((a.meters || [])[i]); }).join('') + '</div>' +
      '<footer class="ag-foot"><div><small>Today · tokens</small><b class="num">' + compact(a.tokens) + '</b></div><div><small>' + (a.cost === 0 ? 'Plan' : 'Today API') + '</small><b class="num">' + (a.cost === 0 ? 'Included' : valid(a.cost) ? '$' + a.cost.toFixed(2) : 'Unavailable') + '</b></div>' + spark(a) + '</footer></section>';
  }
  function aggregate(list) {
    var complete = list.every(function (a) { return !!series(a); });
    var todayComplete = list.every(function (a) { return valid(a.tokens); });
    var costComplete = list.every(function (a) { return valid(a.cost); });
    var totals = DATES.map(function (_, i) { return list.reduce(function (sum, a) { return sum + (series(a) ? a.week[i] : 0); }, 0); });
    var week = totals.reduce(function (s, n) { return s + n; }, 0), today = list.reduce(function (s, a) { return s + (valid(a.tokens) ? a.tokens : 0); }, 0);
    var cost = list.reduce(function (s, a) { return s + (valid(a.cost) ? a.cost : 0); }, 0);
    var ceiling = Math.max(200000, Math.ceil(Math.max.apply(null, totals) / 200000) * 200000);
    var chart = '<svg class="ag-chart" viewBox="0 0 320 160" role="img" aria-label="' + (complete ? '' : 'Partial coverage. ') + 'Seven-day stacked token usage, zero baseline. ' + esc(DATES.map(function (d, i) { return d + ': ' + compact(totals[i]) + ' tokens'; }).join('; ')) + '">';
    for (var t = 0; t <= 4; t++) {
      var y = 136 - t * 28;
      chart += '<line x1="30" x2="314" y1="' + y + '" y2="' + y + '"/><text x="25" y="' + (y + 3) + '" text-anchor="end">' + Math.round(ceiling * t / 4000) + '</text>';
    }
    chart += '<text x="1" y="12">K tokens</text>';
    DATES.forEach(function (date, i) {
      var x = 39 + i * 40, y = 136;
      list.forEach(function (a, j) {
        var val = series(a) ? a.week[i] : 0, h = val / ceiling * 112;
        y -= h;
        chart += '<rect x="' + x + '" y="' + y.toFixed(2) + '" width="24" height="' + h.toFixed(2) + '" fill="' + COLORS[j] + '"><title>' + date + ', ' + esc(a.name) + ': ' + val + ' tokens</title></rect>';
      });
      chart += '<text x="' + (x + 12) + '" y="' + (y - 5).toFixed(2) + '" text-anchor="middle">' + compact(totals[i]) + '</text><text x="' + (x + 12) + '" y="153" text-anchor="middle">' + ['W', 'T', 'F', 'S', 'S', 'M', 'T'][i] + '</text>';
    });
    chart += '</svg><table class="ag-data-table"><caption>Illustrative daily token usage</caption><thead><tr><th>Date</th>' + list.map(function (a) { return '<th>' + esc(a.name) + '</th>'; }).join('') + '<th>Total</th></tr></thead><tbody>' + DATES.map(function (date, i) { return '<tr><th>' + date + '</th>' + list.map(function (a) { return '<td>' + (series(a) ? a.week[i] : 'Unavailable') + '</td>'; }).join('') + '<td>' + totals[i] + (complete ? '' : ' (partial)') + '</td></tr>'; }).join('') + '</tbody></table>';
    return '<section class="ag-card ag-sum"><header class="ag-head"><h2>All Providers</h2><span class="ag-plan">7-day usage</span></header><div class="ag-aggregate-body">' + chart +
      '<div class="ag-series-legend">' + list.map(function (a, i) { return '<span><i style="background:' + COLORS[i] + '"></i>' + esc(a.name) + '</span>'; }).join('') + '</div>' +
      (!complete ? '<small class="ag-coverage">Partial coverage · missing provider series</small>' : '') + '</div>' +
      '<footer class="ag-total"><div><small>' + (complete ? '7-day total' : 'Partial total') + '</small><b class="num">' + (week / 1000000).toFixed(2) + 'M</b><span>tokens</span></div><div><small>Today</small><b class="num">' + (todayComplete ? compact(today) : 'Unavailable') + '</b><span>tokens</span></div><div><small>Today API cost</small><b class="num">' + (costComplete ? '$' + cost.toFixed(2) : 'Unavailable') + '</b></div></footer></section>';
  }
  function updated() {
    return App.fmt24h ? App.fmt24h(V.updated, true) : V.updated.toLocaleTimeString('en-GB', { hour12: false });
  }
  function render() {
    var list = providers();
    V.el.innerHTML = '<div class="agents"><header class="ag-top page-heading"><div><h1 class="page-title">Agents <span>/ Provider Telemetry</span></h1><span class="ag-subtitle">PROVIDER USAGE &amp; SERVICE STATUS</span></div><span class="ag-demo">DEMO · Illustrative quotas</span><div class="ag-sync"><div><span data-updated>Demo updated ' + updated() + '</span><small>Refresh updates timestamp only</small></div><button class="ag-refresh" data-refresh>' + App.icon('undo', 20) + 'Refresh</button></div></header>' +
      '<div class="ag-usage-legend"><span>ILLUSTRATIVE SNAPSHOT · 14–20 OCT 2026</span><div><i class="ag-example" aria-hidden="true"><b></b><em></em></i>Fill: used <span>·</span> Tick: even pace</div></div>' +
      '<div class="ag-grid">' + list.map(card).join('') + aggregate(list) + '</div><span class="ag-announcement" role="status" aria-live="polite"></span></div>';
  }
  App.register('agents', {
    show: function (el) {
      if (!V.el) {
        V.el = el;
        el.addEventListener('click', function (e) {
          if (!e.target.closest('[data-refresh]')) return;
          V.updated = new Date();
          V.el.querySelector('[data-updated]').textContent = 'Demo updated ' + updated();
          V.el.querySelector('.ag-announcement').textContent = 'Demo timestamp updated to ' + updated() + '. Illustrative usage values are unchanged.';
        });
      }
      render();
    }
  });
})();
