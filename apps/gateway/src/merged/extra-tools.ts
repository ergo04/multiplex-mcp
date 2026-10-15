import type { UpstreamFetch } from "../proxy/passthrough"
import type { Arguments } from "./arguments"
import { linear } from "./linear"

/**
 * A tool the gateway runs itself, for what a service's own MCP server leaves
 * out. It shadows an upstream tool with the same name.
 */
export interface ExtraTool {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required: string[]
  }
  /** The text of a successful result; a thrown error reaches the model as a tool error. */
  run(
    args: Arguments,
    credential: string,
    upstreamFetch: UpstreamFetch
  ): Promise<string>
}

export interface ExtraTools {
  tools: ExtraTool[]
  /** Appended to the merged endpoint's instructions. */
  instructions?: string
}

export const EXTRA_TOOLS: Record<string, ExtraTools> = { linear }
