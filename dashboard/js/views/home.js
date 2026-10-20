// Today / Daily Command. All summaries derive from the shared prototype state.
(function () {
  'use strict';
  var D = window.DATA, V = {};
  function esc(s) { return App.esc(s == null ? '' : s); }
  function clock() {
    var n = App.now();
    return '<div class="h-time num">' + App.fmt.time(n) + '</div><div class="h-date">' + App.fmt.dayShort(n) + ' ' + n.getDate() + ' ' + App.fmt.monthShort(n) + ' ' + n.getFullYear() + '</div><small class="h-clock-zone">HOUSEHOLD TIME · DEMO</small>';
  }
  function weather() {
    var w = App.weatherNow(), hours = App.hourly(7);
    if (w.unavailable) return '<div class="h-weather-unavailable">' + App.icon('cloud', 38) + '<b>Weather unavailable</b><span>Waiting for weather data</span></div><div class="h-wx-hours">' + Array(7).fill('<div class="h-hr"><span>—</span><b>—</b></div>').join('') + '</div>';
    return '<div class="h-current"><div class="h-wx-top"><span class="h-wx-icon">' + App.icon(w.cond, 43) + '</span><b class="h-wx-temp num">' + w.temp + '°</b><span class="h-wx-meta"><b>' + esc(w.label) + '</b><span>H ' + w.hi + '°　L ' + w.lo + '°</span></span></div><div class="h-wx-advice">' + App.icon('thermo', 17) + '<span>' + esc(w.advice) + '</span></div></div>' +
      '<div class="h-wx-hours">' + hours.map(function (h) { return '<div class="h-hr"><span>' + h.label + '</span>' + App.icon(h.c, 26) + '<b>' + h.t + '°</b></div>'; }).join('') + '</div>';
  }
  function presenceText(p) {
    if (p.available === false || p.stale || (p.home !== true && !p.status)) return 'Unknown';
    return p.home === true ? 'Home' : esc(p.status) + (p.returnAt ? ' · back ' + esc(p.returnAt) : p.eta ? ' · ETA ' + p.eta + ' min' : '');
  }
  function presence() {
    return D.people.map(function (p) { return '<div class="h-who">' + App.avatar(p, 46) + '<span><b>' + esc(p.name) + '</b><small><i class="presence-dot ' + (p.available === false || p.stale ? 'is-unknown' : p.home ? 'is-home' : 'is-away') + '"></i>' + presenceText(p) + '</small></span></div>'; }).join('');
  }
  function hero() {
    var e = App.nextEvent(), now = App.now();
    if (!e) {
      var tomorrow = App.timedOn(App.addDays(now, 1))[0];
      return '<button class="h-hero h-hero--empty" data-go="calendar"><span class="h-hero-label">' + App.icon('check', 28) + '<b>ALL CLEAR</b></span><span class="h-hero-main"><strong class="h-hero-title">All clear for today</strong><span class="h-hero-meta">' + (tomorrow ? 'Tomorrow · ' + esc(tomorrow.title) + ' at ' + App.fmt.time(tomorrow.start) : 'No upcoming household plans') + '</span></span>' + App.icon('right', 24) + '</button>';
    }
    var ongoing = e.start <= now, mins = Math.max(0, Math.ceil(((ongoing ? e.end : e.start) - now) / 60000));
    var hasTravel = Number.isFinite(e.travel) && e.travel >= 0, leave = Math.ceil((App.leaveBy(e) - now) / 60000);
    var who = e.people.map(function (id) { return App.person(id).name; }).join(' + ');
    var departure = ongoing ? '<b>HAPPENING NOW</b><span>' + mins + ' min remaining</span>' : !hasTravel ? '<b>DEPARTURE</b><span>Not set</span>' : '<b>' + (leave <= 0 ? 'LEAVE NOW' : 'LEAVE IN') + '</b><span>' + App.icon('car', 27) + '<strong class="num">' + (leave <= 0 ? 'NOW' : leave) + '</strong>' + (leave <= 0 ? '' : '<em>MIN</em>') + '</span>';
    return '<button class="h-hero" data-ev="' + esc(e.id) + '"><span class="h-hero-label"><b>NEXT EVENT</b><small lang="ja">次の予定</small>' + App.icon(e.icon || 'calendar', 34) + '</span><span class="h-hero-main"><strong class="h-hero-title">' + esc(e.title) + '</strong><span class="h-hero-people">' + esc(who) + '</span><span class="h-hero-meta"><span>' + App.icon('clock', 18) + App.fmt.range(e.start, e.end) + '</span>' + (e.loc ? '<span>' + App.icon('pin', 18) + esc(e.loc) + '</span>' : '') + '</span></span><span class="h-countdown"><span>' + (ongoing ? 'Ends in' : 'Starts in') + '</span><strong class="num">' + mins + '<small>min</small></strong><span>' + (ongoing ? 'Happening now' : 'until start') + '</span></span><span class="h-departure' + (hasTravel && leave <= 0 && !ongoing ? ' is-urgent' : '') + '">' + departure + '</span></button>';
  }
  function eventIcon(e) {
    if (e.icon) return e.icon;
    if (/football|soccer|practice/i.test(e.title)) return 'ball';
    if (/dinner|lunch/i.test(e.title)) return 'utensils';
    if (/piano/i.test(e.title)) return 'music';
    if (/homework|read/i.test(e.title)) return 'book';
    if (/grocer/i.test(e.title)) return 'cart';
    return 'calendar';
  }
  function lanes() {
    var now = App.now(), next = App.nextEvent();
    return D.people.map(function (p) {
      var list = App.timedOn(now, p.id).filter(function (e) { return e.end > now; }), shown = list.slice(0, 3), more = list.length - shown.length;
      return '<section class="h-lane"><div class="h-lane-head">' + App.avatar(p, 42) + '<span><b>' + esc(p.name) + '</b><small><i class="presence-dot ' + (p.home ? 'is-home' : 'is-away') + '"></i>' + presenceText(p) + '</small></span></div><div class="h-lane-events">' + (shown.length ? shown.map(function (e) { return '<button class="h-ev' + (next && next.id === e.id ? ' is-next' : '') + '" data-ev="' + esc(e.id) + '"><time>' + App.fmt.time(e.start) + '</time>' + App.icon(eventIcon(e), 19) + '<span>' + esc(e.shortTitle || e.title) + '</span>' + App.icon('right', 15) + '</button>'; }).join('') : '<p class="h-free">No more plans today.</p>') + '</div>' + (more > 0 ? '<button class="h-more" data-person="' + esc(p.id) + '">+' + more + ' more' + App.icon('right', 16) + '</button>' : '') + '</section>';
    }).join('');
  }
  function ring(done, total, size) {
    var r = size / 2 - 4, c = 2 * Math.PI * r, f = total ? Math.min(1, done / total) : 0;
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-bg"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * f) + ' ' + c + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }
  App.ring = ring;
  function summaryHead(name, subtitle, extra) { return '<span class="h-card-heading"><span><b>' + name + '</b>' + (subtitle ? '<small>' + subtitle + '</small>' : '') + '</span>' + (extra ? '<em>' + extra + '</em>' : '') + App.icon('right', 17) + '</span>'; }
  function chores() {
    var routine = App.currentRoutine(), ids = D.people.map(function (p) { return p.id; }).concat('any');
    var all = D.chores.filter(function (c) { return c.r === routine.id; }), total = all.length, done = all.filter(function (c) { return c.done; }).length;
    return summaryHead('ROUTINES', '今日のルーティン', done + ' / ' + total + ' complete') + (total ? '<span class="h-rings">' + ids.map(function (id) {
      var list = all.filter(function (c) { return c.who === id; }), count = list.filter(function (c) { return c.done; }).length;
      return '<span class="h-ring">' + ring(count, list.length, 56) + '<b class="num">' + count + '/' + list.length + '</b><span>' + (id === 'any' ? 'Anyone' : esc(App.person(id).name)) + '</span></span>';
    }).join('') + '</span><span class="h-card-foot">' + esc(routine.name) + '</span>' : '<span class="h-empty">No routines today.</span>');
  }
  function shopping() {
    var open = D.groceries.filter(function (g) { return !g.done; }), recent = open.slice(0, 3);
    return summaryHead('SHOPPING', '買い物リスト', open.length + ' remaining') + (open.length ? '<ul class="h-recent">' + recent.map(function (g) { return '<li><i></i><span>' + esc(g.name) + '</span>' + App.icon('right', 14) + '</li>'; }).join('') + '</ul>' + (open.length > 3 ? '<span class="h-card-foot">+' + (open.length - 3) + ' more</span>' : '') : '<span class="h-empty">All stocked up.</span>');
  }
  function status() {
    var devices = D.devices || [], connected = D.homeAvailable !== false;
    var lights = devices.filter(function (d) { return d.type === 'light' && d.on; }).length;
    var security = !connected || !D.security || D.security.available === false ? 'Unavailable' : D.security.armed ? 'Armed' : 'Disarmed';
    var inside = connected && D.climate && Number.isFinite(D.climate.current) ? D.climate.current + '°' : 'Unavailable';
    return summaryHead('HOME', 'ホームの状態') + '<span class="h-status-rows">' + [['bulb', 'Lights', connected ? lights + ' on' : 'Unavailable'], ['lock', 'Security', security], ['thermo', 'Inside', inside]].map(function (r) { return '<span class="h-st-row">' + App.icon(r[0], 21) + '<span>' + r[1] + '</span><b>' + r[2] + '</b></span>'; }).join('') + '</span>';
  }
  function photo() {
    var photos = D.photos || [], p = photos.filter(function (x) { return App.photoMeta(x).onThisDay; })[0] || photos[0];
    V.photo = p;
    if (!p) return summaryHead('PHOTO MEMORY', '思い出の写真') + '<span class="h-photo-placeholder">' + App.icon('photo', 36) + '<span>No photos yet</span></span>';
    var m = App.photoMeta(p);
    return summaryHead('PHOTO MEMORY', '思い出の写真') + '<span class="h-photo-image"><span class="h-photo-placeholder">' + App.icon('photo', 32) + '<span>Photo unavailable</span></span><img src="' + esc(App.photoSrc(p)) + '" alt="Demo photo: ' + esc(m.place) + '"><span class="h-photo-cap"><b>' + esc(m.place) + '</b><span>' + (m.onThisDay ? 'On this day · ' : '') + esc(m.kicker) + '</span><small>DEMO MEMORY</small></span></span>';
  }
  function paint() {
    V.el.querySelector('.h-clock').innerHTML = clock();
    V.el.querySelector('.h-weather').innerHTML = weather();
    V.el.querySelector('.h-presence').innerHTML = presence();
    V.el.querySelector('.h-hero-slot').innerHTML = hero();
    V.el.querySelector('.h-lanes').innerHTML = lanes();
    V.el.querySelector('.h-chores').innerHTML = chores();
    V.el.querySelector('.h-shop').innerHTML = shopping();
    V.el.querySelector('.h-status').innerHTML = status();
    V.el.querySelector('.h-photo').innerHTML = photo();
    var im = V.el.querySelector('.h-photo-image img');
    if (im) { im.addEventListener('error', function () { im.parentElement.classList.add('is-unavailable'); }); }
  }
  App.register('home', {
    minutely: true,
    show: function (el) {
      V.el = el;
      if (!el.firstChild) {
        el.innerHTML = '<div class="home"><header class="page-heading"><h1 class="page-title">TODAY <span>DAILY COMMAND<small class="page-subtitle" lang="ja">今日のコマンド</small></span></h1><div class="page-meta"><span>PREVIEW · LOCAL MOCK DATA</span><button class="h-mode" aria-label="Display modes" data-display>' + App.icon('sun', 20) + '</button></div></header><div class="h-top"><div class="h-clock"></div><div class="h-weather"></div></div><div class="h-presence"></div><div class="h-hero-slot"></div><div class="h-lanes"></div><div class="h-summaries"><button class="h-photo" data-memory></button><button class="h-chores" data-go="tasks"></button><button class="h-shop" data-go="shopping"></button><button class="h-status" data-go="control"></button></div></div>';
        el.addEventListener('click', function (e) {
          var target;
          if ((target = e.target.closest('[data-ev]'))) return App.eventSheet(App.findEvent(target.dataset.ev));
          if ((target = e.target.closest('[data-person]'))) return App.go('calendar', { person: target.dataset.person, date: App.now(), mode: 'day' });
          if ((target = e.target.closest('[data-memory]'))) return App.go('photos', V.photo ? { photo: V.photo.seed } : {});
          if ((target = e.target.closest('[data-go]'))) return App.go(target.dataset.go);
          if (e.target.closest('[data-display]')) App.sheet('<div class="sheet-pad"><div class="label">Display mode</div><h2 class="sheet-h">Set the mood</h2><div class="sheet-actions"><button class="btn" data-view-mode="ambient">Photo ambient</button><button class="btn" data-view-mode="night">Night clock</button></div><p style="margin-top:20px;color:var(--mute)">Tap the screen to return. Your color theme is preserved.</p></div>', { label: 'Display modes', onMount: function (sheet, close) { sheet.addEventListener('click', function (event) { var b = event.target.closest('[data-view-mode]'); if (b) { close(); App.setMode(b.dataset.viewMode); } }); } });
        });
      }
      paint();
    }
  });
  App.on('minute', function () { if (V.el && App.current === 'home') paint(); });
  App.on('data', function () { if (V.el && App.current === 'home') paint(); });
})();
