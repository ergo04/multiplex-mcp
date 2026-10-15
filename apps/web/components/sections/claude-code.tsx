import { CodeBlock } from "@/components/ui/code-block"
import { Code } from "@/components/ui/code"
import { Section } from "@/components/ui/section"
import { VarList } from "@/components/ui/var-list"

const MCP_JSON = `{
  "mcpServers": {
    "resend-work": {
      "type": "http",
      "url": "https://<your-gateway>/m/resend/work/mcp",
      "headers": {
        "Authorization": "Bearer \${MUPX_TOKEN}"
      }
    }
  }
}`

const MCP_ADD = `claude mcp add --transport http resend-work \\
  https://<your-gateway>/m/resend/work/mcp \\
  --header "Authorization: Bearer <token>"`

export function ClaudeCodeSection() {
  return (
    <Section
      id="claude-code"
      label="Claude Code"
      title="Claude Code with a static token"
    >
      <p>
        Claude Code can send a header, so it can skip OAuth. Add another secret
        to the Worker named <Code>CLIENT_TOKEN_&lt;NAME&gt;</Code>, for example{" "}
        <Code>CLIENT_TOKEN_LAPTOP</Code>, holding at least 32 random characters.{" "}
        <Code>openssl rand -base64 32</Code> gives you 44. A shorter token is
        ignored and shows up as a problem on the status page.
      </p>

      <CodeBlock label=".mcp.json">{MCP_JSON}</CodeBlock>

      <p>
        Claude Code expands <Code>{"${MUPX_TOKEN}"}</Code> from your
        environment, cloud sessions included, so the token stays out of the
        file. Or add the server from the terminal:
      </p>

      <CodeBlock label="terminal">{MCP_ADD}</CodeBlock>

      <p>
        A token opens every connector unless you limit it. To limit it, add a
        variable with the same name after <Code>CLIENT_PATHS_</Code>, holding a
        comma-separated list of connector paths:
      </p>

      <VarList
        label="Settings → Variables and Secrets"
        rows={[
          ["CLIENT_PATHS_LAPTOP", "/m/resend/work/mcp,/m/linear/acme/mcp"],
        ]}
      />

      <p>
        Without a header, Claude Code can still connect through OAuth: its
        client metadata document is on the default allowlist, so it opens the
        same consent page in your browser.
      </p>
    </Section>
  )
}
