// Habitat Control. Local simulated commands keep desired and confirmed state separate.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, pending: {}, errors: {}, expanded: {}, scene: null, scenePending: false, camTimer: null, sheetBox: null, feedback: '' };
  function dev(id) { return D.devices.filter(function (d) { return d.id === id; })[0]; }
  function esc(s) { return App.esc(s == null ? '' : s); }
  function offline(d) { return d.offline === true || d.online === false; }
  function disabled(d) { return offline(d) || !!V.pending[d.id]; }
  function degrees(n) { return typeof n === 'number' ? n.toFixed(1) + '°' : '—'; }
  function roomName(id) { var r = D.rooms.filter(function (r) { return r.id === id; })[0]; return r ? r.name : id; }
  function feedback(message) {
    V.feedback = message;
    if (V.el) V.el.querySelector('.hc-feedback').textContent = message;
    var s = document.querySelector('.hc-sheet-status');
    if (s) s.textContent = message;
  }

  // Promise<boolean> is additive: legacy callers may still ignore the return value.
  // No new request replaces an outstanding command, so late responses cannot overwrite it.
  App.setDevice = function (id, patch, opts) {
    var d = dev(id);
    if (!d || offline(d) || V.pending[id]) return Promise.resolve(false);
    delete V.errors[id];
    var command = { patch: Object.assign({}, patch) };
    V.pending[id] = command;
    changed([id]);
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (V.pending[id] !== command) { resolve(false); return; }
        delete V.pending[id];
        var ok = !d.flaky && !offline(d);
        if (ok) Object.assign(d, command.patch);
        else {
          V.errors[id] = 'Unable to confirm · retry';
          if (!(opts && opts.silent)) App.toast('DEMO · Unable to confirm <b>' + esc(d.name) + '</b>. Last reported state retained.', { tone: 'error', icon: 'bolt' });
        }
        changed([id]);
        resolve(ok);
      }, d.flaky ? 2000 : 650);
    });
  };
  function commandNote(d) {
    var p = V.pending[d.id];
    if (offline(d)) return 'Offline · last reported state';
    if (!p) return V.errors[d.id] || '';
    if (d.type === 'light') return p.patch.on === false ? 'Turning off…' : 'Updating to ' + (p.patch.level == null ? d.level : p.patch.level) + '%…';
    if (d.type === 'blind') return (p.patch.pos > d.pos ? 'Opening' : 'Closing') + '… last reported ' + d.pos + '%';
    if (d.type === 'lock') return p.patch.locked ? 'Locking…' : 'Unlocking…';
    return 'Command pending…';
  }
  function tile(d) {
    var pending = V.pending[d.id], off = offline(d), blocked = disabled(d), note = commandNote(d);
    var state, icon, action = '', value;
    if (d.type === 'light') {
      state = typeof d.on === 'boolean' ? (d.on ? 'On' : 'Off') : 'Unknown'; icon = 'bulb';
      value = typeof d.level === 'number' && typeof d.on === 'boolean' ? (d.on ? d.level : 0) : null;
      action = '<button class="tile-toggle' + (d.on ? ' is-on' : '') + '" data-toggle role="switch" aria-checked="' + !!d.on + '" aria-label="' + esc(d.name) + ', ' + esc(roomName(d.room)) + '"' + (blocked || state === 'Unknown' ? ' disabled' : '') + '><i></i></button>';
    } else if (d.type === 'blind') {
      value = typeof d.pos === 'number' ? d.pos : null;
      state = value == null ? 'Unknown' : value === 0 ? 'Closed' : value === 100 ? 'Fully open' : 'Partially open'; icon = 'blinds';
    } else if (d.type === 'lock') {
      state = typeof d.locked === 'boolean' ? (d.locked ? 'Locked' : 'Unlocked') : 'Unknown'; icon = d.locked ? 'lock' : 'unlock';
    } else {
      state = { closed: 'Closed', open: 'Open', opening: 'Opening…', closing: 'Closing…', stopped: 'Stopped' }[d.state] || 'Unknown'; icon = 'garage';
    }
    var h = '<article class="tile tile--' + d.type + (off ? ' is-offline' : '') + (pending ? ' is-pending' : '') + '" data-dev="' + esc(d.id) + '" aria-busy="' + !!pending + '">' +
      '<div class="tile-top"><span class="tile-icon">' + App.icon(icon, 27) + '</span><div class="tile-heading"><b class="tile-name">' + esc(d.name) + '</b><span class="tile-state">' + (off ? 'Last known: ' : '') + state + '</span></div>' + action + '</div>';
    if (d.type === 'light' || d.type === 'blind') {
      h += '<div class="tile-adjust"><output class="tile-value num" for="level-' + d.id + '">' + (value == null ? '—' : value + '%') + '</output><input id="level-' + d.id + '" class="tile-range" data-level type="range" min="0" max="100" step="1" value="' + (value || 0) + '" style="--level:' + (value || 0) + '%" aria-label="' + esc(d.name + (d.type === 'light' ? ' brightness' : ' open position')) + '" aria-valuetext="' + (value == null ? 'Unknown' : value + '%') + '"' + (blocked || value == null ? ' disabled' : '') + '></div>';
    } else if (d.type === 'lock') {
      h += '<button class="tile-secure" data-lock' + (blocked || state === 'Unknown' ? ' disabled' : '') + '>' + App.icon(d.locked ? 'right' : 'lock', 20) + '<span>' + (pending ? commandNote(d) : d.locked ? 'Hold 1s to unlock' : 'Lock door') + '</span><i class="tile-hold-progress"></i></button>';
    } else {
      var moving = /^(opening|closing)$/.test(d.state);
      h += '<button class="tile-garage" data-garage' + (blocked || moving || ['open', 'closed'].indexOf(d.state) < 0 ? ' disabled' : '') + '>' + App.icon('right', 20) + '<span>' + (pending ? 'Command pending…' : moving ? state : d.state === 'closed' ? 'Open…' : d.state === 'open' ? 'Close…' : 'State unavailable') + '</span></button>';
    }
    return h + '<span class="tile-note' + (V.errors[d.id] || off ? ' is-warning' : '') + '" aria-live="polite">' + esc(note || (d.type === 'garage' ? 'Confirmation required' : '')) + '</span></article>';
  }
  function summary() {
    var lights = D.devices.filter(function (d) { return d.type === 'light'; }), on = lights.filter(function (d) { return d.on === true && !offline(d); }).length;
    var unknown = lights.filter(function (d) { return offline(d) || typeof d.on !== 'boolean'; }).length;
    var locks = D.devices.filter(function (d) { return d.type === 'lock'; }), locked = locks.filter(function (d) { return d.locked === true && !offline(d); }).length;
    var c = D.climate, m = D.media;
    var list = [['lights', 'bulb', 'Lights', on + ' / ' + lights.length + ' on', unknown ? unknown + ' unavailable' : 'Lighting'], ['security', 'lock', 'Security', locked + ' locked', 'Locks + garage'], ['climate', 'thermo', 'Climate', degrees(c.current), 'Indoor temperature'], ['media', 'music', 'Media', m.playing ? 'Playing' : 'Paused', m.room]];
    return list.map(function (s) { return '<button class="sum" data-sum="' + s[0] + '"><span class="sum-icon">' + App.icon(s[1], 30) + '</span><span class="sum-text"><span>' + s[2] + '</span><b>' + s[3] + '</b><small>' + esc(s[4]) + '</small></span>' + App.icon('right', 20) + '</button>'; }).join('');
  }
  function scenes() {
    return D.scenes.map(function (s) { return '<button class="scene' + (V.scene === s.id ? ' is-on' : '') + '" data-scene="' + s.id + '" aria-pressed="' + (V.scene === s.id) + '"' + (V.scenePending ? ' disabled' : '') + '>' + App.icon(s.icon, 27) + '<span>' + esc(s.name) + '</span></button>'; }).join('');
  }
  function roomCount(room) { return D.devices.filter(function (d) { return d.room === room; }).length + ' devices'; }
  function rooms() {
    return D.rooms.map(function (r) {
      var list = D.devices.filter(function (d) { return d.room === r.id; });
      var preview = list.slice(0, 2);
      if (r.id === 'living') preview = [dev('l-lamp'), dev('l-blinds')].filter(Boolean);
      if (r.id === 'entry') preview = [dev('e-door'), dev('g-door')].filter(Boolean);
      var visible = V.expanded[r.id] ? list : preview;
      return '<section class="room"><header class="room-h"><h2>' + esc(r.name) + '</h2><span data-room-count="' + r.id + '">' + roomCount(r.id) + '</span>' +
        (list.length > preview.length ? '<button class="room-more" data-room-expand="' + r.id + '" aria-expanded="' + !!V.expanded[r.id] + '">' + (V.expanded[r.id] ? 'Show fewer' : 'Show ' + (list.length - preview.length) + ' more') + App.icon('right', 16) + '</button>' : '') + '</header><div class="tiles">' + visible.map(tile).join('') + '</div></section>';
    }).join('');
  }
  function climate() {
    var c = D.climate, operating = c.operating || c.state, verb = { heating: 'Heating', cooling: 'Cooling', idle: 'Idle', off: 'Off' }[operating] || 'Not reported';
    var pending = !!V.climatePending, lo = typeof c.min === 'number' ? c.min : 15, hi = typeof c.max === 'number' ? c.max : 28;
    return '<header class="hc-support-head"><h2>Climate</h2><small>Main floor</small>' + App.icon('thermo', 18) + '</header><div class="hc-climate-body"><div class="th-main"><div class="th-current"><strong class="num">' + degrees(c.current) + '</strong><small>Current · °C</small></div><div class="th-target"><span>Target</span><div><button class="th-btn" data-temp="-0.5" aria-label="Lower target by 0.5 degrees Celsius"' + (pending || c.set <= lo ? ' disabled' : '') + '>' + App.icon('minus', 24) + '</button><b class="num">' + degrees(c.set) + '</b><button class="th-btn" data-temp="0.5" aria-label="Raise target by 0.5 degrees Celsius"' + (pending || c.set >= hi ? ' disabled' : '') + '>' + App.icon('plus', 24) + '</button></div><small>' + (pending ? V.climatePending.set != null ? 'Setting ' + degrees(V.climatePending.set) + '…' : 'Setting ' + esc(V.climatePending.mode) + ' mode…' : '0.5° steps') + '</small></div></div><div class="th-meta"><span>Humidity <b class="num">' + c.humidity + '%</b></span><span>Status <b class="th-verb">' + verb + '</b></span></div><div class="th-modes" aria-label="Thermostat mode">' + [['heat', 'Heat'], ['cool', 'Cool'], ['auto', 'Auto'], ['off', 'Off']].map(function (m) { return '<button class="' + (c.mode === m[0] ? 'is-on' : '') + '" data-tmode="' + m[0] + '" aria-pressed="' + (c.mode === m[0]) + '"' + (pending ? ' disabled' : '') + '>' + m[1] + '</button>'; }).join('') + '</div></div>';
  }
  function age(c) {
    var captured = c.capturedAt && new Date(c.capturedAt).getTime();
    if (!captured || !isFinite(captured)) return 'Age unknown';
    var sec = Math.max(0, Math.floor((Date.now() - captured) / 1000));
    return sec < 60 ? sec + 's ago' : sec < 3600 ? Math.floor(sec / 60) + 'm ago' : Math.floor(sec / 3600) + 'h ago';
  }
  function cams() {
    return '<header class="hc-support-head"><h2>Cameras</h2><small>Still snapshots</small>' + App.icon('camera', 18) + '</header><div class="cams">' + D.cameras.slice(0, 2).map(function (c) {
      return '<button class="cam" data-cam="' + c.id + '"><span class="cam-name">' + esc(c.name) + App.icon('right', 14) + '</span><span class="cam-image"><img src="' + App.img(c.seed, 400, 250) + '" alt="Illustrative ' + esc(c.name) + ' snapshot"></span><span class="cam-caption"><b>SNAPSHOT</b><span data-camera-age="' + c.id + '">' + age(c) + '</span></span></button>';
    }).join('') + '</div>';
  }
  function media() {
    var m = D.media;
    return '<header class="hc-support-head"><h2>Media</h2><small>' + esc(m.room) + '</small>' + App.icon('music', 18) + '</header><div class="np-content"><img class="np-art" src="' + App.img(m.seed, 160, 160) + '" alt="Illustrative album artwork"><div class="np-text"><b>' + esc(m.title) + '</b><span>' + esc(m.artist) + '</span><small>' + (V.mediaPending ? 'Updating…' : m.playing ? 'Playing' : 'Paused') + '</small></div><button class="np-btn" data-play aria-label="' + (m.playing ? 'Pause' : 'Play') + ' simulated media"' + (V.mediaPending ? ' disabled' : '') + '>' + App.icon(m.playing ? 'pause' : 'play', 25) + '<span>' + (m.playing ? 'Pause' : 'Play') + '</span></button></div>';
  }
  function paintTile(id) {
    var d = dev(id); if (!d) return;
    [V.el && V.el.querySelector('.hc-rooms'), V.sheetBox].forEach(function (root) {
      var old = root && root.querySelector('[data-dev="' + id + '"]'); if (!old) return;
      var temp = document.createElement('div'); temp.innerHTML = tile(d);
      old.parentNode.replaceChild(temp.firstChild, old);
      bindTile(root.querySelector('[data-dev="' + id + '"]'));
    });
  }
  function paintPart(sel, html) { var target = V.el && V.el.querySelector(sel); if (target) target.innerHTML = html; }
  function changed(ids) { ids.forEach(paintTile); paintPart('.hc-sum', summary()); App.emit('data'); }
  function paintRooms() {
    var rs = V.el.querySelector('.hc-rooms'), scroll = rs.scrollTop;
    rs.innerHTML = rooms(); rs.scrollTop = scroll; bindTiles(rs);
  }
  function paint() {
    paintPart('.hc-sum', summary()); paintPart('.hc-scenes', scenes()); paintRooms();
    paintPart('.hc-climate', climate()); paintPart('.hc-media', media());
  }
  function bindTiles(root) { App.$$('[data-dev]', root).forEach(bindTile); }
  function bindTile(t) {
    var d = dev(t.dataset.dev), slider = t.querySelector('[data-level]'), toggle = t.querySelector('[data-toggle]'), lock = t.querySelector('[data-lock]'), garage = t.querySelector('[data-garage]');
    if (toggle) toggle.addEventListener('click', function () { V.scene = null; paintPart('.hc-scenes', scenes()); App.setDevice(d.id, { on: !d.on, level: d.level || 100 }); });
    if (slider) {
      slider.addEventListener('input', function () { t.querySelector('.tile-value').textContent = slider.value + '%'; slider.style.setProperty('--level', slider.value + '%'); slider.setAttribute('aria-valuetext', slider.value + '% intended'); });
      slider.addEventListener('change', function () { var level = +slider.value; V.scene = null; paintPart('.hc-scenes', scenes()); App.setDevice(d.id, d.type === 'light' ? level ? { on: true, level: level } : { on: false } : { pos: level }); });
      slider.addEventListener('pointercancel', function () { paintTile(d.id); });
    }
    if (lock) {
      App.hold(lock, 1000, {
        enabled: function () { return d.locked === true && !disabled(d); },
        done: function () { App.setDevice(d.id, { locked: false }).then(function (ok) { if (ok) feedback('DEMO · ' + d.name + ' confirmed unlocked.'); }); }
      });
      lock.addEventListener('click', function () { if (d.locked === false && !disabled(d)) App.setDevice(d.id, { locked: true }); });
    }
    if (garage) garage.addEventListener('click', App.openGarageSheet);
  }
  function cameraTimer() {
    App.$$('[data-camera-age]').forEach(function (el) { var c = D.cameras.filter(function (c) { return c.id === el.dataset.cameraAge; })[0]; if (c) el.textContent = age(c); });
  }
  App.on('second', cameraTimer);

  App.openGarageSheet = function () {
    var g = dev('g-door');
    if (disabled(g) || ['closed', 'open'].indexOf(g.state) < 0) { App.toast('DEMO · Garage is ' + esc(g.state || 'unknown') + '. Wait for a confirmed state.', { icon: 'garage' }); return; }
    var initial = g.state, opening = initial === 'closed', action = opening ? 'open' : 'close', cancelGesture = function () {};
    App.sheet('<div class="sheet-pad hc-sheet-pad"><span class="hc-demo">DEMO · Simulated devices</span><div class="label">Garage · currently ' + initial + '</div><h2 class="sheet-h">' + (opening ? 'Open' : 'Close') + ' garage door</h2><p class="sheet-p">Check the doorway is clear. This operates the demo only.</p><div class="slide-confirm"><span class="sc-label">Slide to ' + action + ' →</span><span class="sc-fill"></span><button class="sc-knob" aria-label="Slide to ' + action + '. Keyboard: hold Enter or Space for 1.5 seconds">' + App.icon('garage', 28) + '</button></div><p class="hc-key-hint">Keyboard: focus the handle and hold Enter or Space for 1.5 seconds.</p><button class="btn hc-cancel" data-close>Cancel</button></div>', {
      label: (opening ? 'Open' : 'Close') + ' simulated garage door', cls: 'sheet--habitat', onClose: function () { cancelGesture(); V.cancelGarage = null; },
      onMount: function (s, close) {
        var track = s.querySelector('.slide-confirm'), knob = s.querySelector('.sc-knob'), fill = s.querySelector('.sc-fill'), sx = null, travel = 0, pos = 0, timer = null, submitted = false;
        function reset() { sx = null; pos = 0; clearTimeout(timer); timer = null; knob.style.transform = ''; fill.style.width = ''; track.classList.remove('is-key-holding'); }
        cancelGesture = reset; V.cancelGarage = reset;
        function submit() {
          if (submitted) return; reset();
          if (g.state !== initial || disabled(g)) { close(); App.toast('Garage state changed. Review the current state and confirm again.', { icon: 'garage' }); return; }
          submitted = true; close(); V.scene = null;
          App.setDevice(g.id, { state: opening ? 'opening' : 'closing' }).then(function (ok) {
            if (!ok) return;
            feedback('DEMO · Garage ' + (opening ? 'opening' : 'closing') + '…');
            setTimeout(function () {
              if (g.state !== (opening ? 'opening' : 'closing')) return;
              App.setDevice(g.id, { state: opening ? 'open' : 'closed' }).then(function (confirmed) { if (confirmed) feedback('DEMO · Garage confirmed ' + g.state + '.'); });
            }, 3200);
          });
        }
        knob.addEventListener('pointerdown', function (e) { if (e.button !== 0) return; sx = e.clientX; travel = track.clientWidth - knob.offsetWidth - 12; pos = 0; knob.setPointerCapture(e.pointerId); });
        knob.addEventListener('pointermove', function (e) { if (sx == null) return; var scale = App.$('#stage').getBoundingClientRect().width / 1280; pos = Math.max(0, Math.min(travel, (e.clientX - sx) / scale)); knob.style.transform = 'translateX(' + pos + 'px)'; fill.style.width = (pos + 70) + 'px'; });
        knob.addEventListener('pointerup', function () { if (sx == null) return; if (pos >= travel - 6) submit(); else reset(); });
        knob.addEventListener('pointercancel', reset);
        knob.addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); if (e.repeat || timer) return; track.classList.add('is-key-holding'); timer = setTimeout(submit, 1500); });
        knob.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reset(); } });
        knob.addEventListener('blur', reset);

      }
    });
  };
  App.cameraSheet = function (c) {
    App.sheet('<div class="cam-big"><img src="' + App.img(c.seed, 1200, 750) + '" alt="Illustrative ' + esc(c.name) + ' snapshot"><div class="cam-big-bar"><b>' + esc(c.name) + '</b><span>DEMO · SNAPSHOT</span><span data-camera-age="' + c.id + '">' + age(c) + '</span></div></div>', { label: c.name + ' simulated snapshot', cls: 'sheet--cam sheet--habitat', onMount: function (sheet) {
      sheet.querySelector('img').addEventListener('error', function () { this.style.display = 'none'; var message = document.createElement('p'); message.className = 'cam-unavailable'; message.textContent = 'Simulated snapshot unavailable'; this.parentNode.insertBefore(message, this); });
    } });
  };
  function listSheet(kind) {
    var list = D.devices.filter(function (d) { return kind === 'lights' ? d.type === 'light' : d.type === 'lock' || d.type === 'garage'; });
    App.sheet('<div class="sheet-pad hc-sheet-pad"><span class="hc-demo">DEMO · Simulated devices</span><h2 class="sheet-h">' + (kind === 'lights' ? 'Lights · ' + list.length + ' devices' : 'Security · locks + garage') + '</h2><p class="sheet-p">' + (kind === 'lights' ? 'All Off changes lights only.' : 'Lock All changes the three locks only, never the garage.') + '</p><div class="tiles tiles--sheet">' + list.map(tile).join('') + '</div><p class="hc-sheet-status" role="status"></p><div class="sheet-actions"><button class="btn btn--solid" ' + (kind === 'lights' ? 'data-alloff' : 'data-lockall') + '>' + (kind === 'lights' ? 'All Off' : 'Lock All') + '</button></div></div>', {
      label: kind === 'lights' ? 'Lights summary' : 'Security summary', cls: 'sheet--wide sheet--habitat', onClose: function () { V.sheetBox = null; },
      onMount: function (s) {
        V.sheetBox = s.querySelector('.tiles--sheet'); bindTiles(V.sheetBox);
        var b = s.querySelector('[data-alloff], [data-lockall]');
        b.onclick = function () {
          b.disabled = true; var targets = list.filter(function (d) { return kind === 'lights' || d.type === 'lock'; });
          feedback('DEMO · Waiting for device confirmations…');
          Promise.all(targets.map(function (d) { return App.setDevice(d.id, kind === 'lights' ? { on: false } : { locked: true }, { silent: true }); })).then(function (results) {
            var count = results.filter(Boolean).length;
            feedback('DEMO · ' + count + ' / ' + targets.length + (kind === 'lights' ? ' lights confirmed off' : ' locks confirmed locked') + (count < targets.length ? ' · ' + (targets.length - count) + ' unresolved. Retry available.' : '.'));
            b.disabled = false;
          });
        };
      }
    });
  }
  function applyScene(id) {
    if (V.scenePending) return;
    var scene = D.scenes.filter(function (s) { return s.id === id; })[0], commands = [];
    Object.keys(scene.set).forEach(function (key) { var d = dev(key), value = scene.set[key]; if (!d) return; if (d.type === 'light') commands.push([key, value ? { on: true, level: value } : { on: false }]); else if (d.type === 'blind') commands.push([key, { pos: value }]); });
    if (id === 'away' || id === 'night') D.devices.forEach(function (d) { if (d.type === 'lock') commands.push([d.id, { locked: true }]); });
    V.scenePending = true; paintPart('.hc-scenes', scenes()); feedback('DEMO · Applying ' + scene.name + '… awaiting confirmations.');
    Promise.all(commands.map(function (c) { return App.setDevice(c[0], c[1], { silent: true }); })).then(function (results) {
      var count = results.filter(Boolean).length; V.scenePending = false; V.scene = count === commands.length ? id : null; paintPart('.hc-scenes', scenes());
      feedback('DEMO · ' + scene.name + ': ' + count + ' / ' + commands.length + ' device commands confirmed' + (count < commands.length ? ' · partial completion.' : '.'));
    });
  }
  function climateCommand(patch) {
    if (V.climatePending) return;
    V.climatePending = patch; paintPart('.hc-climate', climate());
    setTimeout(function () {
      Object.assign(D.climate, patch); V.climatePending = null;
      var c = D.climate;
      // The demo thermostat reports its simulated operating state after acknowledgement.
      c.operating = c.mode === 'off' ? 'off' : (c.mode === 'heat' || c.mode === 'auto') && c.set > c.current ? 'heating' : (c.mode === 'cool' || c.mode === 'auto') && c.set < c.current ? 'cooling' : 'idle';
      paintPart('.hc-climate', climate()); paintPart('.hc-sum', summary()); App.emit('data');
    }, 650);
  }
  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-room-expand]'))) { V.expanded[t.dataset.roomExpand] = !V.expanded[t.dataset.roomExpand]; paintRooms(); return; }
    if ((t = e.target.closest('[data-scene]'))) return applyScene(t.dataset.scene);
    if ((t = e.target.closest('[data-sum]'))) {
      var k = t.dataset.sum; if (k === 'lights' || k === 'security') return listSheet(k);
      var target = V.el.querySelector(k === 'climate' ? '.hc-climate' : '.hc-media'); target.classList.add('is-pulse'); target.querySelector('button').focus(); setTimeout(function () { target.classList.remove('is-pulse'); }, 1000); return;
    }
    if ((t = e.target.closest('[data-temp]'))) { var c = D.climate; return climateCommand({ set: Math.max(c.min == null ? 15 : c.min, Math.min(c.max == null ? 28 : c.max, c.set + +t.dataset.temp)) }); }
    if ((t = e.target.closest('[data-tmode]'))) return climateCommand({ mode: t.dataset.tmode });
    if ((t = e.target.closest('[data-cam]'))) return App.cameraSheet(D.cameras.filter(function (c) { return c.id === t.dataset.cam; })[0]);
    if ((t = e.target.closest('[data-play]')) && !V.mediaPending) { V.mediaPending = true; paintPart('.hc-media', media()); setTimeout(function () { D.media.playing = !D.media.playing; V.mediaPending = false; paintPart('.hc-media', media()); paintPart('.hc-sum', summary()); App.emit('data'); }, 650); }
  }
  App.on('overlay', function () { if (V.cancelGarage) V.cancelGarage(); });
  App.on('mode', function () { if (V.cancelGarage) V.cancelGarage(); });
  window.addEventListener('blur', function () { if (V.cancelGarage) V.cancelGarage(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && V.cancelGarage) V.cancelGarage(); });
  App.register('control', {
    show: function (el) {
      if (!V.el) {
        V.el = el;
        el.innerHTML = '<div class="hc"><header class="hc-header page-heading"><h1 class="page-title">Home <span>/ Habitat Control</span></h1><span class="hc-demo">DEMO · Simulated devices</span></header><div class="hc-sum"></div><div class="hc-scenes"></div><div class="hc-body"><div class="hc-left"><div class="hc-feedback" role="status"></div><div class="hc-rooms" aria-label="Rooms and devices"></div></div><div class="hc-right"><section class="hc-climate"></section><section class="hc-cams"></section><section class="hc-media"></section></div></div></div>';
        el.addEventListener('click', onClick);
        el.addEventListener('error', function (event) {
          var img = event.target, box = img.closest && img.closest('.cam-image');
          if (box) { box.textContent = 'Snapshot unavailable'; box.classList.add('is-unavailable'); }
        }, true);
      }
      paintPart('.hc-cams', cams()); paint(); feedback(V.feedback); cameraTimer();
    },
    resume: function () { cameraTimer(); }, hide: function () { clearInterval(V.camTimer); if (V.cancelGarage) V.cancelGarage(); }
  });
})();
