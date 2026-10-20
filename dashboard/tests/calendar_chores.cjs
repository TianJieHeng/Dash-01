// Focused local-only state/geometry regression tests. No server, browser, or network.
// Internal functions are exposed only inside an isolated VM, never in shipped code.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('node:path').resolve(__dirname, '../..') + '/';
const pending=[];
const context={console,Date,Intl,Set,Array,Math,String,Number,Object,Boolean,JSON,RegExp,parseInt,isNaN, setTimeout:(fn,ms)=>{const task={fn,ms,active:true};pending.push(task);return task;},clearTimeout:(task)=>{if(task)task.active=false;},document:{documentElement:{dataset:{}},activeElement:null,addEventListener(){},querySelector(){return null;}},addEventListener(){}};
context.window=context;vm.createContext(context);
for(const file of ['dashboard/js/data.js','dashboard/js/icons.js','dashboard/js/app.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),context);
let cal=fs.readFileSync(root+'dashboard/js/views/calendar.js','utf8').replace(/\}\)\(\);\s*$/,'window.CALTEST={V,bounds,layout,travelBlocks,dayView,monthView,threeDay,title,nav};})();');
vm.runInContext(cal,context);
let tasks=fs.readFileSync(root+'dashboard/js/views/tasks.js','utf8').replace(/\}\)\(\);\s*$/,'window.TASKTEST={V,listFor,overdue,apply,state,historyRecord,weekGrid,lane,row,transition};})();');
vm.runInContext(tasks,context);
context.App.ring=()=>'<svg></svg>';
let C=context.CALTEST,T=context.TASKTEST,A=context.App,D=context.DATA;
// Synthetic four-person fixtures keep geometry and legacy preview tests independent of the live household.
D.ALL=['alex','jordan','maya','otto'];
D.people=D.ALL.map((id,i)=>({id,name:'Test person '+i,color:'#378B72',rgb:'55 139 114',ink:'#FFFFFF'}));
D.routines=[{id:'after',name:'Test routine',from:0,to:24}];
D.chores=[{id:'test-person',r:'after',who:'maya',title:'Test task',stars:2,done:false},{id:'test-shared',r:'after',who:'any',title:'Shared task',stars:1,done:false}];
D.stars={maya:5};D.choresHistory=[];
const date=new Date(2026,9,20); A.now=()=>new Date(2026,9,20,15,42);
const at=(h,m=0,d=20)=>new Date(2026,9,d,h,m);
C.V.date=date;
let event=(id,start,end,people=['alex'])=>({id,title:id,start,end,people});
assert.equal(C.bounds(event('early',at(5),at(7)),date).top,0);
assert.equal(C.bounds(event('early',at(5),at(7)),date).h,102);
assert.equal(C.bounds(event('out',at(2),at(3)),date),null);
assert.equal(C.bounds(event('late',at(22),at(2,0,21)),date).h,102);
assert.equal(C.bounds(event('half',at(15),at(15,30)),date).h,50);
assert.equal(C.layout([event('a',at(15),at(16)),event('b',at(16),at(17))]).every(x=>x.cols===1),true);
let overlap=C.layout([event('a',at(15),at(16)),event('b',at(15,10),at(16)),event('c',at(15,20),at(16))]);
assert.equal(overlap.length,2); assert.equal(overlap[1].more.length,2);
D.events=[event('a',at(15),at(16)),event('family',at(15,30),at(16,30),D.ALL)];D.busyExtras=[];
assert.equal((C.dayView().match(/data-ev="family"/g)||[]).length,4,'Conflicting family event renders one linked card per lane');
D.events=[event('family',at(18),at(19),D.ALL)];
assert.equal((C.dayView().match(/data-ev="family"/g)||[]).length,1,'Unconflicted family event spans all lanes once');
D.events=[event('pair',at(16,30),at(17,30),['alex','maya'])];D.events[0].travel=20;
const html=C.dayView();assert.equal((html.match(/data-ev="pair"/g)||[]).length,4,'Nonadjacent shared event and travel render only participant lanes');
assert.equal((html.match(/ev--travel/g)||[]).length,2);
D.events=[{...event('ad',at(0),at(0,0,21),['maya','otto']),allDay:true}];
assert(C.dayView().includes('grid-column:3/span 2'));
assert.equal((C.monthView().match(/class="mo-cell/g)||[]).length,42);
assert.equal((C.threeDay().match(/class="day-head/g)||[]).length,3);
const r=D.routines.find(x=>x.id==='after'),kid=D.chores.find(x=>x.r==='after'&&x.who==='maya'&&!x.done);
const order=T.listFor('maya',r).map(x=>x.id).join(','),oldStars=D.stars.maya;
T.apply(kid,{done:true,by:null});assert.equal(D.stars.maya,oldStars+kid.stars);
assert.equal(T.listFor('maya',r).map(x=>x.id).join(','),order,'Completion never reorders lane');
T.apply(kid,{done:false,by:null});assert.equal(D.stars.maya,oldStars);
T.apply(kid,{done:true,by:null});T.apply(kid,{done:false,by:null});assert.equal(D.stars.maya,oldStars,'Recompletion cannot duplicate stars');
const any=D.chores.find(x=>x.r==='after'&&x.who==='any'&&!x.done);const initial=T.state(any);
T.apply(any,{done:true,by:'maya'});assert.equal(any.doneBy,'maya');assert.equal(D.stars.maya,oldStars+any.stars);
T.apply(any,initial);assert.equal(D.stars.maya,oldStars);assert.equal(any.doneBy,undefined);
assert.equal((T.weekGrid('maya',r).match(/role="img"/g)||[]).length,7);
assert.equal(T.historyRecord('maya',r,date).total,T.listFor('maya',r).length);
assert.equal(T.overdue({...kid,done:false,due:'15:30'}),true);
assert.equal(T.overdue({...kid,done:true,due:'15:30'}),false);
assert.equal(T.overdue({...kid,done:false,due:null,overdue:true}),false,'Legacy flag does not invent a deadline');
assert.equal(T.row({...kid,done:true}).includes('aria-pressed="true"'),true);

function finishMutation() { const task=pending.find(t=>t.active&&t.ms===350); assert(task,'Expected pending mutation'); task.active=false; task.fn(); }
T.transition(kid,{done:true,by:null});
T.transition(kid,{done:true,by:null});
assert.equal(pending.filter(t=>t.active&&t.ms===350).length,1,'Repeated tap submits once');
assert.equal(kid.done,false,'Pending task is not counted complete');
finishMutation();assert.equal(kid.done,true);assert.equal(D.stars.maya,oldStars+kid.stars);
const undo=T.V.feedback.undo;undo();assert.equal(kid.done,false);assert.equal(D.stars.maya,oldStars);
T.transition(kid,{done:true,by:null});finishMutation();
const staleUndo=T.V.feedback.undo;T.apply(kid,{done:false,by:null});staleUndo();
assert.equal(kid.done,false);assert.equal(D.stars.maya,oldStars,'Old undo cannot change a newer completion state');
T.transition(any,{done:true,by:'maya'},null,()=>true);finishMutation();
assert.equal(any.done,false,'Canceled attribution leaves task unchanged');assert.equal(D.stars.maya,oldStars);
T.transition(kid,{done:true,by:null});A.now=()=>new Date(2026,9,21,6);finishMutation();
assert.equal(kid.done,false,'An old pending occurrence cannot complete after day rollover');assert.equal(D.stars.maya,oldStars);
console.log('PASS: calendar geometry/shared/overlap/all-day/month and chore ordering/attribution/rewards/history/pending/cancel/undo/rollover regressions.');

// Actual palette values prove normal-sized shared-event text reaches 4.5:1.
// The theme03 selector excludes travel so its hatch and paper surface stay intact.
const calendarCSS=fs.readFileSync(root+'dashboard/css/views/calendar.css','utf8');
const paletteCSS=fs.readFileSync(root+'dashboard/css/tokens.css','utf8');
assert(/:root\[data-theme="03"\] \.ev\.is-family:not\(\.ev--travel\) \{ background: var\(--accent\); color: var\(--accent-ink\); \}/.test(calendarCSS),'Silver shared events must pair accent fill and accent ink');
assert(/\.ev\.is-family \.ev-cont \{ color: inherit; \}/.test(calendarCSS),'Continuation metadata inherits the readable shared-card text color');
const palettes={};let base={};
for(const match of paletteCSS.matchAll(/:root(?:\[data-theme="([^"]+)"\])?\s*\{([^}]+)\}/g)) {
  const own=Object.fromEntries([...match[2].matchAll(/--([\w-]+)\s*:\s*(#[\da-fA-F]{6})\b/g)].map(m=>[m[1],m[2]]));
  if(!match[1])base=own;
  palettes[match[1]||'mint']={...base,...own};
}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function luminance(c){return c.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const name of ['mint','01','02','03']) {
  const p=palettes[name];assert(p,'Missing palette '+name);
  const foreground=rgb(name==='03'?p['accent-ink']:p.ink);
  const modern=name==='03'?rgb(p.accent):rgb(p.accent).map((x,i)=>.62*x+.38*rgb(p.card)[i]);
  const fallback=rgb(name==='03'?p.accent:p['accent-soft']);
  for(const [surface,color] of [['mixed',modern],['WebView106 fallback',fallback]]){
    const ratio=contrast(foreground,color);assert(ratio>=4.5,`${name} shared event ${surface} contrast ${ratio.toFixed(2)}:1`);
    console.log(`PASS: ${name} shared-event ${surface} text contrast ${ratio.toFixed(2)}:1`);
  }
}
