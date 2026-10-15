import { describe, expect, it } from "vitest"
import {
  ALPHA,
  BETA,
  echoAccount,
  gatewayWith,
  LAPTOP_TOKEN,
  NARROW_TOKEN,
  rpc,
} from "./helpers"

const post = (token: string) => ({
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: rpc("ping"),
})

describe("static client tokens", () => {
  it("opens every connector with an unrestricted token", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    expect((await call(ALPHA, post(LAPTOP_TOKEN))).status).toBe(200)
    expect((await call(BETA, post(LAPTOP_TOKEN))).status).toBe(200)
    expect(seen).toHaveLength(2)
  })

  it("keeps a restricted token to its paths", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    expect((await call(BETA, post(NARROW_TOKEN))).status).toBe(200)
    expect((await call(ALPHA, post(NARROW_TOKEN))).status).toBe(401)
    expect(seen).toHaveLength(1)
  })

  it("ignores a configured token that is too short to be safe", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    expect((await call(ALPHA, post("too-short"))).status).toBe(401)
    expect(seen).toHaveLength(0)
  })

  it("challenges an unknown token with this connector's metadata", async () => {
    const { call, seen } = gatewayWith(echoAccount)
    const response = await call(
      ALPHA,
      post("not-a-real-token-at-all-0123456789")
    )

    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toContain(
      'resource_metadata="https://gw.example/.well-known/oauth-protected-resource/m/demo/alpha/mcp"'
    )
    expect(seen).toHaveLength(0)
  })
})
