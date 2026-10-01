import {REGIONS,BY_ID,UKRAINIAN,KINDS,TECHS,SCENARIOS,outlines,regionPolygon} from './data.js';
import {createGame,endTurn,queueOrder,cancelOrder,validateOrder,validateSave,territoryCount,totalStrength,supply,route,intel,preview,income,seaLabel,chooseEvent,ORDER_NAMES,ORDER_LIMIT,otherSide,sideName} from './engine.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15m6-12v15"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 6h8"/>',
  shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  drone:'<path d="m7 7 10 10m0-10L7 17"/><circle cx="5" cy="5" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M9 9h6v6H9z"/>',
  flask:'<path d="M9 2h6m-5 0v7l-6 10a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2M7 16h10"/>',
  anchor:'<circle cx="12" cy="4" r="2"/><path d="M12 6v15M8 10h8M3 14v4l4-1m14-3v4l-4-1M3 17c2 6 16 6 18 0"/>',
  intel:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron:'<path d="m8 5 7 7-7 7"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  save:'<path d="M4 3h13l4 4v14H3V3h1Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3v1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  flag:'<path d="M5 22V3m0 0c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
  industry:'<path d="M3 21V10l6 4V8l6 4V3h5v18ZM7 17h1m4 0h1m4 0h1"/>',
  minus:'<path d="M4 12h16"/>',
  reset:'<path d="M3 9a9 9 0 1 1 1 9M3 3v6h6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>'
};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.flag}</svg>`;
const STORE='front-and-rear-save-v1';
let state=null,hasSave=false,toastTimer;
const ui={tab:'front',selected:'dnipro',mode:null,source:null,amount:30,layer:'control',zoom:1,panX:0,panY:0,logOpen:true,turnBusy:false,tutorial:0};
try {const saved=localStorage.getItem(STORE);if(saved){state=validateSave(JSON.parse(saved));hasSave=true;}}catch{ /* A broken old save cannot prevent starting a new campaign. */ }
if(!state) state=createGame({seed:4262026});
if(hasSave)ui.tutorial=1;
if(state.side==='ru') ui.selected='donetsk';
const polygons=Object.fromEntries(REGIONS.map(r=>[r.id,regionPolygon(r)]));
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));hasSave=true;}catch{toast('Автозбереження недоступне. Експортуйте партію у файл.');}}
function faction(){return state.factions[state.side];}
function btn(action,label,options=''){return `<button data-action="${action}" ${options}>${label}</button>`;}
function stat(label,value,sub,ic){return `<div class="stat"><span class="stat-icon">${icon(ic)}</span><div><span class="micro">${label}</span><strong>${value}</strong><small>${sub}</small></div></div>`;}
function render(){
  const f=faction(),count=territoryCount(state),max=SCENARIOS[state.scenario].turns;
  $('#app').innerHTML=`
  <header class="topbar">
    <a href="#" class="brand" data-action="menu" aria-label="Меню кампанії"><span class="brand-mark">Ф<span>Т</span></span><span>ФРОНТ <i>І</i> ТИЛ<small>СТРАТЕГІЧНА КАМПАНІЯ</small></span></a>
    <div class="top-status"><span class="live-dot"></span> ${sideName(state.side)} <span class="divider">/</span> ${SCENARIOS[state.scenario].name} <span class="version">АЛЬФА 0.1</span></div>
    <div class="top-actions">${btn('save',icon('save')+'<span>Збереження</span>','title="Збереження та експорт"')}${btn('help',icon('help'),'aria-label="Правила гри" title="Правила · ?"')}${btn('menu',icon('reset'),'aria-label="Нова кампанія" title="Нова кампанія"')}</div>
  </header>
  <div class="command-bar">
    <div class="week"><span class="micro">ТИЖДЕНЬ КАМПАНІЇ</span><strong>${String(Math.min(state.turn,max)).padStart(2,'0')}<span> / ${max}</span></strong></div>
    ${stat('БЮДЖЕТ',f.budget,`+${income(state,state.side)} / хід`,'industry')}
    ${stat('РЕЗЕРВ',f.reserve,'+12 / хід','plus')}
    ${stat('СИЛИ',totalStrength(state,state.side),'умовні одиниці','shield')}
    ${stat('КОНТРОЛЬ УКРАЇНИ',`${count}<em> / 25</em>`,state.side==='ua'?'секторів під вашим контролем':'секторів під контролем України','flag')}
    <div class="phase"><span class="live-dot"></span><div><b>${state.winner?'Кампанію завершено':'Фаза планування'}</b><small>${state.winner?'Підсумки доступні в меню':'Накази ще можна скасувати'}</small></div></div>
  </div>
  <main class="workspace">
    <nav class="rail" aria-label="Розділи керування">
      ${[['front','map','Фронт'],['tech','flask','Технології'],['ops','intel','Операції'],['sea','anchor','Море']].map(([tab,ic,label])=>`<button data-action="tab" data-tab="${tab}" class="rail-item ${ui.tab===tab?'active':''}" title="${label}" aria-label="${label}" aria-pressed="${ui.tab===tab}">${icon(ic,22)}<span>${label==='Технології'?'Техно':label}</span></button>`).join('')}
      <div class="rail-bottom"><span class="rail-line"></span><b>${state.side.toUpperCase()}</b><small>ШТАБ</small></div>
    </nav>
    <section class="theater" aria-label="Карта кампанії">
      <div class="map-toolbar"><div><span class="micro">ОПЕРАТИВНА КАРТА</span><h1>${ui.mode?'Виберіть ціль на карті':'Ситуація на фронті'}</h1><p>${ui.mode?modeHint():'Територія · постачання · глибина оборони'}</p></div><div class="layer-switch" aria-label="Шар карти">${btn('layer','Контроль',`data-layer="control" class="${ui.layer==='control'?'active':''}" aria-pressed="${ui.layer==='control'}"`)}${btn('layer','Постачання',`data-layer="supply" class="${ui.layer==='supply'?'active':''}" aria-pressed="${ui.layer==='supply'}"`)}</div></div>
      <div class="map-frame" id="map-frame">
        ${mapSVG()}
        <div class="map-coordinate">48° N &nbsp; 32° E<br><span>СХЕМАТИЧНІ ІГРОВІ СЕКТОРИ</span></div>
        <div class="compass"><span>N</span><svg viewBox="0 0 30 40" aria-hidden="true"><path d="m15 2 8 28-8-7-8 7Z" fill="#d7b77a"/><path d="m15 2 0 21-8 7Z" fill="#506069"/></svg></div>
        <div class="map-controls">${btn('zoom-in',icon('plus'),'aria-label="Збільшити карту" title="Збільшити · +"')}${btn('zoom-out',icon('minus'),'aria-label="Зменшити карту" title="Зменшити · −"')}${btn('map-reset',icon('target'),'aria-label="Показати всю карту" title="Показати всю карту · 0"')}</div>
        <div class="map-legend"><span><i class="legend-ua"></i> Україна</span><span><i class="legend-ru"></i> Росія</span><span><i class="legend-neutral"></i> Нейтральні</span><span class="legend-fog">${icon('intel',13)} Діапазон = оцінка</span></div>
        ${ui.mode?`<div class="target-banner">${icon(ui.mode==='attack'?'target':'route')} ${esc(modeHint())} ${btn('cancel-mode','Скасувати '+icon('close',14))}</div>`:''}
      </div>
      <div class="map-footer"><span>${icon('route',14)} Перетягуйте карту · колесо для масштабу</span><span>Планування одночасне <i>→</i> виконання після ходу</span></div>
      ${logPanel()}
    </section>
    <aside class="sidebar" aria-label="Штаб керування">
      ${missionPanel()}
      <div class="side-content">${state.event?eventPanel():''}${ui.tab==='front'?regionPanel():ui.tab==='tech'?techPanel():ui.tab==='ops'?opsPanel():seaPanel()}</div>
      ${ordersPanel()}
    </aside>
  </main>
  <input type="file" id="import-file" accept="application/json,.json" hidden>
  `;
  updateViewbox();bindMap();
}
function modeHint(){if(ui.mode==='attack')return `Наступ із сектора ${BY_ID[ui.source].name} · виберіть сусідній ворожий сектор`;if(ui.mode==='move')return `${ui.amount} сили із сектора ${BY_ID[ui.source].name} · виберіть власний сектор`;return 'Виберіть ворожий сектор для '+(ui.mode==='strike'?'удару по тилу':'розвідки');}
function mapSVG(){
  const mine=state.side,selected=ui.selected;
  const regions=REGIONS.map(r=>{
    const v=state.regions[r.id],info=intel(state,r.id),sup=supply(state,r.id);
    const canTarget=ui.mode==='attack'?v.owner===otherSide(mine)&&BY_ID[ui.source].neighbors.includes(r.id):ui.mode==='move'?v.owner===mine&&r.id!==ui.source&&!!route(state,ui.source,r.id,mine):['recon','strike'].includes(ui.mode)?v.owner===otherSide(mine):false;
    let fill=v.owner==='ua'?'#244340':v.owner==='ru'?'#563b38':'#283039';
    if(ui.layer==='supply'&&v.owner===mine) fill=['#70423b','#76633c','#27504b'][sup.level];
    return `<g class="sector ${r.id===selected?'selected':''} ${canTarget?'targetable':''}" role="button" tabindex="0" data-region="${r.id}" aria-label="${esc(r.name)}, ${sideName(v.owner)}, сила ${info.label}" aria-pressed="${r.id===selected}">
      <title>${r.name} · ${v.owner==='neutral'?'Нейтральний сектор':sideName(v.owner)} · ${info.label} сили${v.owner===mine?' · '+sup.label+' постачання':''}</title>
      <polygon points="${polygons[r.id]}" fill="${fill}" class="sector-land"/>
      ${v.damage?`<polygon points="${polygons[r.id]}" fill="url(#damage-pattern)" pointer-events="none"/>`:''}
      <g class="sector-label" transform="translate(${r.x},${r.y})" pointer-events="none"><text class="sector-name" y="-22">${esc(({khmelnytskyi:'Хмельниц.',kropyvnytskyi:'Кропивниц.',rear:'Промисловий тил'})[r.id]||r.name)}</text><text class="sector-strength" y="9">${v.owner==='neutral'?'—':info.label}</text><rect x="-16" y="17" width="32" height="2" rx="1" fill="#121c22"/>${v.owner!=='neutral'?`<rect x="-16" y="17" width="${info.exact?v.readiness*0.32:24}" height="2" rx="1" fill="${v.owner==='ua'?'#80c5bc':'#d38d7e'}" opacity="${info.exact?1:0.4}"/>`:''}${v.fort?`<text class="fort-label" y="31">${'▱'.repeat(v.fort)}</text>`:''}</g>
      ${state.orders.some(o=>o.source===r.id)?`<circle cx="${r.x+28}" cy="${r.y-24}" r="5" fill="#d7b77a"/>`:''}
    </g>`;
  }).join('');
  const supplyLines=ui.layer==='supply'?REGIONS.filter(r=>state.regions[r.id].owner===mine).flatMap(r=>r.neighbors.filter(id=>state.regions[id].owner===mine&&r.id<id).map(id=>`<line x1="${r.x}" y1="${r.y}" x2="${BY_ID[id].x}" y2="${BY_ID[id].y}" class="supply-link"/>`)).join(''):'';
  const arrows=state.orders.filter(o=>['attack','move','strike','recon'].includes(o.type)).map(o=>{
    if(!o.source)return `<circle cx="${BY_ID[o.target].x}" cy="${BY_ID[o.target].y}" r="28" class="target-ring"/>`;
    const a=BY_ID[o.source],b=BY_ID[o.target];return `<path d="M${a.x},${a.y} Q${(a.x+b.x)/2},${(a.y+b.y)/2-30} ${b.x},${b.y}" class="order-arrow ${o.type}" marker-end="url(#arrowhead)"/>`;
  }).join('');
  const transits=state.transits.filter(t=>t.side===mine).map(t=>{const r=BY_ID[t.current];return `<g transform="translate(${r.x-35},${r.y+28})"><rect width="50" height="19" rx="4" fill="#d7b77a"/><text x="25" y="13" fill="#142025" text-anchor="middle" font-size="11" font-weight="700">→ ${t.amount}</text></g>`;}).join('');
  return `<svg id="game-map" viewBox="0 0 1240 820" role="group" aria-label="Карта секторів. Виберіть сектор для керування військами." tabindex="0">
    <defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#23333b" stroke-width=".6"/></pattern><pattern id="damage-pattern" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2 2-2M0 8 8 0M6 10 10 6" stroke="#e9bb77" stroke-opacity=".16"/></pattern><marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#e1bb78"/></marker><radialGradient id="mapglow"><stop stop-color="#1b2c32"/><stop offset="1" stop-color="#101b23"/></radialGradient></defs>
    <rect x="-3000" y="-3000" width="7240" height="6820" fill="url(#mapglow)"/><rect x="-3000" y="-3000" width="7240" height="6820" fill="url(#grid)"/>
    <g class="map-context"><text x="152" y="235">ПОЛЬЩА</text><text x="194" y="590">РУМУНІЯ</text><text x="480" y="64">БІЛОРУСЬ</text><text x="865" y="40">РОСІЯ</text><text x="495" y="735" class="sea-name">ЧОРНЕ МОРЕ</text><text x="850" y="651" class="sea-name small-sea">АЗОВСЬКЕ МОРЕ</text><path d="M149 270 103 321 122 431 92 495M355 598 328 657 450 693" class="context-border"/></g>
    <path d="M595 270 Q580 363 601 422 T644 537 L664 608" class="river"/>
    ${regions}
    <g pointer-events="none">${Object.values(outlines).map(points=>`<polygon points="${points.map(p=>p.join(',')).join(' ')}" class="country-border"/>`).join('')}${supplyLines}${arrows}${transits}
    <path d="M463 602 Q530 685 606 680" class="sea-route"/><circle cx="475" cy="641" r="3" fill="#80c5bc"/><text x="405" y="666" class="sea-status">${state.sea>=2?'ВІДКРИТЕ СПОЛУЧЕННЯ':state.sea<=-2?'МОРСЬКА БЛОКАДА':'СПОЛУЧЕННЯ ПІД ЗАГРОЗОЮ'}</text>
    <text x="546" y="777" class="map-scale">0 ━━━━━ 200 км · умовний масштаб</text></g>
  </svg>`;
}
function missionPanel(){
  const max=SCENARIOS[state.scenario].turns,ours=state.side==='ua';
  const text=ours?(state.scenario==='defense'?'Утримати Київ та 19 секторів до 20-го тижня.':'Повернути всі 25 секторів. Утримати їх два ходи.'):'Взяти Київ або зірвати ціль України до кінця кампанії.';
  return `<section class="mission"><span class="micro">${icon('flag',13)} ЗАВДАННЯ КАМПАНІЇ</span><div><h2>${state.winner?(state.winner.side===state.side?'Місію виконано':'Місію не виконано'):SCENARIOS[state.scenario].name}</h2><span class="mission-count">${max-Math.min(state.turn-1,max)} <small>тиж.</small></span></div><p>${state.winner?esc(state.winner.reason):text}</p><div class="mission-track"><i style="width:${territoryCount(state)/25*100}%"></i></div>${state.hold&&!state.winner?'<small class="good">Утримання території: 1 / 2 ходи</small>':''}</section>`;
}
function regionPanel(){
  const id=ui.selected,r=BY_ID[id],v=state.regions[id],own=v.owner===state.side,info=intel(state,id),sup=supply(state,id);
  const pending=state.orders.find(o=>o.source===id),supTone=['danger','warn','good'][sup.level];
  if(v.owner==='neutral')return `<section class="region-card"><span class="micro">НЕЙТРАЛЬНИЙ СЕКТОР</span><h2>${r.name}</h2><p>Білорусь у цих сценаріях нейтральна. Її територія не доступна для пересування чи наступу.</p><div class="note">Північна загроза йде через видимі російські сектори Брянська та Курська.</div></section>`;
  const can=(type)=>!state.winner&& !validateOrder(state,{type,source:id,target:own?r.neighbors.find(n=>state.regions[n].owner===otherSide(state.side)):id});
  const sourceNeighbor=!own?r.neighbors.find(n=>state.regions[n].owner===state.side):null;
  return `<section class="region-card ${own?'own-card':''}">
    <div class="section-top"><span class="micro">${own?'ВАШЕ УГРУПОВАННЯ':'ОЦІНКА ПРОТИВНИКА'}</span><span class="owner-pill ${v.owner}">${sideName(v.owner)}</span></div>
    <h2>${r.name}</h2><p class="region-kind">${icon(r.kind==='logistics'?'route':r.kind==='port'?'anchor':r.kind==='capital'?'flag':'industry',14)} ${KINDS[r.kind]}${own?`<span class="region-quick" title="Сила та готовність">${v.strength} сили · ${v.readiness}%</span>`:''}</p>
    <div class="force-card"><div><span class="micro">СИЛА УГРУПОВАННЯ</span><strong>${info.label}</strong></div><span class="force-symbol">${icon('shield',32)}</span></div>
    <div class="readiness"><div><span>Готовність</span><b>${info.exact?v.readiness+'%':'невідома'}</b></div><div class="meter"><i style="width:${info.exact?v.readiness:0}%"></i></div></div>
    ${own?`<div class="info-row"><span>Постачання</span><b class="${supTone}"><i class="status-dot"></i>${sup.label}</b></div><div class="info-row"><span>Місткість сектора</span><b>${sup.capacity} сили</b></div>`:`<div class="note">${info.exact?'Розвіддані актуальні до тижня '+v.intel[state.side]+'.':'Чисельність оцінена діапазоном. Розвідка відкриє точні показники на три ходи.'}</div>`}
    <div class="info-row"><span>Укріплення</span><b>${v.fort} / 3</b></div>
    ${v.damage?`<div class="damage-note">${icon('bolt',14)} Вузол пошкоджений · ${v.damage} ходи до ремонту</div>`:''}
    ${own?`<div class="action-grid">${btn('mode',icon('target')+'Наступ',`data-mode="attack" data-source="${id}" ${can('attack')?'':'disabled'} class="action-primary"`)}${btn('mode',icon('route')+'Перекинути',`data-mode="move" data-source="${id}" ${!pending&&v.strength>=15&&!state.winner&&state.orders.length<4?'':'disabled'}`)}${btn('order',icon('plus')+'Поповнити <small>20 ◈</small>',`data-type="reinforce" data-source="${id}" ${can('reinforce')?'':'disabled'}`)}${btn('order',icon('clock')+'Відновити <small>8 ◈</small>',`data-type="recover" data-source="${id}" ${can('recover')?'':'disabled'}`)}${btn('order',icon('shield')+'Укріпити <small>14 ◈</small>',`data-type="fortify" data-source="${id}" ${can('fortify')?'':'disabled'} class="span-two"`)}</div>
    ${ui.mode==='move'&&ui.source===id?`<div class="movement-form"><label for="amount">Перекинути <strong id="amount-label">${ui.amount}</strong> сили</label><input id="amount" type="range" min="5" max="${Math.floor(v.strength-10)}" value="${ui.amount}"><small>10 сили залишаються для оборони. Виберіть пункт призначення на карті.</small></div>`:''}
    ${pending?`<div class="note good">${icon('check',14)} Наказ заплановано: ${ORDER_NAMES[pending.type]}. Скасування — в черзі нижче.</div>`:''}
    <div class="neighbors"><span class="micro">СУСІДНІ ВОРОЖІ СЕКТОРИ</span>${r.neighbors.filter(n=>state.regions[n].owner===otherSide(state.side)).map(n=>{const p=preview(state,id,n);return `<button data-action="attack-target" data-source="${id}" data-target="${n}" ${pending||state.winner?'disabled':''}><span>${BY_ID[n].name}</span><small class="${p.tone}">${p.label}</small>${icon('chevron',14)}</button>`;}).join('')||'<p>Тиловий сектор. Перекиньте сили ближче до фронту.</p>'}</div>`:
    `<div class="action-grid">${btn('order',icon('intel')+'Розвідка <small>6 ◈</small>',`data-type="recon" data-target="${id}" ${can('recon')?'':'disabled'}`)}${btn('order',icon('target')+'Удар <small>26 ◈</small>',`data-type="strike" data-target="${id}" ${can('strike')?'':'disabled'}`)}</div>${sourceNeighbor?`<div class="note">Наступ можна розпочати із сусіднього власного сектора. ${btn('select','Обрати '+BY_ID[sourceNeighbor].name,`data-id="${sourceNeighbor}" class="text-button"`)}</div>`:''}`}
    ${own&&ui.tutorial===0?`<div class="tutorial-note"><b>Перший хід</b><p>${state.side==='ua'?'Перекиньте західні резерви до фронту, укріпіть Чернігів і почніть дослідження дронів. Для наступу на Херсон доступні Миколаїв та Дніпро.':'Підсилюйте фронт із тилових регіонів, розвивайте дрони й перевіряйте слабкі сектори розвідкою. Перешкодьте українській цілі кампанії або візьміть Київ.'}</p></div>`:''}
  </section>`;
}
function techPanel(){
  const f=faction();
  return `<section class="tech-panel"><span class="micro">ІНВЕСТИЦІЇ У ПЕРЕВАГУ</span><h2>Технології</h2><p>Одне дослідження одночасно. Покращення впроваджується автоматично після підготовки.</p>${f.project?`<div class="project-status">${icon('flask')}<div><b>${TECHS[f.project.tech].name}</b><small>До впровадження: ${f.project.remaining} ходи</small></div></div>`:''}
  ${Object.entries(TECHS).map(([key,t])=>{const error=validateOrder(state,{type:'research',tech:key}),level=f.tech[key];return `<article class="tech-card"><div class="tech-heading"><span class="tech-icon">${icon(t.icon,23)}</span><div><h3>${t.name}</h3><div class="tech-level">${[1,2,3].map(n=>`<i class="${level>=n?'unlocked':''}"></i>`).join('')}<span>Рівень ${level} / 3</span></div></div></div><p>${t.description}</p><div class="tech-bottom"><span>${level>=3?'Завершено':`${t.cost+level*25} ◈ · ${t.time} ходи`}</span>${btn('research',level>=3?icon('check'):'Дослідити '+icon('arrow',13),`data-tech="${key}" ${error?'disabled':''} title="${esc(error||'Розпочати дослідження')}"`)}</div></article>`;}).join('')}</section>`;
}
function opsPanel(){
  const f=faction(),progress=f.special?.progress||0,ready=progress>=2;
  return `<section><span class="micro">ВПЛИВ ЗА МЕЖАМИ ФРОНТУ</span><h2>Тилові операції</h2><p>Послаблюйте забезпечення противника, щоб створити можливість на фронті.</p>
  <article class="operation-card"><span class="tech-icon">${icon('intel',26)}</span><h3>Розвідка сектора</h3><p>Точна сила й готовність на три ходи. Інформація старіє: перевіряйте оцінку перед наступом.</p>${btn('mode','Вибрати ціль <small>6 ◈</small>',`data-mode="recon" ${state.winner||state.orders.length>=4||f.budget<6?'disabled':''}`)}</article>
  <article class="operation-card"><span class="tech-icon">${icon('target',26)}</span><h3>Удар по тилу</h3><p>Пошкоджує виробничий чи логістичний вузол, знижує дохід і готовність. Захист противника скорочує тривалість ефекту.</p>${btn('mode',f.tech.strike?'Вибрати ціль <small>26 ◈</small>':'Потрібна технологія далеких ударів',`data-mode="strike" ${state.winner||!f.tech.strike||state.orders.length>=4||f.budget<26?'disabled':''}`)}</article>
  <article class="operation-card special-card"><span class="micro">СПЕЦІАЛЬНИЙ ПРОЄКТ</span><h3>Тиха хвиля</h3><p>Одна підготовлювана операція. Порушує до трьох тилових вузлів на 2–5 ходів. Ризик викриття: ${Math.round((0.25-progress*0.035)*100)}%.</p><div class="special-progress">${[1,2,3,4,5].map(n=>`<i class="${progress>=n?'active':''}"></i>`).join('')}</div><div class="info-row"><span>Підготовка</span><b>${f.special?progress+' / 5':'Не розпочата'}</b></div>${btn('special',f.special?(ready?'Провести операцію':'Готується · ще '+(2-progress)+' ходи'):'Почати підготовку <small>45 ◈</small>',`data-execute="${!!f.special}" ${validateOrder(state,{type:'special',execute:!!f.special})?'disabled':''}`)}</article></section>`;
}
function seaPanel(){
  return `<section><span class="micro">ЧОРНОМОРСЬКИЙ ТЕАТР</span><h2>Морське сполучення</h2><p>Контроль моря впливає на доходи портів та постачання прибережних секторів.</p><div class="sea-illustration">${icon('anchor',68)}<span class="sea-wave"></span></div><h3 class="sea-heading">${seaLabel(state)}</h3><div class="sea-balance">${[-3,-2,-1,0,1,2,3].map(n=>`<i class="${state.sea===n?'selected':''}"></i>`).join('')}</div><div class="sea-labels"><span>Росія</span><span>Україна</span></div><article class="operation-card"><h3>Операція на морі</h3><p>Зсуває вплив на ${1+Math.floor(faction().tech.naval/2)} крок${faction().tech.naval<2?'':'и'} на вашу користь. Кожні п’ять ходів вплив слабшає на один крок.</p>${btn('order',icon('anchor')+'Провести операцію <small>18 ◈</small>',`data-type="naval" ${validateOrder(state,{type:'naval'})?'disabled':''}`)}</article><div class="note">Морські системи можна покращити в розділі «Технології». Сухопутні війська не витрачаються.</div></section>`;
}
function eventPanel(){return `<section class="event-card"><span class="micro">ПОДІЯ З ВИБОРОМ</span><h3>${esc(state.event.title)}</h3><p>${esc(state.event.description)}</p><div>${btn('event','+35 резерву','data-choice="reserve"')}${btn('event','+45 бюджету','data-choice="budget"')}</div></section>`;}
function ordersPanel(){
  return `<section class="orders-panel"><div class="section-top"><h3>План на тиждень</h3><span class="order-count">${state.orders.length} / ${ORDER_LIMIT}</span></div>
    <div class="order-list">${state.orders.length?state.orders.map((o,index)=>`<div class="queued-order"><span class="order-number">${index+1}</span><div><b>${ORDER_NAMES[o.type]}</b><small>${o.type==='research'?TECHS[o.tech].name:o.source?BY_ID[o.source].name+(o.target?' → '+BY_ID[o.target].name:''):o.target?BY_ID[o.target].name:o.type==='special'?(o.execute?'Виконання':'Підготовка'):'Чорне море'}</small></div>${btn('cancel-order',icon('close',14),`data-index="${index}" aria-label="Скасувати наказ ${index+1}" title="Скасувати та повернути витрати"`)}</div>`).join(''):`<div class="orders-empty">${icon('route',20)}<span>Виберіть сектор на карті<br>й заплануйте перший наказ</span></div>`}</div>
    ${state.winner?btn('results','Підсумки кампанії '+icon('arrow'),'class="end-turn"'):btn('end-turn',`Завершити хід ${icon('arrow')}<small>Enter</small>`,`class="end-turn" ${ui.turnBusy||state.event?'disabled':''}`)}
    <small class="end-turn-note">${state.event?'Спочатку оберіть підтримку в події вище.':'Автозбереження після кожної зміни'}</small>
  </section>`;
}
function logPanel(){
  const recent=state.log.slice(0,10),latest=state.turn-1;
  return `<section class="journal ${ui.logOpen?'':'collapsed'}"><div class="journal-header"><h2>${icon('clock',16)} Оперативний журнал <span>ТИЖДЕНЬ ${String(Math.max(1,latest)).padStart(2,'0')}</span></h2>${btn('toggle-log',ui.logOpen?'Згорнути':'Розгорнути','class="text-button"')}</div><div class="journal-entries">${recent.map(l=>`<article class="journal-entry ${l.type}"><span class="log-symbol">${icon({battle:'target',move:'route',capture:'flag',tech:'flask',strike:'bolt',naval:'anchor',intel:'intel',supply:'shield'}[l.type]||'clock',16)}</span><div><b>${esc(l.title)}</b><p>${esc(l.detail)}</p></div><small>${l.side?sideName(l.side):'Штаб'} · ${l.turn}</small></article>`).join('')}</div></section>`;
}
function updateViewbox(){const svg=$('#game-map');if(!svg)return;const w=1240/ui.zoom,h=820/ui.zoom;ui.panX=Math.max(-400,Math.min(1000,ui.panX));ui.panY=Math.max(-300,Math.min(650,ui.panY));svg.setAttribute('viewBox',`${(1240-w)/2+ui.panX} ${(820-h)/2+ui.panY} ${w} ${h}`);const bounds=svg.getBoundingClientRect(),scale=Math.min(bounds.width/w,bounds.height/h);svg.style.setProperty('--force-font',`${Math.max(18,Math.min(28,12/Math.max(.1,scale)))}px`);svg.classList.toggle('compact-labels',scale<.55);}
function zoom(delta){ui.zoom=Math.max(0.8,Math.min(3.5,ui.zoom+delta));updateViewbox();}
function bindMap(){
  const frame=$('#map-frame'),svg=$('#game-map');let drag=null,moved=false;
  frame.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?0.12:-0.12);},{passive:false});
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,panX:ui.panX,panY:ui.panY,pointerId:e.pointerId};moved=false;});
  svg.addEventListener('pointermove',e=>{
    if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.hypot(dx,dy)>5){moved=true;svg.setPointerCapture(e.pointerId);const scale=1240/ui.zoom/svg.getBoundingClientRect().width;ui.panX=drag.panX-dx*scale;ui.panY=drag.panY-dy*scale;updateViewbox();svg.classList.add('dragging');}
  });
  svg.addEventListener('pointerup',e=>{if(drag){drag=null;svg.classList.remove('dragging');if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);}});
  svg.addEventListener('pointercancel',()=>{drag=null;moved=false;});
  svg.addEventListener('click',e=>{if(moved){moved=false;return;}const sector=e.target.closest('[data-region]');if(sector)selectRegion(sector.dataset.region);});
  svg.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.dataset.region){e.preventDefault();selectRegion(e.target.dataset.region);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();ui.panX+=e.key==='ArrowLeft'?-40:e.key==='ArrowRight'?40:0;ui.panY+=e.key==='ArrowUp'?-40:e.key==='ArrowDown'?40:0;updateViewbox();}});
  $('#amount')?.addEventListener('input',e=>{ui.amount=Number(e.target.value);$('#amount-label').textContent=ui.amount;$('.map-toolbar p').textContent=modeHint();const banner=$('.target-banner');if(banner){for(const child of banner.childNodes)if(child.nodeType===Node.TEXT_NODE)child.textContent=' '+modeHint()+' ';}});
  $('#import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;if(file.size>1_000_000){toast('Файл завеликий для збереження.');return;}
    try{const imported=validateSave(JSON.parse(await file.text()));state=imported;ui.mode=null;ui.selected=state.side==='ua'?'dnipro':'donetsk';ui.tutorial=1;save();render();closeModal();toast('Кампанію відновлено з файлу.');}catch(error){toast(error.message.startsWith('Файл')?error.message:'Не вдалося прочитати файл збереження.');}
  });
}
function selectRegion(id){
  if(ui.mode){
    const order={type:ui.mode,target:id};if(ui.source)order.source=ui.source;if(ui.mode==='move')order.amount=ui.amount;
    const result=queueOrder(state,order);if(!result.ok){toast(result.error);return;}
    ui.mode=null;ui.source=null;ui.tutorial=1;save();render();toast('Наказ додано до плану.');return;
  }
  ui.selected=id;ui.tab='front';render();
}
function addOrder(order){const result=queueOrder(state,order);if(!result.ok){toast(result.error);return;}ui.tutorial=1;ui.mode=null;save();render();toast('Наказ заплановано.');}
function startMode(mode,source){ui.mode=mode;ui.source=source||null;if(source){ui.selected=source;ui.amount=Math.max(5,Math.min(Math.floor(state.regions[source].strength-10),Math.floor(state.regions[source].strength*0.5)));}render();}

function showModal(content,wide=false){const root=$('#modal-root');root.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="Меню гри">${content}</section></div>`;root.dataset.previousFocus=document.activeElement?.id||'';$('#app').inert=true;root.querySelector('button:not([disabled]),select,input')?.focus();}
function closeModal(){const focus=$('#modal-root').dataset.previousFocus;$('#modal-root').innerHTML='';$('#app').inert=false;if(focus&&document.getElementById(focus))document.getElementById(focus).focus();else $('.top-actions button')?.focus();}
function welcome(){
  showModal(`<div class="welcome-art"><div class="welcome-grid"></div><span class="welcome-coordinate">ОПЕРАТИВНИЙ ШТАБ / 01</span><div class="welcome-emblem">${icon('map',100)}</div><span class="welcome-label">ТЕРИТОРІЯ. РЕСУРСИ. ЧАС.</span></div><div class="welcome-body"><span class="micro">ПОКРОКОВА СТРАТЕГІЯ</span><h1>Фронт <i>і</i> тил<span>Кожен наказ<br>має свою ціну.</span></h1><p>Поверніть територію, збережіть сили, інвестуйте в перевагу. Чотири накази на тиждень — і жодної можливості встигнути все.</p><div class="setup-grid"><label>Сторона<select id="setup-side"><option value="ua">Україна</option><option value="ru">Росія</option></select></label><label>Складність<select id="setup-difficulty"><option value="normal">Звичайна</option><option value="hard">Досвідчений противник</option></select></label></div><fieldset class="scenario-choice"><legend>Кампанія</legend>${Object.entries(SCENARIOS).map(([key,s],i)=>`<label><input type="radio" name="scenario" value="${key}" ${i===0?'checked':''}><span><b>${s.name}</b><small>${s.tag}</small></span></label>`).join('')}</fieldset>${btn('start-game','Розпочати кампанію '+icon('arrow'),'class="end-turn"')}${hasSave?btn('continue','Продовжити збереження · тиждень '+state.turn,'class="continue-button"'):''}<small class="welcome-footnote">Самостійна гра, натхненна «Битвою за Україну».<br>Схематична карта та умовні сценарії. Працює локально.</small></div>`,true);
}
function help(){showModal(`<div class="modal-head"><span class="micro">ПОЛЬОВИЙ ПОСІБНИК</span>${btn('close-modal',icon('close'),'aria-label="Закрити правила"')}</div><h2>Як керувати кампанією</h2><ol class="help-steps"><li><b>Виберіть свій сектор.</b><p>Сила — кількість умовних ресурсів угруповання. Готовність впливає на бій. Постачання підтримує готовність і запобігає виснаженню.</p></li><li><b>Заплануйте до чотирьох наказів.</b><p>Один сектор — один наказ. Наступ можливий лише до сусіднього ворога. Перекидання йде через власні сектори, один сектор за хід. Поповнення прибуває наступного ходу.</p></li><li><b>Розвивайте тил.</b><p>Бюджет потрібен для резервів, ремонту, укріплень і досліджень. Перевантажені, пошкоджені або відрізані сектори втрачають ефективність. Наказ «Відновити» також прискорює ремонт.</p></li><li><b>Завершіть хід і прочитайте журнал.</b><p>Противник планує незалежно. Бої розраховуються одночасно; ослаблений захисник може відступити. Після захоплення 45% сил наступу переходять у новий сектор.</p></li></ol><div class="help-grid"><div><b>Туман війни</b><p>Без розвідки ворог показаний діапазоном із кроком 25. Прогноз бою приблизний.</p></div><div><b>Постачання</b><p>Потрібен власний шлях до Києва / промислового тилу. Критичне постачання зменшує силу на 2,5% за хід.</p></div><div><b>Технології</b><p>П'ять напрямів, три рівні. Одне дослідження одночасно; потрібні бюджет, наказ і час.</p></div><div><b>Умови перемоги</b><p>Україна: повернути 25 секторів на два ходи або втримати 19 у сценарії оборони. Росія: взяти Київ або зірвати українську ціль.</p></div></div><div class="note">Enter — завершити хід · Esc — скасувати вибір цілі · + / − — масштаб · 0 — вся карта · ? — правила. Автозбереження зберігається в цьому браузері.</div>${btn('close-modal','До карти '+icon('arrow'),'class="end-turn"')}`);}
function saveMenu(){showModal(`<div class="modal-head"><span class="micro">ЗБЕРЕЖЕННЯ КАМПАНІЇ</span>${btn('close-modal',icon('close'),'aria-label="Закрити"')}</div><h2>Поверніться до свого плану</h2><p>Автозбереження працює після кожного наказу й ходу. Файл дозволяє перенести партію до іншого браузера.</p><div class="save-summary"><b>${sideName(state.side)} · ${SCENARIOS[state.scenario].name}</b><span>Тиждень ${state.turn} · ${state.orders.length} запланованих наказів</span></div><div class="save-buttons">${btn('export',icon('download')+'Експортувати JSON')}${btn('import',icon('upload')+'Імпортувати JSON')}</div>${btn('save-text','Показати JSON для ручного збереження','class="text-button"')}<p class="small-copy">Імпорт замінить поточну партію. За потреби спочатку експортуйте її.</p>${btn('close-modal','До карти','class="end-turn"')}`);}
function results(){
  const win=state.winner.side===state.side,turns=state.history.length;
  showModal(`<div class="result-icon ${win?'good':'warn'}">${icon(win?'flag':'shield',52)}</div><span class="micro">КАМПАНІЮ ЗАВЕРШЕНО</span><h2>${win?'Місію виконано':'Фронт потребує нового плану'}</h2><p>${esc(state.winner.reason)}</p><div class="result-stats"><div><strong>${turns}</strong><span>тижнів</span></div><div><strong>${territoryCount(state)}</strong><span>секторів України</span></div><div><strong>${faction().losses}</strong><span>втрачено сили</span></div></div>${historyChart()}<div class="save-buttons">${btn('menu','Нова кампанія')}${btn('close-modal','Переглянути карту')}</div>${btn('export',icon('download')+'Зберегти підсумки','class="text-button"')}`);
}
function historyChart(){const points=[{ua:20},...state.history].map((h,i)=>`${10+i*380/Math.max(1,state.history.length)},${100-h.ua*3.2}`).join(' ');return `<div class="history-chart"><span class="micro">КОНТРОЛЬ УКРАЇНСЬКИХ СЕКТОРІВ</span><svg viewBox="0 0 400 110" role="img" aria-label="Динаміка українського контролю протягом кампанії"><path d="M10 20H390M10 100H390" stroke="#31434b"/><polyline points="${points}" stroke="#80c5bc" stroke-width="3" fill="none"/></svg></div>`;}
function confirmAttack(source,target){const p=preview(state,source,target),error=validateOrder(state,{type:'attack',source,target});if(error){toast(error);return;}showModal(`<div class="modal-head"><span class="micro">ПЛАНУВАННЯ НАСТУПУ</span>${btn('close-modal',icon('close'),'aria-label="Закрити"')}</div><h2>${BY_ID[source].name} → ${BY_ID[target].name}</h2><p>Оцінка за поточними розвідданими. Противник також може відновитися чи перекинути сили цього ходу.</p><div class="attack-preview"><b class="${p.tone}">${p.label}</b><span>Очікувані втрати наступу: близько ${p.loss} сили</span></div><div class="note">Наказ запланується, коли ви натиснете кнопку. Його можна скасувати до завершення ходу.</div>${btn('confirm-attack','Запланувати наступ '+icon('arrow'),`data-source="${source}" data-target="${target}" class="end-turn"`)}`);}

