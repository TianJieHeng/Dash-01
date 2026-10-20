#!/usr/bin/env node
// Local, dependency-free model/render regression checks. This is not a browser,
// hardware, provider API, or CI test. Run: node dashboard/tests/control_providers.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

function environment() {
  const timers = [], views = {}, listeners = {};
  const context = {
    console, Promise, Date,
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {}, clearInterval() {}, addEventListener() {},
    document: { addEventListener() {}, querySelector() { return null; } },
    App: {
      esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
      icon() { return ''; }, on() {}, emit() {}, toast() {},
      fmt24h() { return '16:12:00'; },
      register(name, view) { views[name] = view; }
    }
  };
  context.window = context;
  vm.createContext(context);
  function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }); }
  load('js/data.js');
  return { context, timers, views, listeners, load };
}

async function checkCommands() {
  const e = environment(); e.load('js/views/control.js');
  const { DATA, App } = e.context;
  const d = DATA.devices.find(d => d.id === 'k-pend'), before = d.on;
  const pending = App.setDevice(d.id, { on: !before });
  assert.equal(d.on, before, 'Keep confirmed state while a command is pending');
  assert.equal(await App.setDevice(d.id, { on: before }), false, 'Reject duplicate in-flight commands');
  e.timers.shift()();
  assert.equal(await pending, true); assert.equal(d.on, !before);
  d.offline = true;
  assert.equal(await App.setDevice(d.id, { on: before }), false, 'Disable offline commands');
  assert.equal(d.on, !before); delete d.offline;
  const flaky = DATA.devices.find(d => d.flaky), old = flaky.on;
  const failure = App.setDevice(flaky.id, { on: !old });
  assert.equal(flaky.on, old); e.timers.shift()();
  assert.equal(await failure, false); assert.equal(flaky.on, old, 'Failed commands retain confirmed state');
  assert.equal(await App.setDevice('missing-device', { on: true }), false);
  // The sheet and page share the same current-action feedback source. Capture
  // its status sink without pretending this VM test is a browser interaction.
  const status = { textContent: '' };
  e.context.document.querySelector = selector => selector === '.hc-sheet-status' ? status : null;
  const door = DATA.devices.find(d => d.id === 'e-door');
  const unlocking = App.setDevice(door.id, { locked: false });
  assert(status.textContent.includes('Unlocking'));
  e.timers.shift()(); await unlocking;
  assert.equal(status.textContent, 'DEMO · Front Door confirmed unlocked.');
  const locking = App.setDevice(door.id, { locked: true });
  assert.equal(door.locked, false, 'Relock is not confirmed prematurely');
  assert(status.textContent.includes('Locking'));
  assert(!status.textContent.includes('confirmed unlocked'), 'A new command replaces stale unlock feedback immediately');
  e.timers.shift()(); await locking;
  assert.equal(door.locked, true);
  assert.equal(status.textContent, 'DEMO · Front Door confirmed locked.', 'Relock completion cannot leave an unlocked banner');
  const first = App.setDevice('k-pend', { on: true });
  const second = App.setDevice('k-island', { on: true });
  const earlierResponse = e.timers.shift(), laterResponse = e.timers.shift();
  laterResponse(); await second;
  const latestMessage = status.textContent;
  earlierResponse(); await first;
  assert.equal(status.textContent, latestMessage, 'An earlier device acknowledgement cannot overwrite the latest action banner');
  const inventory = DATA.devices.reduce((counts, d) => { counts[d.type] = (counts[d.type] || 0) + 1; return counts; }, {});
  assert.deepEqual(inventory, { light: 13, blind: 2, lock: 3, garage: 1 });
  assert.equal(new Set(DATA.devices.map(d => d.id)).size, 19, 'Preserve unique device IDs');
  console.log('PASS Habitat commands: pending, duplicate, offline, failure, missing ID, relock feedback, out-of-order feedback, exact 19-device inventory');
}

function checkProviders() {
  const e = environment(); e.load('js/views/agents.js');
  const nodes = {}; let click;
  const el = {
    innerHTML: '',
    addEventListener(event, fn) { if (event === 'click') click = fn; },
    querySelector(selector) { return nodes[selector] || (nodes[selector] = { textContent: '' }); }
  };
  const render = () => { e.views.agents.show(el); return el.innerHTML; };
  let html = render();
  assert.equal((html.match(/<section class="ag-card/g) || []).length, 6);
  assert.equal((html.match(/class="ag-meter(?: is-hot)?"/g) || []).length, 10);
  assert.equal((html.match(/class="ag-spark"/g) || []).length, 5);
  for (const text of ['Refresh updates timestamp only', '4.40M', '700K', '$1.68', '61<small>%</small>', 'On pace', 'Near limit · Monthly quota', 'Elevated response latency']) assert(html.includes(text), text);
  assert(html.includes('ag-data-table'), 'Expose exact aggregate data non-visually');
  const fixture = e.context.DATA.agentUsage;
  assert.deepEqual(Array.from(fixture, a => a.id), ['claude', 'codex', 'cursor', 'gemini', 'copilot']);
  assert.equal(fixture.reduce((sum, a) => sum + a.tokens, 0), 700000);
  assert.equal(fixture.reduce((sum, a) => sum + a.week.reduce((s, n) => s + n, 0), 0), 4400000);
  assert.equal(fixture.reduce((sum, a) => sum + a.cost, 0), 1.68);
  assert.equal(fixture.find(a => a.id === 'cursor').status, 'ok');
  assert.equal(fixture.find(a => a.id === 'gemini').status, 'degraded');
  const before = JSON.stringify(fixture);
  click({ target: { closest() { return true; } } });
  assert.equal(JSON.stringify(fixture), before, 'Refresh must not mutate illustrative usage');
  assert.equal(el.innerHTML, html, 'Refresh must not rebuild or alter the provider cards');
  assert(nodes['.ag-announcement'].textContent.includes('unchanged'));
  const a = fixture[0];
  a.meters[0].quota = 0; html = render();
  assert(html.includes('Quota unavailable')); assert(html.includes('N/A'));
  a.meters[0] = { label: 'Daily', used: 140, quota: 100, unit: 'requests', pace: 50, reset: '12h' };
  html = render(); assert(html.includes('140<small>%</small>')); assert(html.includes('Over quota')); assert(html.includes('width:100%'));
  a.week = null; a.tokens = null; a.cost = null; a.status = null; html = render();
  for (const text of ['Partial coverage', '7D unavailable', 'Unknown']) assert(html.includes(text), text);
  console.log('PASS Providers: six cards, ten meters, five lines, exact totals, service/usage separation, timestamp-only Refresh, missing/over-quota resilience');
}

(async function () { await checkCommands(); checkProviders(); })().catch(error => { console.error(error); process.exitCode = 1; });
