import { REGIONS, BY_ID, UKRAINIAN, TECHS, SCENARIOS } from './data.js';

export const VERSION = 1;
export const ORDER_LIMIT = 4;
export const COSTS = { attack:0,move:0,recover:8,fortify:14,reinforce:20,recon:6,strike:26,naval:18,special:45 };
export const ORDER_NAMES = {attack:'Наступ',move:'Перекидання',recover:'Відновлення',fortify:'Укріплення',reinforce:'Поповнення',recon:'Розвідка',strike:'Удар по тилу',research:'Дослідження',naval:'Морська операція',special:'Спецпроєкт'};
export const otherSide = side => side === 'ua' ? 'ru' : 'ua';
export const sideName = side => side === 'ua' ? 'Україна' : side === 'ru' ? 'Росія' : 'Нейтральний сектор';
export const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

export function createGame({side='ua',scenario='liberation',difficulty='normal',seed=Date.now()}={}) {
  if(!['ua','ru'].includes(side) || !SCENARIOS[scenario] || !['normal','hard'].includes(difficulty)) throw new Error('Невідомі налаштування кампанії.');
  const state={version:VERSION,side,scenario,difficulty,seed:(seed>>>0)||42,turn:1,orders:[],transits:[],log:[],history:[],winner:null,hold:0,sea:0,event:null,
    factions:{},regions:{}};
  for(const team of ['ua','ru']) state.factions[team]={budget:145,reserve:90,tech:{drones:0,strike:0,defense:0,logistics:0,naval:0},project:null,special:null,losses:0};
  for(const region of REGIONS) state.regions[region.id]={owner:region.owner,strength:region.strength,readiness:region.owner==='neutral'?0:82,fort:0,damage:0,intel:{ua:0,ru:0}};
  if(scenario==='defense') for(const id of ['donetsk','luhansk','zaporizhzhia','kherson']) state.regions[id].strength+=25;
  addLog(state,'brief','Кампанію розпочато.','Сформуйте до чотирьох наказів. Обидві сторони виконують свої плани після завершення ходу.');
  return state;
}
function random(state) { let x=state.seed; x^=x<<13; x^=x>>>17; x^=x<<5; state.seed=x>>>0; return state.seed/4294967296; }
function addLog(s,type,title,detail='',side=null) { s.log.unshift({turn:s.turn,type,title,detail,side}); s.log=s.log.slice(0,180); }
export function owned(s,side) { return REGIONS.filter(r=>s.regions[r.id].owner===side); }
export function territoryCount(s,side='ua') { return UKRAINIAN.filter(id=>s.regions[id].owner===side).length; }
export function totalStrength(s,side) { return Math.round(owned(s,side).reduce((n,r)=>n+s.regions[r.id].strength,0)+s.transits.filter(t=>t.side===side).reduce((n,t)=>n+t.amount,0)); }

