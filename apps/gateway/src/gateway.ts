import {
  OAuthAuthorizationServer,
  OAuthError,
  OAuthResourceServer,
} from "@cloudflare/workers-oauth-provider"
import { readSettings, type Connector, type Settings } from "./config"
import { authorize } from "./oauth/authorize"
import {
  checkPassword,
  hasOwnerSession,
  ownerSessionCookie,
} from "./oauth/session"
import { homePage, messagePage } from "./pages"
import {
  gatewayError,
  passthrough,
  type UpstreamFetch,
} from "./proxy/passthrough"
import { clientForToken, clientMayOpen } from "./secrets"

const DAY = 24 * 60 * 60
const AUTHORIZE_PATH = "/authorize"
const RESOURCE_METADATA_PREFIX = "/.well-known/oauth-protected-resource"
const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback"
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

interface Props {
  subject: string
}

interface Routes {
  server: OAuthAuthorizationServer<Env>
  resources: Map<string, OAuthResourceServer<Env, Props>>
}

export interface GatewayOptions {
  upstreamFetch?: UpstreamFetch
}

function allowedRedirect(uri: unknown): boolean {
  if (typeof uri !== "string") return false
  if (uri === CLAUDE_CALLBACK) return true
  try {
    const url = new URL(uri)
    return url.protocol === "http:" && LOOPBACK.has(url.hostname)
  } catch {
    return false
  }
}

function connectorAt(
  settings: Settings,
  pathname: string
): Connector | undefined {
  const path = pathname.startsWith(RESOURCE_METADATA_PREFIX)
    ? pathname.slice(RESOURCE_METADATA_PREFIX.length)
    : pathname
  return settings.connectors.find(
    (c) => path === c.path || path.startsWith(`${c.path}/`)
  )
}

export function createGateway(options: GatewayOptions = {}) {
  const upstreamFetch: UpstreamFetch =
    options.upstreamFetch ?? ((input, init) => fetch(input, init))

  // The library fixes its resource list at construction, so the server is
  // rebuilt whenever the origin or the set of connectors changes. A changed
  // secret restarts the Worker anyway; this also covers several hostnames.
  const cache = new Map<string, Routes>()

  function routesFor(settings: Settings, origin: string): Routes {
    const key = [
      origin,
      settings.connectors.map((c) => c.path).join(","),
      settings.accessTokenDays,
      settings.refreshTokenDays,
      settings.dynamicRegistration,
    ].join("|")
    const cached = cache.get(key)
    if (cached) return cached

    const server = new OAuthAuthorizationServer<Env>({
      issuer: origin,
      resources: settings.connectors.map((c) => `${origin}${c.path}`),
      authorizeEndpoint: AUTHORIZE_PATH,
      clientIdMetadataDocumentEnabled: true,
      clientRegistrationEndpoint: settings.dynamicRegistration
        ? "/oauth/register"
        : undefined,
      clientRegistrationCallback: ({ clientMetadata }) => {
        const uris = clientMetadata["redirect_uris"]
        if (
          Array.isArray(uris) &&
          uris.length > 0 &&
          uris.every(allowedRedirect)
        )
          return
        return { description: "redirect_uris not allowed by this gateway" }
      },
      // claude.ai may never refresh a custom connector's token
      // (anthropics/claude-ai-mcp#228), so access tokens are long-lived and the
      // grant slides while it is used.
      accessTokenTTL: settings.accessTokenDays * DAY,
      refreshTokenTTL: settings.refreshTokenDays * DAY,
      refreshTokenIdleTTL: settings.refreshTokenDays * DAY,
    })

    const resources = new Map<string, OAuthResourceServer<Env, Props>>()
    for (const connector of settings.connectors) {
      resources.set(
        connector.path,
        new OAuthResourceServer<Env, Props>({
          resourceMetadata: {
            resource: `${origin}${connector.path}`,
            authorization_servers: [origin],
            bearer_methods_supported: ["header"],
            resource_name: connector.label,
          },
          validateToken: (env) => async (resource, token) => {
            const client = await clientForToken(readSettings(env), token)
            if (client) {
              if (!clientMayOpen(client, connector.path))
                throw new OAuthError("invalid_token", {
                  description: `Client "${client.name}" may not open this connector`,
                })
              return {
                props: { subject: `client:${client.name}` },
                audience: resource,
                clientId: `static:${client.name}`,
              }
            }
            return server.validateToken<Props>(resource, token, env)
          },
          handler: {
            fetch: (request, env) =>
              serveConnector(request, env, connector.path),
          },
        })
      )
    }

    const routes = { server, resources }
    cache.set(key, routes)
    return routes
  }

  async function serveConnector(
    request: Request,
    env: Env,
    path: string
  ): Promise<Response> {
    // The resource server also routes path descendants here; they mean nothing
    // to a single-endpoint MCP server.
    if (new URL(request.url).pathname !== path)
      return gatewayError(404, "Not an MCP endpoint")

    const connector = readSettings(env).connectors.find((c) => c.path === path)
    if (!connector) return gatewayError(404, "This connector no longer exists")
    return passthrough(request, connector, connector.credential, upstreamFetch)
  }

  async function home(
    request: Request,
    env: Env,
    settings: Settings,
    origin: string
  ): Promise<Response> {
    if (request.method === "POST") {
      const form = await request.formData()
      const result = await checkPassword(
        request,
        env,
        settings.ownerPassword,
        String(form.get("password") ?? "")
      )
      if (result === "ok") {
        return new Response(null, {
          status: 303,
          headers: {
            Location: "/",
            "Set-Cookie": await ownerSessionCookie(settings.ownerPassword!),
          },
        })
      }
      const notice =
        result === "limited"
          ? "Too many attempts. Wait a minute and try again."
          : "Wrong password."
      return homePage(settings, origin, false, notice)
    }

    const signedIn = await hasOwnerSession(request, settings.ownerPassword)
    return homePage(settings, origin, signedIn)
  }

  return {
    async fetch(
      request: Request,
      env: Env,
      ctx: ExecutionContext
    ): Promise<Response> {
      const settings = readSettings(env)
      const url = new URL(request.url)
      const origin = settings.publicUrl ?? url.origin

      // Tokens are bound to the origin, so other hostnames serve nothing. The
      // 404 doesn't name the right one: a pinned origin may be meant to stay
      // unguessable.
      if (url.origin !== origin)
        return new Response("Not found\n", { status: 404 })

      if (url.pathname === "/") return home(request, env, settings, origin)

      if (settings.connectors.length === 0)
        return messagePage(
          404,
          "No connectors yet",
          "Add an ACCOUNT_<SERVICE>_<ACCOUNT> secret to this Worker first."
        )

      const routes = routesFor(settings, origin)

      if (url.pathname === AUTHORIZE_PATH)
        return authorize(
          request,
          env,
          routes.server.getOAuthApi(env),
          settings,
          (resource) =>
            settings.connectors.find((c) => `${origin}${c.path}` === resource)
        )

      const connector = connectorAt(settings, url.pathname)
      const resource = connector && routes.resources.get(connector.path)
      if (resource) return resource.fetch(request, env, ctx)

      return routes.server.fetch(request, env, ctx)
    },
  }
}
