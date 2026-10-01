// A deliberately simple test player. Uses public intel, not hidden enemy state.
import {fileURLToPath} from 'node:url';
import {createGame,queueOrder,endTurn,owned,preview,territoryCount,route,chooseEvent} from '../src/engine.js';
import {UKRAINIAN} from '../src/data.js';
export function testPlayer(s){
 const f=s.factions.ua,add=o=>queueOrder(s,o).ok;
 if(s.turn<=3)for(const id of ['chernihiv','sumy'])if(s.regions[id].owner==='ua')add({type:'fortify',source:id});
 if(!f.project){const tech=f.tech.drones<3?'drones':f.tech.logistics<1?'logistics':f.tech.strike<1?'strike':null;if(tech)add({type:'research',tech});}
 const mine=owned(s,'ua'),front=mine.filter(r=>r.neighbors.some(id=>s.regions[id].owner==='ru'));
 const offensives=[];
 for(const r of front)for(const target of r.neighbors.filter(id=>s.regions[id].owner==='ru'&&UKRAINIAN.includes(id))){
  const p=preview(s,r.id,target,'ua');offensives.push({source:r.id,target,score:p.ratio});}
 offensives.sort((a,b)=>b.score-a.score);
 for(const r of front.filter(r=>s.regions[r.id].readiness<60))add({type:'recover',source:r.id});
 for(const o of offensives)if(o.score>0.95)add({type:'attack',source:o.source,target:o.target});
 for(const r of front.filter(r=>s.regions[r.id].strength<65))add({type:'reinforce',source:r.id});
 for(const r of mine.filter(r=>!front.includes(r)&&s.regions[r.id].strength>25).sort((a,b)=>s.regions[b.id].strength-s.regions[a.id].strength)){
  const target=[...front].filter(t=>route(s,r.id,t.id,'ua')).sort((a,b)=>s.regions[a.id].strength-s.regions[b.id].strength)[0];
  if(target)add({type:'move',source:r.id,target:target.id,amount:Math.floor(s.regions[r.id].strength-10)});
 }
 for(const r of front)add({type:'fortify',source:r.id});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
const count=Number(process.argv[2]||100);
for(const scenario of ['liberation','defense']){
 const winningSeeds=[];
 const wins={ua:0,ru:0};let min=25,max=0,sum=0;
 for(let seed=1;seed<=count;seed++){
  let s=createGame({seed,scenario});
  while(!s.winner){testPlayer(s);if(s.event)chooseEvent(s,'reserve');s=endTurn(s);}
  wins[s.winner.side]++;if(s.winner.side==='ua')winningSeeds.push(seed);const sectors=territoryCount(s);min=Math.min(min,sectors);max=Math.max(max,sectors);sum+=sectors;
 }
 console.log(JSON.stringify({scenario,games:count,wins,min,max,averageSectors:sum/count,winningSeeds}));
}
}
