# Publish Iron Tide with GitHub and Cloudflare

## 1. GitHub
Create a repository named `iron-tide`. Private is fine. Do not initialize it with a README, license, or .gitignore: this project already has its files. Copy the repository HTTPS URL.

From this project directory, after committing the source:

```sh
git remote add origin https://github.com/YOUR-USERNAME/iron-tide.git
git push -u origin main
```

Authenticate using GitHub Desktop or your existing Git credential manager. Never paste a password or access token into this document.

## 2. Cloudflare authentication and database

```sh
npx wrangler login
npx wrangler whoami
npx wrangler d1 create iron-tide-db
```

Authorize Wrangler in your browser. If multiple accounts are available, choose the intended account before creating the database. Copy the account ID from whoami and database ID from the database creation output.

Copy `.cloudflare/deployment.example.json` to `.cloudflare/deployment.json`. Set worker_name to `iron-tide`, database_name to `iron-tide-db`, and fill in the real account_id and database_id. These identifiers may be committed; authentication tokens must not be committed.

## 3. First deployment

```sh
npm run deploy:cloudflare
```

This builds the game, prepares the production configuration, applies the remote database migrations, and deploys the game and its assets. Save the HTTPS workers.dev URL printed by Wrangler. If asked, configure a workers.dev subdomain for your account. The new database starts without the local preview rooms.

Verify the homepage in a private window and play a fresh room from two devices. Verify refresh recovery, hits, misses, sinking, victory and rematches. A custom domain is optional.

## 4. Automatic updates
Commit and push `.cloudflare/deployment.json`. In Cloudflare, open Workers & Pages, select `iron-tide`, then Settings > Builds > Connect. Connect only the intended GitHub repository. Select main as the production branch and the repository root as the project directory when the game files are at its root.

Use these settings:

- Node version: 22.13 or newer (Node 22 recommended).
- Build command: `npm run build:cloudflare`
- Deploy command: `npm run db:migrate:cloudflare && npx wrangler deploy --config dist/server/wrangler.json`

The dashboard Worker name must match `iron-tide` in the deployment configuration. Review configured branch triggers: pushes to the production branch publish updates. Do not enable other branch deployments against the production database. Keep credentials in Cloudflare protected settings.

## 5. Finish
Record the final URL in README.md, update social metadata with the permanent site origin, and complete one final remote multiplayer test. Submit that permanent URL for the project.
