export type UpstreamAuth = { type: "bearer" } | { type: "header"; name: string }

export interface ServiceDefinition {
  name: string
  upstream: string
  auth: UpstreamAuth
}

// Only hosted MCP servers verified to accept an API key as a bearer token.
// Anything else works through SERVICE_<NAME>_URL without touching this list.
export const KNOWN_SERVICES: Record<string, ServiceDefinition> = {
  linear: {
    name: "Linear",
    upstream: "https://mcp.linear.app/mcp",
    auth: { type: "bearer" },
  },
  resend: {
    name: "Resend",
    upstream: "https://mcp.resend.com/mcp",
    auth: { type: "bearer" },
  },
}
