// Core shell: router, demo clock, idle/ambient, toasts, sheets, helpers.
(function () {
  'use strict';
  var D = window.DATA;
  var App = window.App = { state: D, views: {}, current: null, mode: 'day', calMode: 'normal' };
  var $ = App.$ = function (s, r) { return (r || document).querySelector(s); };
  App.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  App.theme = document.documentElement.dataset.theme || 'mint';
  App.setTheme = function (name) {
    if (['mint', '01', '02', '03'].indexOf(name) < 0) name = 'mint';
    App.theme = name;
    document.documentElement.dataset.theme = name;
    try { localStorage.setItem('dash01-theme', name); } catch (e) { /* Private browsing: session theme still works. */ }
    App.$$('.theme-choice').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.theme === name ? 'true' : 'false'); });
  };

  // ------------------------------------------------------------ events
  var handlers = {};
  App.on = function (e, fn) { (handlers[e] = handlers[e] || []).push(fn); };
  App.emit = function (e, a) { (handlers[e] || []).forEach(function (fn) { fn(a); }); };

  // ------------------------------------------------------------ time (demo clock)
  var offset = 0;
  App.now = function () { return new Date(Date.now() + offset); };
  App.setTime = function (h, m) {
    if (h == null) offset = 0;
    else { var d = new Date(); d.setHours(h, m, 0, 0); offset = d - Date.now(); }
    lastMin = -1;
    App.emit('time');
    App.rerender();
  };
  App.dayStart = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  App.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  App.sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  App.isNight = function () { var h = App.now().getHours(); return h >= 22 || h < 6; };

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  App.fmt = {
    time: function (d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); },
    hour: function (d) { return App.fmt.time(d); },
    ampm: function () { return ''; },
    range: function (a, b) { return App.fmt.time(a) + '–' + App.fmt.time(b); },
    day: function (d) { return DAYS[d.getDay()]; },
    dayShort: function (d) { return DAYS[d.getDay()].slice(0, 3); },
    month: function (d) { return MONTHS[d.getMonth()]; },
    monthShort: function (d) { return MON_SHORT[d.getMonth()]; },
    mins: function (m) {
      m = Math.max(0, Math.round(m));
      if (m < 60) return m + ' min';
      var h = Math.floor(m / 60), r = m % 60;
      return h + ' hr' + (r ? ' ' + r + ' min' : '');
    },
    rel: function (d) {
      var t = App.dayStart(App.now()), x = App.dayStart(d), diff = Math.round((x - t) / 864e5);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      return DAYS[d.getDay()];
    }
  };
  App.fmt24h = function (d, seconds) { return App.fmt.time(d) + (seconds ? ':' + ('0' + d.getSeconds()).slice(-2) : ''); };
  App.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ------------------------------------------------------------ icons + people
  App.icon = function (name, size, cls) {
    size = size || 24;
    return '<svg class="i ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (window.ICONS[name] || '') + '</svg>';
  };
  App.person = function (id) {
    if (id === 'family' || id === 'any') return D.family;
    for (var i = 0; i < D.people.length; i++) if (D.people[i].id === id) return D.people[i];
    return D.family;
  };
  App.pstyle = function (p) {
    if (typeof p === 'string') p = App.person(p);
    return '--c:' + p.color + ';--c-rgb:' + p.rgb + ';--c-ink:' + p.ink;
  };
  App.avatar = function (p, size, cls) {
    if (typeof p === 'string') p = App.person(p);
    size = size || 48;
    return '<span class="avatar ' + (cls || '') + '" style="' + App.pstyle(p) + ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.46) + 'px">' + (p.id === 'family' ? '★' : p.name[0]) + '</span>';
  };
  App.dots = function (ids, size) {
    return '<span class="dots">' + ids.map(function (id) { return '<i style="' + App.pstyle(id) + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '"></i>'; }).join('') + '</span>';
  };

  // ------------------------------------------------------------ calendar helpers
  App.events = function () {
    var list = D.events.filter(function (e) { return !e.canceled && e.status !== 'canceled'; });
    var today = App.dayStart(App.now());
    if (App.calMode === 'busy') list = list.concat(D.busyExtras);
    if (App.calMode === 'empty') list = list.filter(function (e) { return e.allDay || !App.sameDay(e.start, today); });
    return list;
  };
  App.isFamily = function (e) { return e.people.length >= D.people.length; };
  App.evColor = function (e) { return App.isFamily(e) ? D.family : App.person(e.people[0]); };
  App.timedOn = function (day, pid) {
    var s = App.dayStart(day), e = App.addDays(s, 1);
    return App.events().filter(function (ev) {
      return !ev.allDay && ev.start < e && ev.end > s && (!pid || ev.people.indexOf(pid) > -1);
    }).sort(function (a, b) { return a.start - b.start || String(a.id).localeCompare(String(b.id)); });
  };
  App.allDayOn = function (day, pid) {
    var s = App.dayStart(day), e = App.addDays(s, 1);
    return App.events().filter(function (ev) {
      return ev.allDay && ev.start < e && ev.end > s && (!pid || ev.people.indexOf(pid) > -1);
    });
  };
  // Timed events only. Travel is an explicit estimate, never inferred from location.
  App.leaveBy = function (e) { return new Date(+e.start - ((Number(e.travel) || 0) + (Number(e.buffer) || 0)) * 60000); };
  // Earliest ongoing event, otherwise earliest start today; stable ID breaks equal starts.
  // All-day and canceled events never become a timed next-event/departure.
  App.nextEvent = function () {
    var now = App.now();
    return App.timedOn(now).filter(function (e) { return e.end > now; })[0] || null;
  };
  App.findEvent = function (id) {
    return App.events().filter(function (e) { return e.id === id; })[0];
  };

  // ------------------------------------------------------------ chores + weather helpers
  App.currentRoutine = function () {
    var h = App.now().getHours();
    for (var i = 0; i < D.routines.length; i++) if (h >= D.routines[i].from && h < D.routines[i].to) return D.routines[i];
    return D.routines[2];
  };
  App.weatherNow = function () {
    var W = D.weather, h = App.now().getHours();
    if (!W || W.available === false || !W.t || !W.c) return { unavailable: true, cond: 'cloud', label: 'Weather unavailable', summary: 'Weather unavailable', advice: '', hour: h };
    var rainAt = -1;
    for (var i = h; i < 24; i++) if (W.p[i] >= 50) { rainAt = i; break; }
    var summary, advice;
    if (rainAt === h) {
      var stop = h; while (stop < 24 && W.p[stop] >= 50) stop++;
      summary = 'Rain until ' + App.fmt.hour(new Date(2000, 0, 1, stop));
      advice = 'Umbrella weather';
    } else if (rainAt > -1) {
      summary = 'Rain from ' + App.fmt.hour(new Date(2000, 0, 1, rainAt));
      var soccer = App.timedOn(App.now()).filter(function (e) { return /soccer/i.test(e.title) && e.start > App.now(); })[0];
      advice = soccer ? 'Pack a rain jacket for soccer' : 'Grab a rain jacket';
    } else {
      summary = W.t[h] < 12 ? 'Clear and cool' : 'Dry all day';
      advice = W.t[h] < 12 ? 'Jacket weather' : 'Light layers';
    }
    var labels = { sun: 'Sunny', moon: 'Clear', partly: 'Partly cloudy', cloud: 'Overcast', rain: 'Rain' };
    return { temp: W.t[h], cond: W.c[h], label: labels[W.c[h]], hi: W.hi, lo: W.lo, summary: summary, advice: W.advice || advice, hour: h };
  };
  App.hourly = function (count) {
    var W = D.weather, h = App.now().getHours(), out = [];
    if (!W || W.available === false || !W.t || !W.c) return out;
    for (var i = 0; i < count; i++) {
      var x = (h + i + 1) % 24;
      out.push({ h: x, t: W.t[x], c: W.c[x], p: W.p[x], label: ('0' + x).slice(-2) + ':00' });
    }
    return out;
  };

  // ------------------------------------------------------------ router
  App.register = function (name, view) { App.views[name] = view; };
  // Views are built once and kept laid out (hidden with content-visibility), so switching tabs
  // only has to paint. A view is rebuilt when its data changed ('data'/'time' events) or, for
  // time-sensitive views (minutely: true), when the minute has rolled over since it was built.
  function minuteKey() { return Math.floor(App.now().getTime() / 60000); }
  function build(name, opts) {
    var view = App.views[name];
    view.show($('#view-' + name), opts || {});
    view._built = true; view._dirty = false; view._min = minuteKey();
  }
  App.go = function (name, opts) {
    opts = opts || {};
    App.cancelHolds();
    if (!App.views[name]) name = 'home';
    if (App.current && App.current !== name && App.views[App.current].hide) App.views[App.current].hide();
    App.$$('.view').forEach(function (v) { v.classList.toggle('is-active', v.dataset.view === name); });
    App.$$('.rail-item').forEach(function (b) { var active = b.dataset.go === name; b.classList.toggle('is-active', active); if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    App.current = name;
    var view = App.views[name];
    if (!view._built || view._dirty || Object.keys(opts).length || (view.minutely && view._min !== minuteKey())) build(name, opts);
    else if (view.resume) view.resume($('#view-' + name));
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  };
  // Build a hidden view and lay it out now (cached by content-visibility; no paint happens).
  function prebuild(name) {
    var el = $('#view-' + name), view = App.views[name];
    build(name);
    if (view.hide) view.hide();
    el.classList.add('is-warming');
    el.offsetHeight;
    el.classList.remove('is-warming');
  }
  // Pre-build (startup) and re-build (after data changes) hidden views in the background, one per
  // slot, so navigating to them never pays the rebuild cost.
  var refreshTimer = null;
  function refreshStale(delay) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function next() {
      var name = Object.keys(App.views).filter(function (k) {
        var v = App.views[k];
        return k !== App.current && (!v._built || v._dirty);
      })[0];
      if (!name) return;
      prebuild(name);
      refreshTimer = setTimeout(next, 400);
    }, delay);
  }
  function markStale() {
    Object.keys(App.views).forEach(function (k) { if (k !== App.current) App.views[k]._dirty = true; });
    refreshStale(1500);
  }
  App.on('data', markStale);
  App.on('time', markStale);
  App.rerender = function () {
    if (App.current) App.views[App.current].show($('#view-' + App.current), { rerender: true });
  };

  // ------------------------------------------------------------ toasts (single, with undo)
  var toastTimer;
  App.toast = function (html, opts) {
    opts = opts || {};
    var box = $('#toasts');
    box.innerHTML = '';
    clearTimeout(toastTimer);
    var ms = opts.ms || 5000;
    var t = document.createElement('div');
    t.className = 'toast' + (opts.tone ? ' toast--' + opts.tone : '');
    t.style.setProperty('--ms', ms + 'ms');
    t.innerHTML = (opts.icon ? App.icon(opts.icon, 26) : '') + '<span class="toast-msg">' + html + '</span>' +
      (opts.undo ? '<button class="toast-undo">' + App.icon('undo', 22) + 'Undo</button>' : '');
    box.appendChild(t);
    t.classList.add('is-in');
    function kill() { t.remove(); }
    toastTimer = setTimeout(kill, ms);
    if (opts.undo) t.querySelector('.toast-undo').addEventListener('click', function () { clearTimeout(toastTimer); opts.undo(); kill(); });
  };

  // ------------------------------------------------------------ sheets (modal cards)
  var sheetReturnFocus = null;
  App.sheet = function (html, opts) {
    opts = opts || {};
    App.cancelHolds();
    App.emit('overlay');
    var layer = $('#sheetLayer');
    if (!layer.classList.contains('is-open')) sheetReturnFocus = document.activeElement;
    else App.closeSheet(true);
    layer.innerHTML = '<div class="sheet-scrim"></div><div class="sheet ' + (opts.cls || '') + '" role="dialog" aria-modal="true" aria-label="' + App.esc(opts.label || 'Details') + '" tabindex="-1">' +
      '<button class="sheet-x" data-close aria-label="Close details">' + App.icon('x', 28) + '</button>' + html + '</div>';
    layer.classList.add('is-open');
    var sheet = layer.querySelector('.sheet');
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key !== 'Tab') return;
      var items = App.$$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex="0"]', sheet).filter(function (x) { return x.offsetWidth || x.offsetHeight; });
      if (!items.length) { e.preventDefault(); sheet.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function close(replacing) {
      if (!layer.classList.contains('is-open')) return;
      document.removeEventListener('keydown', onKey, true);
      layer.classList.remove('is-open');
      if (opts.onClose) opts.onClose();
      layer.innerHTML = '';
      if (!replacing && sheetReturnFocus && sheetReturnFocus.isConnected) sheetReturnFocus.focus();
    }
    App.closeSheet = close;
    document.addEventListener('keydown', onKey, true);
    layer.querySelector('.sheet-scrim').addEventListener('click', function () { close(); });
    App.$$('[data-close]', layer).forEach(function (b) { b.addEventListener('click', function () { close(); }); });
    if (opts.onMount) opts.onMount(sheet, close);
    sheet.querySelector('.sheet-x').focus();
    return close;
  };
  App.closeSheet = function () {};

  // Stage-local coordinates for an element's center (stage may be scaled on desktop)
  App.centerOf = function (el) {
    var stage = $('#stage').getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - stage.left, y: r.top + r.height / 2 - stage.top };
  };

  // ------------------------------------------------------------ press-and-hold
  var holdCancels = [];
  App.cancelHolds = function () {
    holdCancels.slice().forEach(function (cancel) { cancel(); });
    holdCancels = holdCancels.filter(function (cancel) { return cancel.element.isConnected; });
  };
  App.hold = function (el, ms, cb) {
    holdCancels = holdCancels.filter(function (cancel) {
      if (cancel.element.isConnected) return true;
      cancel();
      return false;
    });
    var timer = null;
    function begin(e) {
      if (timer || (e.type === 'pointerdown' && e.button !== 0) || (cb.enabled && !cb.enabled())) return;
      el.classList.add('is-holding');
      timer = setTimeout(function () { timer = null; el.classList.remove('is-holding'); if (el.isConnected && (!cb.enabled || cb.enabled())) cb.done(); }, ms);
    }
    function cancel(e) { if (!timer) return; clearTimeout(timer); timer = null; el.classList.remove('is-holding'); if (cb.cancel && e && e.type === 'pointerup') cb.cancel(); }
    function down(e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(e); } }
    function up(e) { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); cancel(e); } }
    el.style.setProperty('--hold', ms + 'ms');
    el.addEventListener('pointerdown', begin);
    ['pointerup','pointerleave','pointercancel','lostpointercapture','blur'].forEach(function (event) { el.addEventListener(event, cancel); });
    el.addEventListener('keydown', down); el.addEventListener('keyup', up);
    cancel.element = el;
    holdCancels.push(cancel);
    return function () { cancel(); holdCancels = holdCancels.filter(function (fn) { return fn !== cancel; }); el.removeEventListener('pointerdown', begin); ['pointerup','pointerleave','pointercancel','lostpointercapture','blur'].forEach(function (event) { el.removeEventListener(event, cancel); }); el.removeEventListener('keydown', down); el.removeEventListener('keyup', up); };
  };
  window.addEventListener('blur', App.cancelHolds);
  document.addEventListener('visibilitychange', function () { if (document.hidden) App.cancelHolds(); });

  // ------------------------------------------------------------ modes: day / ambient / night
  App.setMode = function (m) {
    App.cancelHolds();
    var stage = $('#stage');
    App.mode = m;
    stage.dataset.mode = m;
    App.emit('mode', m);
  };

  // ------------------------------------------------------------ idle
  App.idle = { home: 60, ambient: 120 };
  var idleSec = 0;
  function onIdleTick() {
    idleSec++;
    var blocked = $('#takeover').classList.contains('is-open');
    if (App.mode === 'nightdash' && idleSec >= 20) { App.setMode('night'); return; }
    if (App.mode !== 'day' || blocked) return;
    if (idleSec === App.idle.home && App.current !== 'home') { App.closeSheet(); App.go('home'); }
    if (idleSec >= App.idle.ambient) {
      App.closeSheet();
      App.go('home');
      App.setMode(App.isNight() ? 'night' : 'ambient');
    }
  }
  App.resetIdle = function () { idleSec = 0; };

  // ------------------------------------------------------------ stage scaling (desktop preview only)
  function fit() {
    // Real responsive layout: never shrink the stage or touch targets.
    $('#stage').style.removeProperty('transform');
  }

  // ------------------------------------------------------------ clock tick
  var lastMin = -1;
  function tick() {
    var n = App.now();
    App.emit('second', n);
    if (n.getMinutes() !== lastMin) {
      lastMin = n.getMinutes();
      $('#railClock').innerHTML = '<b>' + App.fmt.time(n) + '</b><span>DEMO DATA</span>';
      App.emit('minute', n);
    }
    onIdleTick();
  }

  // ------------------------------------------------------------ boot
  App.start = function () {
    App.setTime(15, 42); // demo default: a busy weekday afternoon
    App.setTheme(App.theme);
    fit();
    window.addEventListener('resize', fit);
    // Switch tabs the instant a finger lands (pointerdown), not on release. Keyboard "clicks"
    // (detail === 0) still work.
    $('#rail').addEventListener('pointerdown', function (e) {
      var b = e.target.closest('[data-go]');
      if (b && e.button === 0) App.go(b.dataset.go);
    });
    $('#rail').addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]');
      if (b && e.detail === 0) App.go(b.dataset.go);
      var theme = e.target.closest('.theme-choice');
      if (theme) App.setTheme(theme.dataset.theme);
    });
    document.addEventListener('pointerdown', App.resetIdle, true);
    window.addEventListener('hashchange', function () { App.go(location.hash.slice(1)); });
    App.go(location.hash.slice(1) || 'home');
    tick();
    setInterval(tick, 1000);
    App.emit('ready');
    refreshStale(1500);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { lastMin = -1; tick(); App.rerender(); } });
  };
  document.addEventListener('DOMContentLoaded', function () { App.start(); });
})();