export function route(s,source,target,side) {
  if(!BY_ID[source]||!BY_ID[target]||s.regions[source].owner!==side||s.regions[target].owner!==side) return null;
  const queue=[[source]],seen=new Set([source]);
  while(queue.length) {
    const path=queue.shift(),last=path.at(-1);
    if(last===target) return path;
    for(const id of BY_ID[last].neighbors) if(!seen.has(id)&&s.regions[id].owner===side) { seen.add(id); queue.push([...path,id]); }
  }
  return null;
}
export function supply(s,id,assumedStrength=null) {
  const r=s.regions[id];
  if(r.owner==='neutral') return {level:0,label:'Нейтральний',capacity:0,connected:false};
  const side=r.owner,capital=side==='ua'?'kyiv':'rear';
  const connected=!!route(s,capital,id,side);
  const neighbors=BY_ID[id].neighbors.filter(n=>s.regions[n].owner===side);
  const hubs=neighbors.filter(n=>['logistics','capital'].includes(BY_ID[n].kind)&&s.regions[n].damage===0).length;
  const capacity=65+hubs*15+s.factions[side].tech.logistics*15-(r.damage?30:0)+(BY_ID[id].kind==='logistics'?25:0);
  const seaPenalty=BY_ID[id].kind==='port' && (side==='ua'?s.sea<0:s.sea>0);
  const strength=assumedStrength??r.strength;
  const level=!connected?0:strength>capacity*1.7||r.damage>=3?0:strength>capacity||r.damage>0||seaPenalty?1:2;
  return {level,label:['Критичне','Обмежене','Достатнє'][level],capacity,connected};
}
export function income(s,side) {
  let sum=8;
  for(const r of owned(s,side)) {
    let value=r.kind==='capital'?12:r.kind==='industry'?3:r.kind==='port'?3:1;
    if(r.kind==='port') value+=(side==='ua'?s.sea:-s.sea);
    sum+=Math.max(0,value)*(s.regions[r.id].damage>0?0.4:1);
  }
  return Math.round(sum);
}
export function intel(s,id,side=s.side) {
  const r=s.regions[id];
  if(r.owner===side || r.owner==='neutral' || r.intel[side]>=s.turn) return {exact:true,strength:r.strength,readiness:r.readiness,label:String(Math.round(r.strength))};
  const low=Math.floor(r.strength/25)*25;
  return {exact:false,strength:low+12,readiness:70,label:`${low}–${low+25}`};
}
export function combatPower(s,id,side,attack=false,known=false) {
  const r=s.regions[id],info=known?intel(s,id,otherSide(side)):r;
  const readiness=info.readiness;
  const logistics=supply(s,id,known?info.strength:null).level;
  let power=info.strength*(0.45+readiness/180)*[0.55,0.8,1][logistics];
  if(attack) power*=1+Math.max(0,s.factions[side].tech.drones*0.18-s.factions[otherSide(side)].tech.defense*0.08);
  else power*=1.18+r.fort*0.2;
  return power;
}
export function preview(s,source,target,side=s.side) {
  const attack=combatPower(s,source,side,true),defend=combatPower(s,target,otherSide(side),false,true);
  const ratio=attack/Math.max(1,defend);
  return {ratio,label:ratio>=1.5?'Перевага':ratio>=0.95?'Складний бій':'Високий ризик',tone:ratio>=1.5?'good':ratio>=0.95?'warn':'danger',loss:Math.round(clamp(defend*0.18,2,s.regions[source].strength*0.4))};
}
export function orderCost(s,order,side=s.side) {
  return order.type==='research' && TECHS[order.tech]?TECHS[order.tech].cost+s.factions[side].tech[order.tech]*25:COSTS[order.type]??0;
}
export function validateOrder(s,order,side=s.side,orders=s.orders) {
  if(s.winner) return 'Кампанію вже завершено.';
  if(!Object.hasOwn(ORDER_NAMES,order.type)) return 'Невідомий наказ.';
  if(orders.length>=ORDER_LIMIT) return 'На цей хід уже заплановано чотири накази.';
  const faction=s.factions[side],r=s.regions[order.source],target=s.regions[order.target];
  if(['attack','move','recover','fortify','reinforce'].includes(order.type)) {
    if(!r||r.owner!==side) return 'Виберіть власний сектор.';
    if(orders.some(o=>o.source===order.source)) return 'Цей сектор уже отримав наказ на поточний хід.';
  }
  if(order.type==='attack') {
    if(!target||target.owner!==otherSide(side)) return 'Ціль наступу має бути ворожою.';
    if(!BY_ID[order.source].neighbors.includes(order.target)) return 'Наступ можливий лише в сусідній сектор.';
    if(r.strength<12) return 'Для наступу потрібно щонайменше 12 сили.';
    if(r.readiness<28) return 'Спочатку відновіть готовність угруповання.';
  }
  if(order.type==='move') {
    if(order.source===order.target) return 'Виберіть інший сектор.';
    if(!route(s,order.source,order.target,side)) return 'Немає маршруту через власні сектори.';
    if(!Number.isFinite(order.amount)||order.amount<5||order.amount>Math.floor(r.strength-10)) return 'Залиште щонайменше 10 сили в секторі; перекидання — від 5.';
  }
  if(order.type==='reinforce' && faction.reserve<20) return 'Потрібно 20 підготовленого резерву.';
  if(order.type==='fortify' && r.fort>=3) return 'Сектор уже має максимальні укріплення.';
  if(['strike','recon'].includes(order.type)) {
    if(!target||target.owner!==otherSide(side)) return 'Виберіть ворожий сектор.';
    if(orders.some(o=>o.type===order.type&&o.target===order.target)) return 'Для цієї цілі вже заплановано такий наказ.';
  }
  if(order.type==='strike'&&faction.tech.strike<1) return 'Спочатку дослідіть далекі удари.';
  if(order.type==='research') {
    if(!Object.hasOwn(TECHS,order.tech)) return 'Невідоме дослідження.';
    if(faction.project||orders.some(o=>o.type==='research')) return 'Одночасно можна вести одне дослідження.';
    if(faction.tech[order.tech]>=3) return 'Технологію вже розвинуто до рівня III.';
  }
  if(order.type==='naval' && orders.some(o=>o.type==='naval')) return 'Морську операцію вже заплановано.';
  if(order.type==='special') {
    if(orders.some(o=>o.type==='special')) return 'Спецоперацію вже заплановано.';
    if(order.execute && (!faction.special||faction.special.progress<2)) return 'Потрібно щонайменше два ходи підготовки.';
    if(!order.execute && faction.special) return 'Спецпроєкт уже готується.';
  }
  const cost=order.type==='special'&&order.execute?0:orderCost(s,order,side);
  if(faction.budget<cost) return 'Недостатньо бюджету для цього наказу.';
  return null;
}
export function queueOrder(s,order,side=s.side,orders=s.orders) {
  const error=validateOrder(s,order,side,orders); if(error) return {ok:false,error};
  const cost=order.type==='special'&&order.execute?0:orderCost(s,order,side);
  s.factions[side].budget-=cost;
  if(order.type==='reinforce') s.factions[side].reserve-=20;
  orders.push({...order,cost,side});
  return {ok:true};
}
export function cancelOrder(s,index) {
  const order=s.orders[index]; if(!order) return;
  s.factions[order.side].budget+=order.cost;
  if(order.type==='reinforce') s.factions[order.side].reserve+=20;
  s.orders.splice(index,1);
}

