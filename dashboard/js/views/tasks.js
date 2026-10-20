// Chores / Routine Deck: confirmed counts, stable source ordering, and reversible
// session-preview mutations. This view does not claim a server-backed save.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, routine: null, renderedRoutine: null, pending: {}, revisions: {}, scroll: {}, feedback: null, feedbackTimer: null };
  function lanes() { return D.people.map(function (p) { return p.id; }).concat(['any']); }
  function routine() { return D.routines.find(function (r) { return r.id === V.routine; }) || App.currentRoutine(); }
  function listFor(who, r) { return D.chores.filter(function (c) { return c.r === r.id && c.who === who; }); }
  function dateKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function overdue(c) {
    if (c.done || !c.due) return false;
    var due = c.due instanceof Date ? c.due : new Date(App.dayStart(App.now()));
    if (!(c.due instanceof Date)) { var parts = String(c.due).split(':'); if (parts.length !== 2) return false; due.setHours(+parts[0], +parts[1]); }
    return !isNaN(+due) && due < App.now();
  }
  function choreIcon(c) {
    var key = c.icon;
    if (!key) {
      var title = c.title.toLowerCase();
      key = /read|book|homework/.test(title) ? 'book' : /plant|water|garden/.test(title) ? 'plant' : /recycl|bin|garbage/.test(title) ? 'recycle' : /bag|backpack|unpack/.test(title) ? 'bag' : /feed|cat|dog|biscuit|fish/.test(title) ? 'pet' : /wash|wipe|clean|tidy|brush/.test(title) ? 'clean' : /table|dish|lunch|plate/.test(title) ? 'utensils' : /piano/.test(title) ? 'music' : /lock/.test(title) ? 'lock' : /car|drop/.test(title) ? 'car' : 'box';
    }
    return App.icon(window.ICONS[key] ? key : 'box', 25);
  }
  function row(c) {
    var pend = !!V.pending[c.id], late = overdue(c);
    var state = pend ? 'Checking' : c.done ? 'Completed' : 'Incomplete';
    return '<button class="ch' + (c.done ? ' is-done' : '') + (pend ? ' is-checking' : '') + (late ? ' is-overdue' : '') + '" data-ch="' + App.esc(c.id) + '" aria-pressed="' + !!c.done + '" aria-label="' + App.esc(c.title + '. ' + state + (c.doneBy ? ', by ' + App.person(c.doneBy).name : '') + (late ? ', overdue at ' + c.due : '') + '. ' + (c.done ? 'Mark incomplete' : c.who === 'any' ? 'Choose who completed this task' : 'Mark complete')) + '"' + (pend ? ' aria-disabled="true" aria-busy="true"' : '') + '>' +
      '<span class="ch-icon" aria-hidden="true">' + choreIcon(c) + '</span><span class="ch-text"><b>' + App.esc(c.title) + '</b>' +
      (c.stars ? '<small class="ch-reward">' + App.icon('star', 15, 'i--fill') + '+' + c.stars + '</small>' : '') +
      (pend ? '<small class="ch-pending">Checking…</small>' : late ? '<small class="ch-late">' + App.icon('clock', 13) + 'Overdue · ' + App.esc(c.due instanceof Date ? App.fmt.time(c.due) : c.due) + '</small>' : '') +
      (c.doneBy && c.done ? '<small class="ch-by">by ' + App.esc(App.person(c.doneBy).name) + '</small>' : '') +
      '</span><span class="ch-check" aria-hidden="true">' + (pend ? '<i class="ch-spinner"></i>' : c.done ? App.icon('check', 22) : '') + '</span></button>';
  }
  function historyRecord(who, r, d) {
    if (App.sameDay(d, App.now())) { var list = listFor(who, r); return { done: list.filter(function (c) { return c.done; }).length, total: list.length }; }
    return (D.choresHistory || []).find(function (h) { return h.who === who && (h.r || h.routine) === r.id && h.date === dateKey(d); }) || null;
  }
  function weekGrid(who, r) {
    if (D.stars[who] == null) return '';
    return '<div class="ch-week"><div class="label">Last 7 days</div><div class="ch-history-scope">' + App.esc(r.name) + '</div><div class="ch-week-row">' + [-6, -5, -4, -3, -2, -1, 0].map(function (offset) {
      var d = App.addDays(App.dayStart(App.now()), offset), record = historyRecord(who, r, d);
      var status = !record ? 'unknown' : !record.total ? 'empty' : record.done >= record.total ? 'hit' : record.done ? 'partial' : 'miss';
      var summary = !record ? 'History unavailable' : !record.total ? 'No tasks scheduled' : record.done + ' of ' + record.total + ' complete';
      var label = App.fmt.day(d) + ', ' + App.fmt.month(d) + ' ' + d.getDate() + ', ' + d.getFullYear() + ': ' + summary;
      return '<span class="is-' + status + (offset === 0 ? ' is-today' : '') + '" role="img" aria-label="' + App.esc(label) + '" title="' + App.esc(label) + '"><i' + (status === 'partial' ? ' style="--done:' + Math.round(record.done / record.total * 100) + '%"' : '') + '>' + (status === 'hit' ? App.icon('check', 14) : status === 'empty' ? '–' : status === 'unknown' ? '·' : '') + '</i><small>' + App.fmt.dayShort(d).slice(0, 1) + '</small></span>';
    }).join('') + '</div></div>';
  }
  function lane(who, r) {
    var p = App.person(who), list = listFor(who, r), done = list.filter(function (c) { return c.done; }).length;
    var all = list.length > 0 && done === list.length, kid = D.stars[who] != null;
    return '<section class="ch-lane' + (all ? ' is-complete' : '') + '" data-lane="' + who + '" style="' + App.pstyle(p) + '" aria-label="' + App.esc(who === 'any' ? 'Anyone' : p.name) + ' tasks"><header class="ch-head">' +
      (who === 'any' ? '<span class="ch-group-avatar">' + App.icon('person', 29) + '</span>' : App.avatar(p, 50)) +
      '<div class="ch-person"><b>' + App.esc(who === 'any' ? 'Anyone' : p.name) + '</b><small>' + (who === 'any' ? 'Shared tasks' : kid ? 'Your routine' : 'Daily routine') + '</small></div><div class="ch-ring" role="img" aria-label="' + done + ' of ' + list.length + ' tasks complete">' + App.ring(done, list.length || 1, 54) + '<span class="num">' + done + '/' + list.length + '</span></div>' +
      (kid ? '<div class="ch-stars">' + App.icon('star', 14, 'i--fill') + '<b>' + D.stars[who] + '</b> stars earned</div>' : '') + '</header><div class="ch-list" tabindex="0" aria-label="' + App.esc(who === 'any' ? 'Anyone' : p.name) + ' task list">' +
      (list.length ? list.map(row).join('') : '<p class="ch-none">No tasks in this routine</p>') + (all ? '<div class="ch-alldone">' + App.icon('check', 26) + '<span>All done for now.</span></div>' : '') + '</div>' + weekGrid(who, r) + '</section>';
  }
  function preserveScroll() {
    if (!V.el || !V.renderedRoutine) return;
    App.$$('.ch-lane', V.el).forEach(function (lane) { V.scroll[V.renderedRoutine + ':' + lane.dataset.lane] = lane.querySelector('.ch-list').scrollTop; });
  }
  function feedbackHtml() {
    if (!V.feedback) return '';
    return '<div class="ch-toast"><span class="ch-toast-icon">' + App.icon(V.feedback.error ? 'bell' : 'check', 24) + '</span><span class="ch-toast-message" role="status">' + V.feedback.html + '</span>' + (V.feedback.undo ? '<button data-undo>' + App.icon('undo', 18) + 'Undo</button>' : '') + '<button class="ch-toast-close" data-dismiss aria-label="Dismiss message">' + App.icon('x', 20) + '</button></div>';
  }
  function render() {
    if (!V.el) return;
    preserveScroll();
    var focus = document.activeElement, fid = focus && V.el.contains(focus) ? focus.dataset.ch || null : null;
    var focusedRoutine = focus && V.el.contains(focus) ? focus.dataset.r || null : null;
    var r = routine(), now = App.now(), auto = App.currentRoutine(), inR = D.chores.filter(function (c) { return c.r === r.id; });
    var done = inR.filter(function (c) { return c.done; }).length, percent = inR.length ? Math.round(done / inR.length * 100) : 0;
    var current = r.id === auto.id && now.getHours() + now.getMinutes() / 60 >= r.from && now.getHours() + now.getMinutes() / 60 < r.to;
    V.el.innerHTML = '<div class="tasks"><header class="t-head"><div class="t-title"><h1>Chores <span>/ Routine operations</span></h1><p lang="ja">家のしごと / ルーティン</p></div><div class="seg" aria-label="Routine">' + D.routines.map(function (x) { return '<button class="' + (x.id === r.id ? 'is-on' : '') + '" data-r="' + x.id + '" aria-pressed="' + (x.id === r.id) + '">' + App.esc(x.name) + '</button>'; }).join('') + '</div><div class="t-routine"><b>' + App.esc(r.range) + '</b><span class="' + (current ? 'is-current' : '') + '">' + (current ? '<i></i>Current routine' : 'Viewing routine') + '</span></div><div class="t-clock"><b>' + App.fmt.time(now, false) + '</b><span>' + App.fmt.dayShort(now) + ', ' + now.getDate() + ' ' + App.fmt.monthShort(now) + '</span></div></header>' +
      '<div class="t-progress"><div><b>Overall progress</b><small>' + (inR.length ? App.esc(r.name) + ' routine' : 'No tasks scheduled') + '</small></div><div class="t-bar" role="progressbar" aria-label="Routine completion" aria-valuemin="0" aria-valuemax="' + (inR.length || 1) + '" aria-valuenow="' + done + '" aria-valuetext="' + done + ' of ' + inR.length + ' tasks complete"><i style="width:' + percent + '%"></i></div><span class="t-count"><b>' + done + ' / ' + inR.length + '</b> complete</span><strong class="t-percent">' + percent + '%</strong></div><div class="ch-lanes">' + lanes().map(function (w) { return lane(w, r); }).join('') + '</div><div class="ch-feedback">' + feedbackHtml() + '</div></div>';
    V.renderedRoutine = r.id;
    App.$$('.ch-lane', V.el).forEach(function (lane) { lane.querySelector('.ch-list').scrollTop = V.scroll[r.id + ':' + lane.dataset.lane] || 0; });
    var next = fid ? V.el.querySelector('[data-ch="' + fid + '"]') : focusedRoutine ? V.el.querySelector('[data-r="' + focusedRoutine + '"]') : null;
    if (next && !next.disabled) next.focus({ preventScroll: true });
  }
  function hideFeedback() { clearTimeout(V.feedbackTimer); V.feedback = null; var area = V.el && V.el.querySelector('.ch-feedback'); if (area) area.innerHTML = ''; }
  function scheduleFeedback() { clearTimeout(V.feedbackTimer); V.feedbackTimer = setTimeout(hideFeedback, 8000); }
  function feedback(html, undo, error) {
    V.feedback = { html: html, undo: undo, error: error };
    var area = V.el && V.el.querySelector('.ch-feedback'); if (area) area.innerHTML = feedbackHtml(); scheduleFeedback();
  }
  function earner(c, state) { return D.stars[c.who] != null ? c.who : state.by && D.stars[state.by] != null ? state.by : null; }
  function state(c) { return { done: !!c.done, by: c.doneBy || null }; }
  function sameState(a, b) { return a.done === b.done && a.by === b.by; }
  function apply(c, next) {
    var prev = state(c), beforeEarner = earner(c, prev), afterEarner = earner(c, next);
    if (prev.done && beforeEarner && c.stars) D.stars[beforeEarner] -= c.stars;
    if (next.done && afterEarner && c.stars) D.stars[afterEarner] += c.stars;
    c.done = next.done;
    if (next.by) c.doneBy = next.by; else delete c.doneBy;
    V.revisions[c.id] = (V.revisions[c.id] || 0) + 1;
  }
  function transition(c, next, onSuccess, isCanceled, onFailure) {
    if (V.pending[c.id]) return;
    var prev = state(c), occurrenceDate = dateKey(App.now()), revision = V.revisions[c.id] || 0;
    V.pending[c.id] = true; render();
    setTimeout(function () {
      delete V.pending[c.id];
      if (isCanceled && isCanceled()) { render(); return; }
      if (dateKey(App.now()) !== occurrenceDate || !sameState(state(c), prev) || (V.revisions[c.id] || 0) !== revision || D.chores.indexOf(c) < 0) {
        render(); if (onFailure) onFailure(); feedback('This routine changed. Please check the task and try again.', null, true); return;
      }
      apply(c, next); var savedRevision = V.revisions[c.id];
      if (onSuccess) onSuccess();
      render(); App.emit('data');
      feedback('<b>' + App.esc(c.title) + '</b> ' + (next.done ? 'completed' : 'marked incomplete') + (next.by ? ' · by ' + App.esc(App.person(next.by).name) : ''), function () {
        if (V.pending[c.id] || dateKey(App.now()) !== occurrenceDate || V.revisions[c.id] !== savedRevision || !sameState(state(c), next)) { feedback('This task has changed since that action. Its current state was kept.', null, true); return; }
        apply(c, prev); render(); App.emit('data'); feedback('Restored <b>' + App.esc(c.title) + '</b>');
      });
    }, 350);
  }
  function whoDidIt(c) {
    var claim = { closed: false };
    App.sheet('<div class="sheet-pad ch-claim"><div class="label">Shared task</div><h2 class="sheet-h">Who did it?</h2><p>' + App.esc(c.title) + '</p><div class="ch-claim-people">' + D.people.map(function (p) { return '<button class="who-btn" data-by="' + p.id + '" style="' + App.pstyle(p) + '">' + App.avatar(p, 56) + '<span>' + App.esc(p.name) + '</span></button>'; }).join('') + '</div><p class="ch-claim-status" role="status"></p><button class="btn btn--ghost" data-close>Cancel</button></div>', {
      cls: 'sheet--claim', label: 'Who completed ' + c.title + '?', onClose: function () {
        claim.closed = true;
        var launcher = V.el && V.el.querySelector('[data-ch="' + c.id + '"]');
        if (launcher && App.current === 'tasks') launcher.focus({ preventScroll: true });
      }, onMount: function (s, close) {
        s.addEventListener('click', function (e) {
          var b = e.target.closest('[data-by]'); if (!b || V.pending[c.id]) return;
          App.$$('[data-by]', s).forEach(function (choice) { choice.disabled = true; });
          b.classList.add('is-on'); s.querySelector('.ch-claim-status').textContent = 'Checking…';
          transition(c, { done: true, by: b.dataset.by }, close, function () { return claim.closed; }, function () {
            if (!claim.closed) { App.$$('[data-by]', s).forEach(function (choice) { choice.disabled = false; }); s.querySelector('.ch-claim-status').textContent = 'The task changed. Please try again.'; }
          });
        });
      }
    });
  }
  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-r]'))) { preserveScroll(); V.routine = t.dataset.r; hideFeedback(); return render(); }
    if ((t = e.target.closest('[data-dismiss]'))) return hideFeedback();
    if ((t = e.target.closest('[data-undo]'))) { var undo = V.feedback && V.feedback.undo; hideFeedback(); if (undo) undo(); return; }
    if ((t = e.target.closest('[data-ch]'))) {
      var c = D.chores.find(function (x) { return x.id === t.dataset.ch; }); if (!c || V.pending[c.id]) return;
      if (c.done) return transition(c, { done: false, by: null });
      if (c.who === 'any') return whoDidIt(c);
      transition(c, { done: true, by: null });
    }
  }
  App.register('tasks', { minutely: true, show: function (el) {
    if (!V.el) {
      V.el = el; el.addEventListener('click', onClick);
      el.addEventListener('focusin', function (e) { if (e.target.closest('.ch-feedback')) clearTimeout(V.feedbackTimer); });
      el.addEventListener('focusout', function (e) { if (e.target.closest('.ch-feedback') && V.feedback) scheduleFeedback(); });
    }
    render();
  } });
  App.on('minute', function () { if (App.current === 'tasks') render(); });
  App.on('time', function () { V.routine = null; hideFeedback(); });
})();
