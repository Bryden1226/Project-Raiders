
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[m]));
const [materials,blueprints,upgrades,expeditions]=await Promise.all(['materials','blueprints','upgrades','expeditions'].map(x=>fetch(`data/${x}.json?v=6`, {cache:'no-store'}).then(r=>r.json())));
let encyclopediaItems=[]; let itemQuickFilter='All'; let itemsLoaded=false;
const KEY='raider_companion_v1'; let state={inventory:{},blueprints:{},upgrades:{},expeditions:{},workbenchTracker:{},expeditionTracker:{},...JSON.parse(localStorage.getItem(KEY)||'{}')};
state.workbenchTracker ||= {};
state.expeditionTracker ||= {};
// Import progress from the original standalone tracker once, when present.
try {
  const legacy=JSON.parse(localStorage.getItem('arc_raiders_upgrade_tracker_v1')||'{}');
  if(legacy && typeof legacy==='object'){
    if(Object.keys(state.workbenchTracker).length===0) state.workbenchTracker={...legacy};
    if(Object.keys(state.expeditionTracker).length===0){
      state.expeditionTracker=Object.fromEntries(Object.entries(legacy).filter(([key])=>key.startsWith('Expedition 3|')||key.startsWith('Expedition 4|')));
    }
  }
} catch {}
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const neededFor=m=>m.uses.reduce((n,u)=>n+((u.type==='blueprint'&&!state.blueprints[u.target+' Blueprint'])||(u.type==='upgrade'&&!state.upgrades[u.target])||(u.type==='expedition'&&!state.expeditions[u.target])?u.quantity:0),0);
function nav(){ $$('.bottomnav button').forEach(b=>b.onclick=()=>{$$('.bottomnav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.view).classList.add('active');window.scrollTo(0,0)}) }
function renderHome(){const bpDone=Object.values(state.blueprints).filter(Boolean).length, upTotal=Object.values(upgrades).reduce((n,x)=>n+Object.keys(x).length,0), upDone=Object.values(state.upgrades).filter(Boolean).length, exTotal=Object.values(expeditions).reduce((n,x)=>n+Object.keys(x).length,0), exDone=Object.values(state.expeditions).filter(Boolean).length; const total=blueprints.length+upTotal+exTotal,done=bpDone+upDone+exDone,p=Math.round(done/total*100);$('#overall').textContent=p+'%';$('#overallBar').style.width=p+'%';$('#bpStat').textContent=`${bpDone} / ${blueprints.length}`;$('#upStat').textContent=`${upDone} / ${upTotal}`;$('#exStat').textContent=`${exDone} / ${exTotal}`;$('#invStat').textContent=encyclopediaItems.length?encyclopediaItems.length.toLocaleString():'Loading…'; const top=materials.map(m=>({...m,need:neededFor(m),have:+state.inventory[m.id]||0})).filter(m=>m.need>m.have).sort((a,b)=>(b.need-b.have)-(a.need-a.have)).slice(0,8);$('#priorityList').innerHTML=top.length?top.map(m=>`<div class="row" data-material="${m.id}"><div><b>${esc(m.name)}</b><div class="muted">Have ${m.have} · Still needed ${Math.max(0,m.need-m.have)}</div></div><span>›</span></div>`).join(''):'<div class="empty">No outstanding tracked material requirements.</div>';$$('[data-material]').forEach(x=>x.onclick=()=>showItem(encyclopediaItems.find(i=>i.id===x.dataset.material.replaceAll('-','_'))||{...materials.find(m=>m.id===x.dataset.material),id:x.dataset.material.replaceAll('-','_'),name:{en:materials.find(m=>m.id===x.dataset.material)?.name||'Material'},description:{en:materials.find(m=>m.id===x.dataset.material)?.description||''}}))}
const itemName=i=>typeof i?.name==='object'?(i.name.en||Object.values(i.name)[0]||i.id):i?.name||i?.id||'Unknown Item';
const itemDescription=i=>typeof i?.description==='object'?(i.description.en||Object.values(i.description)[0]||''):i?.description||'';
const localMaterialById=new Map(materials.map(m=>[m.id.replaceAll('-','_'),m]));
const rarityRank={Common:1,Uncommon:2,Rare:3,Epic:4,Legendary:5};
const displayValue=n=>Number.isFinite(Number(n))?Number(n).toLocaleString():'—';
const displayWeight=n=>Number.isFinite(Number(n))?`${Number(n)} kg`:'—';
const itemImage=i=>i.imageFilename||'';
async function loadItemsEncyclopedia(){
  const status=$('#itemStatus');
  try{
    const all=[]; let offset=0; const limit=45;
    while(true){
      if(status) status.textContent=`Loading item database… ${all.length} items received`;
      const response=await fetch(`https://arcdata.mahcks.com/v1/items?full=true&offset=${offset}&limit=${limit}`);
      if(!response.ok) throw new Error(`Item API returned ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data.items)) throw new Error('Unexpected item response');
      all.push(...data.items);
      if(!data.next||data.items.length===0) break;
      offset+=limit;
      if(offset>2000) break;
    }
    encyclopediaItems=all.filter(Boolean);
    itemsLoaded=true;
    if(status) status.style.display='none';
    populateItemFilters();
    renderItems();
    renderHome();
  }catch(error){
    console.error(error);
    encyclopediaItems=materials.map(m=>({id:m.id.replaceAll('-','_'),name:{en:m.name},description:{en:m.description},type:m.category,rarity:m.rarity,stackSize:m.stackSize,value:m.sellValue,weightKg:m.weight,imageFilename:'',_fallback:true}));
    itemsLoaded=false;
    if(status){status.style.display='block';status.classList.add('item-error');status.innerHTML='The live encyclopedia could not be loaded. Showing the locally bundled progression materials instead. Check your connection and refresh to try again.';}
    populateItemFilters();
    renderItems();
    renderHome();
  }
}
function populateItemFilters(){
  const types=[...new Set(encyclopediaItems.map(i=>i.type).filter(Boolean))].sort();
  const rarities=[...new Set(encyclopediaItems.map(i=>i.rarity).filter(Boolean))].sort((a,b)=>(rarityRank[a]||99)-(rarityRank[b]||99));
  $('#itemTypeFilter').innerHTML='<option value="">All item types</option>'+types.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  $('#itemRarityFilter').innerHTML='<option value="">All rarities</option>'+rarities.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
}
function renderItems(){
  if(!$('#itemGrid')) return;
  const q=$('#itemSearch').value.trim().toLowerCase(),type=$('#itemTypeFilter').value,rarity=$('#itemRarityFilter').value,sort=$('#itemSort').value;
  const quick=['All','Materials','Weapons','Equipment','Quick Use','Blueprints'];
  $('#itemQuickFilters').innerHTML=quick.map(x=>`<button class="chip ${itemQuickFilter===x?'active':''}" data-item-quick="${esc(x)}">${esc(x)}</button>`).join('');
  $$('[data-item-quick]').forEach(b=>b.onclick=()=>{itemQuickFilter=b.dataset.itemQuick;renderItems()});
  let list=encyclopediaItems.filter(i=>{
    const name=itemName(i).toLowerCase(),desc=itemDescription(i).toLowerCase(),t=String(i.type||'');
    if(q&&!name.includes(q)&&!desc.includes(q)&&!t.toLowerCase().includes(q)) return false;
    if(type&&t!==type) return false;
    if(rarity&&i.rarity!==rarity) return false;
    if(itemQuickFilter==='Materials'&&!/material|recyclable|nature/i.test(t)) return false;
    if(itemQuickFilter==='Weapons'&&!/rifle|pistol|shotgun|sniper|smg|lmg|special|weapon/i.test(t)) return false;
    if(itemQuickFilter==='Equipment'&&!/augment|shield|modification|ammo/i.test(t)) return false;
    if(itemQuickFilter==='Quick Use'&&!/quick use|medical|grenade|mine|trap/i.test(t)) return false;
    if(itemQuickFilter==='Blueprints'&&!/blueprint/i.test(name)&&!/blueprint/i.test(t)) return false;
    return true;
  });
  list.sort((a,b)=>sort==='type'?String(a.type||'').localeCompare(String(b.type||''))||itemName(a).localeCompare(itemName(b)):sort==='rarity'?(rarityRank[b.rarity]||0)-(rarityRank[a.rarity]||0)||itemName(a).localeCompare(itemName(b)):sort==='value-high'?(Number(b.value)||0)-(Number(a.value)||0):sort==='weight-low'?(Number(a.weightKg)||9999)-(Number(b.weightKg)||9999):itemName(a).localeCompare(itemName(b)));
  $('#itemCount').textContent=`${list.length.toLocaleString()} of ${encyclopediaItems.length.toLocaleString()} items`;
  $('#itemGrid').innerHTML=list.map(i=>`<article class="card encyclopedia-card" data-item-id="${esc(i.id)}"><img class="encyclopedia-image rarity-${String(i.rarity||'').toLowerCase()}" src="${esc(itemImage(i))}" alt="${esc(itemName(i))}" loading="lazy" onerror="this.style.visibility='hidden'"><div><h3>${esc(itemName(i))}</h3><div class="item-meta"><span class="badge">${esc(i.type||'Unknown type')}</span><span class="badge">${esc(i.rarity||'Unknown rarity')}</span></div><div class="item-values"><span>Stack ${displayValue(i.stackSize)}</span><span>${displayWeight(i.weightKg)}</span><span>${displayValue(i.value)} coins</span></div></div></article>`).join('')||'<div class="card empty item-loading">No matching items.</div>';
  $$('[data-item-id]').forEach(card=>card.onclick=()=>showItem(encyclopediaItems.find(i=>i.id===card.dataset.itemId)));
}
function objectRows(obj){return obj&&typeof obj==='object'?Object.entries(obj).map(([id,qty])=>`<div class="row"><span>${esc(id.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()))}</span><b>×${esc(qty)}</b></div>`).join(''):''}
function showItem(i){
  const local=localMaterialById.get(i.id); const desc=itemDescription(i);
  const effects=i.effects&&typeof i.effects==='object'?Object.entries(i.effects):[];
  const found=Array.isArray(i.foundIn)?i.foundIn:String(i.foundIn||'').split(/[,;]/).map(x=>x.trim()).filter(Boolean);
  const uses=local?.uses||[]; const groups={upgrade:[],expedition:[],blueprint:[]}; uses.forEach(u=>(groups[u.type]||=[]).push(u));
  $('#modalBox').innerHTML=`<div class="modalhead"><img src="${esc(itemImage(i))}" alt="${esc(itemName(i))}" onerror="this.style.display='none'"><div><div class="badges"><span class="badge">${esc(i.type||'Unknown type')}</span><span class="badge">${esc(i.rarity||'Unknown rarity')}</span></div><h2>${esc(itemName(i))}</h2><p class="muted">${esc(desc||'No description is currently available.')}</p></div><button class="iconbtn close">✕</button></div>
  <div class="item-detail-stats"><div class="item-detail-stat"><span>Stack size</span><b>${displayValue(i.stackSize)}</b></div><div class="item-detail-stat"><span>Weight</span><b>${displayWeight(i.weightKg)}</b></div><div class="item-detail-stat"><span>Sell value</span><b>${displayValue(i.value)} coins</b></div></div>
  ${found.length?`<div class="detail-section"><h3>Can be found in</h3><div class="detail-tags">${found.map(x=>`<span class="detail-tag">${esc(x)}</span>`).join('')}</div></div>`:''}
  ${effects.length?`<div class="detail-section"><h3>Effects</h3>${effects.map(([k,v])=>`<div class="row"><span>${esc(k.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()))}</span><b>${esc(typeof v==='object'?JSON.stringify(v):v)}</b></div>`).join('')}</div>`:''}
  ${i.recipe?`<div class="detail-section"><h3>Crafting recipe${i.craftBench?` · ${esc(i.craftBench)}`:''}</h3>${objectRows(i.recipe)}</div>`:''}
  ${i.recyclesInto?`<div class="detail-section"><h3>Recycles into</h3>${objectRows(i.recyclesInto)}</div>`:''}
  ${i.salvagesInto?`<div class="detail-section"><h3>Salvages into</h3>${objectRows(i.salvagesInto)}</div>`:''}
  ${Object.entries(groups).filter(([,v])=>v.length).map(([g,v])=>`<div class="detail-section"><h3>Used in ${g[0].toUpperCase()+g.slice(1)}s</h3>${v.map(u=>`<div class="row"><span>${esc(u.target)}</span><b>×${u.quantity}</b></div>`).join('')}</div>`).join('')}
  <a class="external-source" href="https://arctracker.io/items/${encodeURIComponent(i.id)}" target="_blank" rel="noopener">View source item page ↗</a>`;
  $('#modal').classList.add('open');$('.close').onclick=closeModal;
}
let workbenchFilter='All';
const workbenchKey=(station,level,item)=>`${station}|${level}|${item}`;
const workbenchQty=(station,level,item)=>Math.max(0,+state.workbenchTracker[workbenchKey(station,level,item)]||0);
function setWorkbenchQty(station,level,item,value,required){
  state.workbenchTracker[workbenchKey(station,level,item)]=Math.max(0,Math.min(+value||0,required));
  const levelKey=`${station} — ${level}`;
  state.upgrades[levelKey]=Object.entries(upgrades[station][level]).every(([name,need])=>workbenchQty(station,level,name)>=need);
  save();renderAll();
}
function workbenchTotals(){
  let required=0,collected=0,entries=0,done=0; const master={};
  for(const [station,levels] of Object.entries(upgrades)) for(const [level,mats] of Object.entries(levels)) for(const [item,need] of Object.entries(mats)){
    const qty=Math.min(workbenchQty(station,level,item),need);
    required+=need; collected+=qty; entries++; if(qty>=need) done++;
    master[item]??={required:0,collected:0}; master[item].required+=need; master[item].collected+=qty;
  }
  return {required,collected,entries,done,master};
}
function workbenchStationProgress(station){
  let required=0,collected=0;
  for(const [level,mats] of Object.entries(upgrades[station])) for(const [item,need] of Object.entries(mats)){
    required+=need; collected+=Math.min(workbenchQty(station,level,item),need);
  }
  return `${collected} / ${required}`;
}
function renderUpgrades(){
  const stations=['All',...Object.keys(upgrades)];
  $('#workbenchFilters').innerHTML=stations.map(name=>`<button class="chip ${workbenchFilter===name?'active':''}" data-workbench-filter="${esc(name)}">${esc(name)}</button>`).join('');
  $$('[data-workbench-filter]').forEach(button=>button.onclick=()=>{workbenchFilter=button.dataset.workbenchFilter;renderUpgrades()});
  const query=$('#workbenchSearch').value.trim().toLowerCase(); let html='';
  for(const [station,levels] of Object.entries(upgrades)){
    if(workbenchFilter!=='All'&&workbenchFilter!==station) continue;
    let levelsHtml='';
    for(const [level,mats] of Object.entries(levels)){
      const visible=Object.entries(mats).filter(([item])=>!query||station.toLowerCase().includes(query)||level.toLowerCase().includes(query)||item.toLowerCase().includes(query));
      if(!visible.length) continue;
      levelsHtml+=`<div class="tracker-level"><h3>${esc(level)}</h3><div class="tracker-grid">`;
      for(const [item,need] of visible){
        const qty=workbenchQty(station,level,item),done=qty>=need;
        levelsHtml+=`<div class="tracker-item ${done?'done':''}"><div><div class="tracker-item-name">${esc(item)}</div><div class="muted">Need ${need}</div></div><div class="qty tracker-controls"><button data-wb-minus="${esc(workbenchKey(station,level,item))}">−</button><input data-wb-input="${esc(workbenchKey(station,level,item))}" type="number" min="0" max="${need}" value="${qty}"><button data-wb-plus="${esc(workbenchKey(station,level,item))}">+</button><input class="tracker-check" data-wb-check="${esc(workbenchKey(station,level,item))}" type="checkbox" ${done?'checked':''} aria-label="Mark ${esc(item)} complete"></div></div>`;
      }
      levelsHtml+='</div></div>';
    }
    if(levelsHtml) html+=`<article class="card tracker-station"><div class="tracker-station-title"><h2>${esc(station)}</h2><span class="muted">${workbenchStationProgress(station)}</span></div>${levelsHtml}</article>`;
  }
  $('#upgradeList').innerHTML=html||'<div class="card empty">No matching materials.</div>';
  const parseKey=k=>{const [station,level,item]=k.split('|');return {station,level,item,need:upgrades[station][level][item]}};
  $$('[data-wb-minus]').forEach(b=>b.onclick=()=>{const x=parseKey(b.dataset.wbMinus);setWorkbenchQty(x.station,x.level,x.item,workbenchQty(x.station,x.level,x.item)-1,x.need)});
  $$('[data-wb-plus]').forEach(b=>b.onclick=()=>{const x=parseKey(b.dataset.wbPlus);setWorkbenchQty(x.station,x.level,x.item,workbenchQty(x.station,x.level,x.item)+1,x.need)});
  $$('[data-wb-input]').forEach(i=>i.onchange=()=>{const x=parseKey(i.dataset.wbInput);setWorkbenchQty(x.station,x.level,x.item,i.value,x.need)});
  $$('[data-wb-check]').forEach(i=>i.onchange=()=>{const x=parseKey(i.dataset.wbCheck);setWorkbenchQty(x.station,x.level,x.item,i.checked?x.need:0,x.need)});
  const totals=workbenchTotals(),pct=totals.required?Math.round(totals.collected/totals.required*100):0;
  $('#workbenchOverallPct').textContent=pct+'%'; $('#workbenchOverallBar').style.width=pct+'%';
  $('#workbenchCollectedCount').textContent=totals.collected; $('#workbenchRequiredCount').textContent=totals.required; $('#workbenchEntryCount').textContent=`${totals.done} / ${totals.entries}`;
  $('#workbenchMasterBody').innerHTML=Object.entries(totals.master).sort((a,b)=>a[0].localeCompare(b[0])).map(([item,v])=>{const remaining=Math.max(0,v.required-v.collected);return `<tr><td>${esc(item)}</td><td>${v.collected}</td><td>${v.required}</td><td class="${remaining===0?'status-ok':'status-need'}">${remaining===0?'Complete':remaining}</td></tr>`}).join('');
}
let expeditionFilter='All';
const expeditionKey=(expedition,stage,item)=>`${expedition}|${stage}|${item}`;
const expeditionQty=(expedition,stage,item)=>Math.max(0,+state.expeditionTracker[expeditionKey(expedition,stage,item)]||0);
function setExpeditionQty(expedition,stage,item,value,required){
  state.expeditionTracker[expeditionKey(expedition,stage,item)]=Math.max(0,Math.min(+value||0,required));
  const stageKey=`${expedition} — ${stage}`;
  state.expeditions[stageKey]=Object.entries(expeditions[expedition][stage]).every(([name,need])=>expeditionQty(expedition,stage,name)>=need);
  save();renderAll();
}
function expeditionTotals(){
  let required=0,collected=0,entries=0,done=0; const master={};
  for(const [expedition,stages] of Object.entries(expeditions)) for(const [stage,mats] of Object.entries(stages)) for(const [item,need] of Object.entries(mats)){
    const qty=Math.min(expeditionQty(expedition,stage,item),need);
    required+=need; collected+=qty; entries++; if(qty>=need) done++;
    master[item]??={required:0,collected:0}; master[item].required+=need; master[item].collected+=qty;
  }
  return {required,collected,entries,done,master};
}
function expeditionProgress(expedition){
  let required=0,collected=0;
  for(const [stage,mats] of Object.entries(expeditions[expedition])) for(const [item,need] of Object.entries(mats)){
    required+=need; collected+=Math.min(expeditionQty(expedition,stage,item),need);
  }
  return `${collected.toLocaleString()} / ${required.toLocaleString()}`;
}
function renderExpeditions(){
  const names=['All',...Object.keys(expeditions)];
  $('#expeditionFilters').innerHTML=names.map(name=>`<button class="chip ${expeditionFilter===name?'active':''}" data-expedition-filter="${esc(name)}">${esc(name)}</button>`).join('');
  $$('[data-expedition-filter]').forEach(button=>button.onclick=()=>{expeditionFilter=button.dataset.expeditionFilter;renderExpeditions()});
  const query=$('#expeditionSearch').value.trim().toLowerCase(); let html='';
  for(const [expedition,stages] of Object.entries(expeditions)){
    if(expeditionFilter!=='All'&&expeditionFilter!==expedition) continue;
    let stagesHtml='';
    for(const [stage,mats] of Object.entries(stages)){
      const visible=Object.entries(mats).filter(([item])=>!query||expedition.toLowerCase().includes(query)||stage.toLowerCase().includes(query)||item.toLowerCase().includes(query));
      if(!visible.length) continue;
      stagesHtml+=`<div class="tracker-level"><h3>${esc(stage)}</h3><div class="tracker-grid">`;
      for(const [item,need] of visible){
        const qty=expeditionQty(expedition,stage,item),done=qty>=need;
        stagesHtml+=`<div class="tracker-item ${done?'done':''}"><div><div class="tracker-item-name">${esc(item)}</div><div class="muted">Need ${need.toLocaleString()}</div></div><div class="qty tracker-controls"><button data-ex-minus="${esc(expeditionKey(expedition,stage,item))}">−</button><input data-ex-input="${esc(expeditionKey(expedition,stage,item))}" type="number" min="0" max="${need}" value="${qty}"><button data-ex-plus="${esc(expeditionKey(expedition,stage,item))}">+</button><input class="tracker-check" data-ex-check="${esc(expeditionKey(expedition,stage,item))}" type="checkbox" ${done?'checked':''} aria-label="Mark ${esc(item)} complete"></div></div>`;
      }
      stagesHtml+='</div></div>';
    }
    if(stagesHtml) html+=`<article class="card tracker-station"><div class="tracker-station-title"><h2>${esc(expedition)}</h2><span class="muted">${expeditionProgress(expedition)}</span></div>${stagesHtml}</article>`;
  }
  $('#expeditionList').innerHTML=html||'<div class="card empty">No matching expedition materials.</div>';
  const parseKey=k=>{const [expedition,stage,item]=k.split('|');return {expedition,stage,item,need:expeditions[expedition][stage][item]}};
  $$('[data-ex-minus]').forEach(b=>b.onclick=()=>{const x=parseKey(b.dataset.exMinus);setExpeditionQty(x.expedition,x.stage,x.item,expeditionQty(x.expedition,x.stage,x.item)-1,x.need)});
  $$('[data-ex-plus]').forEach(b=>b.onclick=()=>{const x=parseKey(b.dataset.exPlus);setExpeditionQty(x.expedition,x.stage,x.item,expeditionQty(x.expedition,x.stage,x.item)+1,x.need)});
  $$('[data-ex-input]').forEach(i=>i.onchange=()=>{const x=parseKey(i.dataset.exInput);setExpeditionQty(x.expedition,x.stage,x.item,i.value,x.need)});
  $$('[data-ex-check]').forEach(i=>i.onchange=()=>{const x=parseKey(i.dataset.exCheck);setExpeditionQty(x.expedition,x.stage,x.item,i.checked?x.need:0,x.need)});
  const totals=expeditionTotals(),pct=totals.required?Math.round(totals.collected/totals.required*100):0;
  $('#expeditionOverallPct').textContent=pct+'%'; $('#expeditionOverallBar').style.width=pct+'%';
  $('#expeditionCollectedCount').textContent=totals.collected.toLocaleString(); $('#expeditionRequiredCount').textContent=totals.required.toLocaleString(); $('#expeditionEntryCount').textContent=`${totals.done} / ${totals.entries}`;
  $('#expeditionMasterBody').innerHTML=Object.entries(totals.master).sort((a,b)=>a[0].localeCompare(b[0])).map(([item,v])=>{const remaining=Math.max(0,v.required-v.collected);return `<tr><td>${esc(item)}</td><td>${v.collected.toLocaleString()}</td><td>${v.required.toLocaleString()}</td><td class="${remaining?'status-need':'status-ok'}">${remaining.toLocaleString()}</td></tr>`}).join('');
}
let cat='All';function renderBlueprints(){const cats=['All',...new Set(blueprints.map(b=>b.category))];$('#bpChips').innerHTML=cats.map(c=>`<button class="chip ${cat===c?'active':''}" data-cat="${c}">${c}</button>`).join('');$$('[data-cat]').forEach(x=>x.onclick=()=>{cat=x.dataset.cat;renderBlueprints()});const q=$('#blueprintSearch').value.toLowerCase(),bench=$('#benchFilter').value;let a=blueprints.filter(b=>(cat==='All'||b.category===cat)&&(!bench||b.bench===bench)&&(b.name.toLowerCase().includes(q)||String(b.description||'').toLowerCase().includes(q)));$('#blueprintGrid').innerHTML=a.map(b=>`<article class="card itemcard blueprint-card" data-bp="${b.id}"><img class="thumb" src="${b.image}?v=6" alt="${esc(b.name)}" loading="lazy"><div><h3>${esc(b.itemName)}</h3><div class="badges"><span class="badge">${esc(b.category)}</span><span class="badge">${esc(b.rarity)}</span></div><div class="muted" style="margin-top:7px">${esc(b.bench)} · ${b.materials.length} material${b.materials.length===1?'':'s'}</div></div><label class="owned" onclick="event.stopPropagation()" title="Mark blueprint owned"><input type="checkbox" data-own="${b.name}" ${state.blueprints[b.name]?'checked':''}></label></article>`).join('')||'<div class="empty">No matching blueprints.</div>';$$('[data-own]').forEach(x=>x.onchange=()=>{state.blueprints[x.dataset.own]=x.checked;save();renderAll()});$$('[data-bp]').forEach(x=>x.onclick=()=>showBlueprint(blueprints.find(b=>b.id===x.dataset.bp)))}
function showBlueprint(b){const live=encyclopediaItems.find(i=>itemName(i).toLowerCase()===b.name.toLowerCase());const description=b.description||itemDescription(live)||`Unlocks the crafting recipe for ${b.itemName}.`;const stack=b.stackSize??live?.stackSize??1,weight=b.weightKg??live?.weightKg??0,value=b.sellValue??live?.value??5000;$('#modalBox').innerHTML=`<div class="modalhead blueprint-modal-head"><img src="${b.image}?v=6" alt="${esc(b.name)}"><div><div class="badges"><span class="badge">Blueprint</span><span class="badge">${esc(b.rarity)}</span><span class="badge">${state.blueprints[b.name]?'Owned':'Not owned'}</span></div><h2>${esc(b.name)}</h2><p class="muted">${esc(description)}</p><div class="item-values"><span>Stack ${displayValue(stack)}</span><span>${displayWeight(weight)}</span><span>${displayValue(value)} coins</span></div></div><button class="iconbtn close">✕</button></div><div class="blueprint-owned-row"><label><input type="checkbox" id="modalBlueprintOwned" ${state.blueprints[b.name]?'checked':''}> Blueprint collected</label></div><h3 style="color:var(--accent)">Crafting recipe</h3><div class="row"><span>Craft Bench</span><b>${esc(b.bench)}</b></div>${b.materials.map(x=>`<div class="row recipe-row"><span>${esc(x.item)}</span><b>×${x.quantity}</b></div>`).join('')}${b.quest?`<h3 style="color:var(--accent)">Related quest</h3><div class="row"><span>${esc(b.quest.name)} · ${esc(b.quest.trader)}</span><b>Reward ×${b.quest.reward||1}</b></div>`:''}`;$('#modal').classList.add('open');$('.close').onclick=closeModal;$('#modalBlueprintOwned').onchange=e=>{state.blueprints[b.name]=e.target.checked;save();renderAll();showBlueprint(b)}}
function closeModal(){ $('#modal').classList.remove('open') }$('#modal').onclick=e=>{if(e.target===$('#modal'))closeModal()};
function renderAll(){renderHome();renderItems();renderUpgrades();renderExpeditions();renderBlueprints()}
const benches=[...new Set(blueprints.map(b=>b.bench))].sort();$('#benchFilter').innerHTML+='<option>'+benches.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');$('#itemSearch').oninput=renderItems;$('#itemTypeFilter').onchange=renderItems;$('#itemRarityFilter').onchange=renderItems;$('#itemSort').onchange=renderItems;$('#blueprintSearch').oninput=renderBlueprints;$('#benchFilter').onchange=renderBlueprints;
$('#backupBtn').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='raider-companion-save.json';a.click();URL.revokeObjectURL(a.href)};
$('#workbenchSearch').oninput=renderUpgrades;
$('#workbenchCompleteBtn').onclick=()=>{const q=$('#workbenchSearch').value.trim().toLowerCase();for(const [station,levels] of Object.entries(upgrades)){if(workbenchFilter!=='All'&&workbenchFilter!==station)continue;for(const [level,mats] of Object.entries(levels))for(const [item,need] of Object.entries(mats))if(!q||station.toLowerCase().includes(q)||level.toLowerCase().includes(q)||item.toLowerCase().includes(q))state.workbenchTracker[workbenchKey(station,level,item)]=need;}save();renderAll()};
$('#workbenchResetBtn').onclick=()=>{if(confirm('Reset every Work Bench and Scrappy material?')){state.workbenchTracker={};state.upgrades={};save();renderAll()}};
$('#workbenchExportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,tracker:'work-benches',state:state.workbenchTracker},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='arc-raiders-work-benches-save.json';a.click();URL.revokeObjectURL(a.href)};
$('#workbenchImportFile').onchange=async e=>{try{const obj=JSON.parse(await e.target.files[0].text());state.workbenchTracker={...(obj.state||obj)};save();renderAll()}catch{alert('That tracker save could not be imported.')}e.target.value=''};

$('#expeditionSearch').oninput=renderExpeditions;
$('#expeditionCompleteBtn').onclick=()=>{const q=$('#expeditionSearch').value.trim().toLowerCase();for(const [expedition,stages] of Object.entries(expeditions)){if(expeditionFilter!=='All'&&expeditionFilter!==expedition)continue;for(const [stage,mats] of Object.entries(stages))for(const [item,need] of Object.entries(mats))if(!q||expedition.toLowerCase().includes(q)||stage.toLowerCase().includes(q)||item.toLowerCase().includes(q))state.expeditionTracker[expeditionKey(expedition,stage,item)]=need;}for(const [expedition,stages] of Object.entries(expeditions))for(const [stage,mats] of Object.entries(stages))state.expeditions[`${expedition} — ${stage}`]=Object.entries(mats).every(([item,need])=>expeditionQty(expedition,stage,item)>=need);save();renderAll()};
$('#expeditionResetBtn').onclick=()=>{if(confirm('Reset every Expedition material?')){state.expeditionTracker={};state.expeditions={};save();renderAll()}};
$('#expeditionExportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,tracker:'expeditions',state:state.expeditionTracker},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='arc-raiders-expeditions-save.json';a.click();URL.revokeObjectURL(a.href)};
$('#expeditionImportFile').onchange=async e=>{try{const obj=JSON.parse(await e.target.files[0].text());state.expeditionTracker={...(obj.state||obj)};for(const [expedition,stages] of Object.entries(expeditions))for(const [stage,mats] of Object.entries(stages))state.expeditions[`${expedition} — ${stage}`]=Object.entries(mats).every(([item,need])=>expeditionQty(expedition,stage,item)>=need);save();renderAll()}catch{alert('That Expedition tracker save could not be imported.')}e.target.value=''};
nav();renderAll();loadItemsEncyclopedia();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('service-worker.js?v=6').then(r=>r.update());
