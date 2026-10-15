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
const RESPONSE_HEADERS = new Set([
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

export async function passthrough(
  request: Request,
  connector: Connector,
  credential: string,
  upstreamFetch: UpstreamFetch
): Promise<Response> {
  const headers = new Headers()
  for (const [name, value] of request.headers) {
    if (forwards(name, REQUEST_HEADERS)) headers.set(name, value)
  }
  if (connector.auth.type === "bearer")
    headers.set("Authorization", `Bearer ${credential}`)
  else headers.set(connector.auth.name, credential)

  const target = new URL(connector.upstream)
  for (const [key, value] of new URL(request.url).searchParams)
    target.searchParams.append(key, value)

  // Requests are single JSON-RPC messages, so buffering costs nothing and gives
  // the upstream a Content-Length. Only responses can run long (SSE).
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer()

  let upstream: Response
  try {
    upstream = await upstreamFetch(target, {
      method: request.method,
      headers,
      body,
      // A redirect would carry the account's credential to another host.
      redirect: "manual",
    })
  } catch (error) {
    console.error(`[passthrough] ${connector.path}: fetch failed`, error)
    return gatewayError(502, `${connector.service} is unreachable`)
  }

  // A 401 from here would make the client redo OAuth with the gateway, which
  // can't fix a key the upstream refuses.
  if (upstream.status === 401 || upstream.status === 403) {
    await upstream.body?.cancel()
    return gatewayError(
      502,
      `${connector.service} rejected the credential of account "${connector.account}" (${upstream.status})`
    )
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel()
    return gatewayError(
      502,
      `${connector.service} answered with a redirect, which is not followed`
    )
  }

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
