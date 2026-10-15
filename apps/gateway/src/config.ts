import { KNOWN_SERVICES, type UpstreamAuth } from "./services"

/**
 * The whole configuration lives in the Worker's environment, so a deployment
 * made with the Deploy to Cloudflare button is configured from the dashboard
 * without touching code:
 *
 *   ACCOUNT_<SERVICE>_<ACCOUNT>   secret  the account's credential (one per account)
 *   SERVICE_<SERVICE>_URL         var     upstream of a service not built in
 *   SERVICE_<SERVICE>_HEADER      var     send the credential in this header, not as Bearer
 *   SERVICE_<SERVICE>_NAME        var     display name
 *   CLIENT_TOKEN_<CLIENT>         secret  static bearer token for a header-capable client
 *   CLIENT_PATHS_<CLIENT>         var     comma-separated connector paths it may open
 *   OWNER_PASSWORD                secret  the consent page's password
 *   PUBLIC_URL                    var     pin one origin; otherwise the request's
 *   ACCESS_TOKEN_DAYS, REFRESH_TOKEN_DAYS, ALLOWED_CLIENTS, DYNAMIC_REGISTRATION
 */

export interface Connector {
  path: string
  service: string
  account: string
  label: string
  upstream: URL
  auth: UpstreamAuth
  credential: string
  variable: string
}

export interface StaticClient {
  name: string
  token: string
  paths?: string[]
}

export interface Problem {
  /** Safe on the public status page: names no service, account or client. */
  summary: string
  /** Names the variable at fault; shown only to the signed-in owner. */
  detail: string
}

export interface Settings {
  connectors: Connector[]
  clients: StaticClient[]
  ownerPassword?: string
  publicUrl?: string
  accessTokenDays: number
  refreshTokenDays: number
  allowedClients: string[]
  dynamicRegistration: boolean
  problems: Problem[]
}

export const CLAUDE_CLIENTS = [
  "https://claude.ai/oauth/mcp-oauth-client-metadata",
  "https://claude.ai/oauth/claude-code-client-metadata",
]

// A guessable static token would open every account at once.
export const MIN_CLIENT_TOKEN_LENGTH = 32

// Variable names are split on `_`, so slugs can't contain one; hyphens are out
// too, because environment variable names can't carry them.
const SLUG = "[A-Z][A-Z0-9]*"
const ACCOUNT = new RegExp(`^ACCOUNT_(${SLUG})_(${SLUG})$`)
const SERVICE = new RegExp(`^SERVICE_(${SLUG})_(URL|HEADER|NAME)$`)
const CLIENT_TOKEN = new RegExp(`^CLIENT_TOKEN_(${SLUG})$`)
const CLIENT_PATHS = new RegExp(`^CLIENT_PATHS_(${SLUG})$`)
const HEADER_NAME = /^[A-Za-z0-9-]+$/

// Headers the gateway or the runtime own; letting config set them would let a
// credential overwrite routing or framing.
const RESERVED_HEADERS = new Set(["host", "content-length", "cookie"])

export function connectorPath(service: string, account: string): string {
  return `/m/${service}/${account}/mcp`
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined
}

