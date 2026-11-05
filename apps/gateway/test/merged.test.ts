import { describe, expect, it } from "vitest"
import {
  gatewayWith,
  LAPTOP_TOKEN,
  MERGED,
  NARROW_TOKEN,
  ORIGIN,
  type SeenRequest,
  type UpstreamHandler,
} from "./helpers"

const MERGED_ON = { SERVICE_DEMO_MERGED: "true" }
const auth = { Authorization: `Bearer ${LAPTOP_TOKEN}` }

interface ListedTool {
  name: string
  description?: string
  inputSchema: {
    properties: Record<string, { enum?: string[] }>
    required: string[]
  }
}

const TOOLS: Record<string, object[]> = {
  "Bearer key-alpha": [
    {
      name: "shared_tool",
      description: "In both",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    { name: "alpha_only", description: "Alpha's plan has it" },
  ],
  "Bearer key-beta": [
    { name: "beta_only", inputSchema: { type: "object", properties: {} } },
    {
      name: "shared_tool",
      description: "In both",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}

function sse(message: object): Response {
  return new Response(`event: message\ndata: ${JSON.stringify(message)}\n\n`, {
    headers: { "Content-Type": "text/event-stream" },
  })
}

/** Alpha answers in JSON, beta in SSE, as different servers do. */
const demoUpstream: UpstreamHandler = ({ headers, body }) => {
  const message = JSON.parse(body) as { id: number; method: string }
  const authorization = headers.get("Authorization") ?? ""
  if (message.method === "tools/list") {
    const reply = {
      jsonrpc: "2.0",
      id: message.id,
      result: { tools: TOOLS[authorization] },
    }
    return authorization === "Bearer key-beta"
      ? sse(reply)
      : Response.json(reply)
  }
  return sse({
    jsonrpc: "2.0",
    id: message.id,
    result: { content: [{ type: "text", text: authorization }] },
  })
}

const SSE_HEADERS = { "Content-Type": "text/event-stream" }
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

function post(body: object, headers: Record<string, string> = {}) {
  return {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", ...body }),
  }
}

function modernCall(id: number) {
  return post(
    {
      id,
      method: "tools/call",
      params: {
        name: "shared_tool",
        arguments: { account: "alpha" },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    },
    { "MCP-Protocol-Version": "2026-07-28" }
  )
}

interface CallReply {
  id: number
  result: {
    resultType?: string
    content: unknown[]
    _meta?: Record<string, unknown>
  }
}

const dataLines = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as CallReply)

async function listTools(call: ReturnType<typeof gatewayWith>["call"]) {
  const response = await call(MERGED, post({ id: 7, method: "tools/list" }))
  expect(response.status).toBe(200)
  return (await response.json()) as {
    id: number
    result: {
      tools: ListedTool[]
      ttlMs: number
      cacheScope: string
      resultType: string
    }
  }
}

const toolsList = (seen: SeenRequest[]) =>
  seen.filter((s) => s.body.includes('"tools/list"'))

describe("merged endpoint: tools/list", () => {
  it("lists the union of every account's tools, sorted, with the account argument", async () => {
    const { call } = gatewayWith(demoUpstream, MERGED_ON)
    const { id, result } = await listTools(call)

    expect(id).toBe(7)
    expect(result.resultType).toBe("complete")
    expect(result.cacheScope).toBe("private")
    expect(result.ttlMs).toBe(300_000)
    expect(result.tools.map((t) => t.name)).toEqual([
      "list_accounts",
      "alpha_only",
      "beta_only",
      "shared_tool",
    ])

    const shared = result.tools.find((t) => t.name === "shared_tool")!
    expect(shared.inputSchema.properties["account"]?.enum).toEqual([
      "alpha",
      "beta",
    ])
    expect(shared.inputSchema.required).toEqual(["account", "query"])
    expect(shared.description).toBe("In both")
  })

  it("narrows each tool to the accounts that have it", async () => {
    const { call } = gatewayWith(demoUpstream, MERGED_ON)
    const { result } = await listTools(call)

    const alphaOnly = result.tools.find((t) => t.name === "alpha_only")!
    expect(alphaOnly.inputSchema.properties["account"]?.enum).toEqual(["alpha"])
    expect(alphaOnly.inputSchema.required).toEqual(["account"])
    expect(alphaOnly.description).toContain(
      "Only available for these accounts: alpha."
    )
  })

  it("asks the accounts once, then answers from the cache", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    const first = await listTools(call)
    expect(toolsList(seen)).toHaveLength(2)

    const second = await listTools(call)
    expect(toolsList(seen)).toHaveLength(2)
    expect(second.result.tools).toEqual(first.result.tools)
  })

  it("lists the other accounts when one fails, and does not cache that", async () => {
    let failBeta = true
    const { call, seen } = gatewayWith((request) => {
      if (
        failBeta &&
        request.headers.get("Authorization") === "Bearer key-beta"
      )
        return new Response("down", { status: 500 })
      return demoUpstream(request)
    }, MERGED_ON)

    const partial = await listTools(call)
    expect(partial.result.tools.map((t) => t.name)).toEqual([
      "list_accounts",
      "alpha_only",
      "shared_tool",
    ])
    expect(partial.result.ttlMs).toBeLessThan(300_000)

    failBeta = false
    const full = await listTools(call)
    expect(full.result.tools.map((t) => t.name)).toContain("beta_only")
    expect(toolsList(seen)).toHaveLength(4)
  })

  it("follows the upstream's pagination", async () => {
    const { call } = gatewayWith(({ body }) => {
      const message = JSON.parse(body) as {
        id: number
        params: { cursor?: string }
      }
      const result = message.params.cursor
        ? { tools: [{ name: "page_two" }] }
        : { tools: [{ name: "page_one" }], nextCursor: "2" }
      return Response.json({ jsonrpc: "2.0", id: message.id, result })
    }, MERGED_ON)
    const { result } = await listTools(call)
    expect(result.tools.map((t) => t.name)).toEqual([
      "list_accounts",
      "page_one",
      "page_two",
    ])
  })

  it("leaves out a tool that already has an argument with the account's name", async () => {
    const { call } = gatewayWith(
      ({ body }) =>
        Response.json({
          jsonrpc: "2.0",
          id: (JSON.parse(body) as { id: number }).id,
          result: {
            tools: [
              {
                name: "clashing",
                inputSchema: { properties: { account: { type: "string" } } },
              },
              { name: "fine" },
            ],
          },
        }),
      MERGED_ON
    )
    const { result } = await listTools(call)
    expect(result.tools.map((t) => t.name)).toEqual(["list_accounts", "fine"])
  })

  it("asks the upstream in its own revision, with mirrored headers", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    await listTools(call)
    const request = seen[0]!
    expect(request.headers.get("MCP-Protocol-Version")).toBe("2025-06-18")
    expect(request.headers.get("Mcp-Method")).toBe("tools/list")
    expect(request.headers.get("Accept")).toBe(
      "application/json, text/event-stream"
    )
  })
})

describe("merged endpoint: tools/call", () => {
  it("strips the account, keeps the id and routes to that account's credential", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    const response = await call(
      MERGED,
      post(
        {
          id: "call-42",
          method: "tools/call",
          params: {
            name: "shared_tool",
            arguments: { account: "beta", query: "x" },
          },
        },
        {
          "Mcp-Param-Region": "eu",
          traceparent: "00-abc-def-01",
          "Mcp-Session-Id": "client-session",
        }
      )
    )

    const upstream = seen[0]!
    expect(upstream.headers.get("Authorization")).toBe("Bearer key-beta")
    expect(JSON.parse(upstream.body)).toEqual({
      jsonrpc: "2.0",
      id: "call-42",
      method: "tools/call",
      params: { name: "shared_tool", arguments: { query: "x" } },
    })
    expect(upstream.headers.get("Mcp-Method")).toBe("tools/call")
    expect(upstream.headers.get("Mcp-Name")).toBe("shared_tool")
    expect(upstream.headers.get("Mcp-Param-Region")).toBe("eu")
    expect(upstream.headers.get("traceparent")).toBe("00-abc-def-01")
    expect(upstream.headers.get("Mcp-Session-Id")).toBeNull()

    expect(response.headers.get("Content-Type")).toBe("text/event-stream")
    expect(await response.text()).toBe(
      `event: message\ndata: ${JSON.stringify({
        jsonrpc: "2.0",
        id: "call-42",
        result: { content: [{ type: "text", text: "Bearer key-beta" }] },
      })}\n\n`
    )
  })

  it("speaks the upstream's revision to a 2026-07-28 client, keeping other _meta", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    await call(
      MERGED,
      post(
        {
          id: 1,
          method: "tools/call",
          params: {
            name: "shared_tool",
            arguments: { account: "alpha" },
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientCapabilities": {},
              "io.modelcontextprotocol/clientInfo": { name: "c", version: "1" },
              progressToken: "p-1",
            },
          },
        },
        { "MCP-Protocol-Version": "2026-07-28" }
      )
    )

    const upstream = seen[0]!
    expect(upstream.headers.get("MCP-Protocol-Version")).toBe("2025-06-18")
    expect(
      (JSON.parse(upstream.body) as { params: { _meta: unknown } }).params._meta
    ).toEqual({ progressToken: "p-1" })
  })

  it("streams the upstream's answer without waiting for it to finish", async () => {
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    const encoder = new TextEncoder()
    const { call } = gatewayWith(
      () =>
        new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(encoder.encode("data: first\n\n"))
              await released
              controller.enqueue(encoder.encode("data: second\n\n"))
              controller.close()
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } }
        ),
      MERGED_ON
    )

    const response = await call(
      MERGED,
      post({
        id: 1,
        method: "tools/call",
        params: { name: "slow", arguments: { account: "alpha" } },
      })
    )
    const reader = response.body!.getReader()
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toContain("first")
    release()
    await reader.cancel()
  })

  it("gives a 2026-07-28 client what its revision requires, in JSON and in SSE", async () => {
    const reply = {
      jsonrpc: "2.0",
      id: 4,
      result: { content: [{ type: "text", text: "perché" }] },
    }
    const progress = { jsonrpc: "2.0", method: "notifications/progress" }

    const json = gatewayWith(() => Response.json(reply), MERGED_ON)
    const fromJson = (await (
      await json.call(MERGED, modernCall(4))
    ).json()) as CallReply

    const stream = gatewayWith(
      () =>
        new Response(
          `data: ${JSON.stringify(progress)}\n\nevent: message\ndata: ${JSON.stringify(reply)}\n\n`,
          { headers: SSE_HEADERS }
        ),
      MERGED_ON
    )
    const text = await (await stream.call(MERGED, modernCall(4))).text()
    const [first, fromStream] = dataLines(text)

    expect(first).toEqual(progress)
    expect(text).toContain("event: message\ndata: ")
    for (const message of [fromJson, fromStream!]) {
      expect(message.id).toBe(4)
      expect(message.result.resultType).toBe("complete")
      expect(message.result.content).toEqual(reply.result.content)
      expect(message.result._meta?.[SERVER_INFO_KEY]).toMatchObject({
        name: "mupx",
      })
    }
  })

  it("leaves a legacy client's reply exactly as the upstream sent it", async () => {
    const framed = `event: message\ndata: ${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [] },
    })}\n\n`
    const { call } = gatewayWith(
      () => new Response(framed, { headers: SSE_HEADERS }),
      MERGED_ON
    )
    const response = await call(
      MERGED,
      post({
        id: 1,
        method: "tools/call",
        params: { name: "shared_tool", arguments: { account: "alpha" } },
      })
    )
    expect(await response.text()).toBe(framed)
  })

  it("keeps what the upstream said about its own result", async () => {
    const { call } = gatewayWith(
      () =>
        Response.json({
          jsonrpc: "2.0",
          id: 2,
          result: {
            resultType: "input_required",
            content: [],
            _meta: { kept: true },
          },
        }),
      MERGED_ON
    )
    const { result } = (await (
      await call(MERGED, modernCall(2))
    ).json()) as CallReply
    expect(result.resultType).toBe("input_required")
    expect(result._meta?.["kept"]).toBe(true)
    expect(result._meta?.[SERVER_INFO_KEY]).toBeDefined()
  })

  it("passes on to a 2026-07-28 client whatever isn't a result", async () => {
    const error = JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      error: { code: -32602, message: "No such tool" },
    })
    const refused = gatewayWith(
      () =>
        new Response(error, {
          headers: { "Content-Type": "application/json" },
        }),
      MERGED_ON
    )
    expect(await (await refused.call(MERGED, modernCall(3))).text()).toBe(error)

    const broken = gatewayWith(
      () => new Response("upstream fell over", { status: 500 }),
      MERGED_ON
    )
    const response = await broken.call(MERGED, modernCall(3))
    expect(response.status).toBe(500)
    expect(await response.text()).toBe("upstream fell over")
  })

  it("streams to a 2026-07-28 client event by event, across chunk boundaries", async () => {
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    const encoder = new TextEncoder()
    const answer = encoder.encode(
      `data: ${JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        result: { content: [{ type: "text", text: "perché" }] },
      })}\n\n`
    )
    const accent = answer.indexOf(0xc3)
    const { call } = gatewayWith(
      () =>
        new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(
                encoder.encode('data: {"method":"notifications/progress"}\n\n')
              )
              await released
              controller.enqueue(answer.slice(0, accent + 1))
              controller.enqueue(answer.slice(accent + 1, -1))
              controller.enqueue(answer.slice(-1))
              controller.close()
            },
          }),
          { headers: SSE_HEADERS }
        ),
      MERGED_ON
    )

    const response = await call(MERGED, modernCall(5))
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    const first = await reader.read()
    expect(decoder.decode(first.value)).toContain("notifications/progress")

    release()
    let rest = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      rest += decoder.decode(value, { stream: true })
    }
    const [message] = dataLines(rest)
    expect(message!.result.resultType).toBe("complete")
    expect(message!.result.content).toEqual([{ type: "text", text: "perché" }])
  })

  it("explains a missing or unknown account to the model", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    for (const args of [{}, { account: "gamma" }]) {
      const response = await call(
        MERGED,
        post({
          id: 3,
          method: "tools/call",
          params: { name: "shared_tool", arguments: args },
        })
      )
      const body = (await response.json()) as {
        id: number
        result: { isError: boolean; content: { text: string }[] }
      }
      expect(body.id).toBe(3)
      expect(body.result.isError).toBe(true)
      expect(body.result.content[0]?.text).toContain("alpha, beta")
    }
    expect(seen).toHaveLength(0)
  })

  it("accepts the account in any case", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    await call(
      MERGED,
      post({
        id: 1,
        method: "tools/call",
        params: { name: "shared_tool", arguments: { account: "Alpha" } },
      })
    )
    expect(seen[0]?.headers.get("Authorization")).toBe("Bearer key-alpha")
  })

  it("turns a refused credential into a tool error naming the account", async () => {
    const { call } = gatewayWith(
      () => new Response("no", { status: 401 }),
      MERGED_ON
    )
    const response = await call(
      MERGED,
      post({
        id: 5,
        method: "tools/call",
        params: { name: "shared_tool", arguments: { account: "beta" } },
      })
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      result: { isError: boolean; content: { text: string }[] }
    }
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0]?.text).toContain('account "beta"')
  })

  it("answers its own list tool", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    const response = await call(
      MERGED,
      post({ id: 2, method: "tools/call", params: { name: "list_accounts" } })
    )
    const body = (await response.json()) as {
      result: { content: { text: string }[] }
    }
    expect(body.result.content[0]?.text).toContain("`alpha`")
    expect(body.result.content[0]?.text).toContain("`beta`")
    expect(seen).toHaveLength(0)
  })
})

