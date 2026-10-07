# Iron Tide — Multiplayer Battleship

A complete two- or four-player Battleship game with shared online rooms, hidden fleets, server-enforced turns, mobile layouts, written rules, refresh recovery, and rematches.

## Play Iron Tide

**[Play the live game](https://iron-tide.lotstarr.workers.dev/)**

Hosted on Cloudflare Workers with a shared D1 database. The game runs independently of the creator’s computer. Play solo against the computer or invite friends into a shared room.

Enter a captain name, create a room, and copy the invite link to a friend on another device. Choose Quick, Classic, or a custom fleet when creating the room. All players place the same fleet with a one-square gap, including diagonals, and lock in. A hit earns another shot, including a sinking shot; a miss passes the turn. A sunk boat is announced and revealed; the one-square water border around it is automatically cleared and cannot be shot. Cleared squares do not count as fired shots. Sink the whole enemy fleet to win. Use Horizontal/Vertical controls or press R to rotate a placed boat. Select How to play in the game for the full rules.

Four-player free-for-all requires four ready captains. Select an enemy fleet before firing. Shots and damage are shared on each target board; repeat targets are rejected across captains. Misses pass to the next surviving seat, hits retain the turn, eliminated captains can watch, and the last fleet afloat wins. All captains must request a rematch. Sound is off by default; use the header toggle to enable or mute synthesized shot cues.

Run `GAME_URL=<public-url> node tests/four-player.mjs` to verify four independent seats, shared hits, privacy, elimination, victory, and rematch.

## Implementation

- React with Vinext, hosted as a Cloudflare Worker.
- Cloudflare D1 stores shared game state; local development uses its local SQLite emulator.
- Clients fetch their own view every 1.5 seconds. Only completely sunk opponent boats are revealed during play; unsunk opponent ship coordinates remain hidden until game over.
- Seat tokens are random and stored as SHA-256 hashes on the server. Invite links contain only the room code.
- Compare-and-swap database updates prevent concurrent requests from taking the same turn or claiming the same seat.
- Rooms are rejected after seven days without a move. Expired records are retained in the database.

## Local development

Requires Node.js 22.13 or newer.

1. Run `npm ci`.
2. Create `work/wrangler.local.json` with:

```json
{
  "name": "fleet-and-fire-local",
  "compatibility_date": "2026-05-15",
  "d1_databases": [{
    "binding": "DB",
    "database_name": "site-creator-d1",
    "database_id": "00000000-0000-4000-8000-000000000000"
  }]
}
```

3. Initialize a new local database once:

```sh
npx wrangler d1 execute site-creator-d1 --local --file drizzle/0000_square_captain_flint.sql --config work/wrangler.local.json --persist-to .wrangler/state
```

4. Run `npm run dev` and visit the displayed local address.

For the built production version, run `npm run build`, then `npx wrangler dev --config dist/server/wrangler.json --port 8787 --ip 127.0.0.1 --persist-to .wrangler/state`. This local address alone is not reachable by remote friends. Expose only this production server through Cloudflare Tunnel for temporary playtesting. When using a tunnel, restart the local Worker with `--var GAME_ORIGIN:https://YOUR-TUNNEL.trycloudflare.com` so browser-origin checks use that exact public address.

## Verification

- `npm test`: placement validation, privacy, hit streaks, miss turn changes, sunk ships, custom fleets, victory, and rematches.
- `npm run lint` and `npx tsc --noEmit`: code checks.
- `npm run build`: production build.
- `npm run test:multiplayer`: full-match API integration test, including independent seats, concurrent shots, unauthorized access, refresh, and rematch.
- Set `GAME_URL` to test a different host. These tests create their own test rooms.

The full integration test passed against the local development server, the production server, and the public HTTPS playtest address. Phone layout was checked at a 390px viewport, with no horizontal overflow. Manual ship placement and refresh recovery were checked through the browser.

## Permanent hosting

The game needs both a Worker and a shared D1 database; a static upload alone is insufficient. To publish permanently, use a connected Cloudflare account to create a D1 database, supply its real ID to the Worker configuration, apply the checked-in SQL migration remotely, and deploy the built Worker and assets. The initializer's zero-filled database ID is only a local development placeholder.

Alternatively, if ChatGPT Sites becomes enabled, reuse this source project and its `.openai/hosting.json`; create a Site once, persist its returned project ID, push the source, save its version, and deploy with the intended public audience.

## Cloudflare deployment setup

After signing in with Wrangler and creating the remote D1 database, copy `.cloudflare/deployment.example.json` to `.cloudflare/deployment.json` and fill it with the real IDs returned by Cloudflare. These are deployment identifiers, not passwords or API tokens.

`npm run deploy:cloudflare` builds the game, supplies the real Worker/database configuration, applies any unapplied database migrations, and publishes the Worker and assets. The database persists separately from each deployment.

For automatic publishing from GitHub, connect the repository to a Cloudflare Worker whose name matches `worker_name` in `.cloudflare/deployment.json`. Use `npm run build:cloudflare` as the build command and `npm run db:migrate:cloudflare && npx wrangler deploy --config dist/server/wrangler.json` as the deploy command. Set the build environment to Node.js 22.13 or newer. The app's database is bound as `DB`.

Authentication tokens must stay in your account tools or the hosting provider's protected settings. Do not commit them to GitHub.

The cinematic front-page artwork is generated with the built-in image tool and saved at `public/naval-hero.png`. CSS adds atmosphere, water shimmer, gentle movement, cursor parallax, and a sonar pulse. Scoring a hit shows a celebration; receiving a hit shows a single red warning flare. Reduced-motion preferences are respected.

The immersive navy, steel, and sunset-gold theme covers the lobby, fleet controls, battle boards, turn banners, hit confirmations, match results, and rules. Atmospheric artwork stays behind readable panels, with responsive phone layouts.

## Team battles and connection recovery

Choose **2 vs. 2 teams** when creating a room. Captains choose Azure or Ember before readying; each team has two seats. Friendly fire is rejected on the server. Both enemy fleets must sink for a team victory; eliminated allies share the victory and may watch. Team choices persist across rematches.

Authenticated requests update player presence. Captains appear offline after 15 seconds without contact. A surviving waiting captain may skip after 60 seconds without contact and at least 60 seconds on the current turn. Reconnecting cancels eligibility. Skips keep fleets intact and never award victory. Presence updates use the same revision checks as game actions.

Run `GAME_URL=<public-url> node tests/teams-presence.mjs` for team matches and a real-time reconnect/skip test (about 80 seconds).

## Battle history and host team arrangement

The captain log stores the latest 100 public events in the room: shots, sunk ships, eliminations, victories, skipped turns and room changes. Entries persist through reloads and rematches, with round numbers and local-time labels. Earlier events from rooms created before this feature are not reconstructed.

The creator can select one captain from each team and swap them during placement. Swaps preserve two balanced teams and are blocked once any captain has locked their fleet. The server rejects non-host swaps and invalid captain pairs.

Run `GAME_URL=<public-url> node tests/history-teams.mjs` to verify swaps, authorization, locked fleets and persisted event history.

## Solo practice and invitations

Choose Solo practice, then Easy or Tactical. The computer places its fleet immediately. Tactical targeting uses public shot results and revealed sunk ships, never hidden ship positions. The server makes one computer shot per polling update with a short delay, retains hit streaks, and restores practice seats on reload. Requesting a rematch resets both fleets immediately and readies the computer for the next round.

Multiplayer rooms offer Copy invite link, Share room (native share sheet where supported, clipboard fallback elsewhere), and a locally generated invite QR image. The QR contains only the public room link, not a seat token.

Run `GAME_URL=<public-url> node tests/solo.mjs` for live computer turn and restore checks; `node tests/qr.mjs` decodes the generated invite image.

## GitHub publishing

Cloudflare Workers Builds is connected to this repository. Updates pushed to `main` build and deploy Iron Tide automatically. Production uses `npm run build:cloudflare`, followed by database migrations and deployment using the generated Worker configuration.
