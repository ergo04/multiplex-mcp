import { ChevronDown } from "lucide-react"
import type { ReactNode } from "react"
import { Code } from "@/components/ui/code"
import { Section } from "@/components/ui/section"

function Question({
  question,
  children,
}: {
  question: string
  children: ReactNode
}) {
  return (
    <details className="group border-b border-border py-4 first:border-t">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  )
}

export function FaqSection() {
  return (
    <Section id="faq" label="FAQ" title="Questions">
      <div>
        <Question question="Why not add ?account=work to the URL instead?">
          <p>
            Because it depends on the server. Some OAuth servers accept it,
            others (Google and Zoho, for example) don&apos;t, and one report
            says claude.ai drops the query when it calls the server. A path is
            part of the URL everywhere.
          </p>
        </Question>

        <Question question="Do I have to redeploy when I add an account?">
          <p>
            No. The gateway reads its configuration from the Worker&apos;s
            environment on every request, so a secret saved in the dashboard is
            picked up as soon as it is saved.
          </p>
        </Question>

        <Question question="What happens when an API key is wrong or revoked?">
          <p>
            It depends on the server. If it answers 401 or 403, the gateway
            turns that into a 502 whose message names the service and the
            account. Some servers, Resend among them, accept the connection and
            report the bad key in the result of the first tool call instead.
            Either way, fix the secret in the dashboard; the connector in
            claude.ai can stay as it is.
          </p>
          <p>
            On a merged connector a refused key comes back as the result of the
            call, naming the account, and the other accounts keep working. An
            account whose tool list can&apos;t be read drops out of the list
            until it can.
          </p>
        </Question>

        <Question question="Can I put the gateway on my own domain?">
          <p>
            Yes: add a custom domain to the Worker in the Cloudflare dashboard,
            and set <Code>PUBLIC_URL</Code> to it if you want every other
            hostname to stop answering. Tokens are bound to the origin, so
            connectors added under the <Code>workers.dev</Code> URL have to be
            added again under the new one.
          </p>
        </Question>

        <Question question="Does it work with clients other than Claude?">
          <p>
            Yes. Any MCP client that can send an <Code>Authorization</Code>{" "}
            header (Cursor, VS Code or Gemini CLI, for example) can use a static
            client token. ChatGPT and Codex connect through OAuth once their
            metadata documents are in <Code>ALLOWED_CLIENTS</Code>. Any other
            OAuth client needs its Client ID Metadata Document listed there too,
            or you turn on <Code>DYNAMIC_REGISTRATION</Code>.
          </p>
        </Question>

        <Question question="What does the gateway store?">
          <p>
            OAuth clients and grants, in the Worker&apos;s KV namespace. API
            keys stay in secrets, and requests and responses pass through
            without being stored. Workers Logs is on in the configuration, so
            your Cloudflare dashboard keeps the usual invocation logs.
          </p>
        </Question>

        <Question question="How do I cut off access?">
          <p>
            Delete an <Code>ACCOUNT_</Code> secret and its connector is gone.
            Change or delete a <Code>CLIENT_TOKEN_</Code> to lock that client
            out. Changing <Code>OWNER_PASSWORD</Code> signs every browser out of
            the consent page, but tokens already issued keep working until they
            expire or their grant is removed from KV.
          </p>
        </Question>
      </div>
    </Section>
  )
}