export function planAI(s,side=otherSide(s.side)) {
  const orders=[],mine=owned(s,side),faction=s.factions[side];
  const add=order=>queueOrder(s,order,side,orders).ok;
  const front=mine.filter(r=>r.neighbors.some(id=>s.regions[id].owner===otherSide(side)));
  // The AI sees the same dated intel bands as a player, and never reads the player's queued orders.
  if(!faction.project && s.turn%4===1) {
    const priorities=s.difficulty==='hard'?['drones','defense','strike','logistics']:['drones','logistics','strike','defense'];
    const tech=priorities.find(key=>faction.tech[key]===Math.min(...priorities.map(k=>faction.tech[k]))&&faction.tech[key]<3);
    if(tech) add({type:'research',tech});
  }
  const candidates=[];
  for(const r of front) for(const target of r.neighbors.filter(id=>s.regions[id].owner===otherSide(side))) {
    const p=preview(s,r.id,target,side);
    candidates.push({source:r.id,target,ratio:p.ratio+(target==='kyiv'?0.15:0)});
  }
  candidates.sort((a,b)=>b.ratio-a.ratio);
  for(const c of candidates) if(c.ratio>(s.difficulty==='hard'?0.9:1.2)&&s.regions[c.source].readiness>45) add({type:'attack',source:c.source,target:c.target});
  const weak=[...front].sort((a,b)=>s.regions[a.id].strength-s.regions[b.id].strength);
  for(const r of weak) {
    const unit=s.regions[r.id];
    if(unit.readiness<65) add({type:'recover',source:r.id});
    else if(unit.strength<65) add({type:'reinforce',source:r.id});
  }
  for(const r of mine.filter(r=>!front.includes(r)).sort((a,b)=>s.regions[b.id].strength-s.regions[a.id].strength)) {
    const target=weak.find(t=>route(s,r.id,t.id,side)&&s.regions[t.id].strength<90);
    if(target && s.regions[r.id].strength>35) add({type:'move',source:r.id,target:target.id,amount:Math.floor((s.regions[r.id].strength-10)*0.65)});
  }
  if(faction.tech.strike>0 && orders.length<4) {
    const target=owned(s,otherSide(side)).filter(r=>['industry','logistics'].includes(r.kind)).sort((a,b)=>intel(s,b.id,side).strength-intel(s,a.id,side).strength)[0];
    if(target) add({type:'strike',target:target.id});
  }
  if(s.turn%5===0) add({type:'naval'});
  for(const r of weak) if(s.regions[r.id].fort<(s.difficulty==='hard'?3:1)) add({type:'fortify',source:r.id});
  return orders;
}

