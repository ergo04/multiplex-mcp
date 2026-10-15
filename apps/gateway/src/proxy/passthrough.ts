import type { Connector } from "../config"

export type UpstreamFetch = (input: URL, init: RequestInit) => Promise<Response>

// Everything else the client sent stays here: its Authorization is a gateway
// token, and cookies or cf-* headers describe the client, not the upstream call.
// `mcp-` covers Mcp-Session-Id, MCP-Protocol-Version, Mcp-Method, Mcp-Name and
// the Mcp-Param-* headers intermediaries must forward verbatim.
const REQUEST_HEADERS = new Set([
  "accept",
  "content-type",
  "last-event-id",
  "traceparent",
  "tracestate",
  "user-agent",
])

// WWW-Authenticate above all: passed through, it would send the client off to
// sign in with the upstream's own authorization server.
export const RESPONSE_HEADERS = new Set([
  "content-type",
  "cache-control",
  "retry-after",
])

function forwards(name: string, allowed: Set<string>): boolean {
  const lower = name.toLowerCase()
  return lower.startsWith("mcp-") || allowed.has(lower)
}

export function gatewayError(status: number, message: string): Response {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32000, message } },
    { status }
  )
}

export type Forwarded = { response: Response } | { failure: string }

/**
 * The one place an account's credential leaves the gateway, so the checks on
 * what comes back hold for both kinds of endpoint.
 */
export async function forward(
  connector: Connector,
  target: URL,
  init: { method: string; headers: Headers; body?: BodyInit },
  upstreamFetch: UpstreamFetch
): Promise<Forwarded> {
  const headers = new Headers(init.headers)
  if (connector.auth.type === "bearer")
    headers.set("Authorization", `Bearer ${connector.credential}`)
  else headers.set(connector.auth.name, connector.credential)

  let upstream: Response
  try {
    upstream = await upstreamFetch(target, {
      method: init.method,
      headers,
      body: init.body,
      // A redirect would carry the account's credential to another host.
      redirect: "manual",
    })
  } catch (error) {
    console.error(`[forward] ${connector.path}: fetch failed`, error)
    return { failure: `${connector.service} is unreachable` }
  }

  // A 401 passed on would make the client redo OAuth with the gateway, which
  // can't fix a key the upstream refuses.
  if (upstream.status === 401 || upstream.status === 403) {
    await upstream.body?.cancel()
    return {
      failure: `${connector.service} rejected the credential of account "${connector.account}" (${upstream.status})`,
    }
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel()
    return {
      failure: `${connector.service} answered with a redirect, which is not followed`,
    }
  }
  return { response: upstream }
}

export async function passthrough(
  request: Request,
  connector: Connector,
  upstreamFetch: UpstreamFetch
): Promise<Response> {
  const headers = new Headers()
  for (const [name, value] of request.headers) {
    if (forwards(name, REQUEST_HEADERS)) headers.set(name, value)
  }

  const target = new URL(connector.upstream)
  for (const [key, value] of new URL(request.url).searchParams)
    target.searchParams.append(key, value)

  // Requests are single JSON-RPC messages, so buffering costs nothing and gives
  // the upstream a Content-Length. Only responses can run long (SSE).
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer()

  const forwarded = await forward(
    connector,
    target,
    { method: request.method, headers, body },
    upstreamFetch
  )
  if ("failure" in forwarded) return gatewayError(502, forwarded.failure)

  const upstream = forwarded.response
  const responseHeaders = new Headers()
  for (const [name, value] of upstream.headers) {
    if (forwards(name, RESPONSE_HEADERS)) responseHeaders.set(name, value)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}
