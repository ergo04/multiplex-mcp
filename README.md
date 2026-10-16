<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/mupx-mark-white.svg">
  <img src="brand/mupx-mark.svg" alt="" width="72" height="72">
</picture>

# mupx

**Multiplex MCP: one connector per account.** Use two Resend accounts, three Linear
workspaces, or any other MCP service several times over, from claude.ai (web,
desktop, mobile), Claude Code, ChatGPT, Codex or any MCP client that can send a
header.

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
claude.ai, ChatGPT, Codex ─ OAuth, approved with your password ──┐
Claude Code, Cursor, … ──── Authorization: Bearer <client token> ┤
                                                                 ▼
                     https://<your-gateway>/m/<service>/<account>/mcp
                                                                 │ your token out,
                                                                 │ the account's key in
                                                                 ▼
                        https://mcp.resend.com/mcp, https://mcp.linear.app/mcp, …
```

- **claude.ai**, and ChatGPT or Codex once you allow them, find the gateway's
  own OAuth server and sign in with their Client ID Metadata Document; you
  approve on a consent page with your password. The token a client gets opens
  that one connector and nothing else.
- **Claude Code**, or any MCP client that can send a header, can use a static
  token instead.
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
- The tool list is cached for five minutes with the Cache API, per data center
  and on custom domains only. It's meant for stateless servers like Linear's and
  Resend's.

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

   - ChatGPT and Codex: add their metadata documents to `ALLOWED_CLIENTS`
     (see [Configuration](#configuration)), then add the URL as a connector and
     approve it the same way. In ChatGPT a custom connector needs developer
     mode.
   - Any other MCP client that can send a header (Cursor, VS Code, Gemini CLI,
     …): use a client token as with Claude Code.

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
| `ALLOWED_CLIENTS`              | var    | Client ID Metadata Document URLs; replaces the default         |
| `DYNAMIC_REGISTRATION`         | var    | `true` to open RFC 7591 registration (off by default)          |

By default the gateway allows claude.ai's and Claude Code's metadata documents.
Setting `ALLOWED_CLIENTS` replaces that list, so name those two again. With
ChatGPT and Codex added:

```
https://claude.ai/oauth/mcp-oauth-client-metadata,https://claude.ai/oauth/claude-code-client-metadata,https://chatgpt.com/oauth/client.json,https://chatgpt.com/oauth/codex/client.json
```

ChatGPT signs in with that one stable document because the gateway returns the
issuer with the authorization code (RFC 9207).

## Security

- One owner. The consent page asks for `OWNER_PASSWORD`, rate limited per IP.
- Tokens are bound to one connector (RFC 8707): a Resend token can't open
  Linear.
- By default only claude.ai's and Claude Code's metadata documents may start
  an authorization; add others with `ALLOWED_CLIENTS`. The check runs before
  anything is fetched. Dynamic registration is off, so nobody can register a
  client.
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
CPU per request, which Cloudflare lets an isolate exceed now and then (it stops
one that does so consistently, with error 1102). On my deployment a request
takes 4 to 7 ms on a running isolate and 10 to 15 ms on a fresh one; building a
merged tool list from four Linear workspaces takes 18 to 20 ms. claude.ai calls
from many data centers, so fresh isolates are common and the per-data-center
cache of the tool list rarely hits. So far no request has been stopped.

## Credits

Built by [Simone Ergotino](https://simoneergotino.it). It generalises
[linear-mcp-gateway](https://github.com/ergo04/linear-mcp-gateway), which did
the same for Linear workspaces only. MIT licensed.
