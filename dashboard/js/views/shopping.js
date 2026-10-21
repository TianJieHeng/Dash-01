// Supply Register backed by the shared Shopping API.
(function () {
  'use strict';
  var S = App.shopping, D = window.DATA, el = null, query = '', drawer = true;
  function esc(s) { return App.esc(s == null ? '' : String(s)); }
  function locked() { return S.busy || S.stale || !!S.pending || S.recoveryError; }
  function disabled() { return locked() ? ' disabled' : ''; }
  function item(id) { return S.items.find(function (i) { return i.id === id; }); }
  function category(name) {
    var hit = D.catalog.find(function (c) { return c[0].toLowerCase() === name.toLowerCase(); });
    var labels = {'Produce':'produce','Dairy & Eggs':'dairy-eggs','Pantry':'pantry','Bakery':'pantry','Snacks':'pantry','Household':'household'};
    return hit && labels[hit[1]] || 'uncategorized';
  }
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

  function row(i, checked) {
    return '<div class="s-row' + (checked ? ' is-done' : '') + '"><button class="s-check" data-check="' + esc(i.id) + '" aria-label="' + (checked?'Uncheck ':'Check ') + esc(i.name) + '" aria-pressed="' + checked + '"' + disabled() + '><span class="s-box">' + (checked?App.icon('check',19):'') + '</span></button>' + foodIcon(i.name) +
      '<button class="s-name s-edit" data-edit="' + esc(i.id) + '" aria-label="Edit ' + esc(i.name) + '"' + disabled() + '><b>' + esc(i.name) + '</b><small>Tap to edit</small></button><span class="s-text-qty">' + esc(i.quantity) + '</span></div>';
  }
  function suggestions() {
    var names = query.trim() ? D.catalog.map(function (c) { return c[0]; }).filter(function (name) { return name.toLowerCase().includes(query.trim().toLowerCase()); }).slice(0,5) : D.usuals;
    return '<h3 class="s-suggest-title">' + (query.trim()?'Suggestions':'Usual items') + '</h3><div class="' + (query.trim()?'s-ac':'s-usuals') + '">' + names.map(function (name) {
      var existing = S.items.some(function (i) { return !i.pickedUp && i.name.toLowerCase()===name.toLowerCase(); });
      return '<button class="s-tile' + (existing?' is-on':'') + '" data-add="' + esc(name) + '"' + (locked() || !S.list?' disabled':'') + '>' + foodIcon(name) + '<b>' + esc(name) + '</b><span>' + (existing?'On list · Add another':'Add item') + '</span></button>';
    }).join('') + '</div>';
  }
  function paint() {
    if (!el) return;
    var active = document.activeElement, focus = active && active.closest('button'), identity;
    if (focus && el.contains(focus)) ['data-check','data-edit','data-add','data-refresh','data-retry','data-undo','data-clear','data-drawer'].some(function (key) {
      if (focus.hasAttribute(key)) { identity=[key,focus.getAttribute(key)]; return true; } return false;
    });
    var open = S.items.filter(function (i) { return !i.pickedUp; }), done = S.items.filter(function (i) { return i.pickedUp; });
    el.querySelector('.s-count').innerHTML='<b class="num">'+open.length+'</b><span>Remaining</span>';
    el.querySelector('.s-source').textContent = (S.stale?'Offline / waiting':S.busy?'Updating…':'Live') + (S.fetchedAt?' · Updated '+App.fmt.time(new Date(S.fetchedAt)):'');
    var select = el.querySelector('.s-list-select');
    select.innerHTML = S.lists.map(function (l) { return '<option value="'+esc(l.id)+'">'+esc(l.name)+'</option>'; }).join('') || '<option>No lists yet</option>';
    select.value=S.selected; select.disabled=S.busy || !!S.pending;
    el.querySelector('[data-new-list]').disabled=locked();
    el.querySelector('[data-refresh]').disabled=S.busy;
    var list=el.querySelector('.s-list'), y=list.scrollTop;
    var cats=S.categories.slice();
    S.items.forEach(function(i){if(!cats.some(function(c){return c.id===i.categoryId;}))cats.push({id:i.categoryId,name:'Uncategorized'});});
    list.innerHTML = open.length ? cats.map(function(c){var group=open.filter(function(i){return i.categoryId===c.id;});return group.length?'<section class="s-cat"><h3 class="s-cat-h">'+esc(c.name)+'<span>· '+group.length+'</span></h3>'+group.map(function(i){return row(i,false);}).join('')+'</section>':'';}).join('') :
      '<div class="s-empty">'+App.icon('bag',36)+'<h3>'+(S.stale?'Waiting for your list':!S.list?'Create your first list':'All stocked up')+'</h3><p>'+(S.stale?'Refresh to reconnect. Saved items stay on this frame.':'Add an item using Quick Add.')+'</p></div>';
    list.scrollTop=y;
    var drawerEl=el.querySelector('.s-drawer'), old=drawerEl.querySelector('.s-drawer-list'), dy=old?old.scrollTop:0;
    drawerEl.innerHTML='<button class="s-drawer-h" data-drawer aria-expanded="'+drawer+'">Got it · '+done.length+'</button>'+(drawer && done.length?'<div class="s-drawer-list">'+done.map(function(i){return row(i,true);}).join('')+'</div><button class="s-clear" data-clear'+disabled()+'>Clear checked</button>':'');
    if(drawerEl.querySelector('.s-drawer-list'))drawerEl.querySelector('.s-drawer-list').scrollTop=dy;
    el.querySelector('.s-suggest').innerHTML=suggestions();
    el.querySelector('[data-custom]').disabled=locked() || !S.list;
    var feedback=el.querySelector('.s-feedback');
    feedback.classList.toggle('is-visible',!!(S.error || S.message || S.pending));
    feedback.innerHTML='<span>'+esc(S.error || (S.pending && !S.busy?'Save not confirmed. Retry to finish the pending action.':S.message))+'</span>'+
      (S.pending?'<button data-retry'+(S.busy?' disabled':'')+'>Retry save</button>':S.undo?'<button data-undo'+disabled()+'>Undo</button>':'');
    if(identity){var target=Array.from(el.querySelectorAll('button')).find(function(b){return b.getAttribute(identity[0])===identity[1];});if(target && !target.disabled)target.focus({preventScroll:true});}
  }
  function editor(existing, name, newList) {
    if(locked() || (!newList && !S.list))return;
    var captured=existing?JSON.parse(JSON.stringify(existing)):null, listId=S.selected;
    App.sheet('<h2>'+ (newList?'New shopping list':existing?'Edit item':'Add item') +'</h2><form class="s-editor"><label>Name<input name="name" required maxlength="'+(newList?120:240)+'" value="'+esc(existing?existing.name:name || '')+'" autocomplete="off"></label>'+
      (newList?'':'<label>Quantity<input name="quantity" required maxlength="80" value="'+esc(existing?existing.quantity:'1')+'" placeholder="e.g. 2 bags"></label><label>Category<select name="category">'+S.categories.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===(existing?existing.categoryId:category(name || ''))?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select></label>')+
      '<p class="s-editor-status" role="status"></p><div class="s-editor-actions">'+(existing?'<button type="button" data-remove>Remove item</button>':'')+'<button type="submit">'+(existing?'Save changes':newList?'Create list':'Add item')+'</button></div></form>',{
      cls:'s-edit-sheet',label:newList?'New shopping list':existing?'Edit item':'Add item',
      onMount:function(sheet,close){
        var form=sheet.querySelector('form'), status=sheet.querySelector('.s-editor-status');
        async function save(operation,payload){
          if(locked()){status.textContent='Wait for the current request or resolve the pending save first.';return;}
          Array.from(form.querySelectorAll('button')).forEach(function(b){b.disabled=true;});
          var ok=await S.write(operation,payload);
          if(ok){if(!existing && !newList){query='';el.querySelector('.s-input').value='';paint();}if(sheet.isConnected)close();}
          else {status.textContent=S.error || 'Could not save.';Array.from(form.querySelectorAll('button')).forEach(function(b){b.disabled=false;});
            // Keep the draft, but rebase only after explicit review. Never silently overwrite a newer item.
            if(captured && !S.pending){var current=item(captured.id);if(current && current.revision!==captured.revision){status.textContent+=' Latest value: '+current.name+' / '+current.quantity+'. Close and reopen to edit the latest version.';form.querySelector('[type=submit]').disabled=true;}}
          }
        }
        form.addEventListener('submit',function(e){e.preventDefault();var title=form.elements.name.value.trim();if(!title)return;
          if(newList)return save('createList',{id:S.newId(),name:title});
          var quantity=form.elements.quantity.value.trim();if(!quantity)return;
          var patch={name:title,quantity:quantity,categoryId:form.elements.category.value};
          if(captured)return save('updateItem',{listId:captured.listId,itemId:captured.id,baseRevision:captured.revision,patch:patch});
          save('createItem',Object.assign({id:S.newId(),listId:listId},patch));
        });
        if(existing)form.querySelector('[data-remove]').addEventListener('click',function(){
          confirmAction('Remove '+captured.name+'?', 'You can undo this after removal.', 'Remove item', function(){return S.write('removeItem',{listId:captured.listId,itemId:captured.id,baseRevision:captured.revision});});
        });
      }
    });
  }
  function confirmAction(title,detail,label,action){
    App.sheet('<h2>'+esc(title)+'</h2><p>'+esc(detail)+'</p><p class="s-editor-status" role="status"></p><div class="s-editor-actions"><button data-close>Cancel</button><button data-confirm>'+esc(label)+'</button></div>',{
      cls:'s-edit-sheet',label:title,onMount:function(sheet,close){sheet.querySelector('[data-confirm]').addEventListener('click',async function(){
        var button=this;button.disabled=true;var ok=await action();if(ok && sheet.isConnected)close();else {sheet.querySelector('.s-editor-status').textContent=S.error || 'Refresh and try again.';button.disabled=false;}
      });}
    });
  }
  function click(e){
    var t=e.target.closest('button');if(!t || t.disabled)return;
    if(t.hasAttribute('data-refresh'))return S.refresh();
    if(t.hasAttribute('data-retry'))return S.retry();
    if(t.hasAttribute('data-undo'))return S.undoLast();
    if(t.hasAttribute('data-new-list'))return editor(null,'',true);
    if(t.hasAttribute('data-drawer')){drawer=!drawer;return paint();}
    if(t.hasAttribute('data-edit'))return editor(item(t.dataset.edit));
    if(t.hasAttribute('data-check')){var i=item(t.dataset.check);if(i)return S.update(i,{pickedUp:!i.pickedUp});}
    if(t.hasAttribute('data-add'))return editor(null,t.dataset.add);
    if(t.hasAttribute('data-custom'))return editor(null,query.trim());
    if(t.hasAttribute('data-clear') && S.list){
      var listId=S.list.id, revision=S.list.contentRevision, count=S.items.filter(function(i){return i.pickedUp;}).length;
      return confirmAction('Clear '+count+' checked items?', 'Only checked items in '+S.list.name+' will be removed. You can undo this.', 'Clear checked', function(){return S.write('clearPickedUp',{listId:listId,baseContentRevision:revision,confirm:true});});
    }
  }
  App.register('shopping',{show:function(node){
    if(!el){el=node;el.innerHTML='<div class="shop"><header class="page-heading s-heading"><div><h1 class="page-title">Shopping <span>/ Supply Register</span></h1><p class="s-source"></p></div><div class="s-count"></div></header><section class="s-workspace" aria-label="Shopping list"><div class="s-toolbar s-live-toolbar"><select class="s-list-select" aria-label="Shopping list"></select><button data-new-list>New list</button><button data-refresh>Refresh</button></div><div class="s-list"></div><section class="s-drawer" aria-label="Completed items"></section></section><aside class="s-side" aria-label="Quick add"><h2 class="s-side-heading">Quick Add <span>素早く追加</span></h2><div class="s-add"><label class="s-input-wrap">'+App.icon('plus',25)+'<input class="s-input" aria-label="Item to add" maxlength="240" placeholder="Type an item…" autocomplete="off"></label></div><div class="s-suggest"></div><button class="s-custom" data-custom>'+App.icon('plus',24)+'Add custom item</button></aside><div class="s-feedback" role="status" aria-live="polite"></div></div>';
      el.addEventListener('click',click);
      el.querySelector('.s-list-select').addEventListener('change',function(){S.select(this.value);});
      el.querySelector('.s-input').addEventListener('input',function(){query=this.value;el.querySelector('.s-suggest').innerHTML=suggestions();});
      el.querySelector('.s-input').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();editor(null,query.trim());}});
    }
    paint();
  }});
  App.on('shopping',paint);
})();
