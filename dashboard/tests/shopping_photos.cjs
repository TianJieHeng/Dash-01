/* Local deterministic model tests. Run: node dashboard/tests/shopping_photos.cjs
 * These exercise the production source with a minimal DOM adapter, NOT a browser/layout test.
 * Private Shopping helpers are exposed only inside this VM; production exports are unchanged.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let assertions = 0;
function check(value, message) { assert.ok(value, message); assertions++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); assertions++; }
function environment(data, stored) {
  const timers = new Map(), storage = new Map(Object.entries(stored || {})); let nextTimer = 0, randomSeed = 42;
  const seededMath = Object.create(Math); seededMath.random = () => { randomSeed = (1664525 * randomSeed + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const env = {
    window: { DATA: data }, document: { hidden: false, activeElement: null, addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) || null, setItem(key, value) { storage.set(key, value); } },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); }, console, Math: seededMath,
    App: {
      now: () => new Date(2026, 9, 20), dayStart(d) { const date = new Date(d); date.setHours(0, 0, 0, 0); return date; },
      fmt: { month: d => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()] },
      person: () => ({}), img: seed => '/fixture/' + seed, esc: value => String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
      icon: () => '<svg></svg>', $$: () => [], emit() {}, register() {}
    }
  };
  vm.createContext(env);
  return { env, timers, storage };
}
function groceryFixture() {
  let id = 3;
  return {
    stores: [{ id: 'grocer', name: 'FreshCo' }, { id: 'costco', name: 'Costco' }],
    catOrder: { all: ['Produce', 'Dairy & Eggs', 'Pantry'], grocer: ['Produce', 'Dairy & Eggs', 'Pantry'], costco: ['Pantry', 'Dairy & Eggs', 'Produce'] },
    catalog: [['Milk', 'Dairy & Eggs'], ['Eggs', 'Dairy & Eggs'], ['Pasta', 'Pantry'], ['Apples', 'Produce']],
    usuals: ['Milk','Eggs','Bread','Bananas','Apples','Rice','Yogurt','Coffee','Pasta','Cheese','Tomatoes','Soap'],
    groceries: [
      { id: 'g1', name: 'Milk', cat: 'Dairy & Eggs', qty: 2, store: 'grocer', done: false, note: 'Oat milk' },
      { id: 'g2', name: 'Eggs', cat: 'Dairy & Eggs', qty: 1, store: 'costco', done: false, note: '' },
      { id: 'g3', name: 'Pasta', cat: 'Pantry', qty: 4, store: 'costco', done: true, note: 'Whole wheat' }
    ], _gid: () => 'g' + (++id)
  };
}
function shoppingFixture(stored) {
  const test = environment(groceryFixture(), stored);
  let code = fs.readFileSync(path.join(root, 'js/views/shopping.js'), 'utf8');
  code = code.replace("App.register('shopping',", "window.__test = { bind: function (el) { V.el = el; }, state: function () { return V; }, open: open, done: done, find: find, add: add, check: check, mutate: mutate, clearChecked: clearChecked, usualTile: usualTile, suggestHTML: suggestHTML, listHTML: listHTML, onClick: onClick }; App.register('shopping',");
  vm.runInContext(code, test.env);
  const nodes = {};
  const element = { querySelector(selector) {
    if (!nodes[selector]) nodes[selector] = { innerHTML: '', scrollTop: 0, value: '', focus() {}, classList: { toggle() {} }, querySelector() { return null; } };
    return nodes[selector];
  }, contains: () => false };
  test.h = test.env.window.__test; test.h.bind(element); test.data = test.env.window.DATA; test.nodes = nodes;
  return test;
}
{
  const t = shoppingFixture(), h = t.h, data = t.data;
  equal(h.open().length, 2, 'counts are entries, not quantity totals');
  h.state().store = 'grocer'; equal(h.open().length, 1); equal(h.done().length, 0);
  h.state().store = 'all'; h.add('Milk'); equal(data.groceries.length, 3); equal(data.groceries[0].qty, 3);
  h.state().feedback.undo(); equal(data.groceries[0].qty, 2, 'quantity undo restores exact previous value');
  h.add('Pasta'); equal(data.groceries[2].qty, 4, 'checked tile preserves quantity'); equal(data.groceries[2].note, 'Whole wheat'); equal(data.groceries[2].done, false);
  h.state().feedback.undo(); equal(data.groceries[2].done, true, 'restore undo checks original entry again');
  check(h.usualTile('Pasta').includes('Got it')); check(h.usualTile('Milk').includes('On list · 2'));
  equal((h.suggestHTML().match(/class="s-tile/g) || []).length, 24, '12 tiles and 12 marker elements');
  h.state().query = 'a'; check((h.suggestHTML().match(/class="s-ac-row/g) || []).length <= 5); check(!h.suggestHTML().includes('s-usuals'));
  h.state().query = ''; h.add('Milk'); const undoOld = h.state().feedback.undo; data.groceries[0].qty = 9; undoOld(); equal(data.groceries[0].qty, 9, 'undo does not overwrite a newer change');
  h.state().store = 'grocer'; h.clearChecked(); equal(data.groceries.length, 3, 'store-scoped clear leaves other store untouched');
  h.state().store = 'costco'; h.clearChecked(); equal(data.groceries.length, 2); check(data.groceries.every(g => !g.done), 'clear never removes active entries');
  h.state().feedback.undo(); equal(data.groceries.length, 3); equal(data.groceries.find(g => g.id === 'g3').qty, 4);
  h.state().store = 'all'; const milk = data.groceries[0]; h.check(milk); h.check(milk);
  equal([...t.timers.values()].filter(timer => timer.ms === 160).length, 1, 'repeated checks have one pending mutation');
  for (const [id, timer] of t.timers) if (timer.ms === 160) { t.timers.delete(id); timer.fn(); }
  equal(milk.done, true); h.state().feedback.undo(); equal(milk.done, false);
  h.add('  Dragon fruit  '); const fresh = data.groceries[data.groceries.length - 1]; equal(fresh.name, 'Dragon fruit'); equal(fresh.store, 'grocer'); equal(fresh.qty, 1);
  const count = data.groceries.length; h.add('  '); equal(data.groceries.length, count, 'blank custom input is not inserted');
  const persisted = t.storage.get('dash01.shopping.v1'); check(Array.isArray(JSON.parse(persisted)), 'local shopping writes are serialized');
  equal(shoppingFixture({ 'dash01.shopping.v1': persisted }).data.groceries.length, data.groceries.length, 'reload restores local list');
  equal(shoppingFixture({ 'dash01.shopping.v1': '{bad' }).data.groceries.length, 3, 'corrupt storage falls back to supplied list');
  equal(shoppingFixture({ 'dash01.shopping.v1': '[{"id":"bad"}]' }).data.groceries.length, 3, 'invalid storage schema falls back safely');
}
function slideshowFixture(photos) {
  const t = environment({ photos }); t.fail = new Set(); t.pending = new Map();
  t.env.document.createElement = () => {
    const wrapper = {};
    Object.defineProperty(wrapper, 'innerHTML', { set(html) {
      const attrs = {}, node = { style: {}, classList: { add() {} }, setAttribute(k,v) { attrs[k] = v; }, getAttribute(k) { return attrs[k]; }, removeAttribute(k) { delete attrs[k]; }, remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); } };
      const images = [...html.matchAll(/data-photo-id="([^"]+)"/g)].map(match => {
        const key = match[1], callbacks = {}, waiting = t.pending.has(key);
        const image = { dataset: { photoId: key }, complete: !waiting, naturalWidth: t.fail.has(key) ? 0 : 100, addEventListener(event, fn) { callbacks[event] = fn; } };
        if (waiting) t.pending.set(key, { image, callbacks });
        return image;
      });
      node.querySelectorAll = () => images; wrapper.firstChild = node;
    } });
    return wrapper;
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/slideshow.js'), 'utf8'), t.env);
  t.el = { children: [], appendChild(node) { this.children.push(node); node.parent = this; } };
  t.show = opts => new t.env.App.Slideshow(t.el, opts);
  return t;
}
let compositions = 0;
for (const photos of [[],[{seed:'a',o:'l'}],[{seed:'a',o:'p'}],[{seed:'a',o:'l'},{seed:'b',o:'l'}],[{seed:'a',o:'p'},{seed:'b',o:'p'}],[{seed:'a',o:'l'},{seed:'b',o:'p'},{seed:'c',o:'p'},{seed:'d',o:'l'}]]) {
  for (const layout of ['auto','cover','pair','collage','polaroid']) {
    const t = slideshowFixture(photos), s = t.show({ layout });
    for (let n = 0; n < 100; n++) {
      const c = s.pick(); if (!photos.length) { equal(c, null); continue; }
      check(c.photos.every(Boolean)); equal(new Set(c.photos.map(t.env.App.photoKey)).size, c.photos.length);
      equal(c.photos.length, c.layout === 'pair' ? 2 : c.layout === 'collage' ? 3 : 1);
      if (c.layout === 'pair') check(c.photos.every(p => p.o === 'p'));
      if (layout === 'auto' && s.current) check(c.layout !== s.current.layout, 'Auto does not repeat the layout');
      s.current = c; compositions++;
    }
  }
}
{
  const t = slideshowFixture([{seed:'a',o:'l'}, {seed:'b',o:'l'}, {seed:'c',o:'p'}]), s = t.show({ layout: 'cover' }), meta = t.env.App.photoMeta;
  equal(meta({date:'2023-10-20'}).kicker, '3 years ago'); equal(meta({date:'2023-10-20'}).onThisDay, true);
  equal(meta({date:'2027-10-20'}).kicker, ''); equal(meta({date:'2027-10-20'}).onThisDay, false);
  equal(meta({date:'2023-02-29'}).date, ''); equal(meta({}).date, ''); equal(meta({date:'2025-12-20'}).kicker, 'Less than a year ago');
  s.start(); const first = s.current; equal(s.history.length, 1); equal(t.timers.size, 1);
  s.next(); const second = s.current; check(first !== second); equal(s.history.length, 2); equal(t.timers.size, 1);
  s.prev(); equal(s.current, first, 'Previous returns the actual shown composition');
  s.next(); equal(s.current, second, 'Next traverses actual forward history'); equal(s.history.length, 2);
  s.setLayout('polaroid'); equal(s.current.photos[0], second.photos[0], 'layout change retains active memory');
  t.env.document.hidden = true; s.onVisibility(); equal(t.timers.size, 0);
  t.env.document.hidden = false; s.onVisibility(); equal(t.timers.size, 1);
  s.restart(); equal(t.timers.size, 1); s.stop(); equal(t.timers.size, 0);
  const old = s.current; t.pending.set('waiting', null); t.env.window.DATA.photos.push({seed:'waiting',o:'l'});
  s.showPhoto('waiting'); equal(s.current, old, 'old photo retained while replacement loads'); equal(s.loading, true);
  const pending = t.pending.get('waiting'); pending.image.complete = true; pending.callbacks.load();
  equal(s.current.photos[0].seed, 'waiting'); equal(s.loading, false); equal(t.el.children.length, 1);
  t.fail.add('broken'); t.env.window.DATA.photos.push({seed:'broken',o:'l'}); s.showPhoto('broken');
  check(s.current.photos[0].seed !== 'broken', 'failed image skipped'); check(s.failed.broken); equal(t.el.children.length, 1);
}
// Caption replacement must preserve its own focused cycle control, but never steal focus.
{
  const t = environment({ photos: [{ seed: 'one' }, { seed: 'two' }] });
  t.env.App.photoKey = p => p.seed;
  t.env.App.photoMeta = () => ({ place: 'Fixture', date: '', kicker: '' });
  const body = {}, focusCalls = [];
  let cycle = null, captionMarkup = '';
  const caption = { querySelector: () => cycle };
  Object.defineProperty(caption, 'innerHTML', {
    get: () => captionMarkup,
    set(markup) {
      // Mimic the browser dropping focus when the focused descendant is removed.
      if (cycle && t.env.document.activeElement === cycle) t.env.document.activeElement = body;
      captionMarkup = markup;
      cycle = markup.includes('data-cycle-photo') ? { focus(options) { focusCalls.push(options); t.env.document.activeElement = this; } } : null;
    }
  });
  const label = {}, fav = { classList: { toggle() {} }, setAttribute() {}, querySelector: () => label };
  const nodes = { '.photos': { classList: { toggle() {} } }, '.ph-caption': caption, '[data-fav]': fav, '.ph-stage': {} };
  const el = { querySelector: selector => nodes[selector] || null };
  const show = { current: { layout: 'pair', photos: t.env.window.DATA.photos }, available: () => t.env.window.DATA.photos, history: [], cursor: 0 };
  let source = fs.readFileSync(path.join(root, 'js/views/photos.js'), 'utf8');
  source = source.replace("App.register('photos',", "window.__photoTest = { bind: function (el, show) { V.el = el; V.show = show; }, state: function () { return V; }, paint: paint }; App.register('photos',");
  vm.runInContext(source, t.env);
  const h = t.env.window.__photoTest; h.bind(el, show);
  t.env.document.activeElement = body; h.paint(); equal(focusCalls.length, 0, 'initial paint does not steal focus');
  const first = cycle; t.env.document.activeElement = first; h.state().active = 1; h.paint();
  check(cycle !== first, 'caption cycle node was actually replaced');
  equal(t.env.document.activeElement, cycle, 'cycle activation retains focus on replacement control');
  equal(focusCalls.length, 1); equal(focusCalls[0].preventScroll, true);
  h.state().active = 0; h.paint(); equal(t.env.document.activeElement, cycle, 'repeated cycling preserves focus');
  equal(focusCalls.length, 2);
  t.env.document.activeElement = fav; h.paint(); equal(t.env.document.activeElement, fav, 'autoplay paint does not steal Favourite focus'); equal(focusCalls.length, 2);
  t.env.document.activeElement = body; h.paint(); equal(t.env.document.activeElement, body, 'unfocused autoplay does not focus cycle'); equal(focusCalls.length, 2);
}
console.log(`PASS ${assertions} assertions, including ${compositions} composition selections; Shopping state/undo/storage; photo metadata/history/loading/timer lifecycle.`);
console.log('Browser geometry, colour contrast, keyboard/touch hit targets, real WebView 106 and real image/network behaviour require separate QA.');
