/**
 * The merged endpoint speaks MCP itself, in two eras: 2026-07-28 dropped the
 * initialize handshake for per-request `_meta` and `server/discover`, and
 * clients of the older revisions are still the majority. Only versions actually
 * implemented are advertised, so a client asking for another one retries.
 */

export const MODERN_VERSION = "2026-07-28"
export const LEGACY_VERSION = "2025-06-18"
export const SUPPORTED_VERSIONS = [MODERN_VERSION, LEGACY_VERSION]

export const META_PROTOCOL_VERSION = "io.modelcontextprotocol/protocolVersion"
export const META_CLIENT_INFO = "io.modelcontextprotocol/clientInfo"
export const META_CLIENT_CAPABILITIES =
  "io.modelcontextprotocol/clientCapabilities"
export const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo"

export const SERVER_INFO = { name: "mupx", version: "0.2.0" }

export const INVALID_REQUEST = -32600
export const METHOD_NOT_FOUND = -32601
export const INVALID_PARAMS = -32602
export const HEADER_MISMATCH = -32020
export const UNSUPPORTED_PROTOCOL_VERSION = -32022

export type RequestId = string | number | null

export interface JsonRpcRequest {
  jsonrpc?: string
  id?: RequestId
  method?: unknown
  params?: unknown
}

export function rpcResult(id: RequestId, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result })
}

export function rpcError(
  status: number,
  id: RequestId,
  code: number,
  message: string,
  data?: unknown
): Response {
  const error = data === undefined ? { code, message } : { code, message, data }
  return Response.json({ jsonrpc: "2.0", id, error }, { status })
}

export function meta(params: unknown): Record<string, unknown> | undefined {
  const value = (params as { _meta?: unknown } | undefined)?._meta
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/** The protocol version a modern request declares in `_meta`, if any. */
export function declaredVersion(params: unknown): string | undefined {
  const version = meta(params)?.[META_PROTOCOL_VERSION]
  return typeof version === "string" ? version : undefined
}

/** Servers SHOULD identify themselves in every result's `_meta`. */
export function withServerInfo<T extends object>(result: T): T {
  const existing = (result as { _meta?: Record<string, unknown> })._meta ?? {}
  return { ...result, _meta: { ...existing, [META_SERVER_INFO]: SERVER_INFO } }
}

const SENTINEL_PREFIX = "=?base64?"
const SENTINEL_SUFFIX = "?="

function isSentinel(value: string): boolean {
  return value.startsWith(SENTINEL_PREFIX) && value.endsWith(SENTINEL_SUFFIX)
}

/** Visible ASCII, space and tab, with no leading or trailing whitespace. */
function isPlainAscii(value: string): boolean {
  return value === value.trim() && /^[\x20-\x7E\t]*$/.test(value)
}

/** The Base64 sentinel Streamable HTTP uses for header values that aren't plain ASCII. */
export function encodeHeaderValue(value: string): string {
  // A plain value shaped like the sentinel is encoded too, or the receiver
  // would decode something that was never encoded.
  if (isPlainAscii(value) && !isSentinel(value)) return value
  const bytes = new TextEncoder().encode(value)
  return `${SENTINEL_PREFIX}${btoa(String.fromCharCode(...bytes))}${SENTINEL_SUFFIX}`
}

export function decodeHeaderValue(value: string): string {
  if (!isSentinel(value)) return value
  try {
    const binary = atob(
      value.slice(SENTINEL_PREFIX.length, -SENTINEL_SUFFIX.length)
    )
    return new TextDecoder().decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0))
    )
  } catch {
    return value
  }
}

/**
 * Headers that mirror body fields are only checked when present, since legacy
 * clients omit them. One that contradicts the body is refused: an intermediary
 * may route or rate-limit on the header while the gateway acts on the body.
 */
export function headerMismatch(
  headers: Headers,
  method: string,
  params: unknown
): string | undefined {
  const declared = declaredVersion(params)
  const versionHeader = headers.get("mcp-protocol-version")
  if (versionHeader && declared && versionHeader !== declared)
    return `MCP-Protocol-Version header value '${versionHeader}' does not match body value '${declared}'`

  const methodHeader = headers.get("mcp-method")
  if (methodHeader && methodHeader !== method)
    return `Mcp-Method header value '${methodHeader}' does not match body value '${method}'`

  const nameHeader = headers.get("mcp-name")
  if (nameHeader && method === "tools/call") {
    const bodyName = (params as { name?: unknown } | undefined)?.name
    const decoded = decodeHeaderValue(nameHeader)
    if (typeof bodyName === "string" && decoded !== bodyName)
      return `Mcp-Name header value '${decoded}' does not match body value '${bodyName}'`
  }
  return undefined
}
