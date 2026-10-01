import test from 'node:test';
import assert from 'node:assert/strict';
import {REGIONS,BY_ID,UKRAINIAN,TECHS,regionPolygon} from '../src/data.js';
import {createGame,queueOrder,cancelOrder,endTurn,supply,route,preview,planAI,validateSave,territoryCount,totalStrength,intel,chooseEvent,income} from '../src/engine.js';
import {testPlayer} from '../scripts/balance.mjs';

const fresh=(options={})=>createGame({seed:123456,...options});
const add=(s,o)=>assert.equal(queueOrder(s,o).ok,true,JSON.stringify(o));
function assertInvariants(s){
  validateSave(s);
  for(const side of ['ua','ru']) {
    assert.ok(s.factions[side].budget>=0);assert.ok(s.factions[side].reserve>=0);
    assert.ok(s.factions[side].losses>=0);
  }
  for(const r of Object.values(s.regions)){
    assert.ok(r.strength>=0);assert.ok(r.readiness>=0&&r.readiness<=100);assert.ok(Number.isFinite(r.strength));
  }
  assert.equal(territoryCount(s,'ua')+territoryCount(s,'ru'),25);
}

test('geography has 25 Ukrainian sectors, symmetric legal links and valid map polygons',()=>{
  assert.equal(UKRAINIAN.length,25);
  for(const r of REGIONS){assert.ok(regionPolygon(r).length>0);for(const id of r.neighbors)assert.ok(BY_ID[id].neighbors.includes(r.id));}
});
test('one sector cannot receive conflicting orders; cancellation refunds exactly',()=>{
  const s=fresh(),before=structuredClone(s.factions.ua);
  add(s,{type:'reinforce',source:'dnipro'});
  assert.equal(s.factions.ua.budget,before.budget-20);assert.equal(s.factions.ua.reserve,before.reserve-20);
  assert.equal(queueOrder(s,{type:'recover',source:'dnipro'}).ok,false);
  cancelOrder(s,0);assert.deepEqual(s.factions.ua,before);
});
test('only four orders, invalid orders do not spend resources',()=>{
  const s=fresh();for(const source of ['kyiv','lviv','dnipro','sumy'])add(s,{type:'fortify',source});
  const before=JSON.stringify(s);assert.equal(queueOrder(s,{type:'recon',target:'donetsk'}).ok,false);assert.equal(JSON.stringify(s),before);
});
test('movement conserves forces, reserves 10 and follows a friendly route across turns',()=>{
  let s=fresh();const initial=totalStrength(s,'ua');
  assert.equal(queueOrder(s,{type:'move',source:'lviv',target:'donetsk',amount:25}).ok,false);
  assert.equal(queueOrder(s,{type:'move',source:'lviv',target:'dnipro',amount:56}).ok,false);
  add(s,{type:'move',source:'lviv',target:'dnipro',amount:30});
  s=endTurn(s);assert.equal(s.regions.lviv.strength,35);assert.equal(s.transits[0].current,'lviv');assert.equal(totalStrength(s,'ua')+s.factions.ua.losses,initial);
  for(let i=0;i<8&&s.transits.some(t=>t.source==='lviv');i++)s=endTurn(s);
  assert.equal(s.transits.some(t=>t.source==='lviv'),false);assert.ok(s.log.some(l=>l.title.includes('Резерв прибув')));
});
test('an interrupted transit returns to a friendly current sector without creating troops',()=>{
  let s=fresh();add(s,{type:'move',source:'lviv',target:'dnipro',amount:30});s=endTurn(s);
  s.regions.dnipro.owner='ru';const before=s.regions.lviv.strength;s=endTurn(s);
  assert.equal(s.regions.lviv.strength,before+30);assert.equal(s.transits.filter(t=>t.source==='lviv').length,0);
});
test('reinforcement arrives on the following turn and is paid only once',()=>{
  let s=fresh();const before=s.regions.lviv.strength;
  add(s,{type:'reinforce',source:'lviv'});s=endTurn(s);assert.equal(s.regions.lviv.strength,before);assert.ok(s.transits.some(t=>t.amount===20&&t.target==='lviv'));
  s=endTurn(s);assert.equal(s.regions.lviv.strength,before+20);
});
test('only adjacent enemies can be attacked and neutrals cannot be occupied',()=>{
  const s=fresh();assert.equal(queueOrder(s,{type:'attack',source:'lviv',target:'donetsk'}).ok,false);
  assert.equal(queueOrder(s,{type:'attack',source:'chernihiv',target:'gomel'}).ok,false);
  assert.equal(queueOrder(s,{type:'move',source:'kyiv',target:'gomel',amount:20}).ok,false);
  add(s,{type:'attack',source:'mykolaiv',target:'kherson'});
});
test('research takes its full duration and unlocks strikes',()=>{
  let s=fresh();assert.equal(queueOrder(s,{type:'strike',target:'donetsk'}).ok,false);
  add(s,{type:'research',tech:'strike'});s=endTurn(s);assert.equal(s.factions.ua.tech.strike,0);assert.equal(s.factions.ua.project.remaining,3);
  for(let i=0;i<3;i++)s=endTurn(s);
  assert.equal(s.factions.ua.tech.strike,1);assert.equal(s.factions.ua.project,null);add(s,{type:'strike',target:'donetsk'});
  s=endTurn(s);assert.ok(s.regions.donetsk.damage>=2);
  const repaired=structuredClone(s);repaired.regions.donetsk.damage=0;
  assert.ok(income(s,'ru')<income(repaired,'ru'));
});
test('logistics research shortens transit without teleporting',()=>{
  let s=fresh();s.factions.ua.tech.logistics=1;
  add(s,{type:'move',source:'lviv',target:'dnipro',amount:30});s=endTurn(s);s=endTurn(s);
  const convoy=s.transits.find(t=>t.source==='lviv');assert.equal(convoy.current,route(s,'lviv','dnipro','ua')[2]);
});
test('fog of war gives bands, recon expires and readiness remains unknown until observed',()=>{
  let s=fresh();assert.equal(intel(s,'donetsk').exact,false);assert.equal(intel(s,'dnipro').exact,true);
  add(s,{type:'recon',target:'donetsk'});s=endTurn(s);assert.equal(intel(s,'donetsk').exact,true);
  for(let i=0;i<3;i++)s=endTurn(s);assert.equal(intel(s,'donetsk').exact,false);
});
test('preview and AI cannot distinguish hidden force/readiness changes inside the same intel band',()=>{
  const a=fresh({side:'ru'}),b=structuredClone(a);
  a.regions.sumy.strength=50;a.regions.sumy.readiness=100;
  b.regions.sumy.strength=74;b.regions.sumy.readiness=30;
  assert.deepEqual(preview(a,'kursk','sumy','ru'),preview(b,'kursk','sumy','ru'));
  assert.deepEqual(planAI(a,'ru'),planAI(b,'ru'));
});
test('AI ignores player queued orders',()=>{
  const a=fresh(),b=fresh();add(b,{type:'fortify',source:'kharkiv'});add(b,{type:'reinforce',source:'sumy'});
  assert.deepEqual(planAI(a),planAI(b));
});
test('supply detects isolation, damage and congestion',()=>{
  const s=fresh();assert.equal(supply(s,'dnipro').level,2);
  s.regions.dnipro.strength=400;assert.equal(supply(s,'dnipro').level,0);
  s.regions.dnipro.strength=70;s.regions.dnipro.damage=2;assert.equal(supply(s,'dnipro').level,1);
  for(const id of BY_ID.lviv.neighbors)s.regions[id].owner='ru';assert.equal(supply(s,'lviv').connected,false);
});
test('a decisive battle captures the sector and transfers surviving forces',()=>{
  let s=fresh();s.regions.mykolaiv.strength=110;s.regions.kherson.strength=3;
  add(s,{type:'attack',source:'mykolaiv',target:'kherson'});s=endTurn(s);
  assert.equal(s.regions.kherson.owner,'ua');assert.ok(s.regions.kherson.strength>20);assert.ok(s.log.some(l=>l.type==='capture'));assertInvariants(s);
});
test('same seed and orders reproduce exact results without mutating the original input',()=>{
  const s=fresh();add(s,{type:'attack',source:'mykolaiv',target:'kherson'});const original=JSON.stringify(s);
  assert.deepEqual(endTurn(s),endTurn(s));assert.equal(JSON.stringify(s),original);
});
test('special operation requires preparation, consumes its project and affects rear nodes',()=>{
  let s=fresh();assert.equal(queueOrder(s,{type:'special',execute:true}).ok,false);
  add(s,{type:'special',execute:false});s=endTurn(s);assert.equal(s.factions.ua.special.progress,0);
  s=endTurn(s);s=endTurn(s);assert.equal(s.factions.ua.special.progress,2);
  add(s,{type:'special',execute:true});s=endTurn(s);assert.equal(s.factions.ua.special,null);assert.ok(s.log.some(l=>l.title.includes('Спецопераці')));
});
test('sea operations and counter-operations act simultaneously at the saturation boundary',()=>{
  let s=fresh();s.turn=5;s.sea=3;s.factions.ru.tech.naval=0;s.factions.ua.tech.naval=0;
  // AI has spare commands for its sea operation when the front is dormant.
  for(const r of REGIONS)if(s.regions[r.id].owner==='ru')s.regions[r.id].strength=30;
  for(const r of REGIONS)if(s.regions[r.id].owner==='ua')s.regions[r.id].strength=80;
  s.factions.ru.reserve=0;s.factions.ru.budget=18;
  add(s,{type:'naval'});s=endTurn(s);
  assert.ok(s.sea>=1&&s.sea<=3);assertInvariants(s);
});
test('six-week support event has exactly one award',()=>{
  let s=fresh();for(let i=0;i<6;i++)s=endTurn(s);
  assert.ok(s.event);const before=s.factions.ua.budget;chooseEvent(s,'budget');assert.equal(s.factions.ua.budget,Math.min(999,before+45));assert.equal(s.event,null);
  chooseEvent(s,'budget');assert.equal(s.factions.ua.budget,Math.min(999,before+45));
});
test('liberation requires two turns of control, including the deadline',()=>{
  let s=fresh();for(const id of UKRAINIAN){s.regions[id].owner='ua';s.regions[id].strength=100;}
  s=endTurn(s);assert.equal(s.winner,null);s=endTurn(s);assert.equal(s.winner.side,'ua');
  let late=fresh();late.turn=36;for(const id of UKRAINIAN){late.regions[id].owner='ua';late.regions[id].strength=100;}
  late=endTurn(late);assert.equal(late.winner.side,'ru');
});
test('defense deadline and loss of Kyiv conclude the campaign for either player side',()=>{
  let s=fresh({scenario:'defense'});s.turn=20;s=endTurn(s);assert.ok(s.winner);assert.equal(s.winner.side,territoryCount(s)>=19?'ua':'ru');
  let defeated=fresh();defeated.regions.kyiv.owner='ru';defeated=endTurn(defeated);assert.equal(defeated.winner.side,'ru');assert.deepEqual(endTurn(defeated),defeated);
});
test('JSON saves round-trip projects, reserved budgets and queued orders',()=>{
  const s=fresh();add(s,{type:'research',tech:'strike'});add(s,{type:'reinforce',source:'dnipro'});
  const restored=validateSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);
});
test('malformed or forged saves are rejected',()=>{
  const mutations=[s=>s.version=99,s=>delete s.regions.kyiv,s=>s.regions.dnipro.strength=-1,s=>s.factions.ua.project={tech:'toString',remaining:2},s=>s.orders.push({type:'move',source:'lviv',target:'rear',amount:999,cost:0,side:'ua'}),s=>s.transits.push({side:'ua',source:'bad',current:'lviv',target:'dnipro',amount:20,path:[]})];
  for(const mutate of mutations){const s=fresh();mutate(s);assert.throws(()=>validateSave(s));}
});
test('100 seeded automated full campaigns preserve resources and terminate for both sides',()=>{
  for(let seed=1;seed<=100;seed++){
    let s=fresh({seed,side:seed%2?'ua':'ru',difficulty:seed%3?'normal':'hard',scenario:seed%4?'liberation':'defense'});
    const initial=totalStrength(s,'ua')+totalStrength(s,'ru');let recruited=0;
    for(let turn=0;turn<40&&!s.winner;turn++){
      s.orders=planAI(s,s.side);if(s.event)chooseEvent(s,'reserve');const week=s.turn;s=endTurn(s);assertInvariants(s);
      recruited+=20*s.log.filter(l=>l.turn===week&&l.title.includes('поповнення в дорозі')).length;
      assert.equal(totalStrength(s,'ua')+totalStrength(s,'ru')+s.factions.ua.losses+s.factions.ru.losses,initial+recruited,`force conservation seed ${seed} week ${week}`);
    }
    assert.ok(s.winner,`seed ${seed} did not finish`);
  }
});

test('coordinated attacks put contributions from both surviving armies into the captured sector',()=>{
  let s=fresh();s.regions.kherson.strength=3;
  const original=totalStrength(s,'ua');
  add(s,{type:'attack',source:'dnipro',target:'kherson'});add(s,{type:'attack',source:'mykolaiv',target:'kherson'});
  s=endTurn(s);assert.equal(s.regions.kherson.owner,'ua');assert.ok(s.regions.kherson.strength>45);
  assert.equal(totalStrength(s,'ua')+s.factions.ua.losses,original);
});

test('a complete liberation can be won through legal orders without editing campaign state',()=>{
  let s=fresh({seed:5});
  while(!s.winner){testPlayer(s);if(s.event)chooseEvent(s,'reserve');s=endTurn(s);assertInvariants(s);}
  assert.equal(s.winner.side,'ua');assert.equal(territoryCount(s),25);assert.equal(s.hold,2);
});