function days(value: unknown, fallback: number): number {
  const parsed = Number(text(value))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function list(value: unknown): string[] | undefined {
  return text(value)
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

interface AccountEntry {
  service: string
  account: string
  credential: string
  variable: string
}

interface ServiceOverride {
  url?: string
  header?: string
  name?: string
}

function resolveConnector(
  entry: AccountEntry,
  override: ServiceOverride | undefined,
  problems: Problem[]
): Connector | undefined {
  const known = KNOWN_SERVICES[entry.service]
  const prefix = `SERVICE_${entry.service.toUpperCase()}`
  const upstreamRaw = override?.url ?? known?.upstream
  if (!upstreamRaw) {
    problems.push({
      summary: "An account belongs to a service this gateway does not know",
      detail: `${entry.variable}: set ${prefix}_URL to the service's MCP endpoint`,
    })
    return undefined
  }

  let upstream: URL
  try {
    upstream = new URL(upstreamRaw)
  } catch {
    problems.push({
      summary: "A service URL is not a valid URL",
      detail: `${prefix}_URL`,
    })
    return undefined
  }
  if (upstream.protocol !== "https:") {
    problems.push({
      summary: "A service URL is not https",
      detail: `${prefix}_URL must start with https://`,
    })
    return undefined
  }

  let auth: UpstreamAuth = known?.auth ?? { type: "bearer" }
  const header = override?.header
  if (header) {
    if (
      !HEADER_NAME.test(header) ||
      RESERVED_HEADERS.has(header.toLowerCase())
    ) {
      problems.push({
        summary: "A service names a header the gateway cannot set",
        detail: `${prefix}_HEADER: "${header}"`,
      })
      return undefined
    }
    auth =
      header.toLowerCase() === "authorization"
        ? { type: "bearer" }
        : { type: "header", name: header }
  }

  const name = override?.name ?? known?.name ?? entry.service
  return {
    path: connectorPath(entry.service, entry.account),
    service: entry.service,
    account: entry.account,
    label: `${name} · ${entry.account}`,
    upstream,
    auth,
    credential: entry.credential,
    variable: entry.variable,
  }
}

export function readSettings(env: object): Settings {
  const vars = env as Record<string, unknown>
  const problems: Problem[] = []
  const accounts: AccountEntry[] = []
  const services = new Map<string, ServiceOverride>()
  const tokens = new Map<string, string>()
  const paths = new Map<string, string[]>()

  for (const [key, value] of Object.entries(vars)) {
    const account = ACCOUNT.exec(key)
    if (account) {
      const credential = text(value)
      if (credential)
        accounts.push({
          service: account[1]!.toLowerCase(),
          account: account[2]!.toLowerCase(),
          credential,
          variable: key,
        })
      continue
    }
    if (key.startsWith("ACCOUNT_")) {
      problems.push({
        summary: "A variable starting with ACCOUNT_ has an unusable name",
        detail: `${key}: expected ACCOUNT_<SERVICE>_<ACCOUNT>, letters and digits only`,
      })
      continue
    }

    const service = SERVICE.exec(key)
    if (service) {
      const slug = service[1]!.toLowerCase()
      const field = service[2]!.toLowerCase() as keyof ServiceOverride
      services.set(slug, { ...services.get(slug), [field]: text(value) })
      continue
    }

    const token = CLIENT_TOKEN.exec(key)
    if (token) {
      const raw = text(value)
      if (raw) tokens.set(token[1]!.toLowerCase(), raw)
      continue
    }

    const clientPaths = CLIENT_PATHS.exec(key)
    if (clientPaths) paths.set(clientPaths[1]!.toLowerCase(), list(value) ?? [])
  }

  const connectors = accounts
    .map((entry) =>
      resolveConnector(entry, services.get(entry.service), problems)
    )
    .filter((connector): connector is Connector => connector !== undefined)
    .sort((a, b) => a.path.localeCompare(b.path))

  const existing = new Set(connectors.map((c) => c.path))
  const clients: StaticClient[] = []
  for (const [name, token] of tokens) {
    if (token.length < MIN_CLIENT_TOKEN_LENGTH) {
      problems.push({
        summary: "A client token is too short to be safe, so it is ignored",
        detail: `CLIENT_TOKEN_${name.toUpperCase()}: use at least ${MIN_CLIENT_TOKEN_LENGTH} random characters`,
      })
      continue
    }
    const allowed = paths.get(name)
    for (const path of allowed ?? []) {
      if (!existing.has(path))
        problems.push({
          summary: "A client is limited to a connector that does not exist",
          detail: `CLIENT_PATHS_${name.toUpperCase()}: ${path}`,
        })
    }
    clients.push(allowed ? { name, token, paths: allowed } : { name, token })
  }

  const ownerPassword = text(vars["OWNER_PASSWORD"])
  if (!ownerPassword)
    problems.push({
      summary: "OWNER_PASSWORD is not set, so nobody can approve a connector",
      detail: "Add OWNER_PASSWORD as a secret",
    })

  let publicUrl: string | undefined
  const pinned = text(vars["PUBLIC_URL"])
  if (pinned) {
    try {
      publicUrl = new URL(pinned).origin
    } catch {
      problems.push({
        summary: "PUBLIC_URL is not a valid URL, so it is ignored",
        detail: `PUBLIC_URL: "${pinned}"`,
      })
    }
  }

  return {
    connectors,
    clients,
    ownerPassword,
    publicUrl,
    accessTokenDays: days(vars["ACCESS_TOKEN_DAYS"], 30),
    refreshTokenDays: days(vars["REFRESH_TOKEN_DAYS"], 180),
    allowedClients: list(vars["ALLOWED_CLIENTS"]) ?? CLAUDE_CLIENTS,
    dynamicRegistration: text(vars["DYNAMIC_REGISTRATION"]) === "true",
    problems,
  }
}
