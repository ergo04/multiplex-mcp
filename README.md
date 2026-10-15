# multiaccount-mcp-gateway

**One MCP connector per account.** Use two Resend accounts, three Linear
workspaces, or any other MCP service several times over, from claude.ai (web,
desktop, mobile) and from Claude Code.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ergo04/multiaccount-mcp-gateway/tree/main/apps/gateway)

Documentation: **https://mux.simoneergotino.it**

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

| Name                          | Kind   | What                                                           |
| ----------------------------- | ------ | -------------------------------------------------------------- |
| `OWNER_PASSWORD`              | secret | approves connectors; required                                  |
| `ACCOUNT_<SERVICE>_<ACCOUNT>` | secret | one account's API key; letters and digits only                 |
| `SERVICE_<NAME>_URL`          | var    | MCP endpoint of a service that isn't built in                  |
| `SERVICE_<NAME>_HEADER`       | var    | send the key in this header instead of `Authorization: Bearer` |
| `SERVICE_<NAME>_NAME`         | var    | display name                                                   |
| `CLIENT_TOKEN_<CLIENT>`       | secret | static bearer token for a client that can send headers         |
| `CLIENT_PATHS_<CLIENT>`       | var    | comma-separated connector paths that token may open            |
| `PUBLIC_URL`                  | var    | pin one origin (otherwise each hostname serves itself)         |
| `ACCESS_TOKEN_DAYS`           | var    | default 30                                                     |
| `REFRESH_TOKEN_DAYS`          | var    | default 180, sliding while in use                              |
| `ALLOWED_CLIENTS`             | var    | Client ID Metadata Document URLs allowed to authorize          |
| `DYNAMIC_REGISTRATION`        | var    | `true` to open RFC 7591 registration (off by default)          |

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

The gateway runs on the Workers free plan: 100,000 requests a day, and plain
forwarding uses almost no CPU.

## Credits

Built by [Simone Ergotino](https://simoneergotino.it). It generalises
[linear-mcp-gateway](https://github.com/ergo04/linear-mcp-gateway), which did
the same for Linear workspaces only. MIT licensed.
