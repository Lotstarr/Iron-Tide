import assert from 'node:assert/strict';
import { FLEET } from '../lib/game.ts';
const base = process.env.GAME_URL || 'http://localhost:3000';
const fleet = offset => FLEET.map((s,i)=>({cells:Array.from({length:s.size},(_,j)=>(offset===50?5:0)+i*20+j)}));
let count=0;
async function api(data,status=200) {
  const response=await fetch(`${base}/api/game`,{method:'POST',headers:{'Content-Type':'application/json','Origin':new URL(base).origin},body:JSON.stringify(data)});
  const body=await response.json(); assert.equal(response.status,status,JSON.stringify(body)); count++; return body;
}
const a=await api({action:'create',name:'Test Captain A'});
const code=a.game.code; const authA={code,token:a.token};
const b=await api({action:'join',name:'Test Captain B',code}); const authB={code,token:b.token};
assert.notEqual(a.token,b.token); assert.equal(b.game.me,1);
await api({action:'join',name:'Third captain',code},409);
await api({action:'state',code,token:'invalid'},401);
await api({action:'ready',...authA,ships:[]},400);
const touching=fleet(0);touching[1].cells=[10,11,12,13];await api({action:'ready',...authA,ships:touching},400);
await api({action:'ready',...authA,ships:fleet(0)});
const start=await api({action:'ready',...authB,ships:fleet(50)}); assert.equal(start.game.phase,'battle');
assert.equal(JSON.stringify(start.game).includes(a.token),false); assert.deepEqual(start.game.enemyShips,[]);
await api({action:'ready',...authA,ships:fleet(10)},400);
await api({action:'fire',...authB,cell:90},400);
const concurrent=await Promise.all([99,98].map(cell=>fetch(`${base}/api/game`,{method:'POST',headers:{'Content-Type':'application/json','Origin':new URL(base).origin},body:JSON.stringify({action:'fire',...authA,cell})})));
assert.deepEqual(concurrent.map(r=>r.status).sort((a,b)=>a-b),[200,400]); count+=2;
let snapshot=(await api({action:'state',...authA})).game; assert.equal(snapshot.shots.length,1); assert.equal(snapshot.turn,1);
await api({action:'fire',...authB,cell:99});
await api({action:'fire',...authA,cell:snapshot.shots[0].cell},400);
const remaining=fleet(50).flatMap(s=>s.cells).filter(c=>!snapshot.shots.some(s=>s.cell===c));
for(let i=0;i<remaining.length;i++) {
  snapshot=(await api({action:'fire',...authA,cell:remaining[i]})).game;
  if(snapshot.lastShot.sunk===0){assert.equal(snapshot.cleared.includes(15),true);await api({action:'fire',...authA,cell:15},400);assert.equal((await api({action:'state',...authA})).game.shots.length,snapshot.shots.length);}
  if(i<remaining.length-1) { assert.equal(snapshot.turn,0); assert.equal(snapshot.lastShot.hit,true); }
}
assert.equal(snapshot.phase,'finished'); assert.equal(snapshot.winner,0); assert.equal(snapshot.players[0].sunk.length,5);
const refreshed=await api({action:'state',...authA}); assert.equal(refreshed.game.winner,0);
const rival=await api({action:'state',...authB}); assert.equal(rival.game.winner,0); assert.equal(rival.game.incoming.length,18); assert.equal(rival.game.incoming.filter(shot=>shot.hit).length,17);
await api({action:'fire',...authB,cell:98},400);
await api({action:'rematch',...authA}); const reset=await api({action:'rematch',...authB});
assert.equal(reset.game.round,2); assert.equal(reset.game.phase,'placement'); assert.deepEqual(reset.game.ships,[]);
await api({action:'ready',...authA,ships:fleet(0)}); const next=await api({action:'ready',...authB,ships:fleet(50)}); assert.equal(next.game.turn,1);
console.log(`PASS: ${count} requests; two independent player sessions, privacy, simultaneous shots, full match, refresh, and rematch.`);
