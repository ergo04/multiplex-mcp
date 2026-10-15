import {
  AuthorizationError,
  CimdFetchError,
  type OAuthHelpers,
} from "@cloudflare/workers-oauth-provider"
import type { Connector, Settings } from "../config"
import { consentPage, messagePage } from "../pages"
import { checkPassword, hasOwnerSession, ownerSessionCookie } from "./session"

export const OWNER = "owner"

/**
 * Checked on the raw query, before parseAuthRequest(): that call fetches a
 * CIMD document from whatever URL the client_id names, and an allowlist that
 * ran after it would still let anyone make the gateway fetch arbitrary URLs.
 */
function clientAllowed(settings: Settings, clientId: string): boolean {
  if (clientId.startsWith("https://"))
    return settings.allowedClients.includes(clientId)
  return settings.dynamicRegistration
}

function failure(error: unknown): Response {
  if (error instanceof AuthorizationError && error.redirectTo)
    return Response.redirect(error.redirectTo, 302)
  if (error instanceof AuthorizationError)
    return messagePage(
      400,
      "Invalid request",
      `${error.description}. Start connecting again from the client.`
    )
  if (error instanceof CimdFetchError)
    return messagePage(
      400,
      "Client could not be verified",
      "The document describing this client could not be read."
    )
  throw error
}

export async function authorize(
  request: Request,
  env: Env,
  oauth: OAuthHelpers,
  settings: Settings,
  connectorFor: (resource: string | undefined) => Connector | undefined
): Promise<Response> {
  if (request.method === "GET") {
    const clientId = new URL(request.url).searchParams.get("client_id") ?? ""
    if (!clientAllowed(settings, clientId))
      return messagePage(
        403,
        "Client not allowed",
        "This gateway only accepts the clients on its allowlist."
      )

    try {
      const authRequest = await oauth.parseAuthRequest(request)
      const connector = connectorFor(authRequest.resource)
      if (!connector)
        return messagePage(
          400,
          "Unknown connector",
          "The requested resource is not a connector of this gateway."
        )

      const details = await oauth.describeConsent(authRequest)
      const consent = await oauth.beginConsent(authRequest)
      return consentPage({
        details,
        connector,
        handle: consent.handle,
        signedIn: await hasOwnerSession(request, settings.ownerPassword),
        headers: consent.headers,
      })
    } catch (error) {
      return failure(error)
    }
  }

  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } })

  const form = await request.formData()
  const handle = String(form.get("handle") ?? "")

  try {
    if (form.get("decision") !== "approve") {
      const denied = await oauth.denyConsent(request, handle)
      return new Response(null, { status: 302, headers: denied.headers })
    }

    let sessionCookie: string | undefined
    if (!(await hasOwnerSession(request, settings.ownerPassword))) {
      const result = await checkPassword(
        request,
        env,
        settings.ownerPassword,
        String(form.get("password") ?? "")
      )
      // The handle is consumed only by approve or deny, so going back to the
      // form and retrying works.
      if (result === "limited")
        return messagePage(
          429,
          "Too many attempts",
          "Wait a minute and try again."
        )
      if (result === "unconfigured")
        return messagePage(
          503,
          "No owner password",
          "Set the OWNER_PASSWORD secret on this Worker first."
        )
      if (result === "wrong")
        return messagePage(401, "Wrong password", "Go back and try again.")
      sessionCookie = await ownerSessionCookie(settings.ownerPassword!)
    }

    const approved = await oauth.approveConsent(request, handle)
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: OWNER,
      metadata: { resource: approved.request.resource },
      scope: approved.request.scope,
      props: { subject: OWNER },
    })

    approved.headers.set("Location", redirectTo)
    if (sessionCookie) approved.headers.append("Set-Cookie", sessionCookie)
    return new Response(null, { status: 302, headers: approved.headers })
  } catch (error) {
    return failure(error)
  }
}
