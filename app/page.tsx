'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import { FLEET, CLASSIC_FLEET, QUICK_QUANTITIES, surroundingCells, coordinate, randomFleet, type FleetBoat, type Ship, type Shot, type View } from '@/lib/game';

type Credentials = { code: string; token: string };
function Compass({ small = false }: { small?: boolean }) {
  return <svg width={small ? 28 : 48} height={small ? 28 : 48} viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.4"/><path d="M24 5v7m0 24v7M5 24h7m24 0h7M31 17l-4 10-10 4 4-10 10-4Z" stroke="currentColor" strokeWidth="1.4"/><path d="m31 17-10 4 6 6 4-10Z" fill="currentColor"/></svg>;
}
function ShipIcon({ size = 4, kind = FLEET.findIndex(ship => ship.size === size) }: { size?: number; kind?: number }) {
  return <span className="ship-icon" style={{ width: size * 20 }} aria-hidden="true"><ShipDrawing size={size} kind={kind}/></span>;
}
function ShipDrawing({ size, vertical = false, kind = 1 }: { size: number; vertical?: boolean; kind?: number }) {
  const length = size * 40;
  return <svg className={`boat boat-kind-${kind}`} viewBox={vertical ? `0 0 40 ${length}` : `0 0 ${length} 40`} preserveAspectRatio="none" aria-hidden="true">
    <g transform={vertical ? 'translate(40 0) rotate(90)' : undefined}>
      {kind === 3 ? <>
        <rect className="boat-hull" x="4" y="9" width={length - 8} height="22" rx="11"/>
        <path className="boat-detail" d={`M14 20 H${length - 14} M15 9 V31 M${length - 15} 9 V31`}/>
        <rect className="boat-cabin" x={length * .4} y="13" width="25" height="14" rx="6"/>
        <path className="boat-detail" d={`M${length * .5} 13 V6 h8`}/>
      </> : <>
        <path className="boat-hull" d={`M10 5 H${length - 29} Q${length - 12} 5 ${length - 4} 20 Q${length - 12} 35 ${length - 29} 35 H10 Q4 35 4 29 V11 Q4 5 10 5Z`}/>
        <path className="boat-deck" d={`M15 10 H${length - 32} L${length - 18} 20 L${length - 32} 30 H15Z`}/>
        {kind === 0 ? <>
          <rect className="carrier-runway" x="17" y="13" width={length - 51} height="14" rx="2"/>
          <path className="runway-line" d={`M23 20 H${length - 39}`}/>
          <rect className="boat-cabin" x="65" y="5" width="38" height="8" rx="2"/>
          {[36, 80, 124].map(x => <path key={x} className="carrier-plane" d={`M${x} 14 v12 m-6 -4 6 -3 6 3 m-9 3 h6`}/>)}
        </> : <>
          <rect className="boat-cabin" x={length * .4} y="12" width={Math.max(18, length * .2)} height="16" rx={kind === 4 ? 5 : 3}/>
          <path className="boat-detail" d={`M${length * .46} 12 V28 M${length * .53} 12 V28 M12 20 H26 M${length - 40} 20 H${length - 17}`}/>
          <circle className="boat-turret" cx="29" cy="20" r={kind === 1 ? 6 : 4}/>
          {size > 2 && <circle className="boat-turret" cx={length - 44} cy="20" r={kind === 1 ? 6 : 4}/>}
          {kind === 1 && <path className="boat-detail" d={`M25 17 H13 M25 23 H13 M${length - 40} 17 H${length - 24} M${length - 40} 23 H${length - 24}`}/>}
        </>}
      </>}
    </g>
  </svg>;
}
function NavalScene() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [pulse, setPulse] = useState(0);
  return <div className="living-scene" style={{ '--scene-x': `${pointer.x}px`, '--scene-y': `${pointer.y}px` } as CSSProperties} onPointerMove={event => {
    if (event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPointer({ x: ((event.clientX - bounds.left) / bounds.width - .5) * 18, y: ((event.clientY - bounds.top) / bounds.height - .5) * 14 });
  }} onPointerLeave={() => setPointer({ x: 0, y: 0 })}>
    <div className="scene-camera"><Image src="/naval-hero.png" width={1122} height={1402} unoptimized priority alt="A battleship and escort boat cutting through ocean waves beneath dramatic golden storm clouds"/><div className="scene-ocean-light"/></div>
    <div className="scene-mist mist-near"/><div className="scene-mist mist-far"/><div className="scene-sunlight"/>
    <div className="scene-frame"/><div className="scene-coordinates"><span className="live-dot"/> OPEN SEA / CAPTAINS ABOARD</div>
    {pulse > 0 && <div key={pulse} className="scene-sonar" aria-hidden="true"><i/><i/><i/></div>}
    <div className="scene-caption"><span className="eyebrow">YOUR FLEET AWAITS</span><h2>Command the horizon.</h2><p>A rival. A hidden fleet. An ocean between you.</p><button className="sonar-button" onClick={() => setPulse(pulse + 1)}><span aria-hidden="true">◎</span> Send sonar pulse</button><small className="scene-mouse-hint">Move your cursor to explore the sea</small></div>
  </div>;
}
function Board({ ships, shots, boatTypes = CLASSIC_FLEET, cleared = [], enemy = false, active = false, preview = [], previewKind = 0, invalid = false, onCell, onHover, disabled = false }: {
  ships: Ship[]; shots: Shot[]; boatTypes?: FleetBoat[]; cleared?: number[]; enemy?: boolean; active?: boolean; preview?: number[]; previewKind?: number; invalid?: boolean;
  onCell?: (cell: number) => void; onHover?: (cell: number | null) => void; disabled?: boolean;
}) {
  const occupied = new Set(ships.flatMap(ship => ship.cells));
  const shotCount = shots.length;
  const lastShotCell = shots.at(-1)?.cell ?? null;
  const previousShots = useRef(shotCount);
  const [recentCell, setRecentCell] = useState<number | null>(null);
  useEffect(() => {
    if (shotCount > previousShots.current) setRecentCell(lastShotCell);
    else if (shotCount < previousShots.current) setRecentCell(null);
    previousShots.current = shotCount;
    const timer = setTimeout(() => setRecentCell(null), 1600);
    return () => clearTimeout(timer);
  }, [shotCount, lastShotCell]);
  const previewVertical = preview.length > 1 && preview[1] - preview[0] === 10;
  const canDrawPreview = preview.length > 1 && preview.every(cell => cell >= 0 && cell < 100 && (previewVertical || Math.floor(cell / 10) === Math.floor(preview[0] / 10)));
  return <div className={`board ${enemy ? 'enemy-board' : ''} ${active ? 'active-board' : ''}`} onMouseLeave={() => onHover?.(null)}>
    <span className="axis corner"/>{Array.from({ length: 10 }, (_, i) => <span className="axis" key={`col${i}`}>{i + 1}</span>)}
    {Array.from({ length: 10 }, (_, row) => <div className="board-row" key={row}>
      <span className="axis">{'ABCDEFGHIJ'[row]}</span>
      {Array.from({ length: 10 }, (_, col) => {
        const cell = row * 10 + col; const shot = shots.find(s => s.cell === cell);
        const status = shot ? shot.hit ? 'hit' : 'miss' : cleared.includes(cell) ? 'cleared' : occupied.has(cell) ? 'vessel' : '';
        return <button key={cell} className={`square ${status} ${recentCell === cell ? `recent-${status}` : ''} ${preview.includes(cell) ? invalid ? 'invalid-preview' : 'preview' : ''}`}
          aria-label={`${enemy ? 'Target' : 'Fleet'} ${coordinate(cell)}${status ? `, ${status === 'vessel' ? 'ship' : status}` : ''}`}
          disabled={disabled || !onCell || ((!!shot || cleared.includes(cell)) && enemy)} onClick={() => onCell?.(cell)} onMouseEnter={() => onHover?.(cell)} onFocus={() => onHover?.(cell)}>
          {recentCell === cell && <span className={`shot-effect ${shot?.hit ? 'explosion' : 'splash'}`} aria-hidden="true"><i/><i/><i/><i/></span>}
          {shot ? shot.hit ? <span className="hit-mark"><b>×</b><small>HIT</small></span> : <span className="miss-mark"/> : cleared.includes(cell) ? <span className="cleared-mark" aria-hidden="true">·</span> : null}
        </button>;
      })}
    </div>)}
    <div className="fleet-overlay" aria-hidden="true">{ships.map((ship, i) => {
      if (!ship.cells.length) return null;
      const cells = [...ship.cells].sort((a, b) => a - b);
      const vertical = cells[1] - cells[0] === 10;
      const sunk = cells.every(cell => shots.some(shot => shot.cell === cell && shot.hit));
      return <div key={i} className={`board-boat ${sunk ? 'boat-sunk' : cells.some(cell => shots.some(shot => shot.cell === cell && shot.hit)) ? 'boat-damaged' : ''} ${sunk && recentCell !== null && cells.includes(recentCell) ? 'just-sunk' : ''}`} style={{ gridColumn: `${cells[0] % 10 + 1} / span ${vertical ? 1 : cells.length}`, gridRow: `${Math.floor(cells[0] / 10) + 1} / span ${vertical ? cells.length : 1}` }}><ShipDrawing size={cells.length} vertical={vertical} kind={boatTypes[i]?.kind ?? i}/></div>;
    })}
    {canDrawPreview && <div className={`board-boat boat-preview ${invalid ? 'boat-preview-invalid' : ''}`} style={{ gridColumn: `${preview[0] % 10 + 1} / span ${previewVertical ? 1 : preview.length}`, gridRow: `${Math.floor(preview[0] / 10) + 1} / span ${previewVertical ? preview.length : 1}` }}><ShipDrawing size={preview.length} vertical={previewVertical} kind={previewKind}/></div>}
    </div>
  </div>;
}
function Rules({ boats = CLASSIC_FLEET, capacity = 2, teams = false, solo = false }: { boats?: FleetBoat[]; capacity?: number; teams?: boolean; solo?: boolean }) {
  return <details className="rules"><summary>How to play <span>+</span></summary><div className="rules-content">
    <p><b>1. Hide your fleet.</b> Place {boats.length} ships on your 10 × 10 board: lengths {boats.map(boat => boat.size).join(', ')}. Ships must be straight, horizontal or vertical, with one empty square between boats, including diagonally. They cannot overlap or touch. Select a ship and a starting square, or use Shuffle fleet. Use Horizontal / Vertical or press R to rotate. A placed boat rotates around its first square when it fits.</p>
    {capacity === 4 && !teams && <p><b>Four-player free-for-all.</b> All four captains must join and lock their fleets. Choose an opposing captain before firing. Everyone sees the shots on each enemy board. Damage is shared: you cannot shoot a square already targeted by another captain. Hits keep your turn; misses pass clockwise, skipping eliminated fleets. When your entire fleet sinks you can watch the remaining battle. Turn order follows the captain list, starting with the creator and skipping eliminated captains. The last fleet afloat wins. All four captains must request a rematch.</p>}
    {solo && <p><b>Solo practice.</b> Place your fleet and lock in to start against the computer. Easy fires random shots. Tactical searches in a pattern and follows up around confirmed hits; it cannot see your hidden ships. The same hit streak, spacing, sinking and victory rules apply. Rematches start immediately after you request them.</p>}
    {teams && <p><b>2 vs. 2 teams.</b> Choose Azure or Ember before locking in; each team holds two captains. The room creator can swap captains between teams before anyone locks their fleet. You may attack only the other team. Hits and cleared water are shared, and friendly fire is blocked. Turns follow the captain list; hits keep your turn and misses pass to the next surviving captain. Eliminated allies can watch. A team wins when both enemy fleets are sunk, even if one ally has already been eliminated. All four captains request a rematch.</p>}
    {!solo && <p><b>Disconnected captains.</b> A captain is shown offline after 15 seconds without an update. After a full minute without contact, and at least a minute since their turn began, another surviving captain can skip their turn. Their fleet stays in play and they can return to their saved seat. Skipping never awards a hit or a victory.</p>}
    <p><b>2. Lock in.</b> {solo ? 'The computer fleet is ready. Lock your fleet to begin practice.' : 'Share the room link with your friends. The battle starts when every captain joins and locks their fleet.'} The room creator fires first in the opening round. Enemy ship positions stay hidden.</p>
    <p><b>3. Take turns.</b> Choose one untried square on the opponent’s board. Red × means hit; a white dot means miss. A hit earns another shot, including when you sink a ship. A miss passes to the next surviving captain. A ship sinks when all of its squares are hit; its ship is then revealed on the target board and the one-square border around it is cleared automatically. Cleared water cannot be targeted and does not count as extra shots.</p>
    <p><b>4. {teams ? 'Sink both enemy fleets to win.' : capacity === 4 ? 'Keep your fleet afloat to win.' : 'Sink the whole fleet to win.'}</b> After the battle, all captains can request a rematch. The starting player advances one seat each round. Refreshing this browser restores your seat; rooms expire after seven days without a move.</p>
  </div></details>;
}

