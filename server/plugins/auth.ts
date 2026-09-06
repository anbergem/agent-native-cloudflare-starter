import { createAuthPlugin } from "@agent-native/core/server";

// No `workspaceAppPublicPaths`: every page requires sign-in, including `/`
// (D11 — membership is invite-only and there is no marketing surface).
//
// `marketing.tagline` is required by `AuthOptions["marketing"]`, so it carries a
// neutral one-liner rather than the template's product pitch. No screenshot, no
// feature list and no "learn more" link: the sign-in page is internal.
// `rootAuth` defaults to true whenever `marketing` is set, which serves the
// sign-in document at `/` for everyone — signed in or not — and never reaches
// the `_index` route. `/` is an ordinary authenticated page here (B17), so it
// has to be off; the auth guard still sends anonymous visitors to sign in.
export default createAuthPlugin({
  rootAuth: false,
  marketing: {
    appName: "Example Jobs",
    tagline: "Sign in to continue.",
  },
});