function resolveTransits(s) {
  const ongoing=[];
  for(const t of s.transits) {
    const next=route(s,t.current,t.target,t.side);
    if(!next) {
      if(s.regions[t.current].owner===t.side) { s.regions[t.current].strength+=t.amount; addLog(s,'move','Маршрут перервано.',`${t.amount} сили повернулися в сектор ${BY_ID[t.current].name}.`,t.side); }
      else {
        const retreat=BY_ID[t.current].neighbors.find(id=>s.regions[id].owner===t.side);
        const saved=retreat?Math.round(t.amount*0.7):0;
        if(retreat) s.regions[retreat].strength+=saved;
        s.factions[t.side].losses+=t.amount-saved;
        addLog(s,'danger','Колона втратила маршрут.',`Збережено ${saved} із ${t.amount} сили.`,t.side);
      }
      continue;
    }
    const speed=1+(s.factions[t.side].tech.logistics>0?1:0);
    t.current=next[Math.min(speed,next.length-1)]; t.path=next;
    if(t.current===t.target) { s.regions[t.target].strength+=t.amount; s.regions[t.target].readiness=clamp(s.regions[t.target].readiness-4,0,100); addLog(s,'move',`Резерв прибув: ${BY_ID[t.target].name}.`,`+${t.amount} сили з сектора ${BY_ID[t.source].name}.`,t.side); }
    else ongoing.push(t);
  }
  s.transits=ongoing;
}

function resolveCombat(s,orders) {
  const snapshot=structuredClone(s),losses={},fatigue={},attacks={};
  for(const order of orders.filter(o=>o.type==='attack')) {
    const a=snapshot.regions[order.source],d=snapshot.regions[order.target];
    if(a.owner!==order.side||d.owner!==otherSide(order.side)) continue;
    const ap=combatPower(snapshot,order.source,order.side,true)*(0.9+random(s)*0.2);
    const dp=combatPower(snapshot,order.target,d.owner,false)*(0.9+random(s)*0.2);
    const al=Math.min(a.strength-1,Math.max(2,Math.round(dp*0.18)));
    const dl=Math.min(d.strength,Math.max(2,Math.round(ap*0.32)));
    losses[order.source]=(losses[order.source]||0)+al; losses[order.target]=(losses[order.target]||0)+dl;
    fatigue[order.source]=(fatigue[order.source]||0)+23; fatigue[order.target]=(fatigue[order.target]||0)+Math.round(ap/Math.max(dp,1)*14);
    (attacks[order.target]??=[]).push({...order,power:ap});
    addLog(s,'battle',`${BY_ID[order.source].name} → ${BY_ID[order.target].name}`,`Втрати: наступ −${al}, оборона −${dl}. ${ap>=dp*1.3?'Оборону послаблено.':'Оборона чинить опір.'}`,order.side);
  }
  for(const [id,loss] of Object.entries(losses)) {
    const r=s.regions[id],actual=Math.min(r.strength,loss); r.strength-=actual; s.factions[r.owner].losses+=actual;
    r.readiness=clamp(r.readiness-(fatigue[id]||0),0,100);
  }
  const captures=[];
  for(const [target,list] of Object.entries(attacks)) {
    const winner=list.sort((a,b)=>b.power-a.power)[0],r=s.regions[target];
    const totalPower=list.reduce((n,a)=>n+a.power,0);
    const breakThrough=r.strength<12 || (r.readiness<28&&totalPower>combatPower(s,target,r.owner,false)*1.15);
    const supporters=list.filter(a=>s.regions[a.source].strength>12);
    if(breakThrough&&supporters.length) captures.push({...winner,target,supporters});
  }
  // Reserve occupying forces before changing any owner: outcomes are simultaneous.
  const occupying=captures.map(c=>{
    let amount=0,readiness=0;
    for(const supporter of c.supporters){
      const r=s.regions[supporter.source],contribution=Math.max(5,Math.floor(r.strength*0.45));
      r.strength-=contribution;amount+=contribution;readiness+=contribution*r.readiness;
    }
    return {...c,amount,occupyingReadiness:Math.round(readiness/amount)};
  });
  for(const c of occupying) {
    const r=s.regions[c.target],oldOwner=r.owner,retreat=BY_ID[c.target].neighbors.find(id=>snapshot.regions[id].owner===oldOwner&&!captures.some(x=>x.target===id));
    if(retreat) s.regions[retreat].strength+=Math.round(r.strength*0.7);
    s.factions[oldOwner].losses+=r.strength-(retreat?Math.round(r.strength*0.7):0);
    Object.assign(r,{owner:c.side,strength:c.amount,readiness:clamp(c.occupyingReadiness,35,85),fort:0,damage:Math.max(1,r.damage)});
    addLog(s,'capture',`${BY_ID[c.target].name}: контроль змінився.`,`${sideName(c.side)} займає сектор. Угруповання має ${c.amount} сили; постачання потребує відновлення.`,c.side);
  }
}

