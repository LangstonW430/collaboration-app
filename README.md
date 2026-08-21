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

## Checks

```bash
npm test          # unit and Convex function tests (vitest)
npm run typecheck # tsc over the app and the convex/ project
npm run lint      # eslint
npm run build     # production build
```

CI runs all four on every push and pull request.

Convex backend functions are tested with
[convex-test](https://docs.convex.dev/testing/convex-test), which runs the real
function bodies against an in-memory database — no deployment needed. Those
tests live beside the code in `convex/*.test.ts` and declare
`// @vitest-environment edge-runtime`, which is what Convex functions run under.
Files matching `*.test.ts` are not deployed.

```bash
npm run test:watch     # re-run on change
npm run test:coverage  # coverage report
```

End-to-end tests are separate and need a running deployment, so they are not
part of `npm test`:

```bash
npm run e2e       # requires `npx convex dev` and `npm run dev` running
```

### CI secrets

E2E drives a real Convex deployment, so CI deploys the backend from the commit
under test before running the suite. Without that it would exercise the
frontend from HEAD against whatever backend was last pushed by hand, and any
change to a Convex function fails E2E while being perfectly correct.

Set these under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `CONVEX_DEPLOY_KEY` | Lets CI run `npx convex deploy`. Generate it in the Convex dashboard under **Settings → Deploy Keys**. |
| `NEXT_PUBLIC_CONVEX_URL` | The deployment the app connects to during the run. |
| `E2E_USER1_EMAIL` / `E2E_USER1_PASSWORD` | First test account. |
| `E2E_USER2_EMAIL` / `E2E_USER2_PASSWORD` | Second test account, for the collaboration and real-time specs. |

`CONVEX_DEPLOY_KEY` and `NEXT_PUBLIC_CONVEX_URL` must refer to the **same
deployment**. If they point at different ones, CI deploys to one backend and
tests against another, which reproduces the stale-backend failure it exists to
prevent.

## Project structure

```
convex/          Convex backend — schema, auth, document functions, their tests
convex/model/    Shared backend logic: access checks, rate limits, audit trail
app/             Next.js App Router pages
components/      React components (editor, dashboard, ui)
lib/             Service layer, hooks, sync infrastructure, validation
__tests__/       Frontend unit tests and Playwright end-to-end specs
docs/            Architecture and collaboration guides
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — real-time sync data flow, conflict resolution, state machine, latency expectations
- [Collaboration](docs/COLLABORATION.md) — how sync works, what causes conflicts, how to resolve them, how to test real-time features
