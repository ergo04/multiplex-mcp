import type { ConsentDescription } from "@cloudflare/workers-oauth-provider"
import { KNOWN_SERVICES } from "./services"
import type { Connector, Settings } from "./config"

export const DOCS_URL = "https://mupx.simoneergotino.it"

// The project's own icon, inline because these pages load nothing else.
const ICON_HREF = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="#0e0e0e"/><path fill="#f9f9f9" d="M41 44H167A9 9 0 0 1 176 53V203A9 9 0 0 1 167 212H41A9 9 0 0 1 32 203V185A9 9 0 0 1 41 176H140V146H41A9 9 0 0 1 32 137V119A9 9 0 0 1 41 110H140V80H41A9 9 0 0 1 32 71V53A9 9 0 0 1 41 44Z"/><path fill="#ff6a2d" d="M176 110H215A9 9 0 0 1 224 119V137A9 9 0 0 1 215 146H176Z"/></svg>'
)}`

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

const STYLE = `
  :root { color-scheme: light dark; --fg: #1a1a1a; --bg: #fafafa; --muted: #666; --line: #ddd; --warn: #fff4d6; }
  @media (prefers-color-scheme: dark) { :root { --fg: #eee; --bg: #161616; --muted: #999; --line: #333; --warn: #3d3315; } }
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 34rem; margin: 3rem auto; padding: 0 1rem; color: var(--fg); background: var(--bg); }
  h1 { font-size: 1.4rem; } h2 { font-size: 1.1rem; margin-top: 2rem; }
  code { font: .9em ui-monospace, monospace; word-break: break-all; }
  .muted { color: var(--muted); }
  .warn { background: var(--warn); padding: .75rem; border-radius: .5rem; }
  ul.connectors { list-style: none; padding: 0; } ul.connectors li { padding: .6rem 0; border-bottom: 1px solid var(--line); }
  label { display: block; margin: 1.5rem 0 .25rem; font-weight: 600; }
  input[type=password] { width: 100%; box-sizing: border-box; padding: .6rem; font-size: 1rem; }
  .actions { display: flex; gap: .75rem; margin-top: 1.5rem; }
  button { padding: .6rem 1.2rem; font-size: 1rem; border-radius: .4rem; border: 1px solid var(--fg); background: var(--bg); color: var(--fg); }
  button.primary { background: var(--fg); color: var(--bg); }`

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "X-Frame-Options": "DENY",
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="${ICON_HREF}">
<title>${escape(title)}</title>
<style>${STYLE}</style>
<body>
${body}
<p class="muted"><a href="${DOCS_URL}">mupx</a></p>
</body>
</html>`
}

function page(
  status: number,
  title: string,
  body: string,
  extra?: Headers
): Response {
  const headers = new Headers(extra)
  for (const [key, value] of Object.entries(HEADERS)) headers.set(key, value)
  return new Response(layout(title, body), { status, headers })
}

export function messagePage(
  status: number,
  title: string,
  message: string
): Response {
  return page(
    status,
    title,
    `<h1>${escape(title)}</h1><p>${escape(message)}</p>`
  )
}

export function consentPage(options: {
  details: ConsentDescription
  connector: Connector
  handle: string
  signedIn: boolean
  headers: Headers
}): Response {
  const { details, connector, handle, signedIn } = options
  const name = escape(details.clientName)

  const origin = details.clientDomain
    ? `<strong>${name}</strong>, published by <strong>${escape(details.clientDomain)}</strong>, is asking.`
    : `<strong>${name}</strong> is asking. It registered itself, so its name is not verified.`

  const loopback = details.redirectIsLoopback
    ? `<p class="warn">Access goes to an app on this computer. Continue only if you just started connecting from it.</p>`
    : ""

  const password = signedIn
    ? ""
    : `<label for="password">Gateway password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>`

  const body = `<h1>Connect ${escape(connector.label)}</h1>
<p>${origin}</p>
<p>It will act as account <strong>${escape(connector.account)}</strong> of ${escape(connector.service)}. Access goes to <strong>${escape(details.redirectHost)}</strong>.</p>
${loopback}
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">
  ${password}
  <div class="actions">
    <button class="primary" name="decision" value="approve">Allow</button>
    <button name="decision" value="deny" formnovalidate>Deny</button>
  </div>
</form>`

  return page(200, `Connect ${connector.label}`, body, options.headers)
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

const ADD_ACCOUNT = `<h2>Add an account</h2>
<p>Add a secret to this Worker named <code>ACCOUNT_&lt;SERVICE&gt;_&lt;ACCOUNT&gt;</code> holding the account's API key, for example <code>ACCOUNT_RESEND_WORK</code>. Built in: ${Object.keys(
  KNOWN_SERVICES
)
  .map((slug) => `<code>${slug}</code>`)
  .join(
    ", "
  )}. Any other MCP server that takes an API key works with a <code>SERVICE_&lt;NAME&gt;_URL</code> variable. <a href="${DOCS_URL}">Docs</a>.</p>`

/** The public status page: counts and problem kinds, never a name. */
export function homePage(
  settings: Settings,
  origin: string,
  signedIn: boolean,
  notice?: string
): Response {
  if (!settings.ownerPassword)
    return page(
      200,
      "Almost ready",
      `<h1>Almost ready</h1>
<p>This gateway has no owner password yet. In the Cloudflare dashboard open this Worker, then <strong>Settings → Variables and Secrets</strong>, add a secret named <code>OWNER_PASSWORD</code> with a long random value, and reload this page.</p>
${ADD_ACCOUNT}`
    )

  const notices = notice ? `<p class="warn">${escape(notice)}</p>` : ""

  if (!signedIn) {
    const problems = settings.problems.length
      ? `<p class="warn">${plural(settings.problems.length, "configuration problem")}. Sign in to see the details.</p>`
      : ""
    return page(
      200,
      "mupx",
      `<h1>mupx</h1>
<p>Running, with ${plural(settings.connectors.length, "connector")}.</p>
${problems}${notices}
<form method="post" action="/">
  <label for="password">Sign in to see your connector URLs</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
  <div class="actions"><button class="primary">Sign in</button></div>
</form>`
    )
  }

  const connectors = settings.connectors.length
    ? `<ul class="connectors">${settings.connectors
        .map(
          (c) =>
            `<li><strong>${escape(c.label)}</strong><br><code>${escape(origin + c.path)}</code></li>`
        )
        .join("")}</ul>`
    : `<p>No accounts yet.</p>`

  const clients = settings.clients.length
    ? `<h2>Clients with a static token</h2><ul>${settings.clients
        .map(
          (c) =>
            `<li><code>${escape(c.name)}</code>: ${c.paths ? `only ${c.paths.map((p) => `<code>${escape(p)}</code>`).join(", ")}` : "every connector"}</li>`
        )
        .join("")}</ul>`
    : ""

  const problems = settings.problems.length
    ? `<h2>Problems</h2><ul>${settings.problems
        .map(
          (p) =>
            `<li>${escape(p.summary)}.<br><span class="muted">${escape(p.detail)}</span></li>`
        )
        .join("")}</ul>`
    : ""

  return page(
    200,
    "Your connectors",
    `<h1>Your connectors</h1>
${notices}
<p>Add each URL as a custom connector in claude.ai (Settings → Connectors), or as an <code>http</code> server in Claude Code.</p>
${connectors}${problems}${clients}${ADD_ACCOUNT}`
  )
}