export function endTurn(state) {
  if(state.winner) return state;
  const s=structuredClone(state);
  const ai=planAI(s),all=[...s.orders,...ai];
  s.event=null;
  // Previous damage and projects advance first, so a new order always gets its full duration.
  for(const r of Object.values(s.regions)) if(r.damage>0) r.damage--;
  for(const side of ['ua','ru']) {
    const f=s.factions[side];
    if(f.project && --f.project.remaining<=0) { f.tech[f.project.tech]++; addLog(s,'tech',`${TECHS[f.project.tech].name}: рівень ${f.tech[f.project.tech]}.`,'Модернізацію впроваджено. Ефект уже працює.',side); f.project=null; }
    if(f.special) f.special.progress=Math.min(5,f.special.progress+1);
  }
  resolveTransits(s);
  let navalShift=0;
  for(const o of all) {
    const r=s.regions[o.source],f=s.factions[o.side];
    if(o.type==='research') f.project={tech:o.tech,remaining:TECHS[o.tech].time};
    if(o.type==='recover') { r.readiness=clamp(r.readiness+35,0,100); r.damage=Math.max(0,r.damage-1); addLog(s,'supply',`${BY_ID[o.source].name}: відновлення.`,'Готовність +35; прискорено ремонт вузла.',o.side); }
    if(o.type==='fortify') { r.fort=Math.min(3,r.fort+1); addLog(s,'supply',`${BY_ID[o.source].name}: укріплення ${r.fort}/3.`,'Кожен рівень дає +20% до оборонної ефективності.',o.side); }
    if(o.type==='reinforce') { s.transits.push({side:o.side,source:o.source,current:o.source,target:o.source,amount:20,path:[o.source]}); addLog(s,'move',`${BY_ID[o.source].name}: поповнення в дорозі.`,'20 сили прибудуть наступного ходу, якщо сектор утримано.',o.side); }
    if(o.type==='move') { r.strength-=o.amount; s.transits.push({side:o.side,source:o.source,current:o.source,target:o.target,amount:o.amount,path:route(s,o.source,o.target,o.side)}); addLog(s,'move',`${BY_ID[o.source].name} → ${BY_ID[o.target].name}`,`${o.amount} сили вирушили. Рух — один сектор за хід; модернізація логістики прискорює маршрут.`,o.side); }
    if(o.type==='recon') { s.regions[o.target].intel[o.side]=s.turn+3; addLog(s,'intel',`Розвідка: ${BY_ID[o.target].name}.`,'Точні сила та готовність доступні на три ходи.',o.side); }
    if(o.type==='strike') {
      const target=s.regions[o.target],protection=s.factions[target.owner].tech.defense;
      const damage=Math.max(1,2+f.tech.strike-Math.floor(protection/2));
      target.damage=Math.max(target.damage,damage); target.readiness=clamp(target.readiness-8*f.tech.strike,0,100);
      addLog(s,'strike',`Удар по тилу: ${BY_ID[o.target].name}.`,`Вузол пошкоджено на ${damage} ходи. Дохід знижено, постачання обмежене.`,o.side);
    }
    if(o.type==='naval') { const shift=1+Math.floor(f.tech.naval/2); navalShift+=o.side==='ua'?shift:-shift; addLog(s,'naval',`${sideName(o.side)}: морська операція.`,'Флот і морські системи вплинули на сполучення та дохід портів.',o.side); }
    if(o.type==='special') {
      if(!o.execute) { f.special={progress:0}; addLog(s,'intel','Спецпроєкт розпочато.','За 2–5 ходів можна провести операцію. Довша підготовка посилює результат.',o.side); }
      else {
        const progress=f.special.progress,targets=owned(s,otherSide(o.side)).filter(r=>['industry','logistics','capital'].includes(r.kind)).sort((a,b)=>s.regions[b.id].strength-s.regions[a.id].strength).slice(0,Math.min(3,progress));
        const success=random(s)>0.25-progress*0.035;
        if(success) for(const t of targets) {s.regions[t.id].damage=Math.max(s.regions[t.id].damage,progress); s.regions[t.id].readiness=clamp(s.regions[t.id].readiness-progress*6,0,100);}
        addLog(s,'intel',success?'Спецоперація успішна.':'Спецоперацію викрито.',success?`${targets.length} тилові вузли порушено на ${progress} ходи.`:'Підготовку втрачено. Можна розпочати новий проєкт.',o.side); f.special=null;
      }
    }
  }
  s.sea=clamp(s.sea+navalShift,-3,3);
  resolveCombat(s,all);
  for(const region of REGIONS) {
    const r=s.regions[region.id]; if(r.owner==='neutral') continue;
    const level=supply(s,region.id).level;
    r.readiness=clamp(r.readiness+[0,4,9][level],0,100);
    if(level===0&&r.strength>10) { const lost=Math.max(1,Math.floor(r.strength*0.025)); r.strength-=lost;s.factions[r.owner].losses+=lost; }
    r.strength=Math.round(r.strength);r.readiness=Math.round(r.readiness);
  }
  for(const side of ['ua','ru']) { const f=s.factions[side];f.budget=Math.min(999,f.budget+income(s,side));f.reserve=Math.min(200,f.reserve+12); }
  s.history.push({turn:s.turn,ua:territoryCount(s),uaStrength:totalStrength(s,'ua'),ruStrength:totalStrength(s,'ru')});
  if(s.turn%6===0) {
    s.event={type:'aid',title:'Вікно можливостей',description:'Оберіть разову підтримку: готовий резерв зараз або бюджет для наступного проєкту.'};
  }
  if(s.turn===4) addLog(s,'brief','Північ залишається під загрозою.','Російські сектори Брянськ і Курськ мають прямі маршрути до Чернігова й Сум. Білорусь у цій кампанії нейтральна.');
  if(s.turn%5===0) { s.sea-=Math.sign(s.sea);addLog(s,'naval','Морський вплив слабшає.','Контроль сполучення потребує регулярних операцій.'); }
  if(territoryCount(s)===25) s.hold++; else s.hold=0;
  if(s.regions.kyiv.owner==='ru') s.winner={side:'ru',reason:'Київ перейшов під контроль Росії.'};
  else if(s.hold>=2) s.winner={side:'ua',reason:'Усі українські сектори повернуто та втримано два ходи.'};
  else if(s.turn>=SCENARIOS[s.scenario].turns) {
    const won=s.scenario==='defense'?territoryCount(s)>=19:territoryCount(s)===25;
    s.winner={side:won?'ua':'ru',reason:s.scenario==='defense'?`Рубіж кампанії: Україна утримує ${territoryCount(s)} із 25 секторів.`:'Час кампанії вичерпано. Умова повернення всіх секторів не виконана.'};
    // Liberation requires the same two-turn hold even on the last week.
    if(s.scenario==='liberation'&&s.hold<2) s.winner.side='ru';
  }
  s.orders=[];s.turn++;
  return s;
}
export function chooseEvent(s,choice) {
  if(!s.event) return;
  if(!['reserve','budget'].includes(choice)) return;
  const f=s.factions[s.side];
  if(choice==='reserve') f.reserve=Math.min(200,f.reserve+35);else f.budget=Math.min(999,f.budget+45);
  addLog(s,'brief',choice==='reserve'?'Отримано підготовлений резерв.':'Отримано фінансування.',choice==='reserve'?'+35 резерву.':'+45 бюджету.',s.side);s.event=null;
}
export function seaLabel(s) { return s.sea>=2?'Відкрите для України':s.sea<=-2?'Під російським контролем':'Сполучення під загрозою'; }

