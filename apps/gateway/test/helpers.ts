import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test"
import { createGateway } from "../src/gateway"
import type { UpstreamFetch } from "../src/proxy/passthrough"

export const ORIGIN = "https://gw.example"
export const ALPHA = `${ORIGIN}/m/demo/alpha/mcp`
export const BETA = `${ORIGIN}/m/demo/beta/mcp`
export const MERGED = `${ORIGIN}/u/demo/mcp`
export const LAPTOP_TOKEN = "laptop-token-0123456789abcdef0123456789"
export const NARROW_TOKEN = "narrow-token-0123456789abcdef0123456789"
export const PASSWORD = "correct horse battery staple"

export const TEST_VARS: Record<string, string> = {
  PUBLIC_URL: ORIGIN,
  OWNER_PASSWORD: PASSWORD,
  SERVICE_DEMO_URL: "https://upstream.example/mcp",
  SERVICE_DEMO_NAME: "Demo",
  SERVICE_HEADERED_URL: "https://headered.example/mcp",
  SERVICE_HEADERED_HEADER: "X-Api-Key",
  ACCOUNT_DEMO_ALPHA: "key-alpha",
  ACCOUNT_DEMO_BETA: "key-beta",
  ACCOUNT_HEADERED_MAIN: "key-headered",
  CLIENT_TOKEN_LAPTOP: LAPTOP_TOKEN,
  CLIENT_TOKEN_NARROW: NARROW_TOKEN,
  CLIENT_PATHS_NARROW: "/m/demo/beta/mcp",
  CLIENT_TOKEN_SHORT: "too-short",
}

export interface SeenRequest {
  url: URL
  method: string
  headers: Headers
  body: string
}

export type UpstreamHandler = (
  seen: SeenRequest
) => Response | Promise<Response>

/**
 * A gateway whose upstream calls land in `seen` and are answered by `handler`.
 * `vars` replaces entries of TEST_VARS; `undefined` removes one.
 */
export function gatewayWith(
  handler: UpstreamHandler,
  vars: Record<string, string | undefined> = {}
) {
  const seen: SeenRequest[] = []
  const upstreamFetch: UpstreamFetch = async (input, init) => {
    const request = new Request(input, init)
    const entry = {
      url: new URL(request.url),
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" ? "" : await request.text(),
    }
    seen.push(entry)
    return handler(entry)
  }

  // Only the bindings: string vars would come from a developer's .dev.vars,
  // which the test plugin loads too.
  const bindings = Object.entries(env).filter(([, v]) => typeof v !== "string")
  const merged: Record<string, unknown> = {
    ...Object.fromEntries(bindings),
    ...TEST_VARS,
  }
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete merged[key]
    else merged[key] = value
  }

  // Its own cache, so a tool list cached by one test never answers another.
  const gateway = createGateway({
    upstreamFetch,
    cacheName: crypto.randomUUID(),
  })
  // Waits for waitUntil work too, so a cache write is done before the next call.
  const call = async (input: string, init?: RequestInit) => {
    const ctx = createExecutionContext()
    const response = await gateway.fetch(
      new Request(input, init),
      merged as unknown as Env,
      ctx
    )
    await waitOnExecutionContext(ctx)
    return response
  }
  return { call, seen }
}

export function rpc(method: string, params: unknown = {}) {
  return JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
}

export const echoAccount: UpstreamHandler = ({ headers }) =>
  Response.json(
    { jsonrpc: "2.0", id: 1, result: { auth: headers.get("Authorization") } },
    { headers: { "Mcp-Session-Id": "session-1" } }
  )

export function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ")
}