document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const a=el.dataset.action;e.preventDefault();
  if(a==='tab'){ui.tab=el.dataset.tab;ui.mode=null;render();}
  if(a==='layer'){ui.layer=el.dataset.layer;render();}
  if(a==='select')selectRegion(el.dataset.id);
  if(a==='mode')startMode(el.dataset.mode,el.dataset.source);
  if(a==='cancel-mode'){ui.mode=null;ui.source=null;render();}
  if(a==='order')addOrder({type:el.dataset.type,...(el.dataset.source?{source:el.dataset.source}:{}),...(el.dataset.target?{target:el.dataset.target}:{})});
  if(a==='research')addOrder({type:'research',tech:el.dataset.tech});
  if(a==='special')addOrder({type:'special',execute:el.dataset.execute==='true'});
  if(a==='attack-target')confirmAttack(el.dataset.source,el.dataset.target);
  if(a==='confirm-attack'){addOrder({type:'attack',source:el.dataset.source,target:el.dataset.target});closeModal();}
  if(a==='cancel-order'){cancelOrder(state,Number(el.dataset.index));save();render();}
  if(a==='event'){chooseEvent(state,el.dataset.choice);save();render();}
  if(a==='end-turn')advance();
  if(a==='zoom-in')zoom(0.2);if(a==='zoom-out')zoom(-0.2);
  if(a==='map-reset'){ui.zoom=1;ui.panX=0;ui.panY=0;updateViewbox();}
  if(a==='toggle-log'){ui.logOpen=!ui.logOpen;render();}
  if(a==='help')help();if(a==='save')saveMenu();if(a==='menu')welcome();if(a==='close-modal'||a==='continue')closeModal();if(a==='results')results();
  if(a==='start-game'){
    const side=$('#setup-side').value,scenario=$('input[name="scenario"]:checked').value,difficulty=$('#setup-difficulty').value;
    state=createGame({side,scenario,difficulty});ui.selected=side==='ua'?'dnipro':'donetsk';ui.tab='front';ui.mode=null;ui.tutorial=0;ui.zoom=1;ui.panX=0;ui.panY=0;save();closeModal();render();toast('Кампанію розпочато. Виберіть сектор і заплануйте накази.');
  }
  if(a==='export'){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`front-and-rear-${state.side}-week-${state.turn}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Збереження експортовано.');
  }
  if(a==='import')$('#import-file').click();
  if(a==='save-text')showModal(`<div class="modal-head"><span class="micro">ТЕКСТ ЗБЕРЕЖЕННЯ</span>${btn('close-modal',icon('close'),'aria-label="Закрити"')}</div><h2>Збереження у JSON</h2><p>Якщо браузер не підтримує завантаження файлів, скопіюйте цей текст і збережіть його у файл із розширенням .json.</p><textarea id="save-json" readonly aria-label="JSON збереження" class="json-text">${esc(JSON.stringify(state,null,2))}</textarea>${btn('select-save-text','Виділити весь текст','class="end-turn"')}`);
  if(a==='select-save-text'){$('#save-json').focus();$('#save-json').select();}
});
function advance(){
  if(ui.turnBusy||state.winner||state.event)return;
  ui.turnBusy=true;ui.mode=null;ui.tutorial=1;const button=$('[data-action="end-turn"]');if(button){button.disabled=true;button.innerHTML='Виконання наказів… '+icon('clock');}
  setTimeout(()=>{state=endTurn(state);ui.turnBusy=false;save();render();if(state.winner)results();else toast(`Тиждень ${state.turn}: результати доступні в журналі.`);},260);
}
document.addEventListener('keydown',e=>{
  const modal=$('#modal-root .modal');
  if(modal){
    if(e.key==='Escape'){closeModal();return;}
    if(e.key==='Tab'){const all=[...modal.querySelectorAll('button:not([disabled]),select,input,a[href]')];const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    return;
  }
  if(e.target.closest('input,select,textarea,button,[data-region]'))return;
  if(e.key==='Enter'){e.preventDefault();advance();}if(e.key==='Escape'){ui.mode=null;ui.source=null;render();}
  if(e.key==='+'||e.key==='=')zoom(0.2);if(e.key==='-')zoom(-0.2);if(e.key==='0'){ui.zoom=1;ui.panX=0;ui.panY=0;updateViewbox();}if(e.key==='?')help();
});
render();welcome();
window.addEventListener('resize',updateViewbox);