export function validateSave(s) {
  const fail=()=>{throw new Error('Файл не схожий на сумісне збереження «Фронт і тил».');};
  const number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
  if(!s||s.version!==VERSION||!['ua','ru'].includes(s.side)||!SCENARIOS[s.scenario]||!['normal','hard'].includes(s.difficulty)||!number(s.turn,1,100)||!number(s.seed,0,2**32-1)||!number(s.sea,-3,3)||!number(s.hold,0,100)) fail();
  if(!s.regions||Object.keys(s.regions).length!==REGIONS.length||!s.factions) fail();
  for(const r of REGIONS) {
    const v=s.regions[r.id];
    if(!v||!['ua','ru','neutral'].includes(v.owner)||!number(v.strength,0,10000)||!number(v.readiness,0,100)||!number(v.fort,0,3)||!number(v.damage,0,10)||!v.intel||!number(v.intel.ua,0,100)||!number(v.intel.ru,0,100)) fail();
  }
  for(const side of ['ua','ru']) {
    const f=s.factions[side];
    if(!f||!number(f.budget,0,999)||!number(f.reserve,0,200)||!number(f.losses,0,100000)||!f.tech||Object.keys(f.tech).length!==5) fail();
    for(const key of Object.keys(TECHS)) if(!Number.isInteger(f.tech[key])||!number(f.tech[key],0,3)) fail();
    if(f.project&&(!Object.hasOwn(TECHS,f.project.tech)||!number(f.project.remaining,1,4))) fail();
    if(f.special&&!number(f.special.progress,0,5)) fail();
  }
  if(!Array.isArray(s.orders)||s.orders.length>4||!Array.isArray(s.transits)||s.transits.length>500||!Array.isArray(s.log)||s.log.length>180||!Array.isArray(s.history)||s.history.length>100) fail();
  for(const t of s.transits) if(!['ua','ru'].includes(t.side)||![t.source,t.target,t.current].every(id=>BY_ID[id])||!number(t.amount,1,10000)||!Array.isArray(t.path)||!t.path.every(id=>BY_ID[id])) fail();
  for(const l of s.log) if(!number(l.turn,1,100)||typeof l.type!=='string'||typeof l.title!=='string'||typeof l.detail!=='string'||l.title.length>500||l.detail.length>2000) fail();
  for(const h of s.history) if(!number(h.turn,1,100)||!number(h.ua,0,25)||!number(h.uaStrength,0,100000)||!number(h.ruStrength,0,100000)) fail();
  if(s.winner&&(!['ua','ru'].includes(s.winner.side)||typeof s.winner.reason!=='string')) fail();
  if(s.event&&(s.event.type!=='aid'||typeof s.event.title!=='string'||typeof s.event.description!=='string')) fail();
  const restored=structuredClone(s);restored.orders=[];
  // Rebuild reserved resources, then re-validate every pending order rather than trusting file input.
  for(const o of s.orders) {
    if(o.side!==s.side||!number(o.cost,0,200)||o.cost!==(o.type==='special'&&o.execute?0:orderCost(s,o,s.side))) fail();
    restored.factions[s.side].budget+=o.cost;
    if(o.type==='reinforce') restored.factions[s.side].reserve+=20;
  }
  for(const o of s.orders) if(!queueOrder(restored,o).ok) fail();
  return restored;
}
