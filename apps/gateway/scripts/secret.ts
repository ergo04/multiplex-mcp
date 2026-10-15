import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"

const USAGE = `Usage:
  pnpm secret <service> <account>   an account's API key, typed into a hidden prompt
  pnpm secret --client <name>       a new static client token, printed once
  pnpm secret <NAME>                any other secret (OWNER_PASSWORD), typed, hidden`

const SLUG = /^[a-z][a-z0-9]*$/

function put(name: string, value?: string): void {
  // Typed values go straight from the terminal to wrangler's own hidden prompt,
  // so they never pass through this process or its arguments.
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "secret", "put", name],
    {
      stdio: value === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
      input: value,
    }
  )
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function slug(value: string | undefined): string {
  if (!value || !SLUG.test(value)) {
    console.error(`Not a slug: "${value ?? ""}" (lowercase letters and digits)`)
    process.exit(1)
  }
  return value.toUpperCase()
}

const [first, second] = process.argv.slice(2)

if (first === "--client") {
  const name = `CLIENT_TOKEN_${slug(second)}`
  const token = randomBytes(32).toString("base64url")
  put(name, token)
  console.log(
    `\n${name} is set. Its token, shown only now (store it where the client reads it):\n\n${token}\n`
  )
} else if (first && second) {
  put(`ACCOUNT_${slug(first)}_${slug(second)}`)
} else if (first && /^[A-Z][A-Z0-9_]*$/.test(first)) {
  put(first)
} else {
  console.error(USAGE)
  process.exit(1)
}
