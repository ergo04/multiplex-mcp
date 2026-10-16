import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ALPHA,
  BETA,
  cookiesFrom,
  echoAccount,
  gatewayWith,
  MERGED,
  ORIGIN,
  PASSWORD,
  rpc,
} from "./helpers"

const CLAUDE_CLIENT = "https://claude.ai/oauth/mcp-oauth-client-metadata"
const CALLBACK = "https://claude.ai/api/mcp/auth_callback"

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

async function pkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  )
  return { verifier, challenge: base64url(digest) }
}

function authorizeUrl(
  challenge: string,
  resource = ALPHA,
  clientId = CLAUDE_CLIENT
) {
  const url = new URL(`${ORIGIN}/authorize`)
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: CALLBACK,
    state: "state-123",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource,
  }).toString()
  return url.href
}

// The library fetches claude.ai's metadata document; the test serves it.
beforeEach(() => {
  const realFetch = globalThis.fetch
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url === CLAUDE_CLIENT)
      return Response.json(
        {
          client_id: CLAUDE_CLIENT,
          client_name: "Claude",
          redirect_uris: [CALLBACK],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
        { headers: { "Cache-Control": "max-age=60" } }
      )
    return realFetch(input, init)
  })
})

afterEach(() => vi.restoreAllMocks())

async function signIn(
  call: ReturnType<typeof gatewayWith>["call"],
  resource = ALPHA
) {
  const { verifier, challenge } = await pkce()
  const page = await call(authorizeUrl(challenge, resource))
  expect(page.status).toBe(200)
  const html = await page.text()
  const handle = /name="handle" value="([^"]+)"/.exec(html)?.[1]
  expect(handle).toBeDefined()

  const approved = await call(`${ORIGIN}/authorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookiesFrom(page),
    },
    body: new URLSearchParams({
      handle: handle!,
      decision: "approve",
      password: PASSWORD,
    }),
    redirect: "manual",
  })
  expect(approved.status).toBe(302)
  const location = new URL(approved.headers.get("Location")!)
  expect(location.origin + location.pathname).toBe(CALLBACK)
  expect(location.searchParams.get("state")).toBe("state-123")

  const token = await call(`${ORIGIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: location.searchParams.get("code")!,
      redirect_uri: CALLBACK,
      client_id: CLAUDE_CLIENT,
      code_verifier: verifier,
      resource,
    }),
  })
  expect(token.status).toBe(200)
  return {
    tokens: (await token.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    },
    html,
    sessionCookie: cookiesFrom(approved),
  }
}

describe("discovery", () => {
  it("challenges with the connector's own metadata URL", async () => {
    const { call } = gatewayWith(echoAccount)
    const response = await call(ALPHA, { method: "POST", body: rpc("ping") })
    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toContain(
      `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/m/demo/alpha/mcp"`
    )
  })

  it("serves per-connector metadata whose resource is the connector URL", async () => {
    const { call } = gatewayWith(echoAccount)
    const response = await call(
      `${ORIGIN}/.well-known/oauth-protected-resource/m/demo/beta/mcp`
    )
    const metadata = (await response.json()) as Record<string, unknown>
    expect(metadata["resource"]).toBe(BETA)
    expect(metadata["authorization_servers"]).toEqual([ORIGIN])
  })

  it("advertises CIMD and no open registration", async () => {
    const { call } = gatewayWith(echoAccount)
    const response = await call(
      `${ORIGIN}/.well-known/oauth-authorization-server`
    )
    const metadata = (await response.json()) as Record<string, unknown>
    expect(metadata["client_id_metadata_document_supported"]).toBe(true)
    expect(metadata["token_endpoint_auth_methods_supported"]).toContain("none")
    expect(metadata["registration_endpoint"]).toBeUndefined()
    expect(metadata["protected_resources"]).toContain(ALPHA)
  })
})

