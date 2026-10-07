export const FLEET = [
  { name: 'Carrier', size: 5 }, { name: 'Battleship', size: 4 },
  { name: 'Cruiser', size: 3 }, { name: 'Submarine', size: 3 }, { name: 'Patrol boat', size: 2 },
];
export type FleetBoat = { name: string; size: number; kind: number };
export const CLASSIC_FLEET: FleetBoat[] = FLEET.map((boat, kind) => ({ ...boat, kind }));
export const QUICK_QUANTITIES = [0, 1, 0, 1, 1];
export function fleetFromQuantities(value: unknown): FleetBoat[] {
  if (!Array.isArray(value) || value.length !== 5 || value.some(count => !Number.isInteger(count) || count < 0 || count > 3)) throw new GameError('Choose between 0 and 3 of each boat.');
  const count = value.reduce((sum, n) => sum + n, 0);
  if (count < 2 || count > 10) throw new GameError('Choose a fleet of 2 to 10 boats.');
  return FLEET.flatMap((boat, kind) => Array.from({ length: value[kind] }, (_, i) => ({ ...boat, kind, name: value[kind] > 1 ? `${boat.name} ${i + 1}` : boat.name })));
}
export function roomFleet(game: Game): FleetBoat[] { return game.fleet ?? CLASSIC_FLEET; }
export type Ship = { cells: number[] };
export type Shot = { cell: number; hit: boolean; sunk: number | null; target?: number; by?: number };
export type ShotResult = { by: number; cell: number; hit: boolean; sunk: number | null; target?: number };
export type Player = { name: string; secret: string; ships: Ship[]; ready: boolean; shots: Shot[]; rematch: boolean; team?: number; lastSeen?: number; bot?: 'easy' | 'tactical' };
export type BattleEvent = { id: number; round: number; at: number; kind: 'hit' | 'miss' | 'sunk' | 'elimination' | 'victory' | 'skip' | 'setup'; text: string };
export type Game = {
  code: string; capacity?: number; mode?: 'duel' | 'ffa' | 'teams' | 'solo'; winnerTeam?: number | null; turnStartedAt?: number; botNextAt?: number; fleet?: FleetBoat[]; players: Player[]; phase: 'placement' | 'battle' | 'finished';
  turn: number; winner: number | null; round: number; lastMove: string; lastShot?: ShotResult | null; history?: BattleEvent[];
};
export type View = {
  code: string; mode: 'duel' | 'ffa' | 'teams' | 'solo'; winnerTeam: number | null; skipAvailable: boolean; skipIn: number; capacity: number; boards: TargetBoard[]; phase: Game['phase']; turn: number; winner: number | null; round: number;
  lastMove: string; lastShot: ShotResult | null; history: BattleEvent[]; me: number; revision: number; fleet: FleetBoat[];
  players: { name: string; ready: boolean; rematch: boolean; team: number | null; bot: 'easy' | 'tactical' | null; online: boolean; eliminated: boolean; hits: number; sunk: number[] }[];
  ships: Ship[]; shots: Shot[]; incoming: Shot[]; enemyShips: Ship[]; enemySunkShips: Ship[]; cleared: number[]; incomingCleared: number[];
};
export function recordEvent(game: Game, kind: BattleEvent['kind'], text: string, now = Date.now()) {
  const history = game.history ?? [];
  game.history = [...history, { id: (history.at(-1)?.id ?? 0) + 1, round: game.round, at: now, kind, text }].slice(-100);
}
export const OFFLINE_AFTER = 15000;
export const SKIP_AFTER = 60000;
export function teamOf(game: Game, index: number) { return game.players[index].team ?? index % 2; }
export function skipWait(game: Game, now = Date.now()) { return Math.max(0, SKIP_AFTER - (now - Math.max(game.players[game.turn]?.lastSeen ?? now, game.turnStartedAt ?? now))); }
export type TargetBoard = { shots: Shot[]; ships: Ship[]; sunkShips: Ship[]; cleared: number[] };
export function attacksOn(game: Game, target: number): Shot[] {
  return game.players.flatMap((player, by) => player.shots.filter(shot => (shot.target ?? 1 - by) === target).map(shot => ({ ...shot, by })));
}
export function eliminated(game: Game, target: number): boolean {
  const player = game.players[target];
  const hits = new Set(attacksOn(game, target).filter(shot => shot.hit).map(shot => shot.cell));
  return player.ready && player.ships.every(ship => ship.cells.every(cell => hits.has(cell)));
}
function nextTurn(game: Game, me: number): number {
  for (let step = 1; step <= game.players.length; step++) { const next = (me + step) % game.players.length; if (!eliminated(game, next)) return next; }
  return me;
}
export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function surroundingCells(cells: number[]): number[] {
  const area = new Set<number>();
  for (const cell of cells) {
    const row = Math.floor(cell / 10), col = cell % 10;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < 10 && c >= 0 && c < 10) area.add(r * 10 + c);
    }
  }
  return [...area];
}
export function clearedWater(player: Player, enemy?: Player): number[] {
  if (!enemy) return [];
  const occupied = new Set(enemy.ships.flatMap(ship => ship.cells));
  return [...new Set(player.shots.filter(shot => shot.sunk !== null).flatMap(shot => surroundingCells(enemy.ships[shot.sunk!].cells)))].filter(cell => !occupied.has(cell));
}
export function validFleet(value: unknown, fleet: FleetBoat[] = CLASSIC_FLEET): value is Ship[] {
  if (!Array.isArray(value) || value.length !== fleet.length) return false;
  const used = new Set<number>();
  return value.every((ship, index) => {
    if (!ship || !Array.isArray(ship.cells) || ship.cells.length !== fleet[index].size) return false;
    const cells = [...ship.cells].sort((a, b) => a - b);
    if (cells.some(cell => !Number.isInteger(cell) || cell < 0 || cell >= 100 || used.has(cell))) return false;
    if (new Set(cells).size !== cells.length) return false;
    const horizontal = cells.every((cell, i) => cell === cells[0] + i && Math.floor(cell / 10) === Math.floor(cells[0] / 10));
    const vertical = cells.every((cell, i) => cell === cells[0] + i * 10);
    if (!horizontal && !vertical) return false;
    surroundingCells(cells).forEach(cell => used.add(cell)); return true;
  });
}
export function makePlayer(name: string, secret: string): Player {
  return { name, secret, ships: [], ready: false, shots: [], rematch: false };
}
export function coordinate(cell: number) { return `${'ABCDEFGHIJ'[Math.floor(cell / 10)]}${cell % 10 + 1}`; }
export function act(game: Game, me: number, action: string, data: { ships?: unknown; cell?: unknown; targetPlayer?: unknown; team?: unknown; from?: unknown; to?: unknown }, now = Date.now()) {
  const player = game.players[me];
  if (!player) throw new GameError('Rejoin this room to play.', 401);
  if (action === 'swapTeams') {
    if (me !== 0 || game.mode !== 'teams' || game.phase !== 'placement') throw new GameError('Only the room creator can swap teams before the battle.');
    if (game.players.some(p => p.ready)) throw new GameError('Teams are locked once any captain locks their fleet.');
    const { from, to } = data;
    if (typeof from !== 'number' || typeof to !== 'number' || !Number.isInteger(from) || !Number.isInteger(to) || !game.players[from] || !game.players[to] || from === to || teamOf(game, from) === teamOf(game, to)) throw new GameError('Choose one captain from each team.');
    const first = teamOf(game, from), second = teamOf(game, to);
    game.players[from].team = second; game.players[to].team = first;
    game.lastMove = `${game.players[from].name} and ${game.players[to].name} swapped teams.`;
    recordEvent(game, 'setup', game.lastMove, now);
  } else if (action === 'team') {
    if (game.mode !== 'teams' || game.phase !== 'placement' || player.ready) throw new GameError('Choose your team before locking your fleet.');
    if (data.team !== 0 && data.team !== 1) throw new GameError('Choose Azure or Ember.');
    if (game.players.filter((_, i) => i !== me && teamOf(game, i) === data.team).length >= 2) throw new GameError('That team already has two captains.');
    player.team = data.team; game.lastMove = `${player.name} joined Team ${data.team === 0 ? 'Azure' : 'Ember'}.`; recordEvent(game, 'setup', game.lastMove, now);
  } else if (action === 'skip') {
    if (game.mode === 'solo' || game.phase !== 'battle' || game.turn === me || eliminated(game, me)) throw new GameError('Only a surviving waiting captain can skip an offline turn.');
    if (skipWait(game, now) > 0) throw new GameError('Give the offline captain a full minute to reconnect.');
    const skipped = game.turn;
    let next = nextTurn(game, skipped);
    for (let step = 1; step <= game.players.length; step++) { const candidate = (skipped + step) % game.players.length; if (!eliminated(game, candidate) && now - (game.players[candidate].lastSeen ?? 0) < OFFLINE_AFTER) { next = candidate; break; } }
    game.turn = next; game.turnStartedAt = now; game.lastShot = null;
    game.lastMove = `${game.players[skipped].name} was offline. Turn passes to ${game.players[next].name}; their fleet remains in play.`; recordEvent(game, 'skip', game.lastMove, now);
  } else if (action === 'ready') {
    if (game.phase !== 'placement' || player.ready) throw new GameError('Your fleet is already locked in.');
    if (!validFleet(data.ships, roomFleet(game))) throw new GameError(`Place all ${roomFleet(game).length} ships in straight lines with a one-square gap, including diagonally.`);
    if (game.mode === 'teams' && game.players.length === 4 && game.players.filter((_, i) => teamOf(game, i) === 0).length !== 2) throw new GameError('Each team needs two captains before locking in.');
    player.ships = data.ships.map(ship => ({ cells: [...ship.cells] })); player.ready = true;
    if (game.players.length === (game.capacity ?? 2) && game.players.every(p => p.ready)) {
      game.phase = 'battle'; game.turnStartedAt = now; game.turn = (game.round - 1) % game.players.length; game.lastMove = 'All fleets are ready. Battle stations!'; recordEvent(game, 'setup', game.lastMove, now);
    }
  } else if (action === 'fire') {
    if (game.phase !== 'battle') throw new GameError('The battle has not started or is already over.');
    if (game.turn !== me) throw new GameError('Wait for your turn.');
    const cell = data.cell;
    if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell >= 100) throw new GameError('Choose a square on the board.');
    const target = data.targetPlayer ?? (game.players.length === 2 ? 1 - me : undefined);
    if (typeof target !== 'number' || !Number.isInteger(target) || target === me || !game.players[target]) throw new GameError('Choose an opposing captain.');
    if (game.mode === 'teams' && teamOf(game, target) === teamOf(game, me)) throw new GameError('Choose an enemy fleet. Friendly fire is disabled.');
    if (eliminated(game, target)) throw new GameError('That fleet has already been eliminated. Choose another captain.');
    const shots = attacksOn(game, target);
    if (shots.some(shot => shot.cell === cell)) throw new GameError('That square has already been targeted.');
    const enemy = game.players[target];
    if (clearedWater({ ...player, shots }, enemy).includes(cell)) throw new GameError('That water is already cleared around a sunk ship. Choose another square.');
    const shipIndex = enemy.ships.findIndex(ship => ship.cells.includes(cell));
    const hit = shipIndex !== -1;
    const struck = new Set([...shots.filter(shot => shot.hit).map(shot => shot.cell), cell]);
    const sunk = hit && enemy.ships[shipIndex].cells.every(c => struck.has(c)) ? shipIndex : null;
    player.shots.push({ cell, hit, sunk, target });
    game.lastShot = { by: me, target, cell, hit, sunk };
    game.lastMove = `${player.name} fired at ${enemy.name}’s ${coordinate(cell)}: ${sunk !== null ? `${roomFleet(game)[sunk].name} sunk!` : hit ? 'hit!' : 'miss.'}`;
    recordEvent(game, sunk !== null ? 'sunk' : hit ? 'hit' : 'miss', game.lastMove, now);
    if (eliminated(game, target)) recordEvent(game, 'elimination', `${enemy.name}’s entire fleet was eliminated.`, now);
    const survivors = game.players.map((_, i) => i).filter(i => !eliminated(game, i));
    if (survivors.length === 1 || (game.mode === 'teams' && survivors.every(i => teamOf(game, i) === teamOf(game, survivors[0])))) { game.phase = 'finished'; game.winner = survivors[0]; game.winnerTeam = game.mode === 'teams' ? teamOf(game, survivors[0]) : null; game.lastMove += game.mode === 'teams' ? ` Team ${game.winnerTeam === 0 ? 'Azure' : 'Ember'} wins!` : ` ${game.players[survivors[0]].name} wins!`; }
    else { game.turn = hit ? me : nextTurn(game, me); game.turnStartedAt = now; game.lastMove += eliminated(game, target) ? ` ${enemy.name} is eliminated. Fire again.` : hit ? ' Fire again.' : ` Turn passes to ${game.players[game.turn].name}.`; }
    if (game.mode === 'solo' && game.turn === 1) game.botNextAt = now + 900;
    if (game.phase === 'finished') recordEvent(game, 'victory', game.mode === 'teams' ? `Team ${game.winnerTeam === 0 ? 'Azure' : 'Ember'} wins the battle!` : `${game.players[game.winner!].name} wins the battle!`, now);
  } else if (action === 'rematch') {
    if (game.phase !== 'finished') throw new GameError('Finish this battle before starting a rematch.');
    player.rematch = true; if (game.mode === 'solo') game.players[1].rematch = true;
    if (game.players.every(p => p.rematch)) {
      game.players = game.players.map(p => ({ ...makePlayer(p.name, p.secret), team: p.team, lastSeen: p.lastSeen, bot: p.bot }));
      game.lastShot = null;
      game.round += 1; game.phase = 'placement'; game.winner = null; game.winnerTeam = null;
      game.turn = (game.round - 1) % game.players.length; game.lastMove = 'New battle. Place your fleet!'; recordEvent(game, 'setup', game.lastMove, now);
      if (game.mode === 'solo') { game.players[1].ships = randomFleet(roomFleet(game)); game.players[1].ready = true; game.botNextAt = now + 900; }
    }
  } else throw new GameError('Unknown game action.');
}
export function view(game: Game, me: number, revision: number, now = Date.now()): View {
  const mine = game.players[me];
  const boards: TargetBoard[] = game.players.map((enemy, target) => {
    const shots = attacksOn(game, target);
    return { shots, ships: game.phase === 'finished' ? enemy.ships : [], cleared: clearedWater({ ...mine, shots }, enemy),
      sunkShips: shots.some(shot => shot.sunk !== null) ? enemy.ships.map((ship, i) => shots.some(shot => shot.sunk === i) ? ship : { cells: [] }) : [] };
  });
  const enemyIndex = game.players.findIndex((_, i) => i !== me && (game.mode !== 'teams' || teamOf(game, i) !== teamOf(game, me)));
  const board = boards[enemyIndex];
  return {
    code: game.code, mode: game.mode ?? ((game.capacity ?? 2) === 4 ? 'ffa' : 'duel'), winnerTeam: game.winnerTeam ?? null, skipIn: Math.ceil(skipWait(game, now) / 1000), skipAvailable: game.mode !== 'solo' && game.phase === 'battle' && game.turn !== me && !eliminated(game, me) && skipWait(game, now) === 0, capacity: game.capacity ?? 2, boards: boards.map((board, i) => i === me ? { ...board, ships: [], sunkShips: [] } : board), phase: game.phase, turn: game.turn, winner: game.winner, round: game.round,
    lastMove: game.lastMove, lastShot: game.lastShot ?? null, history: game.history ?? [], me, revision, fleet: roomFleet(game),
    players: game.players.map((p, i) => ({ name: p.name, bot: p.bot ?? null, team: game.mode === 'teams' ? teamOf(game, i) : null, online: Boolean(p.bot) || now - (p.lastSeen ?? 0) < OFFLINE_AFTER, ready: p.ready, rematch: p.rematch, eliminated: eliminated(game, i),
      hits: p.shots.filter(s => s.hit).length, sunk: p.shots.filter(s => s.sunk !== null).map(s => s.sunk!) })),
    ships: mine.ships, shots: mine.shots, incoming: attacksOn(game, me), cleared: board?.cleared ?? [], incomingCleared: boards[me].cleared,
    enemyShips: board?.ships ?? [], enemySunkShips: board?.sunkShips ?? [],
  };
}
export function chooseBotShot(game: Game, random = Math.random): number {
  const bot = game.players[1];
  const publicBoard = view(game, 1, 0).boards[0];
  const blocked = new Set([...publicBoard.shots.map(shot => shot.cell), ...publicBoard.cleared]);
  const available = Array.from({ length: 100 }, (_, cell) => cell).filter(cell => !blocked.has(cell));
  if (bot.bot === 'tactical') {
    const sunkCells = new Set(publicBoard.sunkShips.flatMap(ship => ship.cells));
    const hits = publicBoard.shots.filter(shot => shot.hit && !sunkCells.has(shot.cell)).map(shot => shot.cell);
    const adjacent = [...new Set(hits.flatMap(cell => [cell - 10, cell + 10, ...(cell % 10 > 0 ? [cell - 1] : []), ...(cell % 10 < 9 ? [cell + 1] : [])]))].filter(cell => available.includes(cell));
    if (adjacent.length) return adjacent[Math.floor(random() * adjacent.length)];
    const hunt = available.filter(cell => (Math.floor(cell / 10) + cell % 10) % 2 === 0);
    if (hunt.length) return hunt[Math.floor(random() * hunt.length)];
  }
  return available[Math.floor(random() * available.length)];
}
export function advanceBot(game: Game, now = Date.now(), random = Math.random): boolean {
  if (game.mode !== 'solo' || game.phase !== 'battle' || game.turn !== 1 || now < (game.botNextAt ?? 0)) return false;
  act(game, 1, 'fire', { cell: chooseBotShot(game, random), targetPlayer: 0 }, now);
  game.botNextAt = now + 900;
  return true;
}
export function randomFleet(fleet: FleetBoat[] = CLASSIC_FLEET): Ship[] {
  for (let attempt = 0; attempt < 30; attempt++) {
    const used = new Set<number>(); const ships: Ship[] = [];
    for (const { size } of fleet) {
      let placed = false;
      for (let retry = 0; retry < 100; retry++) {
        const vertical = Math.random() < .5;
        const row = Math.floor(Math.random() * (vertical ? 11 - size : 10));
        const col = Math.floor(Math.random() * (vertical ? 10 : 11 - size));
        const cells = Array.from({ length: size }, (_, i) => row * 10 + col + i * (vertical ? 10 : 1));
        if (cells.every(c => !used.has(c))) { surroundingCells(cells).forEach(c => used.add(c)); ships.push({ cells }); placed = true; break; }
      }
      if (!placed) break;
    }
    if (ships.length === fleet.length) return ships;
  }
  // Pair long and short boats on alternating rows, keeping a gap in both axes.
  const remaining = fleet.map((boat, index) => ({ ...boat, index })).sort((a, b) => b.size - a.size);
  const result: Ship[] = fleet.map(() => ({ cells: [] })); let row = 0;
  while (remaining.length) {
    const first = remaining.shift()!;
    result[first.index] = { cells: Array.from({ length: first.size }, (_, col) => row * 10 + col) };
    const partnerIndex = remaining.findLastIndex(boat => first.size + 1 + boat.size <= 10);
    if (partnerIndex >= 0) {
      const partner = remaining.splice(partnerIndex, 1)[0];
      result[partner.index] = { cells: Array.from({ length: partner.size }, (_, col) => row * 10 + first.size + 1 + col) };
    }
    row += 2;
  }
  return result;
}
