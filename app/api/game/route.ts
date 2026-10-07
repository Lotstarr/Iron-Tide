import { env } from 'cloudflare:workers';
import { act, makePlayer, view, recordEvent, randomFleet, roomFleet, advanceBot, GameError, fleetFromQuantities, CLASSIC_FLEET, type Game } from '@/lib/game';

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
async function hash(token: string) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}
function nameOf(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 24) throw new GameError('Enter a captain name (1–24 characters).');
  return value.trim();
}
function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), b => chars[b % chars.length]).join('');
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    // Local Worker previews rewrite the request URL behind a public tunnel.
    // Configure that exact public origin instead of trusting forwarded headers.
    const allowedOrigin = env.GAME_ORIGIN || new URL(request.url).origin;
    if (origin && origin !== allowedOrigin) throw new GameError('Open the game directly to play.', 403);
    if (Number(request.headers.get('content-length') || 0) > 12000) throw new GameError('Request too large.', 413);
    const raw = await request.text();
    if (raw.length > 12000) throw new GameError('Request too large.', 413);
    let data;
    try { data = JSON.parse(raw); } catch { throw new GameError('Invalid game request.'); }
    if (!data || typeof data !== 'object') throw new GameError('Invalid game request.');
    const db = env.DB;
    if (!db) throw new GameError('The game database is unavailable. Please try again shortly.', 503);
    if (data.action === 'create') {
      if (data.capacity !== undefined && data.capacity !== 2 && data.capacity !== 4) throw new GameError('Choose two or four players.');
      if (data.mode !== undefined && !['duel','ffa','teams','solo'].includes(data.mode)) throw new GameError('Choose a valid game mode.');
      if ((data.mode === 'teams' || data.mode === 'ffa') && data.capacity !== 4) throw new GameError('This mode needs four captains.');
      if ((data.mode === 'duel' || data.mode === 'solo') && data.capacity === 4) throw new GameError('Duels need two captains.');
      if (data.mode === 'solo' && data.difficulty !== undefined && !['easy','tactical'].includes(data.difficulty)) throw new GameError('Choose Easy or Tactical.');
      const name = nameOf(data.name); const token = crypto.randomUUID() + crypto.randomUUID(); const secret = await hash(token);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = roomCode();
        const game: Game = { code, capacity: data.capacity ?? 2, mode: data.mode ?? (data.capacity === 4 ? 'ffa' : 'duel'), fleet: data.quantities === undefined ? CLASSIC_FLEET : fleetFromQuantities(data.quantities), players: [{ ...makePlayer(name, secret), lastSeen: Date.now(), team: 0 }], phase: 'placement', turn: 0, winner: null, round: 1, lastMove: 'Waiting for a second captain.' };
        if (game.mode === 'solo') game.players.push({ ...makePlayer(data.difficulty === 'tactical' ? 'Admiral Iron · Tactical' : 'Cadet Tide · Easy', crypto.randomUUID()), bot: data.difficulty === 'tactical' ? 'tactical' : 'easy', ready: true, ships: randomFleet(roomFleet(game)), lastSeen: Date.now() });
        recordEvent(game, 'setup', game.mode === 'solo' ? `${name} started solo practice.` : `${name} opened the room.`);
        const result = await db.prepare('INSERT OR IGNORE INTO rooms (code, state, revision, updated_at) VALUES (?, ?, 0, ?)').bind(code, JSON.stringify(game), Date.now()).run();
        if (result.meta.changes) return json({ token, game: view(game, 0, 0) });
      }
      throw new GameError('Could not open a room. Try again.', 503);
    }
    if (typeof data.code !== 'string' || !/^[A-HJ-NP-Z2-9]{6}$/.test(data.code)) throw new GameError('Enter a valid six-character room code.');
    const token = typeof data.token === 'string' && data.token.length <= 100 ? data.token : '';
    const secret = token ? await hash(token) : '';
    const joinToken = data.action === 'join' && !token ? crypto.randomUUID() + crypto.randomUUID() : null;
    const joinSecret = joinToken ? await hash(joinToken) : null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = await db.prepare('SELECT state, revision, updated_at FROM rooms WHERE code = ?').bind(data.code).first<{ state: string; revision: number; updated_at: number }>();
      if (!row || Date.now() - row.updated_at > 7 * 86400000) throw new GameError('This room was not found or has expired. Create a new one.', 404);
      const game: Game = JSON.parse(row.state);
      const migratingPresence = game.turnStartedAt === undefined || game.players.some(player => player.lastSeen === undefined);
      game.turnStartedAt ??= Date.now();
      game.players.forEach(player => { player.lastSeen ??= Date.now(); });
      let me = game.players.findIndex(p => p.secret === secret);
      if (data.action === 'join' && me < 0) {
        if (game.players.length >= (game.capacity ?? 2)) throw new GameError('This room is full. Ask your friend to create a new room.', 409);
        if (!joinSecret) throw new GameError('Your saved seat could not be restored. Return to the lobby and join again.', 401);
        game.players.push({ ...makePlayer(nameOf(data.name), joinSecret), team: game.mode === 'teams' ? [game.players.length % 2, 1 - game.players.length % 2].find(team => game.players.filter((_, i) => (game.players[i].team ?? i % 2) === team).length < 2) : undefined, lastSeen: Date.now() }); me = game.players.length - 1;
        game.lastMove = `${game.players.length} of ${game.capacity ?? 2} captains aboard. Place your fleets!`; recordEvent(game, 'setup', `${game.players[me].name} joined the room.`);
      } else {
        if (me < 0) throw new GameError('Your seat could not be restored. Return to the lobby and join again.', 401);
        if (data.action === 'state' || data.action === 'join') {
          const botMoved = advanceBot(game);
          if (!botMoved && !migratingPresence && Date.now() - (game.players[me].lastSeen ?? 0) < 5000) return json({ game: view(game, me, row.revision) });
        } else act(game, me, data.action, data);
        game.players[me].lastSeen = Date.now();
      }
      // Compare-and-swap keeps simultaneous requests from taking the same turn or seat.
      const result = await db.prepare('UPDATE rooms SET state = ?, revision = revision + 1, updated_at = ? WHERE code = ? AND revision = ?')
        .bind(JSON.stringify(game), Date.now(), data.code, row.revision).run();
      if (result.meta.changes) return json({ ...(joinToken ? { token: joinToken } : {}), game: view(game, me, row.revision + 1) });
    }
    throw new GameError('The game changed while you were playing. Please try again.', 409);
  } catch (error) {
    if (error instanceof GameError) return json({ error: error.message }, error.status);
    console.error('Game request failed:', error);
    return json({ error: 'Could not reach battle control. Please try again.' }, 500);
  }
}
