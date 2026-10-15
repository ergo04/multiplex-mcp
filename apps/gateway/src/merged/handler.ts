import type { Connector, MergedConnector } from "../config"
import {
  forward,
  RESPONSE_HEADERS,
  type UpstreamFetch,
} from "../proxy/passthrough"
import type { Arguments } from "./arguments"
import { upstreamCatalog, withAccountParam } from "./catalog"
import { EXTRA_TOOLS, type ExtraTool } from "./extra-tools"
import {
  declaredVersion,
  HEADER_MISMATCH,
  headerMismatch,
  INVALID_PARAMS,
  INVALID_REQUEST,
  LEGACY_VERSION,
  meta,
  META_CLIENT_CAPABILITIES,
  META_CLIENT_INFO,
  META_PROTOCOL_VERSION,
  META_SERVER_INFO,
  METHOD_NOT_FOUND,
  rpcError,
  rpcResult,
  SERVER_INFO,
  SUPPORTED_VERSIONS,
  UNSUPPORTED_PROTOCOL_VERSION,
  withServerInfo,
  type JsonRpcRequest,
  type RequestId,
} from "./protocol"
import { upstreamHeaders } from "./upstream"

export interface MergedOptions {
  upstreamFetch: UpstreamFetch
  cacheName: string
  waitUntil: (promise: Promise<unknown>) => void
}

// Telemetry follows the call upstream; nothing else of the client's does.
const TRACE_HEADERS = ["traceparent", "tracestate", "user-agent"]

function listToolName(endpoint: MergedConnector): string {
  return `list_${endpoint.accountParam}s`
}

function extraTools(endpoint: MergedConnector): ExtraTool[] {
  return endpoint.extraTools ? (EXTRA_TOOLS[endpoint.service]?.tools ?? []) : []
}

function accountNames(endpoint: MergedConnector): string[] {
  return endpoint.accounts.map((a) => a.account)
}

function instructions(endpoint: MergedConnector): string {
  const param = endpoint.accountParam
  const parts = [
    `Every ${endpoint.serviceName} ${param} behind one connector. Every tool takes a \`${param}\` argument, one of: ${accountNames(endpoint).join(", ")}. A tool whose description names some ${param}s exists only in those.`,
  ]
  const extra = endpoint.extraTools
    ? EXTRA_TOOLS[endpoint.service]?.instructions
    : undefined
  if (extra) parts.push(extra)
  return parts.join(" ")
}

/** The tools the gateway answers itself; they shadow upstream tools with the same name. */
function ownTools(endpoint: MergedConnector) {
  const param = endpoint.accountParam
  const list = {
    name: listToolName(endpoint),
    description: `List the ${endpoint.serviceName} ${param}s this connector reaches. Every other tool needs a \`${param}\`.`,
    inputSchema: { type: "object", properties: {}, required: [] },
  }
  const extras = extraTools(endpoint).map((tool) =>
    withAccountParam(
      {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      endpoint,
      accountNames(endpoint)
    )
  )
  return [list, ...extras]
}

function joinArrays(a: string, b: string): string {
  if (a === "[]") return b
  if (b === "[]") return a
  return `${a.slice(0, -1)},${b.slice(1)}`
}

function toolResult(id: RequestId, text: string, isError = false): Response {
  return rpcResult(
    id,
    withServerInfo({
      resultType: "complete",
      content: [{ type: "text", text }],
      ...(isError ? { isError: true } : {}),
    })
  )
}

async function listTools(
  id: RequestId,
  endpoint: MergedConnector,
  options: MergedOptions
): Promise<Response> {
  const own = ownTools(endpoint)
  const catalog = await upstreamCatalog(
    endpoint,
    new Set(own.map((tool) => tool.name)),
    options.upstreamFetch,
    options.cacheName,
    options.waitUntil
  )
  const head = JSON.stringify({
    resultType: "complete",
    ttlMs: catalog.ttlMs,
    // Which tools exist depends on the deployment's credentials: a shared
    // cache must never hand this list to anyone else.
    cacheScope: "private",
    _meta: { [META_SERVER_INFO]: SERVER_INFO },
  })
  const tools = joinArrays(JSON.stringify(own), catalog.json)
  return new Response(
    `{"jsonrpc":"2.0","id":${JSON.stringify(id)},"result":${head.slice(0, -1)},"tools":${tools}}}`,
    { headers: { "Content-Type": "application/json" } }
  )
}

function resolveAccount(
  endpoint: MergedConnector,
  value: unknown
): Connector | string {
  const param = endpoint.accountParam
  const valid = accountNames(endpoint).join(", ")
  if (typeof value !== "string" || value === "")
    return `\`${param}\` is required. One of: ${valid}`
  const connector = endpoint.accounts.find(
    (a) => a.account === value.toLowerCase()
  )
  return connector ?? `Unknown ${param} "${value}". One of: ${valid}`
}

/**
 * The upstream is spoken to in UPSTREAM_VERSION whatever the client declared,
 * so the 2026-07-28 keys go: a body version contradicting the header would be
 * refused. Progress tokens and trace context stay.
 */
function upstreamMeta(params: unknown): Record<string, unknown> | undefined {
  const {
    [META_PROTOCOL_VERSION]: _version,
    [META_CLIENT_INFO]: _info,
    [META_CLIENT_CAPABILITIES]: _capabilities,
    ...rest
  } = meta(params) ?? {}
  return Object.keys(rest).length > 0 ? rest : undefined
}

async function callTool(
  request: Request,
  message: JsonRpcRequest,
  id: RequestId,
  endpoint: MergedConnector,
  options: MergedOptions
): Promise<Response> {
  const params = message.params as
    { name?: unknown; arguments?: unknown } | undefined
  if (typeof params?.name !== "string" || params.name === "")
    return rpcError(400, id, INVALID_PARAMS, "Missing tool name")
  const name = params.name

  if (name === listToolName(endpoint)) {
    const lines = endpoint.accounts.map((a) => `- \`${a.account}\``)
    return toolResult(
      id,
      `## ${endpoint.serviceName} ${endpoint.accountParam}s\n\n${lines.join("\n")}`
    )
  }

  const args =
    typeof params.arguments === "object" &&
    params.arguments !== null &&
    !Array.isArray(params.arguments)
      ? (params.arguments as Arguments)
      : {}
  const connector = resolveAccount(endpoint, args[endpoint.accountParam])
  if (typeof connector === "string") return toolResult(id, connector, true)
  const { [endpoint.accountParam]: _account, ...rest } = args

  const extra = extraTools(endpoint).find((tool) => tool.name === name)
  if (extra) {
    try {
      return toolResult(
        id,
        await extra.run(rest, connector.credential, options.upstreamFetch)
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return toolResult(id, `Error executing tool "${name}": ${reason}`, true)
    }
  }

  const headers = upstreamHeaders("tools/call", name)
  for (const [header, value] of request.headers) {
    const lower = header.toLowerCase()
    if (lower.startsWith("mcp-param-") || TRACE_HEADERS.includes(lower))
      headers.set(header, value)
  }

  const forwarded = await forward(
    connector,
    connector.upstream,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...message,
        params: { ...params, arguments: rest, _meta: upstreamMeta(params) },
      }),
    },
    options.upstreamFetch
  )
  if ("failure" in forwarded) return toolResult(id, forwarded.failure, true)

  // Same id, so the upstream's reply is already the answer to this request and
  // streams through as it is. Only its session id stays behind: a session
  // would tie the merged endpoint to one account.
  const upstream = forwarded.response
  const responseHeaders = new Headers()
  for (const [header, value] of upstream.headers)
    if (RESPONSE_HEADERS.has(header.toLowerCase()))
      responseHeaders.set(header, value)
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