describe("authorization", () => {
  it("issues a long-lived token that opens its connector with the right credential", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    const { tokens, html } = await signIn(call)

    expect(html).toContain("Connect Demo · alpha")
    expect(html).toContain("account <strong>alpha</strong> of Demo")
    expect(html).toContain("claude.ai")
    expect(tokens.expires_in).toBe(30 * 24 * 60 * 60)

    const response = await call(ALPHA, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      body: rpc("ping"),
    })
    expect(response.status).toBe(200)
    expect(seen[0]?.headers.get("Authorization")).toBe("Bearer key-alpha")
  })

  it("authorizes the merged connector, naming every account it opens", async () => {
    const { call } = gatewayWith(
      ({ body }) =>
        Response.json({
          jsonrpc: "2.0",
          id: (JSON.parse(body) as { id: number }).id,
          result: { tools: [] },
        }),
      { SERVICE_DEMO_MERGED: "true" }
    )
    const { tokens, html } = await signIn(call, MERGED)
    expect(html).toContain("Connect Demo · all accounts")
    expect(html).toContain(
      "every account of Demo: <strong>alpha</strong>, <strong>beta</strong>"
    )

    const opened = await call(MERGED, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      body: rpc("tools/list"),
    })
    expect(opened.status).toBe(200)
    const direct = await call(ALPHA, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      body: rpc("ping"),
    })
    expect(direct.status).toBe(401)
  })

  it("binds the token to its connector", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    const { tokens } = await signIn(call)

    const response = await call(BETA, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      body: rpc("ping"),
    })
    expect(response.status).toBe(401)
    expect(seen).toHaveLength(0)
  })

  it("skips the password once the owner is signed in", async () => {
    const { call } = gatewayWith(echoAccount)
    const { sessionCookie } = await signIn(call)

    const { challenge } = await pkce()
    const page = await call(authorizeUrl(challenge, BETA), {
      headers: { Cookie: sessionCookie },
    })
    const html = await page.text()
    expect(html).toContain("Connect Demo · beta")
    expect(html).not.toContain('type="password"')
  })

  it("rejects a wrong password without issuing a code", async () => {
    const { call } = gatewayWith(echoAccount)
    const { challenge } = await pkce()
    const page = await call(authorizeUrl(challenge))
    const handle = /name="handle" value="([^"]+)"/.exec(await page.text())?.[1]

    const response = await call(`${ORIGIN}/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookiesFrom(page),
      },
      body: new URLSearchParams({
        handle: handle!,
        decision: "approve",
        password: "wrong",
      }),
      redirect: "manual",
    })
    expect(response.status).toBe(401)
    expect(response.headers.get("Location")).toBeNull()
  })

  it("sends access_denied back when the owner declines", async () => {
    const { call } = gatewayWith(echoAccount)
    const { challenge } = await pkce()
    const page = await call(authorizeUrl(challenge))
    const handle = /name="handle" value="([^"]+)"/.exec(await page.text())?.[1]

    const response = await call(`${ORIGIN}/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookiesFrom(page),
      },
      body: new URLSearchParams({ handle: handle!, decision: "deny" }),
      redirect: "manual",
    })
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get("Location")!)
    expect(location.searchParams.get("error")).toBe("access_denied")
  })

  it("refuses clients outside the allowlist before fetching their metadata", async () => {
    const { call } = gatewayWith(echoAccount)
    const { challenge } = await pkce()
    const response = await call(
      authorizeUrl(challenge, ALPHA, "https://evil.example/client.json")
    )

    expect(response.status).toBe(403)
    const fetched = vi
      .mocked(globalThis.fetch)
      .mock.calls.map(([input]) => String(input))
    expect(fetched).not.toContain("https://evil.example/client.json")
  })

  it("has no registration endpoint while dynamic registration is off", async () => {
    const { call } = gatewayWith(echoAccount)
    const response = await call(`${ORIGIN}/oauth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_uris: [CALLBACK], client_name: "x" }),
    })
    expect(response.status).toBe(404)
  })
})
