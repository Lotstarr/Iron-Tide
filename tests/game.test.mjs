import test from 'node:test';
import assert from 'node:assert/strict';
import { act, makePlayer, view, validFleet, randomFleet, FLEET } from '../lib/game.ts';
const fleet = offset => FLEET.map((s, i) => ({ cells: Array.from({ length: s.size }, (_, j) => (offset === 50 ? 5 : 0) + i * 20 + j) }));
function game() { return { code:'ABC234', players:[makePlayer('A','secret-a'), makePlayer('B','secret-b')], phase:'placement', turn:0, winner:null, round:1, lastMove:'' }; }
function battle() { const g = game(); act(g,0,'ready',{ships:fleet(0)}); act(g,1,'ready',{ships:fleet(50)}); return g; }
void test('500 random fleets obey the real placement rules', () => { for (let i=0;i<500;i++) assert.equal(validFleet(randomFleet()),true); });
void test('reject overlapping, bent, wrapped, duplicate, fractional, and incomplete fleets', () => {
  const invalid = [[0,1,2,3,4], [0,1,2,3,14], [8,9,10,11,12], [0,1,2,3,3], [0,1,2,3,4.5]];
  for (const cells of invalid) { const f = fleet(0); if (cells[4] === 4) f[1].cells = [0,1,2,3]; else f[0].cells=cells; assert.equal(validFleet(f),false); }
  assert.equal(validFleet(fleet(0).slice(0,4)),false);
});
void test('both captains must be ready; locked fleets cannot move', () => {
  const g = game(); act(g,0,'ready',{ships:fleet(0)}); assert.equal(g.phase,'placement');
  assert.throws(()=>act(g,0,'ready',{ships:fleet(0)})); assert.throws(()=>act(g,0,'fire',{cell:5}));
  act(g,1,'ready',{ships:fleet(50)}); assert.equal(g.phase,'battle'); assert.equal(g.turn,0);
});
void test('hits and sunk ships earn another shot; misses pass the turn; repeat targets are rejected', () => {
  const g=battle();
  assert.throws(()=>act(g,1,'fire',{cell:99}));
  for(let cell=5;cell<=9;cell++){act(g,0,'fire',{cell});assert.equal(g.turn,0);assert.throws(()=>act(g,1,'fire',{cell:99}));}
  assert.equal(g.lastShot.sunk,0);assert.equal(g.lastShot.hit,true);
  assert.throws(()=>act(g,0,'fire',{cell:5}));assert.throws(()=>act(g,0,'fire',{cell:-1}));assert.throws(()=>act(g,0,'fire',{cell:100}));
  act(g,0,'fire',{cell:99});assert.equal(g.turn,1);assert.equal(g.lastShot.hit,false);
  assert.throws(()=>act(g,0,'fire',{cell:25}));act(g,1,'fire',{cell:98});assert.equal(g.turn,0);
});
void test('no hidden opponent ships or seat secrets leak before game over', () => {
  const g=battle(); const v=view(g,0,2); assert.deepEqual(v.enemyShips,[]); assert.deepEqual(v.ships,fleet(0));
  assert.equal(JSON.stringify(v).includes('secret-'),false); assert.equal('ships' in v.players[1],false);
});
void test('sinking all 17 squares ends the game; both players must request rematch', () => {
  const g=battle(); const cells=fleet(50).flatMap(s=>s.cells);
  cells.forEach(cell=>act(g,0,'fire',{cell}));
  assert.equal(g.phase,'finished'); assert.equal(g.winner,0); assert.equal(g.players[0].shots.filter(s=>s.sunk!==null).length,5);
  assert.deepEqual(view(g,0,40).enemyShips,fleet(50)); assert.throws(()=>act(g,1,'fire',{cell:99}));
  act(g,0,'rematch',{}); assert.equal(g.phase,'finished'); act(g,1,'rematch',{});
  assert.equal(g.round,2); assert.equal(g.phase,'placement'); assert.equal(g.winner,null); assert.equal(g.players[0].shots.length,0);
  assert.equal(g.players[0].ships.length,0); assert.equal(g.players[0].secret,'secret-a');
  act(g,0,'ready',{ships:fleet(0)}); act(g,1,'ready',{ships:fleet(50)}); assert.equal(g.turn,1);
});

