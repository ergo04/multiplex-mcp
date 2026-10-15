# mupx — agent guide

An open-source Cloudflare Worker that gives each account of an MCP service its
own connector URL, with OAuth for claude.ai and static bearer tokens for Claude
Code. Start from [README.md](README.md).

| Folder         | What                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/gateway` | the Worker; must stay self-contained (own lockfile, no workspace deps) because the Deploy to Cloudflare button copies only this folder |
| `apps/web`     | the public documentation site (Next.js static export on Workers assets)                                                                |
| `notes/`       | Simone's private planning notes; gitignored, never published                                                                           |

## Language

Code, comments, commits, READMEs and the documentation site in English.

## Code

- pnpm, TypeScript 7, Prettier without semicolons, oxlint with type-aware rules.
  In `apps/gateway`, run the tests, `pnpm typecheck`, `pnpm lint` and
  `pnpm format:check` before committing.
- Comments say why, never what.
- Configuration is read from env vars and secrets (`src/config.ts`); never add a
  config file users would have to edit, since the Deploy button's copies would
  then diverge from upstream.
- Gateway tests run inside workerd through `@cloudflare/vitest-plugin`; keep
  Vitest on 4.x until the plugin supports 5. Upstreams are faked by passing
  `upstreamFetch` to `createGateway()`, and each test builds its env in
  `test/helpers.ts`.
- When the docs change behaviour (env vars, URLs, security), update both
  READMEs and `apps/web` together.

## Secrets

Secrets are set by the person who owns the deployment, in the dashboard or with
`pnpm secret`. They are never pasted into chat and never written to files other than a local,
gitignored `.dev.vars` with throwaway values.

If `notes/agenti.md` exists, read it first: it holds the maintainer's private
instructions and is never committed.

## Commits

No AI attribution: no `Co-Authored-By` trailer, no "Generated with" footer.