describe("merged endpoint: protocol", () => {
  it("answers initialize in the legacy revision", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    const response = await call(
      MERGED,
      post({
        id: 0,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {} },
      })
    )
    const body = (await response.json()) as {
      result: {
        protocolVersion: string
        serverInfo: { name: string }
        instructions: string
      }
    }
    expect(body.result.protocolVersion).toBe("2025-06-18")
    expect(body.result.serverInfo.name).toBe("mupx")
    expect(body.result.instructions).toContain("alpha, beta")
    expect(seen).toHaveLength(0)
  })

  it("answers server/discover with both revisions", async () => {
    const { call } = gatewayWith(demoUpstream, MERGED_ON)
    const response = await call(
      MERGED,
      post(
        {
          id: 1,
          method: "server/discover",
          params: {
            _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
          },
        },
        {
          "MCP-Protocol-Version": "2026-07-28",
          "Mcp-Method": "server/discover",
        }
      )
    )
    const body = (await response.json()) as {
      result: {
        supportedVersions: string[]
        resultType: string
        _meta: Record<string, unknown>
      }
    }
    expect(body.result.supportedVersions).toEqual(["2026-07-28", "2025-06-18"])
    expect(body.result.resultType).toBe("complete")
    expect(body.result._meta["io.modelcontextprotocol/serverInfo"]).toEqual({
      name: "mupx",
      version: "0.2.0",
    })
  })

  it("refuses headers that contradict the body", async () => {
    const { call } = gatewayWith(demoUpstream, MERGED_ON)
    const cases: [object, Record<string, string>][] = [
      [{ method: "tools/list" }, { "Mcp-Method": "tools/call" }],
      [{ method: "tools/call", params: { name: "a" } }, { "Mcp-Name": "b" }],
      [
        {
          method: "tools/list",
          params: {
            _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28" },
          },
        },
        { "MCP-Protocol-Version": "2025-06-18" },
      ],
    ]
    for (const [body, headers] of cases) {
      const response = await call(MERGED, post({ id: 1, ...body }, headers))
      expect(response.status).toBe(400)
      const error = (await response.json()) as { error: { code: number } }
      expect(error.error.code).toBe(-32020)
    }
  })

  it("decodes a Base64 Mcp-Name before comparing it", async () => {
    const { call, seen } = gatewayWith(demoUpstream, MERGED_ON)
    const name = "créer"
    const encoded = `=?base64?${btoa(String.fromCharCode(...new TextEncoder().encode(name)))}?=`
    const response = await call(
      MERGED,
      post(
        {
          id: 1,
          method: "tools/call",
          params: { name, arguments: { account: "alpha" } },
        },
        { "Mcp-Name": encoded }
      )
    )
    expect(response.status).toBe(200)
    expect(seen[0]?.headers.get("Mcp-Name")).toBe(encoded)
  })

  it("refuses a protocol version it does not implement", async () => {
    const { call } = gatewayWith(demoUpstream, MERGED_ON)
    const response = await call(
      MERGED,
      post({
        id: 1,
        method: "tools/list",
        params: {
          _meta: { "io.modelcontextprotocol/protocolVersion": "2099-01-01" },
        },
      })
    )
    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      error: { code: number; data: { supported: string[] } }
    }
    expect(body.error.code).toBe(-32022)
    expect(body.error.data.supported).toContain("2026-07-28")
  })

  it("acknowledges notifications, and refuses GET, batches and unknown methods", async () => {
    const { call } = gatewayWith(demoUpstream, MERGED_ON)
    expect(
      (await call(MERGED, post({ method: "notifications/initialized" }))).status
    ).toBe(202)
    expect((await call(MERGED, { method: "GET", headers: auth })).status).toBe(
      405
    )
    expect(
      (
        await call(MERGED, {
          method: "POST",
          headers: auth,
          body: JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "ping" }]),
        })
      ).status
    ).toBe(400)
    const unknown = await call(MERGED, post({ id: 1, method: "prompts/list" }))
    expect(unknown.status).toBe(404)
    expect(
      ((await unknown.json()) as { error: { code: number } }).error.code
    ).toBe(-32601)
  })
})