void test('only completely sunk enemy ships are revealed during battle', () => {
  const g=battle();
  for (let i=0;i<4;i++) act(g,0,'fire',{cell:5+i});
  assert.deepEqual(view(g,0,10).enemySunkShips,[]);
  act(g,0,'fire',{cell:9});
  const v=view(g,0,11);
  assert.deepEqual(v.enemyShips,[]);
  assert.deepEqual(v.enemySunkShips,[fleet(50)[0],{cells:[]},{cells:[]},{cells:[]},{cells:[]}]);
  assert.deepEqual(view(g,1,11).enemySunkShips,[]);
});

void test('quick and custom fleets enforce their own boat counts, sizes, win condition, and rematch', async () => {
  const { fleetFromQuantities, QUICK_QUANTITIES } = await import('../lib/game.ts');
  for (const quantities of [QUICK_QUANTITIES,[2,0,0,0,0],[3,3,2,1,1]]) {
    const boats=fleetFromQuantities(quantities);
    for(let i=0;i<50;i++) assert.equal(validFleet(randomFleet(boats),boats),true);
    const g=game(); g.fleet=boats;
    assert.throws(()=>act(g,0,'ready',{ships:fleet(0)}));
    const a=randomFleet(boats);
    const b=randomFleet(boats);
    act(g,0,'ready',{ships:a}); act(g,1,'ready',{ships:b});
    assert.deepEqual(view(g,1,2).fleet,boats);
    const targets=b.flatMap(ship=>ship.cells);
    targets.forEach(cell=>act(g,0,'fire',{cell}));
    assert.equal(g.winner,0); assert.equal(g.players[0].shots.filter(shot=>shot.sunk!==null).length,boats.length);
    act(g,0,'rematch',{});act(g,1,'rematch',{});assert.deepEqual(g.fleet,boats);assert.equal(g.round,2);
  }
});
void test('reject invalid fleet quantities', async () => {
  const { fleetFromQuantities }=await import('../lib/game.ts');
  for(const value of [null,[],[0,0,0,0,0],[1,0,0,0,0],[3,3,3,3,3],[4,1,0,0,0],[-1,2,1,1,1],[1.5,1,1,1,1],['1',1,1,1,1]]) assert.throws(()=>fleetFromQuantities(value));
});

void test('ships require diagonal and orthogonal gaps; cleared water stays inside board and cannot be shot', async () => {
  const { surroundingCells, clearedWater } = await import('../lib/game.ts');
  const boats=[{name:'One',size:2,kind:4},{name:'Two',size:2,kind:4}];
  for(const cells of [[2,3],[10,11],[12,13]]) assert.equal(validFleet([{cells:[0,1]},{cells}],boats),false);
  assert.equal(validFleet([{cells:[0,1]},{cells:[23,24]}],boats),true);
  assert.deepEqual(surroundingCells([0,1]).sort((a,b)=>a-b),[0,1,2,10,11,12]);
  const g=game();g.fleet=boats;
  act(g,0,'ready',{ships:[{cells:[0,1]},{cells:[23,24]}]});
  act(g,1,'ready',{ships:[{cells:[0,1]},{cells:[23,24]}]});
  act(g,0,'fire',{cell:0});act(g,0,'fire',{cell:1});
  assert.deepEqual(clearedWater(g.players[0],g.players[1]).sort((a,b)=>a-b),[2,10,11,12]);
  assert.throws(()=>act(g,0,'fire',{cell:12}),/cleared/);assert.equal(g.turn,0);assert.equal(g.players[0].shots.length,2);
  assert.deepEqual(view(g,1,4).incomingCleared.sort((a,b)=>a-b),[2,10,11,12]);
});

void test('crowded fleet shuffle has a valid deterministic fallback', async () => {
 const {fleetFromQuantities}=await import('../lib/game.ts');const boats=fleetFromQuantities([3,3,2,1,1]);
 const original=Math.random;try{Math.random=()=>0;assert.equal(validFleet(randomFleet(boats),boats),true);}finally{Math.random=original;}
});

