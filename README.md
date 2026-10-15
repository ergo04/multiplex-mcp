<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/mupx-mark-white.svg">
  <img src="brand/mupx-mark.svg" alt="" width="72" height="72">
</picture>

# mupx

**Multiplex MCP: one connector per account.** Use two Resend accounts, three Linear
workspaces, or any other MCP service several times over, from claude.ai (web,
desktop, mobile) and from Claude Code.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ergo04/multiplex-mcp/tree/main/apps/gateway)

Documentation: **https://mupx.simoneergotino.it**

## The problem

claude.ai keys custom connectors by URL. Adding a second connector with a URL it
already has fails
([anthropics/claude-ai-mcp#178](https://github.com/anthropics/claude-ai-mcp/issues/178)),
and the connector form has no field for a header, so you can't tell the two
apart with an API key either. If you work across several accounts of the same
service, you get to connect one.

Adding `?account=x` to the URL works for a few OAuth servers and fails for
others, and it does nothing for services you reach with an API key.

## How it works

The gateway is a Cloudflare Worker you deploy to your own account. It gives each
account its own URL and swaps your token for that account's API key on the way
upstream:

```
claude.ai ───── OAuth, approved with your password ──┐
Claude Code ─── Authorization: Bearer <client token> ┤
                                                     ▼
                     https://<your-gateway>/m/<service>/<account>/mcp
                                                     │ your token out,
                                                     │ the account's key in
                                                     ▼
                        https://mcp.resend.com/mcp, https://mcp.linear.app/mcp, …
```

- **claude.ai** finds the gateway's own OAuth server, signs in with its Client
  ID Metadata Document, and you approve on a consent page with your password.
  The token it gets opens that one connector and nothing else.
- **Claude Code** can send a header, so it uses a static token instead.
- Requests are forwarded as they are and responses stream back (SSE included).
  The upstream's auth challenge and cookies never reach the client.

### One URL for every account

A connector per account adds up when a service has many tools: two Resend
connectors are more than 260 tools in the model's context. Set
`SERVICE_<NAME>_MERGED=true` and the service also gets `/u/<service>/mcp`, one
connector for all its accounts:

- Its tools are the union of every account's, each with one more argument,
  `account` (`workspace` for Linear, or whatever `SERVICE_<NAME>_ACCOUNT_PARAM`
  says). Its allowed values are the accounts that have that tool, since a plan
  can hide some.
- A call names the account; the gateway takes the argument out and forwards
  the call to that account under the same request id. The answer streams back
  untouched.
- The gateway answers `initialize` and `server/discover` itself, for clients of
  the 2025-06-18 and the 2026-07-28 revision, and adds a `list_accounts` tool
  (`list_workspaces` for Linear).
- The tool list is cached for five minutes with the Cache API (custom domains
  only). It's meant for stateless servers like Linear's and Resend's.

With `SERVICE_LINEAR_EXTRA_TOOLS=true`, Linear's merged connector also gets ten
tools the gateway runs against Linear's GraphQL API, for what its MCP can't do:
deleting and reordering milestones, assigning issues to a milestone in one
call, archiving and restoring projects and initiatives, linking projects to
initiatives.

## Quick start

1. **Deploy.** Click the button above. Cloudflare copies `apps/gateway` into a
   new repository of yours, creates the KV namespace, asks for an
   `OWNER_PASSWORD`, and deploys.
2. **Add accounts.** In the Cloudflare dashboard open the Worker, then
   _Settings → Variables and Secrets_, and add one secret per account named
   `ACCOUNT_<SERVICE>_<ACCOUNT>` holding its API key, for example
   `ACCOUNT_RESEND_WORK` and `ACCOUNT_RESEND_PERSONAL`. No redeploy needed.
3. **Get the URLs.** Open your gateway's URL and sign in with the password. It
   lists one connector URL per account.
4. **Connect.**
   - claude.ai: _Settings → Connectors → Add custom connector_, paste a URL,
     leave _Advanced settings_ empty, approve with your password. Repeat for each
     account.
   - Claude Code: add a `CLIENT_TOKEN_<NAME>` secret (32+ random characters) and
     send it as a header:

     ```bash
     claude mcp add --transport http resend-work https://<your-gateway>/m/resend/work/mcp --header "Authorization: Bearer <token>"
     ```

## Services

| Service                      | Built in | Credential                                                   |
| ---------------------------- | -------- | ------------------------------------------------------------ |
| Linear                       | yes      | personal API key                                             |
| Resend                       | yes      | API key                                                      |
| any MCP server with API keys | no       | set `SERVICE_<NAME>_URL`, optionally `SERVICE_<NAME>_HEADER` |

Upstreams that only speak OAuth (Vercel's MCP, for example) are not supported
yet.

## Configuration

Everything is a Worker variable or secret, so a deployment is configured from
the dashboard and its code never changes.

| Name                           | Kind   | What                                                           |
| ------------------------------ | ------ | -------------------------------------------------------------- |
| `OWNER_PASSWORD`               | secret | approves connectors; required                                  |
| `ACCOUNT_<SERVICE>_<ACCOUNT>`  | secret | one account's API key; letters and digits only                 |
| `SERVICE_<NAME>_URL`           | var    | MCP endpoint of a service that isn't built in                  |
| `SERVICE_<NAME>_HEADER`        | var    | send the key in this header instead of `Authorization: Bearer` |
| `SERVICE_<NAME>_NAME`          | var    | display name                                                   |
| `SERVICE_<NAME>_MERGED`        | var    | `true` adds `/u/<service>/mcp`, every account behind one URL   |
| `SERVICE_<NAME>_ACCOUNT_PARAM` | var    | the merged connector's account argument; default `account`     |
| `SERVICE_<NAME>_EXTRA_TOOLS`   | var    | `true` adds the gateway's own tools for the service (Linear)   |
| `CLIENT_TOKEN_<CLIENT>`        | secret | static bearer token for a client that can send headers         |
| `CLIENT_PATHS_<CLIENT>`        | var    | comma-separated connector paths that token may open            |
| `PUBLIC_URL`                   | var    | pin one origin (otherwise each hostname serves itself)         |
| `ACCESS_TOKEN_DAYS`            | var    | default 30                                                     |
| `REFRESH_TOKEN_DAYS`           | var    | default 180, sliding while in use                              |
| `ALLOWED_CLIENTS`              | var    | Client ID Metadata Document URLs allowed to authorize          |
| `DYNAMIC_REGISTRATION`         | var    | `true` to open RFC 7591 registration (off by default)          |

## Security

- One owner. The consent page asks for `OWNER_PASSWORD`, rate limited per IP.
- Tokens are bound to one connector (RFC 8707): a Resend token can't open
  Linear.
- Only claude.ai's and Claude Code's metadata documents may start an
  authorization, checked before anything is fetched. Dynamic registration is
  off, so nobody can register a client.
- Access tokens last 30 days, because claude.ai may never refresh a custom
  connector's token
  ([anthropics/claude-ai-mcp#228](https://github.com/anthropics/claude-ai-mcp/issues/228)).
- API keys live only in Worker secrets. The public status page counts
  connectors and problems and names nothing.

## Repository

| Folder                         | What                                                                 |
| ------------------------------ | -------------------------------------------------------------------- |
| [`apps/gateway`](apps/gateway) | the Worker you deploy; self-contained, which the Deploy button needs |
| [`apps/web`](apps/web)         | the documentation site                                               |
| [`brand`](brand)               | the mupx mark and icon, as SVG                                       |

The gateway runs on the Workers free plan: 100,000 requests a day and 10 ms of
CPU per request. Plain forwarding uses almost none; building a merged tool list
from three Linear workspaces takes a few milliseconds, and under one once
cached.

## Credits

Built by [Simone Ergotino](https://simoneergotino.it). It generalises
[linear-mcp-gateway](https://github.com/ergo04/linear-mcp-gateway), which did
the same for Linear workspaces only. MIT licensed.
