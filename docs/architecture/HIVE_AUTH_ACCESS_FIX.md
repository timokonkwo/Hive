# App sign-in and account access correction

Scope: fix the reported My tasks sign-in loop and provide account access throughout the app. Keep wallet connection separate from client authentication. Preserve backend JWT verification and ownership checks.

## Findings and plan

- useAuth schedules logout when Wagmi disconnects or differs from a linked EVM address. Privy and Wagmi have separate connection state; a valid account session must not be destroyed by a wallet event.
- My tasks maps every API 401 to the signed-out gate, even when Privy still reports an authenticated account. Show a session-recovery state with retry and explicit sign-out instead of a repeated login prompt.
- useAuthFetch does not retry a rejected authenticated GET after asking Privy for a refreshed access token. Add one bounded retry for reads only; never replay a write or log out automatically.
- Public app pages remove the auth provider, and legacy routes use a separate provider configuration. Keep one lazy-initialized provider mounted after app entry, including later navigation to landing/docs. Legacy pages retain their presentation contexts inside it.
- Add shared Sign in / Account controls. The account menu includes Account settings, Connect wallet and explicit Sign out. Keep Sign in visible on phones; place Post a task in mobile navigation when the header is narrow.

Reference: Privy access-token documentation https://docs.privy.io/authentication/user-authentication/access-tokens and installed SDK types. Source: hooks/useAuth.ts, useAuthFetch.ts, SiteFrame, AuthenticatedFrame, Providers, dashboard resource handling and lib/client-auth.ts. No JWT verification bypass, browser credential persistence implementation or account writes are added.

Validation will include wallet disconnect/switch without logout, missing/refreshed tokens, rejected reads, non-replayed writes, cancellation, preserved account boundaries, shared entry points, actual sign-in modal, mobile sizing, build and type checks. Real user login confirmation remains distinct from fixture/hook validation.

## Delivered and validated  -  September 12

Implemented the corrections above using the existing Privy integration. No new login service was introduced. The shared app header exposes Sign in and, after authentication, Account settings, Connect wallet and Sign out. My tasks distinguishes a rejected session from a signed-out account. A wallet disconnect or switch no longer logs the account out.

- Production build, TypeScript, scoped lint and diff whitespace checks passed.
- 28 focused auth, account control, dashboard state, route and wallet tests passed. These cover token retry limits, write non-replay, cancellation, identity precedence and session error recovery.
- 98 browser checks passed across eight app routes, light/dark themes and widths from 320 to 1440px. The real Privy modal opens from the header. Provider identity persists through app, docs and home navigation. No browser runtime exceptions were recorded.
- 29 existing dashboard browser checks passed. Reviewed the mobile header and actual wallet/email login modal screenshots.
- Full `npm test` is not green: 275 tests passed and four failed, with two suite setup failures. The remaining source guards reference removed docs components or pre-redesign page implementations for registry, token, staking and dashboard. These failures were left intact; focused auth coverage passes.

Evidence: `/private/tmp/hive-auth-build.log`, `/private/tmp/hive-auth-types.log`, `/private/tmp/hive-auth-lint.log`, `/private/tmp/hive-auth-targeted-tests.log`, `/private/tmp/hive-auth-tests.log`, `/private/tmp/hive-redesign-qa/auth-access-results.json`, `/private/tmp/hive-dashboard-auth-browser.log`.

Local review: http://localhost:3100/dashboard . Changes are unpushed on `main_redesign`. No real user login, wallet connection or account write was performed; an actual account login and server-verified session still need confirmation.

## Localhost cookie configuration  -  October 15

The configured app's public Privy configuration returns `custom_api_url: https://privy.uphive.xyz`. The installed React SDK enables server cookies for that custom API URL. Privy's production HTTP-only cookies cannot be sent to localhost. A successful wallet prompt or authenticated account menu does not establish a usable localhost API session.

Use a Web app client on the existing Hive Privy app, with HTTP-only cookies disabled and `http://localhost:3000` in its allowed origins. Set its public ID in `.env.local`:

```dotenv
NEXT_PUBLIC_PRIVY_CLIENT_ID=<local-development-client-id>
```

`AuthenticatedFrame` passes this optional ID to Privy. Keep the production environment's client settings unchanged. A separate app client preserves the existing app's users; a separate development app would have different user IDs. Restart/rebuild after setting the ID, sign out of the stale local session, and sign in again.

The request adapter must allow a null JavaScript access token to use the existing same-origin cookie transport. The API still verifies the JWT signature, issuer, audience and expiry. No credential from a connected wallet or UI flag grants backend access. Provider errors remain errors; writes are never replayed. The session-error screen does not claim expiry when the underlying problem may be missing or invalid credentials.

References:
- https://docs.privy.io/recipes/react/cookies
- https://docs.privy.io/basics/get-started/dashboard/app-clients

The supplied local client ID is configured only in `.env.local`. Its public configuration was verified to return no custom cookie API domain and to allow `http://localhost:3000`. Acceptance confirmed: after the local client was configured and the user signed in again, the user reported that tasks or the authenticated empty task list is visible.

Local validation after client configuration: 55 focused tests, scoped lint and production build passed. The browser lifecycle suite covers bearer refresh, cookie-only sessions, one bounded retry on cookie rejection, provider outages, account switches and logout. A separate Chrome check against the running Next app verified that the real Privy configuration request sends the configured `privy-client-id`, receives no custom API cookie domain, permits localhost, and renders the signed-out gate. This does not substitute for the user's fresh authenticated wallet test.

User acceptance  -  October 15: confirmed “Tasks or empty task list is visible” after refreshing and signing in with the corrected local client. No live deployment or push was performed.
