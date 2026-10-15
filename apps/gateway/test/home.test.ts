import { describe, expect, it } from "vitest"
import {
  cookiesFrom,
  echoAccount,
  gatewayWith,
  ORIGIN,
  PASSWORD,
} from "./helpers"

async function signIn(call: ReturnType<typeof gatewayWith>["call"]) {
  const response = await call(`${ORIGIN}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: PASSWORD }),
    redirect: "manual",
  })
  expect(response.status).toBe(303)
  return cookiesFrom(response)
}

describe("home page", () => {
  it("asks for an owner password before anything else", async () => {
    const { call } = gatewayWith(echoAccount, { OWNER_PASSWORD: undefined })
    const html = await (await call(`${ORIGIN}/`)).text()
    expect(html).toContain("OWNER_PASSWORD")
    expect(html).not.toContain("demo")
  })

  it("names nothing to a visitor who is not signed in", async () => {
    const { call } = gatewayWith(echoAccount, { ACCOUNT_MYSTERY_ONE: "k" })
    const html = await (await call(`${ORIGIN}/`)).text()

    expect(html).toContain("3 connectors")
    expect(html).toContain("2 configuration problems")
    for (const name of [
      "alpha",
      "beta",
      "headered",
      "mystery",
      "laptop",
      "narrow",
    ])
      expect(html).not.toContain(name)
  })

  it("lists connector URLs, clients and problems to the owner", async () => {
    const { call } = gatewayWith(echoAccount)
    const cookie = await signIn(call)
    const html = await (
      await call(`${ORIGIN}/`, { headers: { Cookie: cookie } })
    ).text()

    expect(html).toContain(`${ORIGIN}/m/demo/alpha/mcp`)
    expect(html).toContain(`${ORIGIN}/m/headered/main/mcp`)
    expect(html).toContain("<code>narrow</code>: only")
    expect(html).toContain("CLIENT_TOKEN_SHORT")
  })

  it("lists the merged URL next to the per-account ones", async () => {
    const { call } = gatewayWith(echoAccount, { SERVICE_DEMO_MERGED: "true" })
    const cookie = await signIn(call)
    const html = await (
      await call(`${ORIGIN}/`, { headers: { Cookie: cookie } })
    ).text()
    expect(html).toContain("Demo · all accounts")
    expect(html).toContain(`${ORIGIN}/u/demo/mcp`)
  })

  it("refuses a wrong password", async () => {
    const { call } = gatewayWith(echoAccount)
    const response = await call(`${ORIGIN}/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ password: "nope" }),
    })
    expect(response.headers.get("Set-Cookie")).toBeNull()
    expect(await response.text()).toContain("Wrong password")
  })

  it("serves the request's own origin when PUBLIC_URL is not set", async () => {
    const { call } = gatewayWith(echoAccount, { PUBLIC_URL: undefined })
    const response = await call("https://other.example/m/demo/alpha/mcp", {
      method: "POST",
    })
    expect(response.headers.get("WWW-Authenticate")).toContain(
      "https://other.example/.well-known/oauth-protected-resource/m/demo/alpha/mcp"
    )
  })
})
