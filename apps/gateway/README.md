# multiaccount-mcp-gateway

This is your copy of [multiaccount-mcp-gateway](https://github.com/ergo04/multiaccount-mcp-gateway):
a Cloudflare Worker that gives each account of an MCP service its own connector
URL, for claude.ai and Claude Code. Full documentation:
https://mux.simoneergotino.it

## Configure it

Nothing here needs editing: the configuration lives in the Worker's variables
and secrets (Cloudflare dashboard → this Worker → _Settings → Variables and
Secrets_).

- `OWNER_PASSWORD` (secret): the password you type to approve a connector.
- `ACCOUNT_<SERVICE>_<ACCOUNT>` (secret): one per account, holding its API key,
  e.g. `ACCOUNT_RESEND_WORK`. Built in: `linear`, `resend`. For any other MCP
  server that takes an API key, add `SERVICE_<NAME>_URL` too.
- `CLIENT_TOKEN_<CLIENT>` (secret, optional): a static token for Claude Code or
  any client that can send an `Authorization` header.

Then open the Worker's URL and sign in: it lists the connector URLs to paste
into claude.ai (_Settings → Connectors → Add custom connector_) or Claude Code.

The full list of settings is in the
[documentation](https://mux.simoneergotino.it).

## From the command line

```bash
pnpm install
pnpm secret OWNER_PASSWORD        # typed into wrangler's hidden prompt
pnpm secret resend work           # sets ACCOUNT_RESEND_WORK
pnpm secret --client laptop       # creates CLIENT_TOKEN_LAPTOP and prints it once
pnpm run deploy
```

## Updates

The Deploy button copied this folder into a new repository, so upstream changes
don't arrive by themselves. Since your configuration lives in Cloudflare and not
in these files, updating means copying the upstream `apps/gateway` over this
repository and pushing: nothing of yours is overwritten.

## Development

```bash
cp .dev.vars.example .dev.vars    # add OWNER_PASSWORD and some ACCOUNT_* values
pnpm dev                          # http://localhost:8787
pnpm test                         # vitest inside workerd
pnpm typecheck && pnpm lint
```

Vitest stays on 4.x: `@cloudflare/vitest-plugin` does not load test files under
Vitest 5 yet.
