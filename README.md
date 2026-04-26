# CollabDocs

A real-time collaborative document editor built with Next.js, Convex, and TipTap.

## Stack

- **Frontend** — Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend / Database** — [Convex](https://convex.dev) (real-time queries, mutations, auth)
- **Auth** — [@convex-dev/auth](https://github.com/get-convex/convex-auth) with Password provider
- **Editor** — [TipTap](https://tiptap.dev)

## Running locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

On first run this opens a browser to log in to Convex and create a project. It auto-writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local` and generates `convex/_generated/`.

### 3. Set Convex environment variables

In your [Convex dashboard](https://dashboard.convex.dev) → your project → **Settings → Environment Variables**, add:

| Variable | Description | How to get it |
|---|---|---|
| `JWT_PRIVATE_KEY` | RS256 private key for signing auth tokens | Run the keygen script below |
| `JWKS` | Matching public key set for verifying tokens | Run the keygen script below |

**Keygen script** — run once, then paste both values into the dashboard:

```bash
node -e "
const { generateKeyPair, exportJWK, exportPKCS8 } = require('jose');
generateKeyPair('RS256').then(async ({ privateKey, publicKey }) => {
  const pem = await exportPKCS8(privateKey);
  const jwk = await exportJWK(publicKey);
  console.log('--- JWT_PRIVATE_KEY ---');
  console.log(pem);
  console.log('--- JWKS ---');
  console.log(JSON.stringify({ keys: [jwk] }));
});
"
```

Paste `JWT_PRIVATE_KEY` as the full multi-line PEM block. Paste `JWKS` as the single-line JSON string.

### 4. Start the frontend

In a second terminal:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Project structure

```
convex/          Convex backend — schema, auth, document functions
app/             Next.js App Router pages
components/      React components (editor, dashboard, ui)
lib/             Service layer, hooks, sync infrastructure, logging
docs/            Architecture and collaboration guides
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — real-time sync data flow, conflict resolution, state machine, latency expectations
- [Collaboration](docs/COLLABORATION.md) — how sync works, what causes conflicts, how to resolve them, how to test real-time features
