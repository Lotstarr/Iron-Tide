import assert from 'node:assert/strict';
const base=process.env.GAME_URL || 'http://127.0.0.1:8787';let count=0;
async function api(data,status=200){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(base).origin},body:JSON.stringify(data)});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));count++;return b;}
const a=await api({action:'create',name:'Host',capacity:4,mode:'teams',quantities:[0,0,0,0,2]});const code=a.game.code;const players=[{code,token:a.token}];
for(const name of ['B','C','D']){const b=await api({action:'join',code,name});players.push({code,token:b.token});}
await api({action:'swapTeams',...players[1],from:0,to:1},400);await api({action:'swapTeams',...players[0],from:0,to:2},400);
let state=(await api({action:'swapTeams',...players[0],from:0,to:1})).game;assert.deepEqual(state.players.map(p=>p.team),[1,0,0,1]);assert.equal(state.history.at(-1).text.includes('swapped teams'),true);
const ships=[{cells:[0,1]},{cells:[20,21]}];await api({action:'ready',...players[2],ships});await api({action:'swapTeams',...players[0],from:0,to:1},400);
for(const i of [0,1,3])await api({action:'ready',...players[i],ships});
await api({action:'fire',...players[0],targetPlayer:3,cell:0},400);
for(const targetPlayer of [1,2])for(const cell of [0,1,20,21])state=(await api({action:'fire',...players[0],targetPlayer,cell})).game;
assert.equal(state.winnerTeam,1);assert.equal(state.history.filter(e=>e.kind==='sunk').length,4);assert.equal(state.history.filter(e=>e.kind==='elimination').length,2);assert.equal(state.history.at(-1).kind,'victory');
const refreshed=(await api({action:'state',...players[3]})).game;assert.deepEqual(refreshed.history,state.history);assert.equal(JSON.stringify(refreshed.history).includes(a.token),false);
for(const auth of players)state=(await api({action:'rematch',...auth})).game;
assert.equal(state.history.at(-1).round,2);assert.equal(state.history.some(e=>e.kind==='victory'&&e.round===1),true);assert.deepEqual(state.players.map(p=>p.team),[1,0,0,1]);
console.log(`PASS: ${count} requests; host-only swaps, balanced teams, lock-in protection, recorded hits/sinks/eliminations/victory, refresh and rematch history.`);
