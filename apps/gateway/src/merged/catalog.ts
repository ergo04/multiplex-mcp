import type { MergedConnector } from "../config"
import type { UpstreamFetch } from "../proxy/passthrough"
import { listAccountTools, type Tool } from "./upstream"

/** Also the `ttlMs` hint, so a client refetching after it is the first request that costs anything. */
export const TOOLS_TTL_MS = 5 * 60 * 1000

// Clients cache a list by `ttlMs`; an incomplete one should be asked again soon.
const PARTIAL_TTL_MS = 30 * 1000

export interface Catalog {
  /** A JSON array: kept serialized, so a cached list is spliced into the response unparsed. */
  json: string
  ttlMs: number
}

interface AccountTools {
  account: string
  tools: Tool[]
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
}

export function withAccountParam<T extends Pick<Tool, "inputSchema">>(
  tool: T,
  endpoint: MergedConnector,
  accounts: string[]
): T {
  const schema = tool.inputSchema ?? {}
  const required = Array.isArray(schema.required) ? schema.required : []
  return {
    ...tool,
    inputSchema: {
      ...schema,
      type: "object",
      properties: {
        [endpoint.accountParam]: {
          type: "string",
          enum: accounts,
          description: `Which ${endpoint.serviceName} ${endpoint.accountParam} to act on. One of: ${accounts.join(", ")}`,
        },
        ...schema.properties,
      },
      required: [endpoint.accountParam, ...required],
    },
  }
}

/**
 * Plans gate part of a service's tools (Linear hides `customer*` on the lower
 * ones), so the list is the union of every account's tools, each tool's enum
 * narrowed to the accounts that have it. One account taken as representative
 * would hide tools the others do have.
 */
export function mergeTools(
  endpoint: MergedConnector,
  perAccount: AccountTools[],
  shadowed: Set<string>
): Tool[] {
  const param = endpoint.accountParam
  const merged = new Map<string, { tool: Tool; accounts: string[] }>()
  for (const { account, tools } of perAccount) {
    for (const tool of tools) {
      if (shadowed.has(tool.name)) continue
      const properties = tool.inputSchema?.properties
      if (properties && Object.hasOwn(properties, param)) {
        // Routing would take the tool's own argument for the account.
        console.warn(
          `[merged] ${endpoint.path}: "${tool.name}" already has a "${param}" argument, so it is left out; set SERVICE_${endpoint.service.toUpperCase()}_ACCOUNT_PARAM to another name`
        )
        continue
      }
      const entry = merged.get(tool.name)
      if (!entry) merged.set(tool.name, { tool, accounts: [account] })
      else if (!entry.accounts.includes(account)) entry.accounts.push(account)
    }
  }

  const everyAccount = endpoint.accounts.length
  // Sorted, not in upstream order: clients and prompt caches rely on a stable list.
  return [...merged.values()]
    .sort((a, b) => byName(a.tool, b.tool))
    .map(({ tool, accounts }) => {
      const withParam = withAccountParam(tool, endpoint, accounts)
      if (accounts.length === everyAccount) return withParam
      return {
        ...withParam,
        description:
          `${tool.description ?? ""}\n\nOnly available for these ${param}s: ${accounts.join(", ")}.`.trim(),
      }
    })
}

async function cacheKey(
  endpoint: MergedConnector,
  shadowed: Set<string>
): Promise<string> {
  // Credentials are part of the key, so a rotated key never reads a list made
  // with the old one; hashed, so the key itself gives nothing away.
  const material = [
    endpoint.service,
    endpoint.serviceName,
    endpoint.accountParam,
    [...shadowed].sort().join(","),
    ...endpoint.accounts.flatMap((a) => [
      a.account,
      a.upstream.href,
      a.credential,
    ]),
  ].join("\n")
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material)
  )
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
  return `https://tools.mupx.invalid/${endpoint.service}/${hex}`
}

/**
 * The Cache API, not KV: it costs no daily write quota. It lives per data
 * center and only works on a custom domain; on workers.dev every list asks
 * each account again.
 */
export async function upstreamCatalog(
  endpoint: MergedConnector,
  shadowed: Set<string>,
  upstreamFetch: UpstreamFetch,
  cacheName: string,
  waitUntil: (promise: Promise<unknown>) => void
): Promise<Catalog> {
  const cache = await caches.open(cacheName)
  const key = await cacheKey(endpoint, shadowed)
  const hit = await cache.match(key)
  // Marks the invocations whose CPU time is worth watching in Workers Logs.
  if (hit) {
    console.log(`[merged] ${endpoint.path}: tool list from the cache`)
    return { json: await hit.text(), ttlMs: TOOLS_TTL_MS }
  }

  const settled = await Promise.all(
    endpoint.accounts.map(async (connector) => {
      try {
        return {
          account: connector.account,
          tools: await listAccountTools(connector, upstreamFetch),
        }
      } catch (error) {
        // One unreachable account must not blank out the others' tools.
        console.warn(`[merged] ${connector.path}: tools/list failed`, error)
        return undefined
      }
    })
  )
  const perAccount = settled.filter(
    (entry): entry is AccountTools => entry !== undefined
  )
  const json = JSON.stringify(mergeTools(endpoint, perAccount, shadowed))
  console.log(
    `[merged] ${endpoint.path}: tool list built from ${perAccount.length} of ${endpoint.accounts.length} accounts`
  )

  if (perAccount.length < endpoint.accounts.length)
    return { json, ttlMs: PARTIAL_TTL_MS }

  waitUntil(
    cache.put(
      key,
      new Response(json, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${TOOLS_TTL_MS / 1000}`,
        },
      })
    )
  )
  return { json, ttlMs: TOOLS_TTL_MS }
}
