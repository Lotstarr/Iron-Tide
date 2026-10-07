import assert from 'node:assert/strict';
const base=process.env.GAME_URL || 'http://127.0.0.1:8787';let count=0;
async function api(data,status=200){const response=await fetch(`${base}/api/game`,{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(base).origin},body:JSON.stringify(data)});const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));count++;return body;}
await api({action:'create',name:'Invalid',capacity:3},400);
const a=await api({action:'create',name:'Four A',capacity:4,quantities:[0,0,0,0,2]});const code=a.game.code;
const players=[{code,token:a.token}];
for(const name of ['Four B','Four C','Four D']){const joined=await api({action:'join',code,name});assert.equal(joined.game.me,players.length);players.push({code,token:joined.token});}
await api({action:'join',code,name:'Overflow'},409);
const ships=[{cells:[0,1]},{cells:[20,21]}];
for(let i=0;i<4;i++){const result=await api({action:'ready',...players[i],ships});assert.equal(result.game.phase,i===3?'battle':'placement');assert.equal(result.game.capacity,4);assert.deepEqual(result.game.boards[(i+1)%4].ships,[]);}
await api({action:'fire',...players[0],cell:0,targetPlayer:0},400);
await api({action:'fire',...players[0],cell:0},400);
await api({action:'fire',...players[0],cell:0,targetPlayer:1});
await api({action:'fire',...players[0],cell:99,targetPlayer:1});
await api({action:'fire',...players[1],cell:99,targetPlayer:2});
await api({action:'fire',...players[2],cell:0,targetPlayer:1},400);
for(const cell of [1,20,21]) await api({action:'fire',...players[2],cell,targetPlayer:1});
let state=(await api({action:'state',...players[1]})).game;assert.equal(state.players[1].eliminated,true);assert.equal(state.turn,2);assert.equal(state.phase,'battle');assert.equal(state.incoming.filter(s=>s.hit).length,4);
await api({action:'fire',...players[2],cell:98,targetPlayer:1},400);
state=(await api({action:'state',...players[0]})).game;assert.equal(state.boards[1].sunkShips.length,2);assert.equal(state.boards[1].cleared.includes(10),true);assert.deepEqual(state.boards[3].ships,[]);
for(const targetPlayer of [0,3])for(const cell of [0,1,20,21])state=(await api({action:'fire',...players[2],cell,targetPlayer})).game;
assert.equal(state.phase,'finished');assert.equal(state.winner,2);
for(let i=0;i<4;i++)state=(await api({action:'rematch',...players[i]})).game;
assert.equal(state.round,2);assert.equal(state.capacity,4);assert.equal(state.phase,'placement');
console.log(`PASS: ${count} requests; four separate seats, readiness, shared hits, privacy, elimination, victory and rematch.`);
