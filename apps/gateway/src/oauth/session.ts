import { sameSecret } from "../secrets"

const COOKIE = "__Host-mgw-owner"
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

const encoder = new TextEncoder()

// Keyed by the password itself: one secret fewer to set up, and changing the
// password signs every browser out.
async function sign(password: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`mgw-session:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export async function ownerSessionCookie(password: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
  const value = `${expires}.${await sign(password, `owner.${expires}`)}`
  return `${COOKIE}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/; Secure; HttpOnly; SameSite=Lax`
}

export async function hasOwnerSession(
  request: Request,
  password: string | undefined
): Promise<boolean> {
  if (!password) return false
  const cookie = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
  if (!cookie) return false

  const [expires, signature] = cookie.slice(COOKIE.length + 1).split(".")
  if (!expires || !signature) return false
  if (Number(expires) < Date.now() / 1000) return false

  return sameSecret(signature, await sign(password, `owner.${expires}`))
}

export type SignInResult = "ok" | "wrong" | "limited" | "unconfigured"

/** Rate limited per IP: the password is all that stands between the internet and every account. */
export async function checkPassword(
  request: Request,
  env: Env,
  password: string | undefined,
  presented: string
): Promise<SignInResult> {
  if (!password) return "unconfigured"
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown"
  const { success } = await env.LOGIN_LIMITER.limit({ key: ip })
  if (!success) return "limited"
  return (await sameSecret(password, presented)) ? "ok" : "wrong"
}