/** MCP over Streamable HTTP, stateless: one JSON-RPC message per POST, no GET stream. */
export async function serveMerged(
  request: Request,
  endpoint: MergedConnector,
  options: MergedOptions
): Promise<Response> {
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { Allow: "POST" } })

  let message: unknown
  try {
    message = await request.json()
  } catch {
    return rpcError(400, null, -32700, "Parse error: invalid JSON")
  }
  // Batches left the protocol in 2025-06-18.
  if (typeof message !== "object" || message === null || Array.isArray(message))
    return rpcError(400, null, INVALID_REQUEST, "Invalid Request")

  const rpc = message as JsonRpcRequest
  const id = rpc.id ?? null
  if (typeof rpc.method !== "string")
    return rpcError(400, id, INVALID_REQUEST, "Invalid Request")
  if (rpc.method.startsWith("notifications/"))
    return new Response(null, { status: 202 })

  const mismatch = headerMismatch(request.headers, rpc.method, rpc.params)
  if (mismatch)
    return rpcError(400, id, HEADER_MISMATCH, `Header mismatch: ${mismatch}`)

  // A modern client states its version on every request; refusing one this
  // server doesn't implement lets it retry with a supported one.
  const requested = declaredVersion(rpc.params)
  if (requested && !SUPPORTED_VERSIONS.includes(requested))
    return rpcError(
      400,
      id,
      UNSUPPORTED_PROTOCOL_VERSION,
      "Unsupported protocol version",
      { supported: SUPPORTED_VERSIONS, requested }
    )

  try {
    switch (rpc.method) {
      case "server/discover":
        return rpcResult(
          id,
          withServerInfo({
            resultType: "complete",
            supportedVersions: SUPPORTED_VERSIONS,
            capabilities: { tools: {} },
            instructions: instructions(endpoint),
            ttlMs: 60 * 60 * 1000,
            // The instructions name this deployment's accounts.
            cacheScope: "private",
          })
        )

      case "initialize":
        // The newest revision that still has a handshake: 2026-07-28 has
        // none, so it never goes here.
        return rpcResult(id, {
          protocolVersion: LEGACY_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: instructions(endpoint),
        })

      case "ping":
        return rpcResult(id, {})

      case "tools/list":
        return await listTools(id, endpoint, options)

      case "tools/call":
        return await callTool(request, rpc, id, endpoint, options)

      default:
        // 404, not 200: a client tells an unimplemented method apart from a
        // URL that isn't an MCP endpoint at all.
        return rpcError(
          404,
          id,
          METHOD_NOT_FOUND,
          `Method not found: ${rpc.method}`
        )
    }
  } catch (error) {
    console.error(`[merged] ${endpoint.path}: ${rpc.method} failed`, error)
    const reason = error instanceof Error ? error.message : String(error)
    return rpcError(500, id, -32603, reason)
  }
}
