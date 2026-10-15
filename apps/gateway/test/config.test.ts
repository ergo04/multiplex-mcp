import { describe, expect, it } from "vitest"
import { readSettings } from "../src/config"

describe("settings from env", () => {
  it("turns each ACCOUNT_ secret into a connector of a built-in service", () => {
    const settings = readSettings({
      ACCOUNT_RESEND_PERSONAL: "re_1",
      ACCOUNT_LINEAR_ACME: "lin_api_1",
      OWNER_PASSWORD: "x",
    })
    expect(
      settings.connectors.map((c) => [c.path, c.upstream.href, c.label])
    ).toEqual([
      ["/m/linear/acme/mcp", "https://mcp.linear.app/mcp", "Linear · acme"],
      [
        "/m/resend/personal/mcp",
        "https://mcp.resend.com/mcp",
        "Resend · personal",
      ],
    ])
    expect(settings.problems).toEqual([])
  })

  it("takes any other service from SERVICE_<NAME>_URL, with an optional header", () => {
    const settings = readSettings({
      ACCOUNT_ACME_MAIN: "k",
      SERVICE_ACME_URL: "https://mcp.acme.example/mcp",
      SERVICE_ACME_HEADER: "X-Api-Key",
      SERVICE_ACME_NAME: "Acme",
      OWNER_PASSWORD: "x",
    })
    expect(settings.connectors[0]).toMatchObject({
      path: "/m/acme/main/mcp",
      label: "Acme · main",
      auth: { type: "header", name: "X-Api-Key" },
    })
  })

  it("reports problems without naming accounts in the summary", () => {
    const settings = readSettings({
      ACCOUNT_ZQMYSTERY_MAIN: "k",
      ACCOUNT_BAD_NAME_HERE: "k",
      ACCOUNT_ZQPLAIN_X: "k",
      SERVICE_ZQPLAIN_URL: "http://insecure.example/mcp",
      ACCOUNT_ZQHDR_X: "k",
      SERVICE_ZQHDR_URL: "https://hdr.example/mcp",
      SERVICE_ZQHDR_HEADER: "Cookie",
      CLIENT_TOKEN_ZQTINY: "short",
      CLIENT_TOKEN_ZQLONG: "x".repeat(40),
      CLIENT_PATHS_ZQLONG: "/m/nope/nope/mcp",
    })

    expect(settings.connectors).toEqual([])
    const details = settings.problems.map((p) => p.detail).join("\n")
    for (const expected of [
      "SERVICE_ZQMYSTERY_URL",
      "ACCOUNT_BAD_NAME_HERE",
      "must start with https://",
      'SERVICE_ZQHDR_HEADER: "Cookie"',
      "CLIENT_TOKEN_ZQTINY",
      "CLIENT_PATHS_ZQLONG",
      "OWNER_PASSWORD",
    ])
      expect(details).toContain(expected)

    for (const problem of settings.problems)
      expect(problem.summary.toLowerCase()).not.toMatch(/zq/)
  })

  it("ignores empty credentials and malformed lifetimes", () => {
    const settings = readSettings({
      ACCOUNT_RESEND_EMPTY: " ",
      ACCESS_TOKEN_DAYS: "soon",
      REFRESH_TOKEN_DAYS: "7",
    })
    expect(settings.connectors).toEqual([])
    expect(settings.accessTokenDays).toBe(30)
    expect(settings.refreshTokenDays).toBe(7)
  })
})
