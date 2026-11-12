# Aiventra Local Research Agent

For a hosted browser that teammates can watch from the dashboard without installing this companion, see [hosted-agent/README.md](../hosted-agent/README.md). The hosted version uses an ephemeral browser context: platform sign-in cookies are discarded when each session ends.

This companion runs on your Windows computer and opens a visible Chromium window. It never accepts social-platform passwords and does not use platform APIs, headless mode, stealth plugins, proxies, or CAPTCHA workarounds. The local browser profile is stored in `.browser-profile/` and is ignored by Git.

## Run it

1. Install Node.js 20 or newer and Google Chrome.
2. In PowerShell, run `npm install` from this folder.
3. Run `npm start`. Keep the terminal and this computer on while sessions run. The terminal prints a one-time pairing code.
4. In Aiventra, open **Research Sessions**, enter the pairing code, and pair the companion with your signed-in workspace.
5. Start a session. Sign in to the platform manually in the visible browser when prompted.

The Supabase refresh token is held only in the companion process memory. Pair again after restarting it. Platform passwords and browser profile data never leave this computer. Research sessions have no Aiventra daily session, inter-session wait, post-count, duration, or query-count cap. You can stop a session at any time in the dashboard or by closing the visible browser. The companion still pauses for platform sign-in challenges, CAPTCHAs, unusual-activity notices, and rate-limit messages.

The browser adapters use visible platform pages and may stop working when those pages change. Platform terms may restrict automated browsing or collection; an attended session does not change those platform rules.

Research platform adapters are available for Reddit, X, Facebook, LinkedIn, Instagram, TikTok, and YouTube. Search-result markup and access vary by account and platform; verify the visible results and extracted post links during each session. The companion stops for sign-in challenges, CAPTCHAs, unusual-activity notices, and rate limits rather than attempting to bypass them.