export default function Home() {
  const [game, setGame] = useState<View | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [returnSeat, setReturnSeat] = useState<Credentials | null>(null);
  const [inviteMode, setInviteMode] = useState(false);
  const [entry, setEntry] = useState<'solo' | 'create' | 'join' | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reducedEffects, setReducedEffects] = useState(false);
  const [largeTarget, setLargeTarget] = useState(false);
  const [crewDetails, setCrewDetails] = useState(false);
  const [undoFleet, setUndoFleet] = useState<Ship[] | null>(null);
  const [placementHint, setPlacementHint] = useState('');
  const [capacity, setCapacity] = useState(2); const [mode, setMode] = useState<'duel' | 'ffa' | 'teams' | 'solo'>('duel'); const [enemyChoice, setEnemyChoice] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false); const soundRef = useRef(false); const audioRef = useRef<AudioContext | null>(null);
  async function toggleSound() {
    const enabled = !soundRef.current;
    if (enabled) { try { audioRef.current ??= new AudioContext(); await audioRef.current.resume(); } catch { setError('Sound is unavailable in this browser.'); return; } }
    soundRef.current = enabled; setSoundEnabled(enabled);
  }
  function playSound(incoming: boolean, sunk: boolean, hit: boolean) {
    const audio = audioRef.current; if (!soundRef.current || !audio || audio.state !== 'running') return;
    const notes = incoming ? [180, 130] : sunk ? [392, 494, 587, 784] : hit ? [440, 660] : [220];
    notes.forEach((frequency, i) => { const oscillator = audio.createOscillator(); const gain = audio.createGain(); const start = audio.currentTime + i * .13; oscillator.type = incoming ? 'triangle' : 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.09, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .22); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + .24); });
  }
  const [difficulty, setDifficulty] = useState<'easy' | 'tactical'>('easy');
  const [inviteFallback, setInviteFallback] = useState(false);
  const [qr, setQr] = useState(''); const [qrBusy, setQrBusy] = useState(false);
  const [swapFrom, setSwapFrom] = useState(0); const [swapTo, setSwapTo] = useState(1);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const leaveDialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => { if (leavePrompt && leaveDialogRef.current && !leaveDialogRef.current.open) leaveDialogRef.current.showModal(); }, [leavePrompt]);
  const [name, setName] = useState(''); const [code, setCode] = useState('');
  const [preset, setPreset] = useState<'quick' | 'classic' | 'custom'>('classic');
  const [quantities, setQuantities] = useState([1, 1, 1, 1, 1]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [connected, setConnected] = useState(true); const [loaded, setLoaded] = useState(false);
  const [fleet, setFleet] = useState<Ship[]>(FLEET.map(() => ({ cells: [] })));
  const [selected, setSelected] = useState(0); const [vertical, setVertical] = useState(false);
  const [hover, setHover] = useState<number | null>(null); const [copied, setCopied] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [impact, setImpact] = useState<{ key: string; incoming: boolean; won: boolean; sunkName: string | null } | null>(null);
  const sessionEpoch = useRef(0);
  const gameRef = useRef<View | null>(null); const roundRef = useRef<string>(''); const lock = useRef(false);
  function accept(next: View) {
    if (gameRef.current && gameRef.current.code === next.code && gameRef.current.revision > next.revision) return;
    const roundKey = `${next.code}:${next.round}`;
    if (roundRef.current !== roundKey) {
      roundRef.current = roundKey;
      let draft = (next.fleet || CLASSIC_FLEET).map(() => ({ cells: [] as number[] }));
      try { const saved = JSON.parse(localStorage.getItem(`fleet:${roundKey}`) || 'null'); if (Array.isArray(saved) && saved.length === (next.fleet || CLASSIC_FLEET).length) draft = saved; } catch {}
      setUndoFleet(null); setPlacementHint(''); setLargeTarget(false); setFleet(next.ships.length ? next.ships : draft); setSelected(0); setTarget(null); setEnemyChoice(null);
    }
    const previous = gameRef.current;
    if (previous?.code === next.code && previous.round === next.round && next.players.reduce((sum, player) => sum + player.hits, 0) + next.boards.reduce((sum, board) => sum + board.shots.filter(shot => !shot.hit).length, 0) > previous.players.reduce((sum, player) => sum + player.hits, 0) + previous.boards.reduce((sum, board) => sum + board.shots.filter(shot => !shot.hit).length, 0) && next.lastShot) {
      const incoming = (next.lastShot.target ?? 1 - next.lastShot.by) === next.me;
      const outgoing = next.lastShot.by === next.me;
      if (incoming || outgoing) playSound(incoming, next.lastShot.sunk !== null, next.lastShot.hit);
      if (next.lastShot.hit && (incoming || outgoing)) setImpact({ key: `${next.code}:${next.round}:${next.revision}`, incoming, won: next.phase === 'finished' && (next.mode === 'teams' ? next.winnerTeam === next.players[next.me].team : next.winner === next.me), sunkName: next.lastShot.sunk !== null ? next.fleet[next.lastShot.sunk].name : null });
    }
    gameRef.current = next; setGame(next); setConnected(true);
  }
  useEffect(() => {
    if (!impact) return;
    const timer = setTimeout(() => setImpact(null), 2200);
    return () => clearTimeout(timer);
  }, [impact]);
  async function request(action: string, extra: Record<string, unknown> = {}, auth = credentials) {
    const response = await fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...auth, ...extra }), signal: AbortSignal.timeout(12000) });
    const result = await response.json() as { game: View; token?: string; error?: string };
    if (!response.ok) throw new Error(result.error || 'Battle control is unavailable. Try again.');
    return result as { game: View; token?: string };
  }
  useEffect(() => {
    queueMicrotask(() => {
    const room = new URLSearchParams(location.search).get('room')?.toUpperCase() || '';
    setCode(room); setInviteMode(Boolean(room));
    let saved: Credentials | null = null;
    try {
      const recent = room || localStorage.getItem('last-room');
      if (recent) saved = JSON.parse(localStorage.getItem(`seat:${recent}`) || 'null');
      setName(localStorage.getItem('captain-name') || '');
      setReducedEffects(localStorage.getItem('reduced-effects') === 'true');
      const resume = localStorage.getItem('resume-room');
      if (resume) setReturnSeat(JSON.parse(localStorage.getItem(`seat:${resume}`) || 'null'));
    } catch {}
    if (saved?.code && saved.token) {
      const auth = saved;
      setBusy(true); lock.current = true;
      request('state', {}, auth).then(result => { setCredentials(auth); accept(result.game); history.replaceState(null, '', `?room=${auth.code}`); })
        .catch(e => { setReturnSeat(auth); setError(`Could not restore your room. ${e.message} Use Resume room to try again.`); setConnected(false); })
        .finally(() => { setBusy(false); lock.current = false; setLoaded(true); });
    } else setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!credentials) return;
    let stopped = false; let polling = false; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (stopped || polling) return;
      polling = true; clearTimeout(timer);
      try {
        const result = await request('state', {}, credentials);
        if (!stopped) accept(result.game);
      } catch { if (!stopped) setConnected(false); }
      finally { polling = false; if (!stopped) timer = setTimeout(poll, 1500); }
    }
    timer = setTimeout(poll, 1500);
    const resume = () => { if (document.visibilityState === 'visible') void poll(); };
    window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    return () => { stopped = true; clearTimeout(timer); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [credentials]);
  useEffect(() => {
    if (game?.phase === 'placement') {
      try { localStorage.setItem(`fleet:${game.code}:${game.round}`, JSON.stringify(fleet)); } catch {}
    }
  }, [fleet, game?.code, game?.round, game?.phase]);
  async function enter(join: boolean) {
    if (lock.current) return;
    if (!name.trim()) {
      setError('Enter your captain name above before joining or creating a room.');
      document.getElementById('name')?.focus();
      return;
    }
    if (join && code.length !== 6) {
      setError('Enter the six-character room code, or open your friend’s invite link.');
      document.getElementById('code')?.focus();
      return;
    }
    lock.current = true; setBusy(true); setError('');
    try {
      const room = code.trim().toUpperCase();
      let saved = null;
      if (join) { try { saved = JSON.parse(localStorage.getItem(`seat:${room}`) || 'null'); } catch {} }
      const result = await request(join ? 'join' : 'create', { name: name.trim(), ...(!join ? { quantities, capacity, mode, difficulty } : {}), ...(join ? { code: room, ...(saved?.token ? { token: saved.token } : {}) } : {}) }, null);
      const auth = { code: result.game.code, token: result.token || saved?.token };
      if (!auth.token) throw new Error('Your seat could not be saved. Please try again.');
      // Persist the seat before showing the room, so a reload can restore it.
      try { localStorage.setItem(`seat:${auth.code}`, JSON.stringify(auth)); localStorage.setItem('last-room', auth.code);
      localStorage.setItem('captain-name', name.trim()); } catch { setError('Your browser cannot save your seat. Keep this tab open while playing.'); }
      history.replaceState(null, '', `?room=${auth.code}`); setCredentials(auth); accept(result.game);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not join. Try again.'); }
    finally { setBusy(false); lock.current = false; }
  }
  async function action(kind: string, extra: Record<string, unknown> = {}) {
    if (lock.current || !credentials) return;
    const epoch = sessionEpoch.current; const auth = credentials;
    lock.current = true; setBusy(true); setError('');
    try { const result = await request(kind, extra, auth); if (epoch === sessionEpoch.current) { accept(result.game); setTarget(null); } }
    catch (e) { if (epoch === sessionEpoch.current) setError(e instanceof Error ? e.message : 'Connection interrupted. Try again.'); }
    finally { if (epoch === sessionEpoch.current) { setBusy(false); lock.current = false; } }
  }
  function leave(confirmed = false) {
    if (!confirmed && game && game.phase !== 'finished') { setLeavePrompt(true); return; }
    setLeavePrompt(false); setQr(''); setInviteFallback(false);
    setReturnSeat(credentials); setInviteMode(false);
    sessionEpoch.current += 1; lock.current = false; setBusy(false); setTarget(null);
    setCredentials(null); setGame(null); gameRef.current = null; roundRef.current = ''; setCode(''); setError(''); setImpact(null);
    try { if (credentials) localStorage.setItem('resume-room', credentials.code); localStorage.removeItem('last-room'); } catch {} history.replaceState(null, '', '/');
  }
  async function returnToRoom() {
    if (!returnSeat || lock.current) return;
    const auth = returnSeat;
    lock.current = true; setBusy(true); setError('');
    try { const result = await request('state', {}, auth); setCredentials(auth); accept(result.game); history.replaceState(null, '', `?room=${auth.code}`); try { localStorage.setItem('last-room', auth.code); } catch {} }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not return to your room. Try again.'); }
    finally { setBusy(false); lock.current = false; }
  }
  function placement(cell: number) {
    return Array.from({ length: boatTypes[selected].size }, (_, i) => cell + i * (vertical ? 10 : 1));
  }
  function validPlacement(cells: number[]) {
    const occupied = new Set(fleet.filter((_, i) => i !== selected).flatMap(ship => surroundingCells(ship.cells)));
    return cells.every(c => c < 100 && !occupied.has(c) && (vertical || Math.floor(c / 10) === Math.floor(cells[0] / 10)));
  }
  function place(cell: number) {
    const cells = placement(cell);
    if (!validPlacement(cells)) { setPlacementHint(cells.some(c => c >= 100 || (!vertical && Math.floor(c / 10) !== Math.floor(cell / 10))) ? 'Ship extends beyond the board. Choose a different starting square.' : 'Too close to another ship. Leave one empty square around each ship, including diagonally.'); return; }
    const next = fleet.map((ship, i) => i === selected ? { cells } : ship);
    setUndoFleet(fleet); setFleet(next); setPlacementHint(''); setError(''); setHover(null);
    const remaining = next.findIndex(ship => !ship.cells.length);
    if (remaining >= 0) setSelected(remaining);
  }
  function rotateBoat(nextVertical: boolean) {
    const current = fleet[selected]?.cells || [];
    if (current.length) {
      const start = Math.min(...current);
      const nextCells = Array.from({ length: boatTypes[selected].size }, (_, i) => start + i * (nextVertical ? 10 : 1));
      const otherCells = new Set(fleet.filter((_, i) => i !== selected).flatMap(ship => surroundingCells(ship.cells)));
      if (!nextCells.every(cell => cell < 100 && !otherCells.has(cell) && (nextVertical || Math.floor(cell / 10) === Math.floor(start / 10)))) {
        setPlacementHint('Ship cannot rotate here. Move it to an open starting square first.'); return;
      }
      setUndoFleet(fleet); setPlacementHint(''); setFleet(fleet.map((ship, i) => i === selected ? { cells: nextCells } : ship));
    }
    setVertical(nextVertical); setHover(null); setError('');
  }
  async function copyLink() {
    const url = `${location.origin}/?room=${game!.code}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([navigator.clipboard.writeText(url), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Clipboard unavailable')), 1500); })]); setCopied(true); setInviteFallback(false); setTimeout(() => setCopied(false), 4000); }
    catch { setInviteFallback(true); }
    finally { clearTimeout(timer); }
  }
  async function shareRoom() {
    const url = `${location.origin}/?room=${game!.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Join me in Iron Tide', text: `Come aboard room ${game!.code}`, url }); } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) await copyLink(); } }
    else await copyLink();
  }
  async function showQr() {
    if (qr) { setQr(''); return; }
    const epoch = sessionEpoch.current; setQrBusy(true);
    try { const image = await QRCode.toDataURL(`${location.origin}/?room=${game!.code}`, { width: 256, margin: 4, errorCorrectionLevel: 'M' }); if (epoch === sessionEpoch.current) setQr(image); }
    catch { setError('Could not generate the QR code. Use the invite link instead.'); }
    finally { setQrBusy(false); }
  }
  const boatTypes = game?.fleet || CLASSIC_FLEET;
  const boatCount = boatTypes.length;
  const totalSquares = boatTypes.reduce((sum, boat) => sum + boat.size, 0);
  const configuredCount = quantities.reduce((sum, n) => sum + n, 0);
  const configuredSquares = quantities.reduce((sum, n, i) => sum + n * FLEET[i].size, 0);
  const fleetLabel = boatTypes.length === 5 && boatTypes.every((boat, i) => boat.kind === i) ? 'Classic' : boatTypes.length === 3 && boatTypes.map(boat => boat.kind).join(',') === '1,3,4' ? 'Quick' : 'Custom';
  const mine = game?.players[game.me];
  const won = game?.mode === 'teams' ? game.winnerTeam !== null && game.winnerTeam === mine?.team : game?.winner === game?.me;
  const winnerName = game?.mode === 'teams' ? `Team ${game.winnerTeam === 0 ? 'Azure' : 'Ember'}` : game?.players[game.winner ?? -1]?.name;
  const isEnemy = (i: number) => Boolean(game && i !== game.me && (game.mode !== 'teams' || game.players[i].team !== mine?.team));
  const enemyIndex = game && enemyChoice !== null && game.players[enemyChoice] && isEnemy(enemyChoice) && (game.phase === 'finished' || !game.players[enemyChoice].eliminated) ? enemyChoice : game?.players.findIndex((player, i) => isEnemy(i) && (game.phase === 'finished' || !player.eliminated)) ?? -1;
  const opponent = game?.players[enemyIndex]; const enemyBoard = game?.boards[enemyIndex];
  const swapFirst = game?.players[swapFrom] ? swapFrom : 0;
  const swapSecond = game?.players[swapTo] && game.players[swapTo].team !== game.players[swapFirst]?.team ? swapTo : game?.players.findIndex(player => player.team !== game.players[swapFirst]?.team) ?? -1;
  const teamsLocked = game?.players.some(player => player.ready);
  const placing = game?.phase === 'placement' && !mine?.ready;
  const myTurn = game?.phase === 'battle' && game.turn === game.me && !mine?.eliminated;
  const lastShot = game?.lastShot;
  const earnedShot = myTurn && lastShot?.by === game?.me && lastShot.hit;
  const shotMessage = !lastShot ? '' : `${lastShot.by === game?.me ? 'Your shot' : `${game?.players[lastShot.by]?.name}’s shot`} at ${game?.players[lastShot.target ?? 1 - lastShot.by]?.name}’s ${coordinate(lastShot.cell)}: ${lastShot.sunk !== null ? `${boatTypes[lastShot.sunk]?.name || 'Ship'} sunk!` : lastShot.hit ? 'HIT!' : 'MISS.'}`;
  const allPlaced = fleet.length === boatCount && fleet.every((ship, i) => ship.cells.length > 0 && ship.cells.every(cell => !fleet.some((other, j) => i !== j && surroundingCells(other.cells).includes(cell))));
  const preview = hover !== null && placing ? placement(hover) : [];
  useEffect(() => {
    if (!placing) return;
    function onRotate(event: KeyboardEvent) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'r' || (event.target instanceof HTMLElement && event.target.closest('input,select,textarea,[contenteditable="true"]'))) return;
      event.preventDefault(); document.getElementById('rotate-boat')?.click();
    }
    window.addEventListener('keydown', onRotate);
    return () => window.removeEventListener('keydown', onRotate);
  }, [placing]);
  const title = !game ? 'Iron Tide' : game.phase === 'finished' ? won ? 'Victory is yours.' : 'A worthy battle.' : placing ? 'A little strategy. A hidden fleet.' : game.phase === 'placement' ? 'Your fleet is ready.' : myTurn ? 'Make your next move.' : 'The sea holds its breath.';
  return <main className={`${game ? 'naval-world command-bridge' : 'naval-world harbor-lobby'} ${reducedEffects ? 'reduced-effects' : ''} ${largeTarget ? 'large-target-mode' : ''} ${crewDetails ? 'show-crew-details' : ''}`}>
    {leavePrompt && <dialog ref={leaveDialogRef} aria-labelledby="leave-title" aria-describedby="leave-description" className="leave-dialog" onCancel={e => { e.preventDefault(); setLeavePrompt(false); }}><span className="eyebrow">YOUR PROGRESS IS SAVED</span><h2 id="leave-title">Back to lobby?</h2><p id="leave-description">{game?.mode === 'solo' ? 'Your practice match is saved. You can resume it from the lobby.' : game?.phase === 'placement' ? 'Your fleet is saved. Return when you’re ready to finish setting up.' : 'Your seat and fleet are saved. Other captains may be waiting for your next turn.'}</p><div><button autoFocus className="primary" onClick={() => setLeavePrompt(false)}>Keep playing</button><button className="secondary" onClick={() => leave(true)}>Back to lobby</button></div></dialog>}
    {impact && !reducedEffects && <div key={impact.key} className={`impact-screen ${impact.incoming ? 'incoming-flare' : 'hit-celebration'}`} aria-hidden="true">
      {impact.incoming ? <><div className="flare-wash"/><div className="impact-badge warning-badge"><span>⚠</span><strong>{impact.sunkName ? 'SHIP LOST!' : 'INCOMING HIT'}</strong><small>{impact.sunkName ? `${impact.sunkName} has been sunk` : 'Your ship has been struck'}</small></div></> : <><div className="hit-confetti">{Array.from({ length: 20 }, (_, i) => <i key={i} style={{ left: `${5 + i * 4.5}%`, animationDelay: `${i % 4 * .05}s`, background: ['#f0c36e','#73c9b4','#f6edc5'][i % 3] }}/>)}</div><div className="impact-badge celebrate-badge"><span>✹</span><strong>{impact.won ? 'FLEET DESTROYED!' : impact.sunkName ? 'SHIP SUNK!' : 'DIRECT HIT!'}</strong><small>{impact.won ? 'The sea is yours, Captain.' : impact.sunkName ? `${impact.sunkName} destroyed. Surrounding water cleared!` : 'Great shot, Captain. Fire again!'}</small></div></>}
    </div>}
    <header className="topbar"><Link className="brand" href="/" onClick={e => { if (game) { e.preventDefault(); leave(); } }}><Compass small/><span>IRON <i>TIDE</i></span></Link>
      <div className="top-note"><span className="live-dot"/>{game ? `ROOM ${game.code}` : 'A CLASSIC. A FRIEND. AN OPEN SEA.'}</div>
      <button className="text-button sound-toggle" aria-pressed={soundEnabled} onClick={toggleSound}>{soundEnabled ? 'Sound on ♪' : 'Sound off'}</button>
      <button className="text-button effects-toggle" aria-pressed={reducedEffects} onClick={() => { const next = !reducedEffects; setReducedEffects(next); try { localStorage.setItem('reduced-effects', String(next)); } catch {} }}>{reducedEffects ? 'Effects reduced' : 'Full effects'}</button>
      {game ? <button className="lobby-back" onClick={() => leave()}><span aria-hidden="true">←</span> Back to lobby</button> : <a className="text-button" href="#rules">The rules →</a>}
    </header>
    <div className="shell">
      <section className="intro"><div className="eyebrow">{game ? `IRON TIDE / ROUND ${String(game.round).padStart(2, '0')}` : 'MULTIPLAYER BATTLESHIP'}</div><h1 className={!game ? 'game-title' : undefined}>{title}</h1>
        <p>{!game ? 'Rule the sea.' : placing ? `Place your ${boatCount} ships, then lock in. Enemy captains cannot see your ships.` : game.phase === 'finished' ? `${winnerName} won the battle.` : game.phase === 'placement' ? `Keep this page open. All ${game.capacity} captains must join and lock their fleets.` : myTurn ? 'Select a square on the target board, then fire.' : `Waiting for ${game.players[game.turn]?.name} to fire. Plan your next shot.`}</p>
      </section>
      {error && <div role="alert" className="notice error">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
      {!game && returnSeat && <div className="return-room"><div><strong>Saved room · {returnSeat.code}</strong><p>Your seat and fleet are ready when you are.</p></div><button className="secondary" disabled={busy} onClick={returnToRoom}>Resume room →</button></div>}
      {!loaded && <output className="notice restoring-room" aria-live="polite">Restoring your saved seat and preparing the harbor…</output>}
      {!game ? <section className="lobby">
        <div className="lobby-art"><NavalScene/></div>
        <div className="lobby-form"><span className="eyebrow">WELCOME ABOARD</span><h2>{inviteMode ? 'Join your crew.' : 'Take the captain’s seat.'}</h2><p>{inviteMode ? `Join room ${code}. Enter your name below to come aboard.` : 'Play solo or invite friends. Your fleet, your strategy.'}</p>
          <label htmlFor="name">Captain name</label><input id="name" value={name} maxLength={24} placeholder="e.g. Captain Lot" onChange={e => setName(e.target.value)} autoComplete="name" required/>
          {!inviteMode && <div className="entry-paths" aria-label="How would you like to play?">{(['solo','create','join'] as const).map(path => <button key={path} className={`secondary ${entry === path ? 'selected' : ''}`} aria-pressed={entry === path} onClick={() => { setEntry(path); if (path === 'solo') { setMode('solo'); setCapacity(2); } else if (mode === 'solo') { setMode('duel'); setCapacity(2); } }}>{<><span aria-hidden="true">{path === 'solo' ? '◈' : path === 'create' ? '⚓' : '↪'}</span><strong>{path === 'solo' ? 'Play solo' : path === 'create' ? 'Create room' : 'Join a friend'}</strong><small>{path === 'solo' ? 'Face the computer' : path === 'create' ? 'Invite your crew' : 'Enter a room code'}</small></>}</button>)}</div>}
          {!inviteMode && entry && entry !== 'join' && <><fieldset className="fleet-settings"><legend>Choose your game</legend><div className="fleet-presets">{(entry === 'solo' ? ['solo'] as const : ['duel','ffa','teams'] as const).map(option => <button key={option} className={mode === option ? 'selected' : ''} aria-pressed={mode === option} onClick={() => { setMode(option); setCapacity(option === 'duel' || option === 'solo' ? 2 : 4); }}>{option === 'duel' ? '2-player duel' : option === 'ffa' ? '4-player free-for-all' : option === 'teams' ? '2 vs. 2 teams' : 'Solo practice'}</button>)}</div><p className="settings-note">{mode === 'solo' ? 'Play immediately against a computer captain.' : mode === 'teams' ? 'Two captains per team. Sink both enemy fleets to win.' : capacity === 4 ? 'Last fleet afloat wins. All four captains must join.' : 'A classic head-to-head battle.'}</p>{mode === 'solo' && <div className="practice-options"><span>Computer difficulty</span><div className="fleet-presets">{(['easy','tactical'] as const).map(level => <button key={level} className={difficulty === level ? 'selected' : ''} aria-pressed={difficulty === level} onClick={() => setDifficulty(level)}>{level === 'easy' ? 'Easy' : 'Tactical'}</button>)}</div><p className="settings-note">{difficulty === 'easy' ? 'Random shots for a relaxed practice match.' : 'Hunts in a pattern and follows up around hits. It cannot see your hidden fleet.'}</p></div>}</fieldset><fieldset className="fleet-settings"><legend>Choose your fleet</legend><div className="fleet-presets">{(['quick', 'classic', 'custom'] as const).map(option => <button type="button" key={option} aria-pressed={preset === option} className={preset === option ? 'selected' : ''} onClick={() => { setPreset(option); if (option !== 'custom') setQuantities(option === 'quick' ? [...QUICK_QUANTITIES] : [1,1,1,1,1]); }}>{option === 'quick' ? 'Quick · 3 ships' : option === 'classic' ? 'Classic · 5 ships' : 'Custom'}</button>)}</div>
          {preset === 'custom' && <div className="quantity-list">{FLEET.map((boat, kind) => <label key={boat.name}><ShipIcon size={boat.size} kind={kind}/><span>{boat.name}<small>{boat.size} squares long</small></span><select aria-label={`${boat.name} quantity`} value={quantities[kind]} onChange={e => setQuantities(quantities.map((count, i) => i === kind ? Number(e.target.value) : count))}>{[0,1,2,3].map(count => <option key={count} value={count}>{count}</option>)}</select></label>)}</div>}
          <p className={configuredCount < 2 || configuredCount > 10 ? 'fleet-summary error' : 'fleet-summary'}>{configuredCount} ships · {configuredSquares} squares · 10 × 10 board{preset === 'custom' ? ' · Choose 2–10 ships' : ''}</p><p className="settings-note">Every captain gets the same fleet. These settings apply for the whole room.</p></fieldset>
          <button className="primary full" disabled={busy || !loaded} onClick={() => enter(false)}>{busy ? 'Connecting…' : mode === 'solo' ? 'Start practice' : 'Create a room'}<span>→</span></button>
          </>}
          {(inviteMode || entry === 'join') && <><label htmlFor="code">Room code</label><div className="join-row"><input id="code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} maxLength={6} placeholder="ABC123" autoComplete="off" className="code-input"/>
            <button className="secondary" disabled={busy || !loaded} onClick={() => enter(true)}>Join battle</button></div>
          <p className="join-help">{code.length === 6 ? 'Enter your name, then select Join room.' : 'Enter your name and your friend’s six-character room code.'}</p></>}
          {inviteMode && <button className="text-button invite-alternative" onClick={() => { setInviteMode(false); setCode(''); history.replaceState(null, '', '/'); }}>Create your own room instead →</button>}
          <div className="form-note"><span className="live-dot"/>{entry === 'solo' && !inviteMode ? 'No waiting. Practice against a computer captain.' : 'No accounts. Invite friends from any device.'}</div>
        </div>
      </section> : <>
        <div className="room-strip"><div className="room-share"><span className="eyebrow">{game.mode === 'solo' ? 'SOLO PRACTICE' : 'YOUR ROOM'}</span><b>{game.code}</b>{game.mode !== 'solo' && <button className="secondary small" aria-expanded={inviteOpen} onClick={() => setInviteOpen(!inviteOpen)}>{inviteOpen ? 'Close invitation' : 'Invite friends'}</button>}</div><output className={`connection ${connected ? '' : 'offline'}`}><span className="live-dot"/>{connected ? 'Live · updates automatically' : 'Connection interrupted · reconnecting…'}</output>{!connected && <button className="secondary small" disabled={busy} onClick={() => action('state')}>{busy ? 'Reconnecting…' : 'Reconnect now ↻'}</button>}</div>
        {inviteOpen && game.mode !== 'solo' && <section className="invitation-panel" aria-label="Invite friends"><div><strong>Invite your crew</strong><p>Send a link, share from your device, or show a QR code.</p></div><div className="invite-actions"><button className="secondary" onClick={copyLink}>{copied ? 'Link copied ✓' : 'Copy link'}</button><button className="secondary" onClick={shareRoom}>Share invite</button><button className="secondary" disabled={qrBusy} aria-expanded={Boolean(qr)} onClick={showQr}>{qrBusy ? 'Generating…' : qr ? 'Hide QR code' : 'Show QR code'}</button></div></section>}
        {inviteOpen && inviteFallback && game.mode !== 'solo' && <div className="manual-invite"><label htmlFor="invite-url">Automatic copying is unavailable. Tap this link to select it, then copy and send it to your friend.</label><input id="invite-url" readOnly value={`${typeof location !== 'undefined' ? location.origin : ''}/?room=${game.code}`} onFocus={e => e.currentTarget.select()} onClick={e => e.currentTarget.select()}/></div>}
        {inviteOpen && qr && game.mode !== 'solo'  && <section className="invite-qr" aria-label="Room invitation QR code"><Image src={qr} width={256} height={256} unoptimized alt={`Scan to join Iron Tide room ${game.code}`}/><div><span className="eyebrow">BRING YOUR CREW ABOARD</span><h2>Scan to join {game.code}</h2><p>Open your phone camera and scan this code. Your friend can join from any device using this invite.</p><a href={`?room=${game.code}`}>{`${typeof location !== 'undefined' ? location.origin : ''}/?room=${game.code}`}</a></div></section>}
        <div className="room-fleet"><b>{fleetLabel} fleet</b><span>{boatCount} ships · {totalSquares} squares each · 10 × 10 board</span><details><summary>Fleet details</summary><p>{boatTypes.map(boat => `${boat.name} (${boat.size})`).join(' · ')}</p></details></div>
        <button className="text-button crew-toggle" aria-expanded={crewDetails} onClick={() => setCrewDetails(!crewDetails)}>{crewDetails ? 'Hide captain details' : 'Captain details'}</button>
        <div className={`captains crew-grid crew-${game.capacity}`}>{Array.from({ length: game.capacity }, (_, i) => { const player = game.players[i]; return <div key={i} className={player?.team === 0 ? 'team-azure' : player?.team === 1 ? 'team-ember' : ''}><span className="avatar">{player?.name[0].toUpperCase() || '?'}</span><div><strong>{player?.name || `Captain ${i + 1}`}{i === game.me && <small> YOU</small>}</strong><small className="crew-presence">{player && `${player.bot ? `◈ Computer · ${player.bot === 'easy' ? 'Easy' : 'Tactical'}` : player.online ? '● Online' : '○ Offline'}${player.team !== null ? ` · ${player.team === 0 ? 'Azure' : 'Ember'} · ${player.team === mine?.team ? 'ALLY' : 'ENEMY'}` : ''}`}</small><p>{!player ? 'Share your invite link' : player.eliminated ? 'Fleet sunk · watching' : player.ready ? `${player.hits} ${player.hits === 1 ? 'hit' : 'hits'} · ${player.sunk.length} ${player.sunk.length === 1 ? 'ship' : 'ships'} sunk` : 'Placing fleet'}</p></div><span className="player-badge">{!player ? 'OPEN SEAT' : player.eliminated ? 'ELIMINATED' : game.phase === 'battle' && game.turn === i ? 'TURN' : player.ready ? 'READY' : 'SETUP'}</span></div>; })}</div>
        {game.mode === 'teams' && game.phase === 'placement' && <details className="team-arrangement"><summary>Team settings · choose or swap teammates</summary><section className="team-picker"><div><strong>Your team: {mine!.team === 0 ? 'Azure' : 'Ember'}</strong><p>Two captains per team. Choose before locking your fleet.</p></div><div>{[0,1].map(team => <button key={team} className={`secondary ${mine!.team === team ? 'selected' : ''}`} aria-pressed={mine!.team === team} disabled={busy || mine!.ready || (mine!.team !== team && game.players.filter(player => player.team === team).length >= 2)} onClick={() => action('team', { team })}>{team === 0 ? 'Team Azure' : 'Team Ember'} · {game.players.filter(player => player.team === team).length}/2</button>)}</div></section><section className="host-teams" aria-label="Team arrangement"><div><span className="eyebrow">TEAM ARRANGEMENT</span><h2>{game.me === 0 ? 'Choose your teammates.' : 'Your host arranges the teams.'}</h2><p>{teamsLocked ? 'Team swaps are locked because a captain has locked their fleet.' : game.me === 0 ? 'Swap one captain from each team. Every team keeps two seats. Agree on teams before anyone locks in.' : 'Ask the room creator to swap captains before anyone locks in.'}</p></div>{game.me === 0 && <div className="swap-controls"><label>First captain<select aria-label="First captain to swap" value={swapFirst} disabled={busy || teamsLocked} onChange={e => setSwapFrom(Number(e.target.value))}>{game.players.map((player,i) => <option key={i} value={i}>{player.name} · {player.team === 0 ? 'Azure' : 'Ember'}</option>)}</select></label><span aria-hidden="true">⇄</span><label>Opposing captain<select aria-label="Second captain to swap" value={swapSecond} disabled={busy || teamsLocked || swapSecond < 0} onChange={e => setSwapTo(Number(e.target.value))}>{game.players.map((player,i) => player.team !== game.players[swapFirst]?.team && <option key={i} value={i}>{player.name} · {player.team === 0 ? 'Azure' : 'Ember'}</option>)}</select></label><button className="secondary" disabled={busy || teamsLocked || swapSecond < 0} onClick={() => action('swapTeams', { from: swapFirst, to: swapSecond })}>Swap teams ⇄</button></div>}</section></details>}
        {game.phase === 'battle' && mine!.eliminated && <div className="notice">Your fleet has been eliminated. You can watch the remaining captains fight for victory.</div>}
        {game.phase === 'battle' && !lastShot && <output className={`turn-banner ${myTurn ? 'turn-mine' : 'turn-rival'} ${!connected ? 'turn-offline' : ''}`}><span className="turn-emblem" aria-hidden="true">{myTurn ? '◎' : '◷'}</span><div><strong>{!connected ? 'Reconnecting to the sea…' : myTurn ? earnedShot ? 'Hit! Fire again, Captain.' : 'Your turn, Captain.' : `${game.players[game.turn]?.name}’s turn.`}</strong><p>{!connected ? 'Hold fire while the connection returns.' : myTurn ? earnedShot ? 'You earned another shot. Keep firing until you miss.' : 'Choose a coordinate. A hit earns another shot; a miss passes the turn.' : mine!.eliminated ? 'Your fleet is out. Watch the remaining captains battle.' : 'Watch your waters. A rival is lining up a shot.'}</p></div><span className="turn-round">ROUND {String(game.round).padStart(2, '0')}</span></output>}
        {game.phase === 'battle' && game.turn !== game.me && !game.players[game.turn].online && <section className="offline-turn" aria-live="polite"><div><strong>{game.players[game.turn].name} is offline.</strong><p>{game.skipAvailable ? 'The reconnect grace period has passed. Their fleet remains in play.' : `Giving them time to reconnect · skip available in ${game.skipIn}s.`}</p></div><button className="secondary" disabled={!game.skipAvailable || busy || !connected || mine!.eliminated} onClick={() => action('skip')}>Skip offline turn →</button></section>}
        {lastShot && <output className={`shot-announcement ${lastShot.hit ? lastShot.sunk !== null ? 'announce-hit announce-sunk' : 'announce-hit' : 'announce-miss'}`} aria-live="polite"><span className="shot-symbol" aria-hidden="true">{lastShot.hit ? '✹' : '○'}</span><div><strong>{shotMessage}</strong><p>{game.phase === 'finished' ? 'Battle complete. All fleets are revealed.' : lastShot.hit ? lastShot.by === game.me ? lastShot.sunk !== null ? 'Entire ship destroyed. Surrounding water is cleared. Fire again!' : 'Hit confirmed. Choose another square and fire again.' : (lastShot.target ?? 1 - lastShot.by) === game.me ? 'Your fleet was hit. The attacking captain shoots again.' : 'A rival fleet was hit. The attacking captain shoots again.' : lastShot.by === game.me ? `Shot missed. ${game.players[game.turn]?.name} takes the next turn.` : `${game.players[game.turn]?.name} takes the next turn.`}</p></div></output>}
        {game.phase === 'finished' && <section className={`victory match-result ${won ? 'match-won' : 'match-lost'}`} aria-label="Match results">
          {won && <div className="confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${4 + i * 6}%`, animationDelay: `${i % 5 * .15}s`, background: ['#d8a354', '#50877e', '#a7bd89'][i % 3] }}/>)}</div>}
          <div className="result-emblem"><Compass/><span aria-hidden="true">★</span></div>
          <div className="result-copy"><span className="eyebrow">{won ? 'THE SEA IS YOURS' : 'UNTIL THE NEXT TIDE'}</span><h2>{game.mode === 'solo' ? won ? 'You ruled the sea!' : 'The computer wins this round.' : game.mode === 'teams' ? `${winnerName} wins the battle!` : `${winnerName} wins!`}</h2><p>{mine!.rematch ? game.mode === 'solo' ? 'Preparing your next practice match…' : 'Rematch requested. Waiting for all captains.' : opponent?.rematch ? 'A captain requested a rematch. Play again?' : `Battle complete. All fleets are now revealed.`}</p></div>
          <div className="match-stats"><div><b>{game.shots.length}</b><span>Your shots</span></div><div><b>{mine!.hits}</b><span>Your hits</span></div><div><b>{game.shots.length ? Math.round(mine!.hits / game.shots.length * 100) : 0}%</b><span>Accuracy</span></div><div><b>{mine!.sunk.length} / {boatCount * (game.mode === 'teams' ? 2 : game.capacity - 1)}</b><span>Ships you sank</span></div></div>
          <button className="primary" disabled={busy || mine!.rematch} onClick={() => action('rematch')}>{mine!.rematch ? 'Waiting for captains…' : game.mode === 'solo' ? 'Practice again →' : 'Play again →'}</button>
        </section>}
        {game.phase === 'placement' && <p className="compact-readiness" aria-live="polite">{game.players.length}/{game.capacity} captains joined · {game.players.filter(player => player.ready).length}/{game.capacity} fleets ready. {game.mode === 'solo' ? 'Lock your fleet to begin practice.' : 'Battle begins when every fleet is ready.'}</p>}
        <div className={`game-layout ${game.phase === 'placement' ? 'setup-layout' : ''}`}>
          <section className="board-card"><div className="card-heading"><div><span className="eyebrow">HOME WATERS</span><h2>Your fleet</h2></div><span className="card-tag">{placing ? `${fleet.filter(s => s.cells.length).length} / ${boatCount} PLACED` : 'DEFEND'}</span></div>
            {placing && <div className="mobile-ship-picker"><label htmlFor="mobile-boat">Choose a ship · {fleet.filter(ship => ship.cells.length).length}/{boatCount} placed</label><select id="mobile-boat" value={selected} disabled={busy} onChange={e => { const i = Number(e.target.value); setSelected(i); if (fleet[i]?.cells.length) setVertical(fleet[i].cells[1] - fleet[i].cells[0] === 10); setHover(null); }}>{boatTypes.map((boat, i) => <option key={boat.name} value={i}>{fleet[i]?.cells.length ? '✓ ' : ''}{boat.name} · {boat.size} squares</option>)}</select></div>}
            {placing && <div className="rotation-controls"><div><strong>{boatTypes[selected]?.name}</strong><small>{boatTypes[selected]?.size} squares · select a starting square</small></div><div className="orientation-buttons"><button className={!vertical ? 'selected' : ''} aria-pressed={!vertical} onClick={() => rotateBoat(false)} disabled={busy}>↔ Horizontal</button><button className={vertical ? 'selected' : ''} aria-pressed={vertical} onClick={() => rotateBoat(true)} disabled={busy}>↕ Vertical</button></div><button id="rotate-boat" className="secondary rotate-toggle" onClick={() => rotateBoat(!vertical)} disabled={busy}>↻ Rotate ship <kbd>R</kbd></button></div>}
            {placing && placementHint && <output className="placement-feedback" aria-live="polite">{placementHint}</output>}
            <Board cleared={game.incomingCleared || []} boatTypes={boatTypes} ships={placing ? fleet : game.ships} shots={game.incoming} onCell={placing ? place : undefined} onHover={setHover} preview={preview} previewKind={boatTypes[selected]?.kind ?? 0} invalid={preview.length > 0 && !validPlacement(preview)} disabled={busy}/>
            <div className="legend"><span><i className="vessel-key"/>Ship</span><span><i className="hit-key">×</i>Hit</span><span><i className="miss-key"/>Miss</span></div>
          </section>
          {game.phase === 'placement' ? <section className="placement-card"><span className="eyebrow">PREPARE FOR BATTLE</span><h2>{placing ? 'Arrange your fleet.' : 'Fleet locked in.'}</h2><p>{placing ? 'Select a ship, then tap its starting square. Leave one empty square around every ship, including diagonally. Select a placed ship to move or rotate it.' : 'Your fleet is hidden and ready. The battle starts when every captain is ready.'}</p>
            <div className="ship-list">{boatTypes.map((ship, i) => <button key={ship.name} disabled={!placing || busy} className={`ship-choice ${selected === i && placing ? 'selected' : ''}`} onClick={() => { setSelected(i); if (fleet[i]?.cells.length) setVertical(fleet[i].cells[1] - fleet[i].cells[0] === 10); setHover(null); }}><span>{ship.name}<small>{ship.size} squares</small></span><ShipIcon size={ship.size} kind={ship.kind}/><span className="placed-check">{(placing ? fleet[i]?.cells.length : true) ? '✓' : '—'}</span></button>)}</div>
            {placing ? <><div className="setup-tools"><button className="secondary" onClick={() => { setUndoFleet(fleet); setPlacementHint(''); setFleet(randomFleet(boatTypes)); setHover(null); setError(''); }}>Shuffle fleet</button><button className="text-button" onClick={() => { setUndoFleet(fleet); setPlacementHint(''); setFleet(boatTypes.map(() => ({ cells: [] }))); setSelected(0); setError(''); }}>Clear</button><button className="secondary" disabled={!undoFleet || busy} onClick={() => { if (undoFleet) { setFleet(undoFleet); setUndoFleet(null); setPlacementHint('Last placement change undone.'); setHover(null); } }}>Undo</button></div><button className="primary full" disabled={!allPlaced || busy} onClick={() => action('ready', { ships: fleet })}>{busy ? 'Locking in…' : 'Lock in fleet'}<span>→</span></button><p className="small-note">{!allPlaced ? 'Place every ship to unlock this button. Your fleet stays fixed after locking in.' : 'All ships placed. Ready to lock in.'}</p></> : <div className="ready-note"><span className="live-dot"/>{game.players.length < game.capacity ? `Waiting for ${game.capacity - game.players.length} more ${game.capacity - game.players.length === 1 ? 'captain' : 'captains'} to join.` : game.players.filter(player => !player.ready).length ? `Waiting for ${game.players.filter(player => !player.ready).map(player => player.name).join(', ')} to lock in.` : 'All fleets ready. Preparing battle…'}</div>}
          </section> : <section className={`board-card target-card ${game.phase === 'battle' ? 'battle-target' : ''}`}><div className="card-heading"><div><span className="eyebrow">OPPOSING FLEET</span><h2>Enemy waters</h2></div><span className={`card-tag ${myTurn ? 'turn-tag' : ''}`}>{game.phase === 'finished' ? 'REVEALED' : myTurn ? 'YOUR TURN' : 'WAIT'}</span></div>
            {game.capacity === 4 && <div className="opponent-picker"><label htmlFor="target-captain">Choose enemy waters</label><select id="target-captain" value={enemyIndex} onChange={e => { setEnemyChoice(Number(e.target.value)); setTarget(null); }} disabled={busy}>{game.players.map((player, i) => isEnemy(i) && <option key={i} value={i} disabled={game.phase !== 'finished' && player.eliminated}>{player.name}{player.eliminated ? ' · eliminated' : game.turn === i ? ' · taking turn' : ''}</option>)}</select><p>Shots and damage are shared. Target a fresh square on any surviving enemy fleet.</p></div>}
            {game.phase === 'battle' && <button className="secondary target-size-toggle" aria-pressed={largeTarget} onClick={() => setLargeTarget(!largeTarget)}>{largeTarget ? 'Compact targeting' : 'Enlarge targeting'}</button>}
            {largeTarget && <p className="target-scroll-hint">Swipe across the enlarged board to reach every column. Select a square, then confirm your shot below.</p>}
            <Board cleared={enemyBoard?.cleared || []} boatTypes={boatTypes} ships={game.phase === 'finished' ? enemyBoard?.ships || [] : enemyBoard?.sunkShips || []} shots={enemyBoard?.shots || []} enemy active={myTurn} preview={target !== null ? [target] : []} onCell={myTurn ? setTarget : undefined} disabled={!myTurn || busy || !connected}/>
            <div className="legend target-legend"><span><i className="hit-key">×</i>Hit — shoot again</span><span><i className="miss-key"/>Miss — turn passes</span><span><i className="cleared-key"/>Cleared water</span></div>
            <div className="fire-row"><p>{game.phase === 'finished' ? 'Battle complete · enemy fleet revealed.' : mine!.eliminated ? 'Fleet eliminated · watching the battle.' : !connected ? 'Reconnecting… hold fire.' : target !== null ? `Target locked: ${coordinate(target)}` : myTurn ? earnedShot ? 'Hit confirmed — choose your next target.' : 'Choose your next target.' : `Waiting for ${game.players[game.turn]?.name} to fire.`}</p><button className="primary fire-button" disabled={!myTurn || target === null || busy || !connected} onClick={() => action('fire', { cell: target, targetPlayer: enemyIndex })}>{busy ? 'Firing…' : target !== null ? `Fire at ${coordinate(target)} →` : 'Fire →'}</button></div>
          </section>}
        </div>
        <details className="battle-history" aria-label="Battle history"><summary>Captain’s log · Battle history</summary><div className="history-heading"><div><span className="eyebrow">CAPTAIN’S LOG</span><h2>Battle history</h2></div><span>Latest first · last 100 events</span></div>{game.history?.length ? <ol>{[...game.history].reverse().map(event => <li key={event.id} className={`history-${event.kind}`}><span className="history-kind">{event.kind === 'elimination' ? 'FLEET OUT' : event.kind === 'setup' ? 'ROOM' : event.kind.toUpperCase()}</span><div><p>{event.text}</p><small>Round {event.round} · <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></small></div></li>)}</ol> : <p className="history-empty">New moves will appear here. Earlier moves from this room were not recorded.</p>}</details>
      </>}
      <div id="rules"><Rules solo={game ? game.mode === 'solo' : mode === 'solo'} teams={game ? game.mode === 'teams' : mode === 'teams'} capacity={game?.capacity ?? capacity} boats={game ? boatTypes : FLEET.flatMap((boat, kind) => Array.from({ length: quantities[kind] }, () => ({ ...boat, kind })))}/></div>
      <footer><span>IRON TIDE</span><p>A friendly rivalry, wherever you are.</p><span>{game?.capacity ?? capacity} CAPTAINS · {game ? boatCount : configuredCount} SHIPS · {(game?.mode ?? mode) === 'teams' ? '1 WINNING TEAM' : (game?.mode ?? mode) === 'solo' ? 'SOLO PRACTICE' : '1 WINNER'}</span></footer>
    </div>
  </main>;
}
