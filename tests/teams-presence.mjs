import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const base=process.env.GAME_URL || 'http://127.0.0.1:8787';let count=0;
async function api(data,status=200){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',Origin:new URL(base).origin},body:JSON.stringify(data)});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));count++;return b;}
const a=await api({action:'create',name:'Team A',mode:'teams',capacity:4,quantities:[0,0,0,0,2]});const code=a.game.code;const players=[{code,token:a.token}];
for(const name of ['Team B','Team C','Team D']){const b=await api({action:'join',code,name});players.push({code,token:b.token});}
let state=(await api({action:'state',...players[0]})).game;assert.deepEqual(state.players.map(p=>p.team),[0,1,0,1]);assert.equal(state.players.every(p=>p.online),true);
await api({action:'team',...players[0],team:1},400);
const ships=[{cells:[0,1]},{cells:[20,21]}];for(const auth of players)await api({action:'ready',...auth,ships});
await api({action:'fire',...players[0],targetPlayer:2,cell:0},400);await api({action:'skip',...players[1]},400);
for(const targetPlayer of [1,3])for(const cell of [0,1,20,21])state=(await api({action:'fire',...players[0],targetPlayer,cell})).game;
assert.equal(state.winnerTeam,0);assert.equal(state.phase,'finished');assert.equal((await api({action:'state',...players[2]})).game.winnerTeam,0);
for(const auth of players)state=(await api({action:'rematch',...auth})).game;assert.equal(state.mode,'teams');assert.equal(state.winnerTeam,null);assert.deepEqual(state.players.map(p=>p.team),[0,1,0,1]);
console.log('Team victory, friendly-fire protection and rematch passed. Checking real reconnect grace period…');
const c=await api({action:'create',name:'Offline A',quantities:[0,0,0,0,2]});const d=await api({action:'join',name:'Online B',code:c.game.code});const ca={code:c.game.code,token:c.token},da={code:c.game.code,token:d.token};
await api({action:'ready',...ca,ships});await api({action:'ready',...da,ships});await api({action:'skip',...da},400);
await delay(16000);state=(await api({action:'state',...da})).game;assert.equal(state.players[0].online,false);assert.equal(state.skipAvailable,false);
await api({action:'state',...ca});state=(await api({action:'state',...da})).game;assert.equal(state.players[0].online,true);assert.equal(state.skipAvailable,false);
await delay(61000);state=(await api({action:'state',...da})).game;assert.equal(state.skipAvailable,true);state=(await api({action:'skip',...da})).game;assert.equal(state.turn,1);assert.equal(state.phase,'battle');assert.equal(state.winner,null);assert.equal(state.incoming.length,0);
state=(await api({action:'state',...ca})).game;assert.equal(state.players[0].online,true);assert.equal(state.turn,1);
console.log(`PASS: ${count} requests; teams, shared victory, rematch, offline detection, grace period, skip and restored seat.`);
