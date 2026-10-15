import type { Settings, StaticClient } from "./config"

const encoder = new TextEncoder()

async function digest(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(value))
}

/** Hashing first gives equal lengths, which timingSafeEqual requires. */
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([digest(a), digest(b)])
  return crypto.subtle.timingSafeEqual(left, right)
}

export async function clientForToken(
  settings: Settings,
  token: string
): Promise<StaticClient | undefined> {
  for (const client of settings.clients) {
    if (await sameSecret(client.token, token)) return client
  }
  return undefined
}

export function clientMayOpen(client: StaticClient, path: string): boolean {
  return client.paths === undefined || client.paths.includes(path)
}
