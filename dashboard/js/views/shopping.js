// Supply Register: one shared list, derived counts, and a fixed quick-add rail.
(function () {
  'use strict';
  var D = window.DATA;
  var V = { el: null, store: 'all', query: '', drawer: true, pending: {}, feedback: null, timer: null, storageError: false };
  var STORAGE_KEY = 'dash01.shopping.v1';
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    var seen = {};
    if (Array.isArray(saved) && saved.every(function (g) {
      if (!g || typeof g.id !== 'string' || seen[g.id] || typeof g.name !== 'string' || !g.name.trim() || typeof g.cat !== 'string' || !Number.isSafeInteger(g.qty) || g.qty < 1 || typeof g.done !== 'boolean' || typeof g.note !== 'string' || typeof g.store !== 'string') return false;
      seen[g.id] = true; return true;
    })) D.groceries = saved;
  } catch (ignore) { /* Corrupt/unavailable storage keeps the supplied list intact. */ }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(D.groceries)); V.storageError = false; }
    catch (error) { V.storageError = true; }
  }
  function focusedControl() {
    var button = document.activeElement;
    if (!button || !V.el.contains(button) || button.tagName !== 'BUTTON') return null;
    var attributes = ['data-check', 'data-qty', 'data-id', 'data-store', 'data-add', 'data-revive', 'data-drawer', 'data-clear'];
    var identity = {};
    attributes.forEach(function (name) { if (button.hasAttribute(name)) identity[name] = button.getAttribute(name); });
    return Object.keys(identity).length ? identity : null;
  }
  function restoreFocus(identity) {
    if (!identity) return;
    var target = App.$$('button', V.el).filter(function (button) {
      return Object.keys(identity).every(function (name) { return button.getAttribute(name) === identity[name]; });
    })[0];
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else if (identity['data-check']) V.el.querySelector('[data-drawer]').focus({ preventScroll: true });
    else if (target && identity['data-qty']) target.parentNode.querySelector('button:not(:disabled)').focus({ preventScroll: true });
  }
  function esc(s) { return App.esc(s == null ? '' : s); }
  function open() { return D.groceries.filter(function (g) { return !g.done && inStore(g); }); }
  function done() { return D.groceries.filter(function (g) { return g.done && inStore(g); }); }
  function inStore(g) { return V.store === 'all' || g.store === V.store; }
  function storeName(id) { var s = D.stores.filter(function (x) { return x.id === id; })[0]; return s ? s.name : 'Unassigned'; }
  function byId(id) { return D.groceries.filter(function (g) { return g.id === id; })[0]; }
  function catalog(name) { return D.catalog.filter(function (c) { return c[0].toLowerCase() === name.toLowerCase(); })[0]; }
  function categorize(name) {
    var n = name.toLowerCase(), hit = catalog(name) || D.catalog.filter(function (c) { var a = c[0].toLowerCase(); return a.indexOf(n) > -1 || n.indexOf(a) > -1; })[0];
    return hit ? hit[1] : 'Other';
  }
  // Names are the prototype catalog's identity. Never merge a differently named variant.
  function find(name, isDone) {
    var matches = D.groceries.filter(function (g) { return !!g.done === isDone && g.name.toLowerCase() === name.toLowerCase(); });
    if (matches.length < 2) return matches[0];
    var preferred = matches.filter(function (g) { return g.store === (V.store === 'all' ? 'grocer' : V.store); });
    return preferred.filter(function (g) { return !g.note; })[0] || preferred[0] || matches[0];
  }
  function snapshot(g) { return JSON.parse(JSON.stringify(g)); }
  function signature(g) { return JSON.stringify(g); }
  function sameItem(a, b) { return a.name.toLowerCase() === b.name.toLowerCase() && a.store === b.store && (a.note || '') === (b.note || ''); }

  // A small coherent line-illustration family; these are UI icons, not product imagery.
  function foodIcon(name) {
    var n = name.toLowerCase(), body, color = '#77957a';
    if (/milk/.test(n)) { color = '#85aeb9'; body = '<path d="M9 3h9l4 7v19H7V10z"/><path d="M9 3v7h13M7 10l5-4M12 16h7v8h-7z"/>'; }
    else if (/egg/.test(n)) { color = '#c1aa82'; body = '<path d="M16 4c-4 0-9 10-9 16a9 9 0 0018 0c0-6-5-16-9-16z"/>'; }
    else if (/bread|loaf|bagel/.test(n)) { color = '#c49d66'; body = '<path d="M7 14C1 5 9 3 16 3s15 2 9 11v15H7z"/><path d="M11 11v13M21 11v13"/>'; }
    else if (/banana/.test(n)) { color = '#cfac47'; body = '<path d="M24 5c2 11-9 20-20 15 3 10 22 8 25-7l-1-8z"/><path d="M9 23c8 1 16-4 18-11M24 5l-1-3"/>'; }
    else if (/apple|tomato/.test(n)) { color = '#bb6b5d'; body = '<path d="M16 11C3 4 0 21 11 29l5-1 5 1C32 21 29 4 16 11z"/><path d="M16 11V5m0 1c2-5 6-4 8-4-1 5-5 6-8 4"/>'; }
    else if (/rice/.test(n)) { color = '#8cabb1'; body = '<path d="M3 17h26c-1 8-5 12-13 12S4 25 3 17z"/><path d="M6 17c0-8 20-8 20 0M10 12l2-3m3 3 1-4m4 5 2-3"/>'; }
    else if (/yogurt/.test(n)) { color = '#85a5be'; body = '<path d="M7 10h18l-3 19H10z"/><path d="M5 7h22v4H5zM13 17h6"/>'; }
    else if (/coffee/.test(n)) { color = '#9e8165'; body = '<path d="M8 9h16v20H8zM9 3h14v6H9z"/><ellipse cx="16" cy="19" rx="4" ry="6"/><path d="M18 14l-4 10"/>'; }
    else if (/pasta|rigatoni|spaghetti/.test(n)) { color = '#c7a15f'; body = '<path d="M5 9l15 17 5-5L10 4zM4 18l7 9 5-5-7-9zM20 5l8 9-4 4-8-9z"/>'; }
    else if (/cheese|cheddar/.test(n)) { color = '#ccaa53'; body = '<path d="M4 15L25 5l4 23H4zM4 15l25 4"/><circle cx="11" cy="22" r="2"/><circle cx="22" cy="24" r="1"/>'; }
    else if (/soap/.test(n)) { color = '#78aab4'; body = '<path d="M9 14h14l2 15H7zM13 14V7h6v7M16 7V3h10v4"/>'; }
    else { body = '<path d="M5 12h22l-3 17H8zM10 12l6-9 6 9M12 17v7m8-7v7"/>'; }
    return '<svg class="s-food" viewBox="0 0 32 32" aria-hidden="true" style="color:' + color + '" fill="currentColor" fill-opacity=".24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }
  function row(g) {
    var pending = !!V.pending[g.id];
    return '<div class="s-row' + (pending ? ' is-checking' : '') + '" data-id="' + esc(g.id) + '" aria-busy="' + pending + '">' +
      '<button class="s-check" data-check="' + esc(g.id) + '" aria-label="Check ' + esc(g.name) + '"' + (pending ? ' disabled' : '') + '><span class="s-box">' + (pending ? App.icon('check', 19) : '') + '</span></button>' +
      foodIcon(g.name) + '<div class="s-name"><b>' + esc(g.name) + '</b>' + (g.note ? '<small>' + esc(g.note) + '</small>' : '') + '</div>' +
      '<span class="s-store">' + esc(storeName(g.store)) + '</span>' +
      '<div class="s-qty" aria-label="' + esc(g.name) + ' quantity"><button data-qty="-1" data-id="' + esc(g.id) + '" aria-label="Decrease ' + esc(g.name) + ' quantity"' + (g.qty <= 1 || pending ? ' disabled' : '') + '>' + App.icon('minus', 18) + '</button><span class="num">' + g.qty + '</span><button data-qty="1" data-id="' + esc(g.id) + '" aria-label="Increase ' + esc(g.name) + ' quantity"' + (pending ? ' disabled' : '') + '>' + App.icon('plus', 18) + '</button></div></div>';
  }
  function listHTML() {
    var items = open(), order = (D.catOrder[V.store] || D.catOrder.all || []).slice();
    items.forEach(function (g) { if (order.indexOf(g.cat) < 0) order.push(g.cat); });
    if (!items.length) {
      var hasOther = D.groceries.some(function (g) { return !g.done; });
      return '<div class="s-empty">' + App.icon('check', 36) + '<h3>' + (hasOther ? 'Nothing left at ' + esc(storeName(V.store)) : 'All stocked up') + '</h3><p>' + (hasOther ? 'Your other stores still have items.' : 'Add something from Quick Add when you need it.') + '</p>' + (hasOther ? '<button data-store="all">View all stores</button>' : '') + '</div>';
    }
    return order.map(function (cat) {
      var group = items.filter(function (g) { return g.cat === cat; });
      return group.length ? '<section class="s-cat"><h3 class="s-cat-h">' + esc(cat) + '<span>· ' + group.length + '</span></h3>' + group.map(row).join('') + '</section>' : '';
    }).join('');
  }
  function drawerHTML() {
    var d = done();
    return '<button class="s-drawer-h" data-drawer aria-expanded="' + (!!d.length && V.drawer) + '" aria-controls="shopping-checked"><span>Got it <b class="num">· ' + d.length + '</b></span>' + '<span class="s-chevron' + (V.drawer && d.length ? ' is-open' : '') + '">' + App.icon('right', 18) + '</span>' + '</button>' +
      '<div id="shopping-checked" class="s-drawer-body"' + (!d.length || !V.drawer ? ' hidden' : '') + '><div class="s-drawer-list">' + d.map(function (g) {
        return '<div class="s-got">' + App.icon('check', 19) + foodIcon(g.name) + '<span class="s-got-name">' + esc(g.name) + '</span><span class="s-store">' + esc(storeName(g.store)) + '</span><span class="s-got-qty">× ' + g.qty + '</span><button data-revive="' + esc(g.id) + '" aria-label="Add ' + esc(g.name) + ' back">' + App.icon('undo', 17) + 'Add Back</button></div>';
      }).join('') + '</div>' + (d.length ? '<button class="s-clear" data-clear>Clear checked' + (V.store === 'all' ? '' : ' at ' + esc(storeName(V.store))) + '</button>' : '') + '</div>';
  }
  function usualTile(name) {
    var on = find(name, false), checked = !on && find(name, true), g = on || checked, pending = g && V.pending[g.id];
    var state = on ? 'On list · ' + on.qty : checked ? 'Got it' : 'Add item';
    var action = on ? name + ', quantity ' + on.qty + ', tap to add one' : checked ? 'Add ' + name + ' back, quantity ' + checked.qty : 'Add ' + name;
    return '<button class="s-tile' + (on ? ' is-on' : checked ? ' is-done' : '') + '" data-add="' + esc(name) + '" aria-label="' + esc(action) + '"' + (pending ? ' disabled aria-busy="true"' : '') + '>' + foodIcon(name) + '<i class="s-tile-mark">' + App.icon(on || checked ? 'check' : 'plus', 15) + '</i><b>' + esc(name) + '</b><span>' + state + '</span></button>';
  }
  function suggestHTML() {
    var q = V.query.trim().toLowerCase();
    if (!q) return '<h3 class="s-suggest-title">Usual items</h3><div class="s-usuals">' + D.usuals.slice(0, 12).map(usualTile).join('') + '</div>';
    var names = D.catalog.map(function (c) { return c[0]; });
    D.groceries.forEach(function (g) { if (!names.some(function (n) { return n.toLowerCase() === g.name.toLowerCase(); })) names.push(g.name); });
    var matches = names.filter(function (n) { return n.toLowerCase().indexOf(q) === 0; }).concat(names.filter(function (n) { return n.toLowerCase().indexOf(q) > 0; })).slice(0, 5);
    return '<h3 class="s-suggest-title">Suggestions</h3><div class="s-ac">' + (matches.length ? matches.map(function (name) {
      var on = find(name, false), checked = !on && find(name, true);
      return '<button class="s-ac-row" data-add="' + esc(name) + '">' + foodIcon(name) + '<span><b>' + esc(name) + '</b><small>' + (on ? esc(storeName(on.store)) + ' · On list · ' + on.qty : checked ? 'Got it · Add back' : esc(categorize(name))) + '</small></span>' + App.icon('plus', 22) + '</button>';
    }).join('') : '<p class="s-no-match">No matching items</p>') + '</div>';
  }
  function paintHead() {
    var all = D.groceries.filter(function (g) { return !g.done; });
    V.el.querySelector('.s-count').innerHTML = '<b class="num">' + all.length + '</b><span>Remaining</span>';
    V.el.querySelector('.s-stores').innerHTML = [['all', 'All']].concat(D.stores.map(function (s) { return [s.id, s.name]; })).map(function (s) {
      var n = s[0] === 'all' ? all.length : all.filter(function (g) { return g.store === s[0]; }).length;
      return '<button class="' + (V.store === s[0] ? 'is-on' : '') + '" data-store="' + esc(s[0]) + '" aria-pressed="' + (V.store === s[0]) + '">' + esc(s[1]) + '<b class="num">' + n + '</b></button>';
    }).join('');
  }
  function paintList() {
    if (!V.el) return;
    var focus = focusedControl(), list = V.el.querySelector('.s-list'), y = list.scrollTop;
    list.innerHTML = listHTML(); list.scrollTop = y;
    var drawer = V.el.querySelector('.s-drawer'), old = drawer.querySelector('.s-drawer-list'), dy = old ? old.scrollTop : 0;
    drawer.innerHTML = drawerHTML();
    if (drawer.querySelector('.s-drawer-list')) drawer.querySelector('.s-drawer-list').scrollTop = dy;
    paintHead(); restoreFocus(focus);
  }
  function paintSuggest() { V.el.querySelector('.s-suggest').innerHTML = suggestHTML(); }
  function refresh() { var focus = focusedControl(); paintList(); paintSuggest(); restoreFocus(focus); }
  function paintFeedback() {
    if (!V.el) return;
    var box = V.el.querySelector('.s-feedback');
    box.innerHTML = V.feedback ? '<span>' + App.icon('check', 21) + esc(V.feedback.text) + '</span>' + (V.feedback.undo ? '<button data-undo>' + App.icon('undo', 18) + 'Undo</button>' : '') : '';
    box.classList.toggle('is-visible', !!V.feedback);
  }
  function feedback(text, undo) {
    clearTimeout(V.timer); V.feedback = { text: text + (V.storageError ? ' · This session only; local storage unavailable.' : ''), undo: undo }; paintFeedback();
    V.timer = setTimeout(function () { V.feedback = null; paintFeedback(); }, 8000);
  }
  function changed() { persist(); refresh(); App.emit('data'); }
  function mutate(g, action, text) {
    var before = snapshot(g); action(g); var after = signature(g);
    changed();
    feedback(text, function () {
      var current = byId(g.id);
      if (!current || signature(current) !== after) return feedback('This item changed again; undo was not applied.');
      Object.keys(current).forEach(function (k) { delete current[k]; });
      Object.assign(current, before); changed();
    });
  }
  function add(name) {
    name = name.trim(); if (!name) { V.el.querySelector('.s-input').focus(); return; }
    var g = find(name, false), checked = !g && find(name, true);
    if ((g && V.pending[g.id]) || (checked && V.pending[checked.id])) return;
    if (g) mutate(g, function (item) { item.qty++; }, g.name + ' quantity updated' + (V.store !== 'all' && g.store !== V.store ? ' · ' + storeName(g.store) : ''));
    else if (checked) mutate(checked, function (item) { item.done = false; }, checked.name + ' added back' + (V.store !== 'all' && checked.store !== V.store ? ' · ' + storeName(checked.store) : ''));
    else {
      var cat = catalog(name);
      g = { id: D._gid(), name: cat ? cat[0] : name.charAt(0).toUpperCase() + name.slice(1), cat: categorize(name), qty: 1, store: V.store === 'all' ? 'grocer' : V.store, done: false, note: '' };
      // Preserve the existing prototype's FreshCo default under All.
      while (byId(g.id)) g.id = D._gid();
      D.groceries.push(g); var expected = signature(g); changed();
      feedback(g.name + ' added to ' + storeName(g.store), function () {
        var current = byId(g.id);
        if (!current || signature(current) !== expected) return feedback('This item changed again; undo was not applied.');
        D.groceries = D.groceries.filter(function (x) { return x.id !== g.id; }); changed();
      });
    }
    V.query = ''; V.el.querySelector('.s-input').value = ''; paintSuggest();
  }
  function check(g) {
    if (V.pending[g.id] || g.done) return;
    V.pending[g.id] = true; refresh();
    // Brief local pending state avoids repeated touchscreen submissions; no remote save is implied.
    setTimeout(function () {
      delete V.pending[g.id];
      if (byId(g.id) !== g || g.done) return refresh();
      mutate(g, function (item) { item.done = true; }, g.name + ' checked');
    }, 160);
  }
  function clearChecked() {
    var gone = done().map(snapshot); if (!gone.length) return;
    D.groceries = D.groceries.filter(function (x) { return !gone.some(function (g) { return g.id === x.id; }); });
    changed(); feedback('Cleared ' + gone.length + ' checked item' + (gone.length === 1 ? '' : 's'), function () {
      var skipped = 0;
      gone.forEach(function (g) {
        if (D.groceries.some(function (x) { return x.id === g.id || sameItem(x, g); })) skipped++;
        else D.groceries.push(g);
      });
      changed(); if (skipped) feedback('Restored available items; newer entries were kept.');
    });
  }
  function onClick(e) {
    var t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.hasAttribute('data-check')) { var g = byId(t.dataset.check); if (g) check(g); return; }
    if (t.hasAttribute('data-qty')) {
      var q = byId(t.dataset.id), delta = +t.dataset.qty;
      if (q && !V.pending[q.id] && q.qty + delta >= 1) mutate(q, function (item) { item.qty += delta; }, q.name + ' quantity updated');
      return;
    }
    if (t.hasAttribute('data-add')) return add(t.dataset.add);
    if (t.hasAttribute('data-custom')) return add(V.query);
    if (t.hasAttribute('data-store')) { V.store = t.dataset.store; paintList(); return; }
    if (t.hasAttribute('data-drawer')) { V.drawer = !V.drawer; paintList(); return; }
    if (t.hasAttribute('data-revive')) {
      var r = byId(t.dataset.revive); if (r) mutate(r, function (item) { item.done = false; }, r.name + ' added back'); return;
    }
    if (t.hasAttribute('data-clear')) return clearChecked();
    if (t.hasAttribute('data-undo') && V.feedback && V.feedback.undo) {
      var undo = V.feedback.undo; clearTimeout(V.timer); V.feedback = null; paintFeedback(); undo();
    }
  }
  function render() {
    if (!V.el.querySelector('.shop')) {
      V.el.innerHTML = '<div class="shop"><header class="page-heading s-heading"><div><h1 class="page-title">Shopping <span>/ Supply Register</span></h1><p>Shared household list</p></div><div class="s-count"></div></header>' +
        '<section class="s-workspace" aria-label="Grocery list"><div class="s-toolbar"><h2>Groceries</h2><div class="s-stores" aria-label="Filter by store"></div></div><div class="s-list"></div><section class="s-drawer" aria-label="Completed items"></section></section>' +
        '<aside class="s-side" aria-label="Quick add"><h2 class="s-side-heading">Quick Add <span>素早く追加</span></h2><div class="s-add"><label class="s-input-wrap">' + App.icon('plus', 25) + '<input class="s-input" aria-label="Item to add" placeholder="Type an item…" autocomplete="off" enterkeyhint="done"></label></div><div class="s-suggest"></div><button class="s-custom" data-custom>' + App.icon('plus', 24) + '<span>Add custom item</span></button></aside>' +
        '<div class="s-feedback" role="status" aria-live="polite"></div></div>';
      var input = V.el.querySelector('.s-input');
      input.addEventListener('input', function () { V.query = input.value; paintSuggest(); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(input.value); } });
      var feedbackEl = V.el.querySelector('.s-feedback');
      feedbackEl.addEventListener('focusin', function () { clearTimeout(V.timer); });
      feedbackEl.addEventListener('focusout', function () { V.timer = setTimeout(function () { V.feedback = null; paintFeedback(); }, 8000); });
    }
    V.el.querySelector('.s-input').value = V.query; refresh(); paintFeedback();
  }
  App.register('shopping', {
    show: function (el) { if (!V.el) { V.el = el; el.addEventListener('click', onClick); } render(); }
  });
})();