void test('four-player shared damage, turn order, elimination, privacy and unanimous rematch', () => {
 const g={...game(),capacity:4,players:['A','B','C','D'].map((name,i)=>makePlayer(name,`secret-${i}`))};
 for(let i=0;i<3;i++)act(g,i,'ready',{ships:fleet(0)});
 assert.equal(g.phase,'placement'); act(g,3,'ready',{ships:fleet(0)});assert.equal(g.phase,'battle');
 assert.throws(()=>act(g,0,'fire',{cell:0,targetPlayer:0}));assert.throws(()=>act(g,0,'fire',{cell:0}));
 act(g,0,'fire',{cell:0,targetPlayer:1});act(g,0,'fire',{cell:99,targetPlayer:1});assert.equal(g.turn,1);
 act(g,1,'fire',{cell:99,targetPlayer:2});assert.equal(g.turn,2);
 assert.throws(()=>act(g,2,'fire',{cell:0,targetPlayer:1}));
 for(const cell of fleet(0).flatMap(ship=>ship.cells).filter(cell=>cell!==0))act(g,2,'fire',{cell,targetPlayer:1});
 assert.equal(view(g,1,0).players[1].eliminated,true);assert.equal(g.phase,'battle');assert.equal(g.turn,2);
 assert.throws(()=>act(g,2,'fire',{cell:98,targetPlayer:1}));
 assert.equal(view(g,0,0).boards[1].sunkShips.filter(ship=>ship.cells.length).length,5);
 assert.deepEqual(view(g,0,0).boards[3].ships,[]);assert.deepEqual(view(g,0,0).boards[3].sunkShips,[]);
 act(g,2,'fire',{cell:98,targetPlayer:3});assert.equal(g.turn,3);act(g,3,'fire',{cell:99,targetPlayer:0});assert.equal(g.turn,0);
 act(g,0,'fire',{cell:98,targetPlayer:2});assert.equal(g.turn,2);
 for(const targetPlayer of [0,3])for(const cell of fleet(0).flatMap(ship=>ship.cells))act(g,2,'fire',{cell,targetPlayer});
 assert.equal(g.winner,2);assert.equal(g.phase,'finished');
 for(let i=0;i<3;i++)act(g,i,'rematch',{});assert.equal(g.phase,'finished');act(g,3,'rematch',{});
 assert.equal(g.capacity,4);assert.equal(g.players.length,4);assert.equal(g.phase,'placement');assert.equal(g.round,2);
 for(let i=0;i<4;i++)act(g,i,'ready',{ships:fleet(0)});assert.equal(g.turn,1);
});

void test('teams enforce two seats, friendly-fire protection, team victory and team-preserving rematch',()=>{
 const g={...game(),capacity:4,mode:'teams',players:['A','B','C','D'].map((name,i)=>({...makePlayer(name,`s${i}`),team:i%2}))};
 assert.throws(()=>act(g,0,'team',{team:1}));
 act(g,0,'team',{team:0});
 for(let i=0;i<4;i++)act(g,i,'ready',{ships:fleet(0)});
 assert.throws(()=>act(g,0,'team',{team:1})); assert.throws(()=>act(g,0,'fire',{cell:0,targetPlayer:2}));
 assert.deepEqual(view(g,0,1).boards[2].ships,[]);
 // Eliminate an ally first: they still share their team's eventual win.
 act(g,0,'fire',{cell:99,targetPlayer:1});
 for(const cell of fleet(0).flatMap(s=>s.cells))act(g,1,'fire',{cell,targetPlayer:0});
 assert.equal(g.phase,'battle');act(g,1,'fire',{cell:99,targetPlayer:2});assert.equal(g.turn,2);
 for(const targetPlayer of [1,3])for(const cell of fleet(0).flatMap(s=>s.cells))act(g,2,'fire',{cell,targetPlayer});
 assert.equal(g.phase,'finished');assert.equal(g.winnerTeam,0);assert.equal(view(g,0,1).players[0].eliminated,true);
 for(let i=0;i<4;i++)act(g,i,'rematch',{});assert.equal(g.winnerTeam,null);assert.deepEqual(g.players.map(p=>p.team),[0,1,0,1]);
});
void test('offline skip needs a full grace period, excludes spectators, and reconnect cancels it',()=>{
 const now=100000;
 const g=battle();g.turnStartedAt=now-60000;g.players.forEach(p=>p.lastSeen=now-60000);g.players[1].lastSeen=now;
 assert.equal(view(g,1,1,now).skipAvailable,true);assert.equal(view(g,1,1,now).players[0].online,false);
 assert.throws(()=>act(g,0,'skip',{},now));
 g.players[0].lastSeen=now-59000;assert.throws(()=>act(g,1,'skip',{},now));
 g.players[0].lastSeen=now;assert.equal(view(g,1,1,now).skipAvailable,false);assert.throws(()=>act(g,1,'skip',{},now));
 g.players[0].lastSeen=now-60000;g.turnStartedAt=now-1000;assert.throws(()=>act(g,1,'skip',{},now));
 g.turnStartedAt=now-60000;act(g,1,'skip',{},now);assert.equal(g.turn,1);assert.equal(g.phase,'battle');assert.equal(g.winner,null);assert.equal(g.players[0].shots.length,0);assert.equal(g.turnStartedAt,now);
 assert.throws(()=>act(g,0,'skip',{},now));
});

