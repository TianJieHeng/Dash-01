// Quiet idle display: only measured frame and connected-node state, never demo device health.
(function () {
  'use strict';
  var panel;
  function paint() {
    if (!panel || App.mode !== 'status') return;
    var s=App.state.schedule || {}, fresh=s.status==='live' && s.fetchedAt && Date.now()-s.fetchedAt<120000;
    var connected=s.enabled && s.fetchedAt, name=!s.enabled?'Not configured':s.status==='loading'?'Connecting':fresh?'Connected':connected?'Stale data':'Unavailable';
    panel.innerHTML='<div class="lab-inner"><div class="lab-kicker">DASH-01 / HOMELAB</div><div class="lab-clock num">'+App.fmt.time(App.now())+'</div><div class="lab-date">'+App.fmt.day(App.now())+' · '+App.fmt.month(App.now())+' '+App.now().getDate()+'</div><div class="lab-services"><section><i class="'+(s.wifiConnected===true?'is-up':'')+'"></i><div><h2>Frame Wi-Fi</h2><p>'+(s.wifiConnected===true?'Connected':s.wifiConnected===false?'Disconnected':'Not checked')+'</p></div></section><section><i class="'+(fresh?'is-up':'')+'"></i><div><h2>Calendar node</h2><p>'+name+'</p><small>'+(s.fetchedAt?'Last data '+App.fmt.time(new Date(s.fetchedAt))+' · '+s.calendars.length+' calendars':'Waiting for a verified response')+'</small>'+(s.warning?'<small>'+App.esc(s.warning)+'</small>':'')+'</div></section></div><div class="lab-foot">Only connected services are shown · Tap to return</div></div>';
  }
  App.on('ready',function(){panel=document.createElement('div');panel.id='labStatus';panel.className='lab-status';panel.setAttribute('role','button');panel.setAttribute('tabindex','0');panel.setAttribute('aria-label','Homelab status. Return to dashboard');App.$('#stage').appendChild(panel);function leave(){App.setMode('day');App.resetIdle();}panel.addEventListener('click',leave);panel.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' ')leave();});});
  App.on('mode',paint);App.on('minute',paint);App.on('schedule',paint);
})();
