import { Code } from "@/components/ui/code"
import { FlowDiagram } from "@/components/ui/flow-diagram"
import { Section, Strong } from "@/components/ui/section"
import { VarList } from "@/components/ui/var-list"

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      label="How it works"
      title="One URL per account, one API key behind each"
    >
      <p>
        Every account you add becomes a connector at{" "}
        <Code>
          https://&lt;your-gateway&gt;/m/&lt;service&gt;/&lt;account&gt;/mcp
        </Code>
        . The account comes from the name of the secret that holds its key:
      </p>

      <VarList
        label="Worker secret → connector URL"
        arrow
        rows={[
          ["ACCOUNT_RESEND_WORK", "/m/resend/work/mcp"],
          ["ACCOUNT_RESEND_PERSONAL", "/m/resend/personal/mcp"],
          ["ACCOUNT_LINEAR_ACME", "/m/linear/acme/mcp"],
        ]}
      />

      <FlowDiagram />

      <ol className="flex list-decimal flex-col gap-3 pl-5 marker:text-muted-foreground">
        <li>
          claude.ai or Claude Code calls the account&apos;s URL with a token:
          one the gateway issued through OAuth, or a static client token you
          set.
        </li>
        <li>
          The gateway checks the token belongs to this connector. A token issued
          for <Code>/m/resend/work/mcp</Code> doesn&apos;t open{" "}
          <Code>/m/linear/acme/mcp</Code>, nor the personal Resend account.
        </li>
        <li>
          It removes your token, adds the account&apos;s API key and forwards
          the request. Of your client&apos;s headers only the MCP ones (
          <Code>Mcp-*</Code>), <Code>Accept</Code>, <Code>Content-Type</Code>,{" "}
          <Code>Last-Event-ID</Code>, trace context and <Code>User-Agent</Code>{" "}
          go through.
        </li>
        <li>
          The response streams back as it arrives, SSE included, without the
          upstream&apos;s <Code>WWW-Authenticate</Code> challenge or cookies.
          Passed through, the challenge would send claude.ai off to sign in with
          the upstream instead.
        </li>
      </ol>

      <p>
        <Strong>Two cases are rewritten.</Strong> If the upstream refuses the
        key with a 401 or 403, the gateway answers 502 and names the service and
        the account: a 401 would make claude.ai redo OAuth with the gateway,
        which can&apos;t fix a key the upstream rejects. And upstream redirects
        aren&apos;t followed, because a redirect would carry the API key to
        another host.
      </p>
    </Section>
  )
}
