/* Local deterministic model tests. Run: node dashboard/tests/shopping_photos.cjs
 * These exercise the production source with a minimal DOM adapter, NOT a browser/layout test.
 * Live shopping behavior is covered separately by shopping_node.cjs.
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
// Shopping API behavior is tested in shopping_node.cjs. Prototype storage tests were retired.
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
console.log(`PASS ${assertions} assertions, including ${compositions} composition selections; photo metadata/history/loading/timer lifecycle.`);
console.log('Browser geometry, colour contrast, keyboard/touch hit targets, real WebView 106 and real image/network behaviour require separate QA.');
