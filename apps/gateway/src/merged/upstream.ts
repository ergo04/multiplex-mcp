import type { Connector } from "../config"
import { forward, type UpstreamFetch } from "../proxy/passthrough"
import { encodeHeaderValue, withServerInfo } from "./protocol"

/**
 * The revision the gateway speaks to upstreams, whatever the client speaks to
 * the gateway. The merged endpoint is for stateless services, which answer
 * without a handshake; claiming 2026-07-28 instead would be refused by a server
 * that doesn't implement it, and every hosted MCP server today implements this.
 */
export const UPSTREAM_VERSION = "2025-06-18"

export interface Tool {
  name: string
  description?: string
  inputSchema?: {
    type?: unknown
    properties?: Record<string, unknown>
    required?: unknown
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface UpstreamMessage {
  id?: unknown
  result?: unknown
  error?: { code?: number; message?: string }
}

// A misbehaving upstream must not keep the list request paging forever.
const MAX_LIST_PAGES = 20
const LIST_TIMEOUT_MS = 15_000

/**
 * Method, name and protocol version are set here together with the body they
 * mirror: a header and a body that disagree make the upstream answer -32020.
 */
export function upstreamHeaders(method: string, name?: string): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": UPSTREAM_VERSION,
    "Mcp-Method": method,
  })
  if (name !== undefined) headers.set("Mcp-Name", encodeHeaderValue(name))
  return headers
}

function isTool(value: unknown): value is Tool {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string"
  )
}

function eventData(event: string): string {
  return event
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n")
}

/** A reply to one request, framed as JSON or as a short event stream. */
function readMessage(contentType: string, body: string): UpstreamMessage {
  if (!contentType.includes("text/event-stream"))
    return JSON.parse(body) as UpstreamMessage

  for (const event of body.split(/\r?\n\r?\n/)) {
    const data = eventData(event)
    if (!data) continue
    const message = JSON.parse(data) as UpstreamMessage
    // Notifications may come first; only the response carries a result.
    if (message.result !== undefined || message.error !== undefined)
      return message
  }
  throw new Error("the event stream ended without a response")
}

function modernResult(data: string): string {
  let message: UpstreamMessage | null
  try {
    message = JSON.parse(data) as UpstreamMessage | null
  } catch {
    return data
  }
  const result = message?.result
  if (typeof result !== "object" || result === null || Array.isArray(result))
    return data
  return JSON.stringify({
    ...message,
    // An upstream's own value goes last: it may be `input_required`.
    result: withServerInfo({ resultType: "complete", ...result }),
  })
}

function modernEvent(event: string): string {
  const data = eventData(event)
  const modern = modernResult(data)
  if (modern === data) return event
  const others = event.split(/\r?\n/).filter((l) => !l.startsWith("data:"))
  return [...others, `data: ${modern}`].join("\n")
}

function modernEvents(): TransformStream<string, string> {
  let pending = ""
  return new TransformStream({
    transform(chunk, controller) {
      const parts = (pending + chunk).split(/(\r?\n\r?\n)/)
      pending = parts.pop() ?? ""
      for (let i = 0; i < parts.length; i += 2)
        controller.enqueue(modernEvent(parts[i]!) + parts[i + 1]!)
    },
    flush(controller) {
      if (pending) controller.enqueue(modernEvent(pending))
    },
  })
}

/**
 * An upstream answers in UPSTREAM_VERSION, whose results have no `resultType`,
 * while a 2026-07-28 client refuses a result without one: the fallback to
 * "complete" is only for servers that declared an earlier revision, and this
 * endpoint declared 2026-07-28. Events are rewritten one at a time, so a long
 * reply still streams.
 */
export async function modernBody(upstream: Response): Promise<BodyInit | null> {
  if (!upstream.body) return null
  const contentType = upstream.headers.get("content-type") ?? ""
  if (!contentType.includes("text/event-stream"))
    return modernResult(await upstream.text())
  return upstream.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(modernEvents())
    .pipeThrough(new TextEncoderStream())
}

export async function listAccountTools(
  connector: Connector,
  upstreamFetch: UpstreamFetch
): Promise<Tool[]> {
  const tools: Tool[] = []
  let cursor: string | undefined
  const signal = AbortSignal.timeout(LIST_TIMEOUT_MS)

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const forwarded = await forward(
      connector,
      connector.upstream,
      {
        method: "POST",
        headers: upstreamHeaders("tools/list"),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: page + 1,
          method: "tools/list",
          params: cursor ? { cursor } : {},
        }),
      },
      (input, init) => upstreamFetch(input, { ...init, signal })
    )
    if ("failure" in forwarded) throw new Error(forwarded.failure)

    const response = forwarded.response
    const body = await response.text()
    if (!response.ok)
      throw new Error(
        `${connector.service} answered ${response.status} to tools/list`
      )
    const message = readMessage(
      response.headers.get("content-type") ?? "",
      body
    )
    if (message.error)
      throw new Error(
        `${connector.service} refused tools/list: ${message.error.message}`
      )

    const result = message.result as
      { tools?: unknown[]; nextCursor?: unknown } | undefined
    tools.push(...(result?.tools ?? []).filter(isTool))
    if (typeof result?.nextCursor !== "string" || !result.nextCursor) break
    cursor = result.nextCursor
  }
  return tools
}
