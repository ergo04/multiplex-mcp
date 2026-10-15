import { describe, expect, it } from "vitest"
import {
  ALPHA,
  BETA,
  echoAccount,
  gatewayWith,
  LAPTOP_TOKEN,
  ORIGIN,
  rpc,
} from "./helpers"

const auth = { Authorization: `Bearer ${LAPTOP_TOKEN}` }

describe("pass-through", () => {
  it("swaps the client token for the account's credential", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    const response = await call(ALPHA, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: rpc("tools/list"),
    })

    expect(response.status).toBe(200)
    expect(seen[0]?.headers.get("Authorization")).toBe("Bearer key-alpha")
    expect(seen[0]?.url.href).toBe("https://upstream.example/mcp")
    expect(seen[0]?.body).toBe(rpc("tools/list"))
  })

  it("routes each account to its own credential", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    await call(BETA, { method: "POST", headers: auth, body: rpc("ping") })
    expect(seen[0]?.headers.get("Authorization")).toBe("Bearer key-beta")
  })

  it("puts the credential in a named header when configured", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    await call(`${ORIGIN}/m/headered/main/mcp`, {
      method: "POST",
      headers: auth,
      body: rpc("ping"),
    })
    expect(seen[0]?.headers.get("X-Api-Key")).toBe("key-headered")
    expect(seen[0]?.headers.get("Authorization")).toBeNull()
  })

  it("forwards MCP headers and drops everything else", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    await call(ALPHA, {
      method: "POST",
      headers: {
        ...auth,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Session-Id": "session-1",
        "MCP-Protocol-Version": "2025-06-18",
        "Mcp-Method": "tools/call",
        "Mcp-Name": "send_email",
        "Mcp-Param-Region": "eu",
        "Last-Event-ID": "42",
        Cookie: "session=secret",
        "CF-Connecting-IP": "203.0.113.7",
        "X-Forwarded-For": "203.0.113.7",
      },
      body: rpc("tools/call", { name: "send_email" }),
    })

    const headers = seen[0]!.headers
    expect(headers.get("Mcp-Session-Id")).toBe("session-1")
    expect(headers.get("MCP-Protocol-Version")).toBe("2025-06-18")
    expect(headers.get("Mcp-Method")).toBe("tools/call")
    expect(headers.get("Mcp-Name")).toBe("send_email")
    expect(headers.get("Mcp-Param-Region")).toBe("eu")
    expect(headers.get("Last-Event-ID")).toBe("42")
    expect(headers.get("Accept")).toBe("application/json, text/event-stream")
    expect(headers.get("Cookie")).toBeNull()
    expect(headers.get("CF-Connecting-IP")).toBeNull()
    expect(headers.get("X-Forwarded-For")).toBeNull()
  })

  it("returns the session id but never the upstream's auth or cookies", async () => {
    const { call } = gatewayWith(
      () =>
        new Response("{}", {
          headers: {
            "Content-Type": "application/json",
            "Mcp-Session-Id": "session-9",
            "Set-Cookie": "upstream=1",
            "WWW-Authenticate":
              'Bearer resource_metadata="https://upstream.example/x"',
          },
        })
    )
    const response = await call(ALPHA, {
      method: "POST",
      headers: auth,
      body: rpc("ping"),
    })

    expect(response.headers.get("Mcp-Session-Id")).toBe("session-9")
    expect(response.headers.get("Content-Type")).toBe("application/json")
    expect(response.headers.get("Set-Cookie")).toBeNull()
    expect(response.headers.get("WWW-Authenticate")).toBeNull()
  })

  it("forwards GET and DELETE, and the query string", async () => {
    const { call, seen } = gatewayWith(
      () => new Response(null, { status: 204 })
    )
    await call(`${ALPHA}?stream=1`, { method: "GET", headers: auth })
    await call(ALPHA, {
      method: "DELETE",
      headers: { ...auth, "Mcp-Session-Id": "s" },
    })

    expect(seen.map((s) => s.method)).toEqual(["GET", "DELETE"])
    expect(seen[0]?.url.searchParams.get("stream")).toBe("1")
    expect(seen[1]?.headers.get("Mcp-Session-Id")).toBe("s")
  })

  it("streams SSE without waiting for the upstream to finish", async () => {
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    const encoder = new TextEncoder()

    const { call } = gatewayWith(
      () =>
        new Response(
          new ReadableStream({
            async start(controller) {
              controller.enqueue(
                encoder.encode("event: message\ndata: first\n\n")
              )
              await released
              controller.enqueue(
                encoder.encode("event: message\ndata: second\n\n")
              )
              controller.close()
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } }
        )
    )

    const response = await call(ALPHA, {
      method: "POST",
      headers: auth,
      body: rpc("tools/call"),
    })
    expect(response.headers.get("Content-Type")).toBe("text/event-stream")

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    // Would hang here if the gateway buffered: "second" is only sent after this read.
    const first = await reader.read()
    expect(decoder.decode(first.value)).toContain("data: first")

    release()
    let rest = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      rest += decoder.decode(value)
    }
    expect(rest).toContain("data: second")
  })

  it("turns an upstream 401 into a 502, so the client does not redo OAuth", async () => {
    const { call } = gatewayWith(
      () =>
        new Response("nope", {
          status: 401,
          headers: { "WWW-Authenticate": "Bearer" },
        })
    )
    const response = await call(ALPHA, {
      method: "POST",
      headers: auth,
      body: rpc("ping"),
    })

    expect(response.status).toBe(502)
    expect(response.headers.get("WWW-Authenticate")).toBeNull()
    const body = (await response.json()) as { error: { message: string } }
    expect(body.error.message).toContain('account "alpha"')
  })

  it("does not follow upstream redirects", async () => {
    const { call } = gatewayWith(
      () =>
        new Response(null, {
          status: 302,
          headers: { Location: "https://evil.example/" },
        })
    )
    const response = await call(ALPHA, {
      method: "POST",
      headers: auth,
      body: rpc("ping"),
    })
    expect(response.status).toBe(502)
  })

  it("answers 502 when the upstream is unreachable", async () => {
    const { call } = gatewayWith(() => {
      throw new TypeError("network down")
    })
    const response = await call(ALPHA, {
      method: "POST",
      headers: auth,
      body: rpc("ping"),
    })
    expect(response.status).toBe(502)
  })

  it("refuses paths below a connector", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    const response = await call(`${ALPHA}/extra`, {
      method: "POST",
      headers: auth,
      body: rpc("ping"),
    })
    expect(response.status).toBe(404)
    expect(seen).toHaveLength(0)
  })

  it("refuses requests on another hostname", async () => {
    const { call } = gatewayWith(echoAccount)
    const response = await call("https://other.example/m/demo/alpha/mcp", {
      method: "POST",
      headers: auth,
      body: rpc("ping"),
    })
    expect(response.status).toBe(404)
  })
})
