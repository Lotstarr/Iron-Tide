import assert from 'node:assert/strict';
import { fleetFromQuantities,QUICK_QUANTITIES } from '../lib/game.ts';
const origin=process.env.GAME_URL||'http://127.0.0.1:8787';
async function request(body,status=200){const r=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;}
await request({action:'create',name:'Invalid Settings',quantities:[3,3,3,3,3]},400);
for(const quantities of [QUICK_QUANTITIES,[2,0,0,0,0]]) {
 const boats=fleetFromQuantities(quantities);
 const created=await request({action:'create',name:'Settings Captain',quantities});
 const a={code:created.game.code,token:created.token};
 const joined=await request({action:'join',code:a.code,name:'Settings Rival',quantities:[1,1,1,1,1]});
 const b={code:a.code,token:joined.token};
 assert.deepEqual(joined.game.fleet,boats);
 const fleetA=boats.map((boat,i)=>({cells:Array.from({length:boat.size},(_,j)=>i*20+j)}));
 const fleetB=boats.map((boat,i)=>({cells:Array.from({length:boat.size},(_,j)=>i*20+9-j)}));
 await request({action:'ready',...a,ships:[]},400);
 await request({action:'ready',...a,ships:fleetA});await request({action:'ready',...b,ships:fleetB});
 const cells=fleetB.flatMap(ship=>ship.cells);let win;
 for(let i=0;i<cells.length;i++){win=await request({action:'fire',...a,cell:cells[i]});if(i<cells.length-1)assert.equal(win.game.turn,0);}
 assert.equal(win.game.phase,'finished');assert.equal(win.game.players[0].sunk.length,boats.length);
 assert.equal(win.game.players[0].hits,cells.length);
 await request({action:'rematch',...a});const rematch=await request({action:'rematch',...b});
 assert.deepEqual(rematch.game.fleet,boats);assert.equal(rematch.game.phase,'placement');
}
console.log('PASS: Quick and duplicate-boat custom rooms, shared settings, invalid fleets, complete matches, and rematches.');
