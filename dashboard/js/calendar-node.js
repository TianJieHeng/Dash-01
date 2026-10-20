(function () {
  'use strict';
  var D = window.DATA, local = location.origin === 'http://127.0.0.1:8765';
  var state = D.schedule = { enabled: local, status: local ? 'loading' : 'demo', calendars: [], alarms: [], fetchedAt: 0, wifiConnected: null, warning: '', error: '' };
  App.scheduleLanes = function () { return state.enabled ? state.calendars : D.people; };
  App.scheduleLabel = function () {
    if (!state.enabled) return 'Local preview · session only';
    if (state.status === 'loading') return 'Connecting to calendar node…';
    if (state.error) return (state.fetchedAt ? 'Cached · ' : '') + state.error;
    return (state.status === 'stale' ? 'Cached · ' : 'Live · ') + state.calendars.length + ' calendars · updated ' + (state.fetchedAt ? App.fmt.time(new Date(state.fetchedAt)) : '—') + (state.warning ? ' · ' + state.warning : '');
  };
  if (!local) return;
  D.events = []; D.busyExtras = [];
  var pending = false;
  App.refreshCalendar = function (force) {
    if (pending) return Promise.resolve();
    pending = true;
    return fetch('/__node/calendar' + (force ? '?refresh=1' : ''), {cache:'no-store'}).then(function(r){if(!r.ok) throw new Error('Calendar connection unavailable'); return r.json();}).then(function(data){
      state.wifiConnected = data.wifiConnected;
      if (Array.isArray(data.calendars) && Array.isArray(data.events)) {
        var mapped = CalendarModel.normalize(data);
        state.calendars = mapped.calendars; state.alarms = mapped.alarms; D.events = mapped.events;
        state.fetchedAt = data.fetchedAt || 0;
        state.warning = [data.warning, mapped.rejected ? mapped.rejected + ' invalid events omitted' : ''].filter(Boolean).join(' · ');
      } else { state.warning = ""; D.events = []; state.calendars = []; state.alarms = []; state.fetchedAt = 0; }
      state.error = data.error || ''; state.status = data.error || data.stale ? 'stale' : 'live';
    }).catch(function(){state.status='stale';state.error='Calendar node unavailable';}).then(function(){
      pending=false;App.emit('data');App.rerender();App.emit('schedule');
    });
  };
  App.showNodeAlarms = function () {
    var esc=App.esc;
    App.sheet('<div class="sheet-pad"><div class="label">Calendar node</div><h2 class="sheet-h">Alarms</h2><p>'+esc(App.scheduleLabel())+'</p><div class="node-alarms">'+state.alarms.map(function(a){return '<section><h3>'+esc(a.name || 'Alarm')+'</h3><p>'+esc(a.enabled ? 'Enabled' : 'Disabled')+' · '+esc(a.executionState || 'State unavailable')+' · '+esc(a.type || a.alarmType || '')+'</p><p>'+esc(a.nextFireAt || a.triggerAt || 'No next fire time')+' · '+esc(a.timezone || '')+'</p><p>'+esc(a.lastResult || '')+'</p></section>';}).join('')+'</div></div>',{label:'Calendar node alarms'});
  };
  App.on('ready',function(){App.refreshCalendar(false);setInterval(function(){App.refreshCalendar(false);},60000);});
})();
