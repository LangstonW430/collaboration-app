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

Use the official CLI — it generates the keys and writes them to the deployment
in the exact format the auth library reads:

```bash
npx @convex-dev/auth           # your dev deployment
npx @convex-dev/auth --prod    # your production deployment
```

It prompts for `SITE_URL` and sets three variables on the deployment:

| Variable | Description |
|---|---|
| `SITE_URL` | Where the app is served from. `http://localhost:3000` for dev; the canonical public URL for production. Used to build links back into the app — password resets, email verification, OAuth callbacks. |
| `JWT_PRIVATE_KEY` | RS256 private key for signing auth tokens |
| `JWKS` | Matching public key set for verifying tokens |

Each deployment needs its own. They live on the Convex deployment, not in
`.env.local`, so a new deployment starts with none of them and nobody can log
in until they are set. Generate separate keys per deployment rather than
copying, so a leak in one cannot mint tokens for another.

**Setting them by hand instead.** Paste the PEM exactly as generated, including
its `-----BEGIN PRIVATE KEY-----` first line. Multi-line is fine. What breaks it
is anything before that header — a leading space or newline, or surrounding
quotes — because the auth library only accepts a value that *starts* with it.
The same error appears when the variable was never saved at all:

```
Uncaught TypeError: "pkcs8" must be PKCS#8 formatted string
    at importPKCS8 ... at generateToken
```

It surfaces at sign-in *after* the password has been accepted, so a correct
login still fails. If you see it, check that `JWT_PRIVATE_KEY` is present on
that deployment and begins with the header — or just re-run the CLI above,
which is why it is the recommended path.

```bash
node -e "
const { generateKeyPair, exportJWK, exportPKCS8 } = require('jose');
generateKeyPair('RS256').then(async ({ privateKey, publicKey }) => {
  const pem = await exportPKCS8(privateKey);
  const jwk = await exportJWK(publicKey);
  console.log('--- JWT_PRIVATE_KEY ---');
  console.log(pem.trimEnd());
  console.log('--- JWKS ---');
  console.log(JSON.stringify({ keys: [{ use: 'sig', ...jwk }] }));
});
"
```

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

## Deploying

The frontend runs on Vercel, the backend on Convex. Set the Vercel build command
to:

```
npx convex deploy --cmd 'npm run build'
```

That deploys the backend and then builds the frontend with the deployment's URL
injected, so the two can never point at different places. Vercel needs
`CONVEX_DEPLOY_KEY` for the target deployment; `app/providers.tsx` throws at
import when `NEXT_PUBLIC_CONVEX_URL` is missing, so a plain `npm run build`
fails without it.

Use a **separate deployment from the one CI tests against**. The E2E suite
creates and deletes documents on every run, and CI deploys to it on every push —
neither is something to point at a live site.

### Demo content

A public deployment starts empty, which makes for a poor first impression. To
fill a demo account, sign up through the app, then:

```bash
npx convex run seed:resetDemoContent '{"email":"demo@example.com"}' --prod
```

That replaces the account's documents with a sample set covering charts, tables,
task lists, and comment threads. It is destructive and re-runnable, so it also
serves to reset the demo after visitors have edited things. Point it only at a
throwaway account — it deletes every document that account owns.

## Project structure

```
convex/          Convex backend — schema, auth, document functions, their tests
convex/model/    Shared backend logic: access checks, rate limits, audit trail
convex/seed.ts   Demo content for a public deployment (internal, destructive)
app/             Next.js App Router pages
components/      React components (editor, dashboard, ui)
lib/             Service layer, hooks, sync infrastructure, validation
__tests__/       Frontend unit tests and Playwright end-to-end specs
docs/            Architecture and collaboration guides
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — real-time sync data flow, conflict resolution, state machine, latency expectations
- [Collaboration](docs/COLLABORATION.md) — how sync works, what causes conflicts, how to resolve them, how to test real-time features
