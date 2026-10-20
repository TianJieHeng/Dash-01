// Calendar / Time Rail. Source events stay separate from display-only travel blocks.
(function () {
  'use strict';
  var D = window.DATA;
  var PX = 104, START = 6, END = 23;
  var V = { mode: 'day', date: null, el: null, scroll: null };
  var MODES = [['day', 'Today'], ['3day', '3 Day'], ['week', 'Week'], ['month', 'Month']];

  function y(d) { return ((d.getHours() + d.getMinutes() / 60) - START) * PX; }
  function boundary(day, hour) { var d = App.dayStart(day); d.setHours(hour); return d; }
  function bounds(e, day) {
    var a = new Date(Math.max(+e.start, +boundary(day, START)));
    var b = new Date(Math.min(+e.end, +boundary(day, END)));
    if (b <= a) return null;
    return { top: y(a), h: Math.max(1, (b - a) / 60000 * PX / 60 - 2), before: e.start < a, after: e.end > b };
  }
  function names(e) { return e.people.map(function (id) { return App.person(id).name; }).join(' · '); }
  function fullDate(d) { return App.fmt.dayShort(d) + ' ' + d.getDate() + ' ' + App.fmt.monthShort(d) + ' ' + d.getFullYear(); }
  function dateKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function travelBlocks(evs) {
    var out = [];
    evs.forEach(function (e) {
      if (e.travel > 0) out.push(Object.assign({}, e, { start: App.leaveBy(e), end: e.start, _travel: true }));
      out.push(e);
    });
    return out.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
  }
  function overlaps(a, b) { return a.start < b.end && b.start < a.end; }

  // Greedy interval colouring. End-at-start is not a collision. Overflow represents
  // the actual omitted intervals, not a synthetic appointment with an invented duration.
  function layout(evs) {
    var out = [], clusters = [], cur = null, curEnd = 0;
    evs.forEach(function (e) {
      if (!cur || +e.start >= curEnd) { cur = []; clusters.push(cur); curEnd = 0; }
      cur.push(e); curEnd = Math.max(curEnd, +e.end);
    });
    clusters.forEach(function (c) {
      var cols = [], placed = [];
      c.forEach(function (e) {
        var i = cols.findIndex(function (end) { return end <= +e.start; });
        if (i < 0) { i = cols.length; cols.push(0); }
        cols[i] = +e.end; placed.push({ e: e, col: i });
      });
      if (cols.length <= 2) placed.forEach(function (p) { out.push({ e: p.e, col: p.col, cols: cols.length }); });
      else {
        placed.filter(function (p) { return p.col === 0; }).forEach(function (p) { out.push({ e: p.e, col: 0, cols: 2 }); });
        out.push({ more: placed.filter(function (p) { return p.col > 0; }).map(function (p) { return p.e; }), col: 1, cols: 2 });
      }
    });
    return out;
  }
  function evBlock(e, style, opts) {
    opts = opts || {};
    var now = App.now(), p = opts.color || App.evColor(e), mins = (e.end - e.start) / 60000;
    var cls = 'ev' + (e.end <= now ? ' is-past' : '') + (e.start <= now && e.end > now ? ' is-now' : '') + (mins < 45 ? ' is-short' : '') + (mins < 25 ? ' is-tiny' : '') + (App.isFamily(e) ? ' is-family' : '') + (opts.half ? ' is-half' : '') + (e._travel ? ' ev--travel' : '');
    var label = (e._travel ? 'Travel to ' : '') + e.title + ', ' + App.fmt.range(e.start, e.end) + ', ' + names(e);
    return '<button class="' + cls + '" data-ev="' + App.esc(e.id) + '" aria-label="' + App.esc(label) + '" title="' + App.esc(label) + '" style="' + App.pstyle(p) + ';' + style + '">' +
      '<span class="ev-meta">' + App.fmt.range(e.start, e.end) + '</span>' +
      '<span class="ev-title">' + (e._travel ? App.icon('car', 18) + 'Travel' : App.esc(e.title)) + '</span>' +
      (!e._travel && e.loc ? '<span class="ev-location">' + App.icon('pin', 13) + App.esc(e.loc) + '</span>' : '') +
      (!e._travel && e.people.length > 1 ? '<span class="ev-with">' + App.icon('person', 13) + App.esc(names(e)) + '</span>' : '') +
      (opts.before || opts.after ? '<span class="ev-cont">' + (opts.before ? 'Continues from earlier' : 'Continues later') + '</span>' : '') + '</button>';
  }
  function placeBlocks(list, day, laneId) {
    list = travelBlocks(list).filter(function (e) { return bounds(e, day); });
    return layout(list).map(function (it) {
      var w = 100 / it.cols, left = it.col * w;
      if (it.more) {
        var ids = Array.from(new Set(it.more.map(function (e) { return e.id; })));
        var first = it.more[0], top = bounds(first, day).top;
        return '<button class="ev-more" data-more="' + ids.join(',') + '" aria-label="' + ids.length + ' more events near ' + App.fmt.time(first.start) + '" style="top:' + top + 'px;left:calc(' + left + '% + 4px);width:calc(' + w + '% - 8px)">+' + ids.length + ' more</button>';
      }
      var b = bounds(it.e, day);
      return evBlock(it.e, 'top:' + b.top + 'px;height:' + b.h + 'px;left:calc(' + left + '% + 4px);width:calc(' + w + '% - 8px)', { color: laneId && !App.isFamily(it.e) ? App.person(laneId) : null, half: it.cols > 1, before: b.before, after: b.after });
    }).join('');
  }
  function hoursCol() {
    var h = '';
    for (var i = START; i <= END; i++) {
      h += '<div class="hr" style="top:' + (i - START) * PX + 'px"><span>' + String(i).padStart(2, '0') + ':00</span></div>';
      if (i < END) h += '<div class="hr hr--half" style="top:' + ((i - START) * PX + PX / 2) + 'px"><span>:30</span></div>';
    }
    return h;
  }
  function nowLine(days) {
    var now = App.now(), idx = days.findIndex(function (d) { return App.sameDay(d, now); });
    if (idx < 0 || now.getHours() < START || now.getHours() >= END) return '';
    return '<div class="now-line' + (days.length > 1 ? ' now-line--' + idx : '') + '" style="top:' + y(now) + 'px"><span class="num">' + App.fmt.time(now, false) + '</span></div>';
  }
  function dayAllDay(day) {
    var list = App.allDayOn(day), occupied = [], shown = [], hidden = [];
    list.forEach(function (e) {
      var indices = D.people.map(function (p, i) { return e.people.indexOf(p.id) >= 0 ? i : -1; }).filter(function (i) { return i >= 0; });
      if (!indices.length || indices.some(function (i) { return occupied[i]; })) { hidden.push(e); return; }
      indices.forEach(function (i) { occupied[i] = true; });
      var contiguous = indices[indices.length - 1] - indices[0] + 1 === indices.length;
      (contiguous ? [indices] : indices.map(function (i) { return [i]; })).forEach(function (group) {
        shown.push('<button class="ad" data-ev="' + App.esc(e.id) + '" style="grid-column:' + (group[0] + 1) + '/span ' + group.length + ';' + App.pstyle(App.evColor(e)) + '"><span>' + App.esc(e.title) + (e.people.length > 1 ? ' · ' + App.esc(names(e)) : '') + '</span></button>');
      });
    });
    return '<div class="allday"><div class="gutter"><span>All day</span>' + (hidden.length ? '<button data-more="' + hidden.map(function (e) { return e.id; }).join(',') + '" aria-label="' + hidden.length + ' more all-day events">+' + hidden.length + ' more</button>' : '<small lang="ja">終日</small>') + '</div><div class="allday-grid">' + shown.join('') + (!list.length ? '<span class="ad-empty">No all-day events</span>' : '') + '</div></div>';
  }
  function dayView() {
    var day = V.date, all = App.timedOn(day), blocks = travelBlocks(all);
    // Shared cards span everyone only when every affected lane is free. Otherwise
    // linked per-lane instances enter ordinary overlap layout and remain selectable.
    var wide = all.filter(function (e) {
      return App.isFamily(e) && !e.travel && !blocks.some(function (other) { return other.id !== e.id && overlaps(e, other); });
    });
    var head = '<div class="lanes-head"><div class="gutter"><button class="cal-agenda" data-agenda aria-label="Open day agenda">' + App.icon('calendar', 22) + '</button></div>' + D.people.map(function (p) {
      return '<div class="lane-head" style="' + App.pstyle(p) + '">' + App.avatar(p, 46) + '<b>' + App.esc(p.name) + '</b></div>';
    }).join('') + '</div>';
    var grid = '<div class="grid-scroll"><div class="grid" style="height:' + (END - START) * PX + 'px"><div class="hours">' + hoursCol() + '</div><div class="lanes">' + D.people.map(function (p) {
      return '<div class="lane" style="' + App.pstyle(p) + '">' + placeBlocks(all.filter(function (e) { return e.people.indexOf(p.id) >= 0 && wide.indexOf(e) < 0; }), day, p.id) + '</div>';
    }).join('') + '<div class="lane-fam">' + wide.map(function (e) {
      var b = bounds(e, day); return b ? evBlock(e, 'top:' + b.top + 'px;height:' + b.h + 'px;left:4px;right:4px', b) : '';
    }).join('') + '</div></div>' + nowLine([day]) + '</div></div>';
    return '<div class="cal-day">' + head + dayAllDay(day) + grid + (!all.length ? '<div class="cal-empty">No events planned</div>' : '') + '</div>';
  }
  function threeDay() {
    var days = [0, 1, 2].map(function (i) { return App.addDays(V.date, i); });
    var head = '<div class="lanes-head"><div class="gutter">' + App.icon('calendar', 22) + '</div>' + days.map(function (d) {
      return '<div class="day-head' + (App.sameDay(d, App.now()) ? ' is-today' : '') + '"><b>' + App.fmt.dayShort(d) + ' ' + d.getDate() + '</b><small>' + App.fmt.monthShort(d) + '</small></div>';
    }).join('') + '</div>';
    var ad = '<div class="allday"><div class="gutter"><span>All day</span><small lang="ja">終日</small></div><div class="allday-grid allday-grid--3">' + days.map(function (d) {
      var list = App.allDayOn(d);
      return '<div class="ad-cell">' + (list.length ? '<button class="ad" data-ev="' + list[0].id + '" style="' + App.pstyle(App.evColor(list[0])) + '"><span>' + App.esc(list[0].title) + '</span></button>' : '') + (list.length > 1 ? '<button class="ad-more" data-more="' + list.slice(1).map(function (e) { return e.id; }).join(',') + '">+' + (list.length - 1) + '</button>' : '') + '</div>';
    }).join('') + '</div></div>';
    return '<div class="cal-day cal-3">' + head + ad + '<div class="grid-scroll"><div class="grid" style="height:' + (END - START) * PX + 'px"><div class="hours">' + hoursCol() + '</div><div class="lanes lanes--3">' + days.map(function (d) {
      return '<div class="lane">' + placeBlocks(App.timedOn(d), d) + '</div>';
    }).join('') + '</div>' + nowLine(days) + '</div></div></div>';
  }
  function weekView() {
    return '<div class="week">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = App.addDays(V.date, i), list = App.allDayOn(d).concat(App.timedOn(d));
      return '<section class="wk-col' + (App.sameDay(d, App.now()) ? ' is-today' : '') + '"><button class="wk-head" data-day="' + (+d) + '" aria-label="Open ' + fullDate(d) + '"><b>' + App.fmt.dayShort(d) + '</b><span class="num">' + d.getDate() + '</span></button><div class="wk-list">' + list.map(function (e) {
        return '<button class="wk-ev' + (e.end <= App.now() ? ' is-past' : '') + '" data-ev="' + App.esc(e.id) + '" style="' + App.pstyle(App.evColor(e)) + '"><span class="wk-t">' + (e.allDay ? 'All day' : App.fmt.time(e.start, false)) + '</span><b>' + App.esc(e.title) + '</b><small>' + App.esc(names(e)) + '</small></button>';
      }).join('') + (!list.length ? '<p class="wk-free">No events</p>' : '') + '</div></section>';
    }).join('') + '</div>';
  }
  function monthView() {
    var first = new Date(V.date.getFullYear(), V.date.getMonth(), 1), start = App.addDays(first, -((first.getDay() + 6) % 7)), cells = '';
    for (var i = 0; i < 42; i++) {
      var d = App.addDays(start, i), evs = App.allDayOn(d).concat(App.timedOn(d));
      var dots = evs.slice(0, 5).map(function (e) { return '<i style="' + App.pstyle(App.evColor(e)) + '"></i>'; }).join('');
      cells += '<button class="mo-cell' + (d.getMonth() !== first.getMonth() ? ' is-out' : '') + (App.sameDay(d, App.now()) ? ' is-today' : '') + (App.sameDay(d, V.date) ? ' is-selected' : '') + '" data-day="' + (+d) + '" aria-label="' + fullDate(d) + ', ' + evs.length + ' events"><span class="num">' + d.getDate() + '</span><span class="mo-dots" aria-hidden="true">' + dots + (evs.length > 5 ? '<em>+' + (evs.length - 5) + '</em>' : '') + '</span></button>';
    }
    return '<div class="month"><div class="mo-dow">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) { return '<span class="label">' + d + '</span>'; }).join('') + '</div><div class="mo-grid">' + cells + '</div></div>';
  }
  function title() {
    if (V.mode === 'month') return App.fmt.month(V.date) + ' ' + V.date.getFullYear();
    if (V.mode === 'day') return fullDate(V.date);
    var end = App.addDays(V.date, V.mode === '3day' ? 2 : 6);
    return App.fmt.dayShort(V.date) + ' ' + V.date.getDate() + ' ' + App.fmt.monthShort(V.date) + ' – ' + end.getDate() + ' ' + App.fmt.monthShort(end) + ' ' + end.getFullYear();
  }
  function header() {
    return '<header class="cal-heading"><div><h1>Calendar <span>/ Schedule deck</span></h1><p lang="ja">スケジュールデッキ</p></div><div class="seg" aria-label="Calendar view">' + MODES.map(function (m) { return '<button class="' + (V.mode === m[0] ? 'is-on' : '') + '" data-mode="' + m[0] + '" aria-pressed="' + (V.mode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div></header>' +
      '<div class="cal-head"><button class="icon-btn" data-nav="-1" aria-label="Previous ' + (V.mode === 'month' ? 'month' : 'date range') + '">' + App.icon('left', 22) + '</button><h2 class="cal-title">' + title() + '</h2><button class="icon-btn" data-nav="1" aria-label="Next ' + (V.mode === 'month' ? 'month' : 'date range') + '">' + App.icon('right', 22) + '</button><div class="cal-actions"><button class="btn btn--ghost" data-today' + (App.sameDay(V.date, App.now()) ? ' disabled' : '') + '>Back to today</button><button class="btn btn--solid" data-add>' + App.icon('plus', 22) + 'Add event</button></div></div>';
  }
  function render() {
    var focus = document.activeElement, key = focus && V.el.contains(focus) ? ['data-ev', 'data-mode', 'data-nav', 'data-day'].filter(function (a) { return focus.hasAttribute(a); })[0] : null;
    var value = key ? focus.getAttribute(key) : null;
    V.el.innerHTML = '<div class="cal cal--' + V.mode + '">' + header() + '<div class="cal-body">' + ({ day: dayView, '3day': threeDay, week: weekView, month: monthView }[V.mode]()) + '</div><footer class="cal-footer"><span>' + (V.mode === 'day' || V.mode === '3day' ? '06:00 — 23:00' : 'Household calendar') + '</span><span>Local preview · session only</span></footer></div>';
    var sc = V.el.querySelector('.grid-scroll');
    if (sc) {
      sc.scrollTop = V.scroll != null ? V.scroll : Math.max(0, y(App.now()) - 175);
      sc.addEventListener('scroll', function () { V.scroll = sc.scrollTop; });
    }
    if (key) { var next = Array.from(V.el.querySelectorAll('[' + key + ']')).find(function (el) { return el.getAttribute(key) === value; }); if (next) next.focus({ preventScroll: true }); }
  }
  function nav(dir) {
    if (V.mode === 'month') V.date = new Date(V.date.getFullYear(), V.date.getMonth() + dir, Math.min(V.date.getDate(), new Date(V.date.getFullYear(), V.date.getMonth() + dir + 1, 0).getDate()));
    else V.date = App.addDays(V.date, dir * ({ day: 1, '3day': 3, week: 7 }[V.mode]));
    V.scroll = null; render();
  }
  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-ev]'))) return App.eventSheet(App.findEvent(t.dataset.ev));
    if ((t = e.target.closest('[data-more]'))) return moreSheet(t.dataset.more.split(','));
    if ((t = e.target.closest('[data-agenda]'))) return moreSheet(App.allDayOn(V.date).concat(App.timedOn(V.date)).map(function (e) { return e.id; }), 'Day agenda · ' + fullDate(V.date));
    if ((t = e.target.closest('[data-nav]'))) return nav(+t.dataset.nav);
    if ((t = e.target.closest('[data-today]'))) { V.date = App.dayStart(App.now()); V.scroll = null; return render(); }
    if ((t = e.target.closest('button[data-mode]'))) { V.mode = t.dataset.mode; V.scroll = null; return render(); }
    if ((t = e.target.closest('[data-day]'))) { V.mode = 'day'; V.date = new Date(+t.dataset.day); V.scroll = null; return render(); }
    if ((t = e.target.closest('[data-add]'))) return addSheet();
  }
  function swipe(el) {
    var sx, sy, st;
    el.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; st = Date.now(); });
    el.addEventListener('pointercancel', function () { sx = null; });
    el.addEventListener('pointerup', function (e) {
      if (sx == null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 90 && Math.abs(dy) < 60 && Date.now() - st < 700 && !e.target.closest('.cal-head,.cal-heading')) nav(dx < 0 ? 1 : -1);
    });
  }
  App.eventSheet = function (e) {
    if (!e) return;
    App.sheet('<div class="evs" style="' + App.pstyle(App.evColor(e)) + '"><div class="evs-band"><div class="label">' + fullDate(e.start) + '</div><h2>' + App.esc(e.title) + '</h2><div class="evs-time num">' + (e.allDay ? 'All day' : App.fmt.range(e.start, e.end)) + '</div></div><div class="evs-body">' +
      (!e.allDay ? '<div class="evs-row">' + App.icon('car', 25) + '<div><b>' + (e.travel ? 'Leave by ' + App.fmt.time(App.leaveBy(e)) : 'Travel estimate unavailable') + '</b>' + (e.travel ? '<span>' + e.travel + ' minute travel estimate</span>' : '') + '</div></div>' : '') +
      '<div class="evs-row">' + App.icon('pin', 25) + '<div><b>' + App.esc(e.loc || 'No location added') + '</b></div></div><div class="evs-row">' + App.icon('person', 25) + '<div class="evs-people">' + e.people.map(App.person).map(function (p) { return '<span class="chip" style="' + App.pstyle(p) + '">' + App.avatar(p, 32) + App.esc(p.name) + '</span>'; }).join('') + '</div></div>' +
      (e.notes ? '<p class="evs-notes">' + App.esc(e.notes) + '</p>' : '') + '</div></div>', { cls: 'sheet--event', label: e.title });
  };
  function moreSheet(ids, heading) {
    var list = ids.map(App.findEvent).filter(Boolean).sort(function (a, b) { return a.start - b.start; });
    App.sheet('<div class="sheet-pad"><div class="label">Calendar</div><h2 class="sheet-h">' + App.esc(heading || 'More events') + '</h2><div class="more-list">' + list.map(function (e) {
      return '<button class="more-row" data-ev="' + App.esc(e.id) + '" style="' + App.pstyle(App.evColor(e)) + '"><i></i><div><b>' + App.esc(e.title) + '</b><small>' + App.esc(names(e)) + '</small></div><span>' + (e.allDay ? 'All day' : App.fmt.range(e.start, e.end)) + '</span></button>';
    }).join('') + (!list.length ? '<p>No events planned.</p>' : '') + '</div></div>', { label: heading || 'More events', onMount: function (s) { s.addEventListener('click', function (e) { var t = e.target.closest('[data-ev]'); if (t) App.eventSheet(App.findEvent(t.dataset.ev)); }); } });
  }
  function addSheet() {
    var now = App.dayStart(App.now()), selected = App.dayStart(V.date), days = [0, 1, 2, 3, 4].map(function (i) { return App.addDays(now, i); });
    if (!days.some(function (d) { return App.sameDay(d, selected); })) days[4] = selected;
    var st = { who: [], date: dateKey(selected), time: '15:00', dur: 60, saving: false };
    var times = ['07:00', '09:00', '12:00', '15:00', '17:00', '19:00'], ideas = ['School', 'Appointment', 'Practice', 'Groceries', 'Family time', 'Other'];
    App.sheet('<form class="add"><header class="add-heading"><div class="label">Calendar</div><h2>New event</h2></header><div class="add-content"><label class="label" for="event-title">Title</label><input id="event-title" class="big-input" placeholder="What’s happening?" required maxlength="160" autocomplete="off"><div class="chips">' + ideas.map(function (s) { return '<button type="button" class="chip chip--ghost" data-idea="' + s + '">' + s + '</button>'; }).join('') + '</div><div class="label">Who</div><div class="add-who">' + D.people.map(function (p) {
      return '<button type="button" class="who-btn" data-who="' + p.id + '" aria-pressed="false" style="' + App.pstyle(p) + '">' + App.avatar(p, 44) + '<span>' + App.esc(p.name) + '</span></button>';
    }).join('') + '<button type="button" class="who-btn" data-who="all" aria-pressed="false">' + App.icon('person', 40) + '<span>Everyone</span></button></div><div class="label">Date</div><div class="chips add-dates">' + days.map(function (d) { return '<button type="button" class="chip' + (dateKey(d) === st.date ? ' is-on' : '') + '" data-date="' + dateKey(d) + '" aria-pressed="' + (dateKey(d) === st.date) + '"><b>' + (App.sameDay(d, now) ? 'Today' : App.fmt.dayShort(d)) + '</b><small>' + d.getDate() + ' ' + App.fmt.monthShort(d) + '</small></button>'; }).join('') + '</div><div class="label">Start time</div><div class="chips add-times">' + times.map(function (t) { return '<button type="button" class="chip' + (t === st.time ? ' is-on' : '') + '" data-time="' + t + '" aria-pressed="' + (t === st.time) + '">' + t + '</button>'; }).join('') + '</div><label class="add-exact">Exact time<input type="time" data-exact value="' + st.time + '" required></label><div class="label">Duration</div><div class="chips">' + [[30, '30 minutes'], [60, '1 hour'], [120, '2 hours']].map(function (t) { return '<button type="button" class="chip' + (t[0] === st.dur ? ' is-on' : '') + '" data-dur="' + t[0] + '" aria-pressed="' + (t[0] === st.dur) + '">' + t[1] + '</button>'; }).join('') + '</div><p class="add-error" role="alert"></p><p class="add-note">Preview events are kept for this session only.</p></div><footer class="sheet-actions"><button type="button" class="btn btn--ghost" data-close>Cancel</button><button type="submit" class="btn btn--solid" data-save disabled>Add event</button></footer></form>', {
      cls: 'sheet--wide sheet--add', label: 'New event', onMount: function (s, close) {
        var input = s.querySelector('#event-title'), save = s.querySelector('[data-save]'), exact = s.querySelector('[data-exact]');
        function valid() { return !!input.value.trim() && st.who.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(st.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(st.time) && [30, 60, 120].indexOf(st.dur) >= 0; }
        function update() { save.disabled = st.saving || !valid(); }
        input.addEventListener('input', update);
        exact.addEventListener('input', function () { st.time = exact.value; App.$$('[data-time]', s).forEach(function (b) { b.classList.toggle('is-on', b.dataset.time === st.time); b.setAttribute('aria-pressed', String(b.dataset.time === st.time)); }); update(); });
        s.addEventListener('click', function (ev) {
          var t = ev.target.closest('button'); if (!t || st.saving) return;
          if (t.dataset.idea) { input.value = t.dataset.idea === 'Other' ? '' : t.dataset.idea; input.focus(); }
          if (t.dataset.who) {
            if (t.dataset.who === 'all') st.who = st.who.length === D.people.length ? [] : D.ALL.slice();
            else { var i = st.who.indexOf(t.dataset.who); if (i >= 0) st.who.splice(i, 1); else st.who.push(t.dataset.who); }
            App.$$('[data-who]', s).forEach(function (b) { var on = b.dataset.who === 'all' ? st.who.length === D.people.length : st.who.indexOf(b.dataset.who) >= 0; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
          }
          ['date', 'time', 'dur'].forEach(function (k) { if (t.dataset[k] != null) { st[k] = k === 'dur' ? +t.dataset[k] : t.dataset[k]; App.$$('[data-' + k + ']', s).forEach(function (b) { b.classList.toggle('is-on', b === t); b.setAttribute('aria-pressed', String(b === t)); }); if (k === 'time') exact.value = st.time; } }); update();
        });
        s.querySelector('form').addEventListener('submit', function (ev) {
          ev.preventDefault(); if (st.saving || !valid()) return;
          st.saving = true; update(); save.textContent = 'Adding…';
          try {
            var parts = st.date.split('-').map(Number), time = st.time.split(':').map(Number), start = new Date(parts[0], parts[1] - 1, parts[2], time[0], time[1]);
            var event = { id: D._eid(), title: input.value.trim(), people: D.ALL.filter(function (id) { return st.who.indexOf(id) >= 0; }), start: start, end: new Date(+start + st.dur * 60000) };
            D.events.push(event); close(); V.date = App.dayStart(start); V.scroll = null; render(); App.emit('data');
            App.toast('Added <b>' + App.esc(event.title) + '</b> to this preview', { icon: 'calendar', undo: function () { var i = D.events.indexOf(event); if (i >= 0) D.events.splice(i, 1); render(); App.emit('data'); } });
          } catch (error) { st.saving = false; update(); save.textContent = 'Add event'; s.querySelector('.add-error').textContent = 'Could not add the event. Your details are still here; please try again.'; }
        });
      }
    });
  }
  App.register('calendar', { show: function (el) { if (!V.el) { V.el = el; el.addEventListener('click', onClick); swipe(el); } if (!V.date) V.date = App.dayStart(App.now()); render(); } });
  App.on('minute', function () {
    if (App.current !== 'calendar' || !V.el) return;
    var grid = V.el.querySelector('.grid'); if (!grid) return;
    var old = grid.querySelector('.now-line'); if (old) old.remove();
    grid.insertAdjacentHTML('beforeend', nowLine(V.mode === '3day' ? [V.date, App.addDays(V.date, 1), App.addDays(V.date, 2)] : [V.date]));
  });
  App.on('time', function () { V.date = App.dayStart(App.now()); V.scroll = null; });
})();