describe("merged endpoint: configuration and access", () => {
  it("does not exist unless switched on", async () => {
    const { call } = gatewayWith(demoUpstream)
    const response = await call(MERGED, post({ id: 1, method: "ping" }))
    expect(response.status).toBe(404)
  })

  it("names the argument as configured", async () => {
    const { call } = gatewayWith(demoUpstream, {
      ...MERGED_ON,
      SERVICE_DEMO_ACCOUNT_PARAM: "workspace",
    })
    const { result } = await listTools(call)
    expect(result.tools[0]?.name).toBe("list_workspaces")
    const shared = result.tools.find((t) => t.name === "shared_tool")!
    expect(shared.inputSchema.required[0]).toBe("workspace")
  })

  it("is an OAuth resource of its own", async () => {
    const { call } = gatewayWith(demoUpstream, MERGED_ON)
    const challenge = await call(MERGED, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    })
    expect(challenge.status).toBe(401)
    expect(challenge.headers.get("WWW-Authenticate")).toContain(
      `${ORIGIN}/.well-known/oauth-protected-resource/u/demo/mcp`
    )

    const metadata = (await (
      await call(`${ORIGIN}/.well-known/oauth-protected-resource/u/demo/mcp`)
    ).json()) as Record<string, unknown>
    expect(metadata["resource"]).toBe(MERGED)
    expect(metadata["resource_name"]).toBe("Demo · all accounts")
  })

  it("keeps a client limited to other paths out", async () => {
    const { call } = gatewayWith(demoUpstream, MERGED_ON)
    const response = await call(MERGED, {
      ...post({ id: 1, method: "ping" }),
      headers: { Authorization: `Bearer ${NARROW_TOKEN}` },
    })
    expect(response.status).toBe(401)
  })
})
