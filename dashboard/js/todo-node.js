(function () {
  'use strict';
  var D=window.DATA, local=location.origin==='http://127.0.0.1:8765';
  function dateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  var state=D.todos={enabled:local,days:{},selected:dateKey(new Date()),error:'',loading:false};
  App.todoDate=dateKey;
  App.todoLabel=function(day){if(!local)return 'To-do connection available on the frame';if(!day)return 'Waiting for to-do source';return (day.stale?'Cached · ':'Live · ')+'updated '+App.fmt.time(new Date(day.fetchedAt));};
  var pending={};
  App.refreshTodos=function(date,force){
    date=date||dateKey(App.now());if(!local)return Promise.resolve();if(pending[date])return pending[date];
    state.loading=true;state.error='';
    pending[date]=fetch('/__node/todos?date='+encodeURIComponent(date)+(force?'&refresh=1':''),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error();return r.json();}).then(function(data){
      if(Array.isArray(data.items)&&data.date===date){
        state.days[date]=data;
        if(date===dateKey(App.now())) D.chores=data.items.map(function(i){return {id:i.id,title:i.text,done:i.completed,who:'any',r:'todos'};});
      }else{delete state.days[date];if(date===dateKey(App.now()))D.chores=[];}
      state.error=data.error||'';
    }).catch(function(){state.error='To-do source unavailable';if(state.days[date])state.days[date].stale=true;}).then(function(){delete pending[date];state.loading=Object.keys(pending).length>0;App.emit('data');App.rerender();App.emit('todos');});
    return pending[date];
  };
  App.on('ready',function(){App.refreshTodos();setInterval(function(){App.refreshTodos();if(state.selected!==dateKey(App.now()))App.refreshTodos(state.selected);},60000);});
})();
