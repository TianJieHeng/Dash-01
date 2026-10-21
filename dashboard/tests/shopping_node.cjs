const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(__dirname+'/../js/shopping-node.js','utf8');
const storage = new Map([['dash01.shopping.v1',JSON.stringify([{name:'Never upload demo'}])]]);
let lists=[{id:'list1',name:'Groceries'}],items=[], revision=1, mode='', commands=[], receipts=new Map(), next=0, blockStorage=false;
const clone=x=>JSON.parse(JSON.stringify(x));
function boot(){
  const c={console,Date,JSON,Promise,setInterval(){},crypto:{randomUUID:()=> '00000000-0000-4000-8000-'+String(++next).padStart(12,'0')},location:{origin:'http://127.0.0.1:8765'},
    DATA:{groceries:[{name:'demo'}]},App:{on(){},emit(){}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(blockStorage)throw Error('full');storage.set(k,v);},removeItem:k=>storage.delete(k)},
    fetch:async(url,options)=>{
      assert.equal(url,'/__node/shopping');assert.equal(options.method,'POST');assert(!JSON.stringify(options).includes('Bearer'));
      const cmd=JSON.parse(decodeURIComponent(options.headers['X-Shopping-Command']));commands.push(clone(cmd));
      if(mode==='offline')throw Error('offline');
      let result, status=200;
      if(cmd.operation==='listLists')result={lists:clone(lists)};
      else if(cmd.operation==='getList')result={list:{...lists.find(l=>l.id===cmd.payload.listId),contentRevision:revision},items:clone(items.filter(i=>i.listId===cmd.payload.listId)),categories:[{id:'produce',name:'Produce'}]};
      else if(receipts.has(cmd.key))result=receipts.get(cmd.key);
      else if(mode==='conflict'){status=409;result={error:{message:'Conflict'}};}
      else if(mode==='unauthorized'){status=401;result={error:{message:'Unauthorized'}};}
      else {
        if(cmd.operation==='createList')lists.push(clone(cmd.payload));
        if(cmd.operation==='createItem')items.push({...cmd.payload,pickedUp:false,revision:1});
        if(cmd.operation==='updateItem'){const i=items.find(i=>i.id===cmd.payload.itemId);assert.equal(cmd.payload.baseRevision,i.revision);Object.assign(i,cmd.payload.patch);i.revision++;}
        revision++;result={actionId:'action-'+revision,listId:'list1',undoable:cmd.operation==='updateItem'};receipts.set(cmd.key,result);
        if(mode==='lost-reply'){mode='';throw Error('reply lost after commit');}
      }
      return {ok:status===200,status,json:async()=>status===200?{result}:result};
    }};
  c.window=c;vm.createContext(c);vm.runInContext(source,c);return c;
}
(async()=>{
  let c=boot(),s=c.App.shopping;
  assert.equal(c.DATA.groceries.length,0,'old demo storage must never populate or upload');
  await s.refresh();assert.equal(s.stale,false);assert.equal(s.selected,'list1');
  const payload={id:'item1',listId:'list1',name:'Apples <&>',quantity:'2 bags',categoryId:'produce'};
  mode='lost-reply';assert.equal(await s.write('createItem',payload),false);
  assert.equal(items.length,1);assert(s.pending);const pending=clone(s.pending);payload.name='MUTATED';
  assert.equal(await s.write('createItem',payload),false,'block writes while outcome unknown');
  storage.set('dash01.shopping.remote.v1','{broken');
  c=boot();s=c.App.shopping;assert(s.pending,'pending command survives reload even when display cache is damaged');await s.refresh();
  assert.equal(await s.retry(),true);assert.equal(items.length,1,'retry after lost reply must not duplicate');assert.equal(s.pending,null);
  const writes=commands.filter(x=>x.operation==='createItem');assert.deepEqual(writes,[pending,pending],'retry uses exact durable command');
  assert.equal(c.DATA.groceries[0].qty,'2 bags');assert.equal(c.DATA.groceries[0].name,'Apples <&>');
  assert.equal(await s.update(s.items[0],{pickedUp:true}),true);assert.equal(c.DATA.groceries[0].done,true);assert(s.undo);
  mode='conflict';const before=clone(items);assert.equal(await s.update(s.items[0],{name:'Overwrite'}),false);assert.deepEqual(items,before);assert.equal(s.pending,null);assert.match(s.error,/changed elsewhere/);
  mode='offline';await s.refresh();assert.equal(s.stale,true);assert.equal(s.items.length,1);assert.equal(await s.update(s.items[0],{pickedUp:false}),false);
  mode='';await s.refresh();blockStorage=true;const count=commands.length;assert.equal(await s.update(s.items[0],{pickedUp:false}),false);assert.equal(commands.length,count,'storage failure sends no mutation');blockStorage=false;
  mode='unauthorized';assert.equal(await s.update(s.items[0],{pickedUp:false}),false);assert.equal(s.pending,null);assert.match(s.error,/Unauthorized/);
  mode='';await s.refresh();assert.equal(await s.write('createList',{id:'list2',name:'Household'}),true);assert.equal(s.selected,'list2');assert.equal(s.items.length,0);await s.select('list1');assert.equal(s.items.length,1,'switching lists restores only that list');
  lists=[];items=[];await s.refresh();assert.equal(s.list,null);assert.equal(s.stale,false);assert.equal(await s.write('createList',{id:'first',name:'First list'}),true);assert.equal(s.selected,'first');
  storage.set('dash01.shopping.command.v1','{broken');c=boot();s=c.App.shopping;await s.refresh();assert(s.recoveryError);assert.equal(await s.write('createItem',payload),false,'invalid durable command must block new writes');
  console.log('PASS shopping API: no demo import, text quantities, acknowledged state, lost-response/reload idempotency, conflict protection, offline cache, storage failure, auth errors');
})().catch(e=>{console.error(e);process.exitCode=1;});
