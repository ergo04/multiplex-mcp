import { Code } from "@/components/ui/code"
import { FlowDiagram } from "@/components/ui/flow-diagram"
import { HairlineFigure } from "@/components/ui/hairline-figure"
import { Section, Strong } from "@/components/ui/section"
import { VarList } from "@/components/ui/var-list"

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      label="How it works"
      title="One URL per account, one API key behind each"
    >
      <div className="grid items-center gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <p>
          Every account you add becomes a connector at{" "}
          <Code>
            https://&lt;your-gateway&gt;/m/&lt;service&gt;/&lt;account&gt;/mcp
          </Code>
          . The account comes from the name of the secret that holds its key, as
          the table below shows.
        </p>
        <HairlineFigure name="gateway" />
      </div>

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

      <h3 className="pt-4 text-base font-medium text-foreground">
        One URL for every account
      </h3>
      <p>
        A connector per account adds up when a service has many tools: two
        Resend connectors are more than 260 tools in the model&apos;s context.
        Set <Code>SERVICE_&lt;NAME&gt;_MERGED</Code> to <Code>true</Code> and
        the service also gets one connector for all its accounts:
      </p>

      <VarList
        label="Worker variable → connector URL"
        arrow
        rows={[["SERVICE_LINEAR_MERGED", "/u/linear/mcp"]]}
      />

      <ul className="flex list-disc flex-col gap-3 pl-5 marker:text-muted-foreground">
        <li>
          Its tools are the union of every account&apos;s, each with one more
          argument: <Code>account</Code>, or <Code>workspace</Code> for Linear.
          The values it allows are the accounts that have that tool, since a
          plan can hide some: Linear&apos;s lower plans have no customer tools.
        </li>
        <li>
          A call names the account in that argument. The gateway takes it out,
          forwards the call to that account with its key under the same request
          id, and streams the answer back untouched.
        </li>
        <li>
          The gateway answers <Code>initialize</Code> and{" "}
          <Code>server/discover</Code> itself, for clients of both the
          2025-06-18 and the 2026-07-28 revision, and adds a tool that lists the
          accounts: <Code>list_accounts</Code>, or <Code>list_workspaces</Code>{" "}
          for Linear.
        </li>
      </ul>

      <p>
        Every account keeps its own URL too, so you pick per service which one
        to add.
      </p>
    </Section>
  )
}