void test('host swaps keep teams balanced and lock once any fleet is ready',()=>{
 const g={...game(),capacity:4,mode:'teams',players:['A','B','C','D'].map((name,i)=>({...makePlayer(name,`secret${i}`),team:i%2}))};
 assert.throws(()=>act(g,1,'swapTeams',{from:0,to:1}));assert.throws(()=>act(g,0,'swapTeams',{from:0,to:2}));assert.throws(()=>act(g,0,'swapTeams',{from:0,to:9}));
 act(g,0,'swapTeams',{from:0,to:1});assert.deepEqual(g.players.map(p=>p.team),[1,0,0,1]);assert.equal(g.history.at(-1).kind,'setup');
 act(g,2,'ready',{ships:fleet(0)});assert.throws(()=>act(g,0,'swapTeams',{from:0,to:1}));
 assert.deepEqual(g.players.map(p=>p.team),[1,0,0,1]);
});
void test('battle history persists public outcomes and survives rematch without exposing fleets',()=>{
 const g=battle();for(const cell of fleet(50).flatMap(s=>s.cells))act(g,0,'fire',{cell});
 const before=JSON.parse(JSON.stringify(g));const events=view(before,1,1).history;
 assert.equal(events.some(e=>e.kind==='sunk'),true);assert.equal(events.some(e=>e.kind==='elimination'),true);assert.equal(events.at(-1).kind,'victory');
 assert.equal(JSON.stringify(events).includes('secret'),false);assert.equal(events.every(e=>Object.keys(e).sort().join(',')==='at,id,kind,round,text'),true);
 act(g,0,'rematch',{});act(g,1,'rematch',{});assert.equal(g.history.at(-1).round,2);assert.equal(g.history.some(e=>e.kind==='victory'&&e.round===1),true);
});
void test('battle history retains at most 100 recent events with increasing IDs',async()=>{
 const {recordEvent}=await import('../lib/game.ts');const g=game();for(let i=0;i<140;i++)recordEvent(g,'setup',`event ${i}`,i);
 assert.equal(g.history.length,100);assert.equal(g.history[0].id,41);assert.equal(g.history.at(-1).id,140);
});

void test('computer targeting uses public clues, stays on board and cannot cheat',async()=>{
 const {chooseBotShot}=await import('../lib/game.ts');const g=battle();g.mode='solo';g.players[1].bot='tactical';
 g.players[1].shots=[{cell:9,hit:true,sunk:null,target:0}];const cell=chooseBotShot(g,()=>0);assert.ok([8,19].includes(cell));
 const original=chooseBotShot(g,()=>.4);g.players[0].ships=fleet(50);assert.equal(chooseBotShot(g,()=>.4),original);
 g.players[1].bot='easy';for(let i=0;i<100;i++){const next=chooseBotShot(g,()=>i/100);assert.ok(Number.isInteger(next)&&next>=0&&next<100&&next!==9);}
});
void test('solo computer completes a legal match and is ready for an immediate rematch',async()=>{
 const {advanceBot,CLASSIC_FLEET}=await import('../lib/game.ts');
 for(const difficulty of ['easy','tactical']){
  const g={...game(),mode:'solo',players:[makePlayer('Human','h'),{...makePlayer('Computer','b'),bot:difficulty,ships:fleet(50),ready:true}]};
  act(g,0,'ready',{ships:fleet(0)},1000);let now=2000,turns=0;
  while(g.phase==='battle' && turns++<300){if(g.turn===1){assert.equal(advanceBot(g,now,()=>.3),true);}else{const board=view(g,0,0).boards[1];const blocked=new Set([...board.shots.map(s=>s.cell),...board.cleared]);const cell=Array.from({length:100},(_,i)=>i).find(c=>!blocked.has(c));act(g,0,'fire',{cell,targetPlayer:1},now);}now+=1000;}
  assert.equal(g.phase,'finished');assert.ok(turns<300);act(g,0,'rematch',{},now);assert.equal(g.phase,'placement');assert.equal(g.players[1].ready,true);assert.equal(g.players[1].bot,difficulty);assert.equal(validFleet(g.players[1].ships,CLASSIC_FLEET),true);
  act(g,0,'ready',{ships:fleet(0)},now);assert.equal(g.turn,1);assert.equal(advanceBot(g,now),false);assert.equal(advanceBot(g,now+1000),true);
 }
});
