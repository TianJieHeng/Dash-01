// Alerts (takeovers, banners, notices) + the hidden demo drawer.
(function () {
  'use strict';
  var D = window.DATA, $ = App.$;
  var leakState = { acknowledged: false, valve: 'open', pending: false }, takeoverReturnFocus = null;

  function img(seed, w, h) { return 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h; }
  App.img = img;

  // ------------------------------------------------------------ full-screen takeovers
  function takeover(html, cls) {
    var el = $('#takeover');
    if (el.classList.contains('is-open') && el.classList.contains('takeover--alarm') && cls !== 'takeover--alarm') return null;
    if (!el.classList.contains('is-open')) takeoverReturnFocus = document.activeElement;
    if (App.cancelHolds) App.cancelHolds();
    App.emit('overlay');
    el.className = 'takeover ' + (cls || '');
    el.innerHTML = html;
    el.classList.add('is-open');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', cls === 'takeover--alarm' ? 'Demo water leak alert' : 'Demo front door snapshot');
    App.closeSheet();
    setTimeout(function () { var first = el.querySelector('button:not([disabled])'); if (el.classList.contains('is-open') && first) first.focus(); }, 0);
    if (App.mode !== 'day') App.setMode('day');
    return el;
  }
  function closeTakeover() {
    var el = $('#takeover');
    if (App.cancelHolds) App.cancelHolds();
    App.emit('overlay');
    el.classList.remove('is-open');
    el.innerHTML = '';
    if (takeoverReturnFocus && takeoverReturnFocus.isConnected) takeoverReturnFocus.focus();
  }
  document.addEventListener('keydown', function (e) {
    var el = $('#takeover');
    if (!el || !el.classList.contains('is-open') || e.key !== 'Tab') return;
    var buttons = App.$$('button:not([disabled])', el), first = buttons[0], last = buttons[buttons.length - 1];
    if (!first) return;
    if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  }, true);
  App.closeTakeover = closeTakeover;

  var doorbellTimer;
  App.doorbell = function () {
    var now = App.now();
    var el = takeover(
      '<div class="tk-cam"><img src="' + img('visitor-porch', 1280, 800) + '" alt=""><span class="tk-live tk-snapshot">DEMO · SNAPSHOT · Front Porch · Age unknown</span></div>' +
      '<div class="tk-door">' +
      '  <div class="label label--light">' + App.icon('bell', 20) + ' Doorbell · ' + (App.fmt24h ? App.fmt24h(now) : App.fmt.time(now)) + '</div>' +
      '  <h1 class="serif tk-title">Someone’s at<br>the front door</h1>' +
      '  <div class="tk-actions">' +
      '    <button class="tk-btn" data-talk>' + App.icon('mic', 30) + '<span>Talk</span></button>' +
      '    <button class="tk-btn tk-btn--hold" data-unlock>' + App.icon('unlock', 30) + '<span>Hold to unlock</span></button>' +
      '    <button class="tk-btn tk-btn--solid" data-dismiss>' + App.icon('x', 30) + '<span>Dismiss</span></button>' +
      '  </div>' +
      '</div>', 'takeover--door');
    if (!el) return;
    el.querySelector('[data-dismiss]').onclick = function () { clearTimeout(doorbellTimer); closeTakeover(); };
    el.querySelector('[data-talk]').onclick = function () {
      this.classList.toggle('is-on');
      this.querySelector('span').textContent = this.classList.contains('is-on') ? 'Demo talk on' : 'Talk (demo)';
    };
    var u = el.querySelector('[data-unlock]');
    if (D.devices.some(function (d) { return d.id === 'e-door' && d.locked === false; })) { u.disabled = true; u.querySelector('span').textContent = 'Front door already unlocked'; }
    App.hold(u, 1000, {
      enabled: function () { return !u.disabled && D.devices.some(function (d) { return d.id === 'e-door' && d.locked === true && !d.offline; }); },
      done: function () {
        u.disabled = true;
        u.querySelector('span').textContent = 'Unlocking…';
        App.setDevice('e-door', { locked: false }).then(function (ok) {
          u.classList.toggle('is-on', ok);
          u.disabled = ok;
          u.querySelector('span').textContent = ok ? 'Confirmed unlocked' : 'Hold to retry';
          App.toast(ok ? 'DEMO · Front door confirmed unlocked' : 'DEMO · Unlock not confirmed', { icon: 'unlock' });
        });
      },
      cancel: function () { App.toast('Keep holding to unlock', { ms: 2000, icon: 'lock' }); }
    });
    clearTimeout(doorbellTimer);
    doorbellTimer = setTimeout(closeTakeover, 45000);
  };

  App.leak = function () {
    clearTimeout(doorbellTimer);
    var now = App.now();
    var el = takeover(
      '<div class="tk-alarm">' +
      '  <div class="tk-alarm-icon">' + App.icon('drop', 88) + '</div>' +
      '  <div class="label label--light">DEMO · Critical simulated alert · ' + (App.fmt24h ? App.fmt24h(now) : App.fmt.time(now)) + '</div>' +
      '  <h1 class="tk-huge">Water leak</h1>' +
      '  <p class="tk-sub">Laundry room sensor detected water on the floor.</p>' +
      '  <div class="tk-actions">' +
      '    <button class="tk-btn tk-btn--hold tk-btn--light" data-valve>' + App.icon('drop', 30) + '<span>Hold to shut off water</span></button>' +
      '    <button class="tk-btn tk-btn--solid tk-btn--light" data-ack>' + App.icon('check', 30) + '<span>Acknowledge</span></button>' +
      '  </div>' +
      '</div>', 'takeover--alarm');
    var v = el.querySelector('[data-valve]');
    if (leakState.valve === 'closed') { v.disabled = true; v.classList.add('is-on'); v.querySelector('span').textContent = 'Demo valve confirmed closed'; }
    else if (leakState.pending) { v.disabled = true; v.querySelector('span').textContent = 'Shutoff pending…'; }
    App.hold(v, 1200, {
      enabled: function () { return !leakState.pending && leakState.valve !== 'closed'; },
      done: function () {
        leakState.pending = true; v.disabled = true; v.querySelector('span').textContent = 'Shutoff pending…';
        setTimeout(function () {
          leakState.pending = false; leakState.valve = 'closed';
          var currentValve = $('#takeover [data-valve]');
          if (currentValve) { currentValve.classList.add('is-on'); currentValve.disabled = true; currentValve.querySelector('span').textContent = 'Demo valve confirmed closed'; }
          App.toast('DEMO · Valve confirmed closed. Leak condition still requires attention.', { icon: 'drop' });
        }, 650);
      },
      cancel: function () { App.toast('Keep holding to shut off the water main', { ms: 2000, icon: 'drop' }); }
    });
    el.querySelector('[data-ack]').onclick = function () {
      leakState.acknowledged = true;
      closeTakeover();
      App.banner({ tone: 'amber', icon: 'drop', title: 'DEMO · Leak acknowledged — unresolved', sub: 'Acknowledgement does not operate the valve or clear the leak.', action: 'Review alert', onAction: App.leak, dismiss: 'Dismiss notice' });
    };
  };

  // ------------------------------------------------------------ banners (amber, actionable)
  App.banner = function (opts) {
    var box = $('#banners');
    var b = document.createElement('div');
    b.className = 'banner banner--' + (opts.tone || 'amber');
    b.innerHTML = App.icon(opts.icon || 'bell', 30) + '<div class="banner-text"><b>' + opts.title + '</b><span>' + (opts.sub || '') + '</span></div>' +
      (opts.action ? '<button class="banner-btn banner-btn--solid" data-act>' + opts.action + '</button>' : '') +
      '<button class="banner-btn" data-x>' + (opts.dismiss || 'Dismiss') + '</button>';
    box.appendChild(b);
    b.classList.add('is-in');
    function kill() { b.remove(); }
    b.querySelector('[data-x]').onclick = kill;
    if (opts.action) b.querySelector('[data-act]').onclick = function () { kill(); opts.onAction(); };
    if (opts.ms) setTimeout(kill, opts.ms);
    return kill;
  };

  App.garageOpenAlert = function () {
    App.setDevice('g-door', { state: 'open' }).then(function (ok) {
      if (!ok) return;
      App.banner({
        icon: 'garage', title: 'DEMO · Garage reported open', sub: 'Simulated garage event · confirmation required to close',
        action: 'Close garage…', dismiss: 'Leave open',
        onAction: function () { App.openGarageSheet(); }
      });
    });
  };

  App.packageNotice = function () {
    App.banner({
      tone: 'ink', icon: 'box', title: 'DEMO · Package notification', sub: 'Front porch · ' + App.fmt.time(App.now()),
      action: 'View camera', dismiss: 'OK', ms: 9000,
      onAction: function () { App.cameraSheet(D.cameras[0]); }
    });
  };

  // ------------------------------------------------------------ demo drawer
  function demoHTML() {
    var t = App.now();
    return '<div class="demo-panel">' +
      '<div class="demo-head"><div><div class="label label--light">Prototype</div><h2 class="serif">Demo controls</h2></div><button class="demo-x" data-demo-close>' + App.icon('x', 28) + '</button></div>' +
      '<div class="demo-sec"><div class="label label--light">Time of day · now ' + App.fmt.time(t) + '</div><div class="demo-grid">' +
      '<button data-time="7:10">7:10 AM</button><button data-time="15:18">3:18 PM</button><button data-time="19:45">7:45 PM</button><button data-time="23:40">11:40 PM</button><button data-time="real">Real time</button></div></div>' +
      '<div class="demo-sec"><div class="label label--light">Modes</div><div class="demo-grid">' +
      '<button data-mode="ambient">Ambient</button><button data-mode="night">Night</button><button data-fastidle>' + (App.idle.home < 60 ? 'Idle: fast ✓' : 'Idle: fast') + '</button></div></div>' +
      '<div class="demo-sec"><div class="label label--light">Alerts</div><div class="demo-grid">' +
      '<button data-alert="doorbell">Doorbell</button><button data-alert="leak">Water leak</button><button data-alert="garage">Garage open</button><button data-alert="package">Package</button></div></div>' +
      '<div class="demo-sec"><div class="label label--light">Calendar data</div><div class="demo-grid">' +
      ['normal', 'empty', 'busy'].map(function (m) {
        return '<button data-cal="' + m + '" class="' + (App.calMode === m ? 'is-on' : '') + '">' + { normal: 'Normal day', empty: 'Empty day', busy: 'Overloaded' }[m] + '</button>';
      }).join('') + '</div></div>' +
      '<p class="demo-note">Keyboard: <b>D</b> demo · <b>A</b> ambient · <b>N</b> night · <b>1–7</b> views</p>' +
      '</div>';
  }
  App.openDemo = function () {
    if ($('#takeover').classList.contains('is-open')) return;
    var el = $('#demo');
    el.innerHTML = demoHTML();
    el.classList.add('is-open');
  };
  function closeDemo() { $('#demo').classList.remove('is-open'); }

  function demoClick(e) {
    var b = e.target.closest('button');
    if (!b) { if (e.target === $('#demo')) closeDemo(); return; }
    if (b.hasAttribute('data-demo-close')) return closeDemo();
    if (b.dataset.time) {
      if (b.dataset.time === 'real') App.setTime(null);
      else { var p = b.dataset.time.split(':'); App.setTime(+p[0], +p[1]); }
      App.openDemo();
      return;
    }
    if (b.dataset.mode) { closeDemo(); App.setMode(b.dataset.mode); return; }
    if (b.hasAttribute('data-fastidle')) {
      var fast = App.idle.home >= 60;
      App.idle.home = fast ? 8 : 60;
      App.idle.ambient = fast ? 15 : 120;
      App.openDemo();
      return;
    }
    if (b.dataset.alert) {
      closeDemo();
      ({ doorbell: App.doorbell, leak: App.leak, garage: App.garageOpenAlert, package: App.packageNotice })[b.dataset.alert]();
      return;
    }
    if (b.dataset.cal) { App.calMode = b.dataset.cal; App.rerender(); App.openDemo(); }
  }

  App.on('ready', function () {
    $('#demo').addEventListener('click', demoClick);
    App.hold($('#railClock'), 700, { done: App.openDemo });
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      var k = e.key.toLowerCase();
      if (k === 'd') { $('#demo').classList.contains('is-open') ? closeDemo() : App.openDemo(); }
      if (k === 'a') App.setMode('ambient');
      if (k === 'n') App.setMode('night');
      if (k === 'escape') { closeDemo(); App.closeSheet(); }
      var views = ['home', 'calendar', 'tasks', 'shopping', 'photos', 'control', 'agents'];
      if (k >= '1' && k <= '7') App.go(views[+k - 1]);
    });
  });
})();
