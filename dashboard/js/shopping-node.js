// Canonical shopping state. Never import the prototype's localStorage list into the API.
(function () {
  'use strict';
  var CACHE = 'dash01.shopping.remote.v1', PENDING = 'dash01.shopping.command.v1';
  var S = App.shopping = { lists: [], list: null, items: [], categories: [], selected: '', busy: false,
    stale: true, error: '', message: '', fetchedAt: 0, pending: null, undo: null, recoveryError: false };
  var enabled = location.origin === 'http://127.0.0.1:8765';
  function validItems(items) {
    var ids = new Set();
    return Array.isArray(items) && items.every(function (i) {
      if (!i || typeof i.id !== 'string' || ids.has(i.id) || typeof i.listId !== 'string' || typeof i.name !== 'string'
          || typeof i.quantity !== 'string' || typeof i.categoryId !== 'string' || typeof i.pickedUp !== 'boolean'
          || !Number.isSafeInteger(i.revision) || i.revision < 1) return false;
      ids.add(i.id); return true;
    });
  }
  function validLists(lists) { return Array.isArray(lists) && lists.every(function (l) { return l && typeof l.id === 'string' && typeof l.name === 'string'; }); }
  function validCategories(cats) { return Array.isArray(cats) && cats.every(function (c) { return c && typeof c.id === 'string' && typeof c.name === 'string'; }); }
  function publish() {
    DATA.groceries = S.items.map(function (i) { return { id:i.id, name:i.name, qty:i.quantity, done:i.pickedUp }; });
    App.emit('data'); App.emit('shopping');
  }
  try {
    var cache = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (cache && validItems(cache.items) && validLists(cache.lists) && validCategories(cache.categories)
        && typeof cache.selected === 'string' && Number.isFinite(cache.fetchedAt)) {
      ['lists','list','items','categories','selected','fetchedAt'].forEach(function (k) { S[k] = cache[k]; });
    }
  } catch (_) { S.error = 'Saved shopping state could not be read.'; }
  // Read the command independently: a damaged display cache must never lose an in-flight save.
  try {
    S.pending = JSON.parse(localStorage.getItem(PENDING) || 'null');
    if (S.pending && (!S.pending.payload || typeof S.pending.payload !== 'object'
        || !/^shopping-[a-zA-Z0-9_-]{16,119}$/.test(S.pending.key)
        || ['createList','renameList','createItem','updateItem','removeItem','clearPickedUp','undo'].indexOf(S.pending.operation)<0)) throw new Error();
  } catch (_) { S.pending = null; S.recoveryError = true; }
  DATA.groceries = S.items.map(function (i) { return { id:i.id, name:i.name, qty:i.quantity, done:i.pickedUp }; });
  function uuid() { return crypto.randomUUID(); }
  async function request(command) {
    if (!enabled) throw Object.assign(new Error('Shopping connection is available on the frame.'), { status:503 });
    var response, data;
    try {
      response = await fetch('/__node/shopping', { method:'POST', cache:'no-store',
        headers:{'X-Shopping-Command':encodeURIComponent(JSON.stringify(command))} });
      data = await response.json();
    } catch (_) { throw Object.assign(new Error('Connection lost. Retry to check whether the save completed.'), {status:503}); }
    if (!response.ok || data.error || !data.result) throw Object.assign(new Error(
      data.error && data.error.message || 'Shopping source unavailable.'), {status:response.status});
    return data.result;
  }
  async function snapshot() {
    var catalog = await request({operation:'listLists',payload:{}});
    if (!validLists(catalog.lists)) throw new Error('Invalid shopping list response.');
    var selected = catalog.lists.some(function (l) { return l.id === S.selected; }) ? S.selected : (catalog.lists[0] || {}).id || '';
    var data = selected ? await request({operation:'getList',payload:{listId:selected}}) : {list:null,items:[],categories:[]};
    if (!validItems(data.items) || !validCategories(data.categories) || (selected && (!data.list || data.list.id !== selected
        || !Number.isSafeInteger(data.list.contentRevision))) || data.items.some(function (i) { return i.listId !== selected; })) throw new Error('Invalid shopping snapshot.');
    S.lists = catalog.lists; S.selected = selected; S.list = data.list; S.items = data.items; S.categories = data.categories;
    S.stale = false; S.fetchedAt = Date.now();
    try { localStorage.setItem(CACHE, JSON.stringify({lists:S.lists,selected:S.selected,list:S.list,items:S.items,categories:S.categories,fetchedAt:S.fetchedAt})); }
    catch (_) { S.message = 'Live list loaded; offline caching is unavailable.'; }
  }
  S.refresh = async function () {
    if (S.busy) return;
    S.busy = true; S.error = ''; publish();
    try { await snapshot(); } catch (e) { S.stale = true; S.error = e.message; }
    if (S.recoveryError) S.error = 'Saved request could not be read. Shopping edits are paused until device storage is repaired.';
    S.busy = false; publish();
  };
  S.select = async function (id) {
    if (S.busy || S.pending || id === S.selected) return;
    S.selected = id; S.items = []; S.list = null; S.undo = null; S.message = ''; S.stale = true;
    await S.refresh();
  };
  async function sendPending() {
    if (S.busy || !S.pending) return false;
    S.busy = true; S.error = ''; S.message = 'Saving…'; publish();
    var command = S.pending, saved = false;
    try {
      var result = await request(command);
      // Clear the durable receipt only after an acknowledged result. Retrying a retained command
      // after a storage failure is harmless: it uses the original immutable key and payload.
      localStorage.removeItem(PENDING); S.pending = null; saved = true;
      S.undo = result.undoable ? { listId:result.listId, actionId:result.actionId } : null;
      S.message = 'Saved';
      if (command.operation === 'createList') S.selected = command.payload.id;
    } catch (e) {
      if ([400,401,403,404,409,413,422].indexOf(e.status) >= 0) {
        try { localStorage.removeItem(PENDING); S.pending = null; } catch (_) {}
        S.message = '';
        S.error = e.status === 409 ? 'This list changed elsewhere. Latest items loaded; review before trying again.' : e.message;
      } else { S.message = ''; S.error = e.message || 'Save status unknown. Retry the pending save.'; }
    }
    var error = S.error;
    try { await snapshot(); } catch (e) { S.stale = true; S.error = error || (saved ? 'Saved, but refresh failed. Try Refresh.' : e.message); }
    S.busy = false; publish(); return saved;
  }
  S.write = async function (operation, payload) {
    if (S.busy || S.pending || S.stale || S.recoveryError) return false;
    var command = {operation:operation,payload:JSON.parse(JSON.stringify(payload)),key:'shopping-'+uuid()};
    try { localStorage.setItem(PENDING,JSON.stringify(command)); }
    catch (_) { S.error = 'Cannot safely save: device storage is unavailable.'; publish(); return false; }
    S.pending = command; return sendPending();
  };
  S.retry = sendPending;
  S.newId = uuid;
  S.update = function (item, patch) { return S.write('updateItem',{listId:item.listId,itemId:item.id,baseRevision:item.revision,patch:patch}); };
  S.undoLast = function () { return S.undo ? S.write('undo',S.undo) : Promise.resolve(false); };
  App.on('ready',function () { S.refresh(); setInterval(function () { S.refresh(); },30000); });
})();
