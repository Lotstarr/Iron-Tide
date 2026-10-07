import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const base=process.env.GAME_URL || 'http://127.0.0.1:8787';let count=0;
async function api(data,status=200){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(base).origin},body:JSON.stringify(data)});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));count++;return b;}
await api({action:'create',name:'Test',mode:'solo',difficulty:'invalid'},400);
for(const difficulty of ['easy','tactical']){
 const a=await api({action:'create',name:`Practice ${difficulty}`,mode:'solo',capacity:2,difficulty,quantities:[0,0,0,0,2]});const auth={code:a.game.code,token:a.token};assert.equal(a.game.players[1].ready,true);assert.equal(a.game.players[1].bot,difficulty);assert.equal(a.game.players[1].online,true);assert.deepEqual(a.game.boards[1].ships,[]);
 await api({action:'join',code:auth.code,name:'Intruder'},409);
 let game=(await api({action:'ready',...auth,ships:[{cells:[0,1]},{cells:[20,21]}]})).game;assert.equal(game.phase,'battle');
 for(let cell=99;game.turn===0&&game.phase==='battle';cell--){if(game.boards[1].cleared.includes(cell))continue;game=(await api({action:'fire',...auth,cell,targetPlayer:1})).game;}
 if(game.phase==='battle'){const before=game.incoming.length;await delay(1100);game=(await api({action:'state',...auth})).game;assert.equal(game.incoming.length,before+1);assert.equal(game.lastShot.by,1);assert.equal(game.skipAvailable,false);await api({action:'skip',...auth},400);}
 const restored=(await api({action:'join',...auth,name:'Restored'})).game;assert.equal(restored.me,0);assert.equal(restored.mode,'solo');assert.equal(restored.players[1].bot,difficulty);
}
console.log(`PASS: ${count} requests; both computer difficulties, hidden fleets, automatic turns, full seats and seat restoration.`);
