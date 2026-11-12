# Hosted supervised browser worker

This Docker deployment runs the existing research companion in a headed Chromium browser on a cloud VM. Caddy provides HTTPS, and noVNC streams the desktop to an authenticated Aiventra workspace member. The browser context is ephemeral: its cookies and page state are discarded when a research session ends or the worker restarts. The worker never receives social-platform passwords, and it never submits posts, comments, or messages.

## Requirements

- A Linux VM with Docker Compose, at least 2 vCPUs and 4 GB RAM for one active browser.
- A DNS name pointed at the VM and inbound TCP ports 80 and 443 open. Caddy obtains and renews HTTPS certificates.
- An Aiventra deploy where `VITE_RESEARCH_AGENT_URL` is set to the HTTPS origin, for example `https://research-agent.example.com`.

The app also runs on Oracle Cloud Infrastructure (OCI). Its Always Free Ampere VM is ARM64; Playwright supports Chromium on Linux ARM64. Free capacity depends on the selected OCI home region. The Docker image is provider-neutral, so it can run on another Linux VM as well.

## Deploy

1. Create the VM, install Docker Engine and the Docker Compose plugin, and point a DNS A record at the VM's public IP.
2. Allow inbound TCP ports 80 and 443 in both the VM firewall and the cloud network security rules.
3. On the VM, clone this repository and enter `hosted-agent/`.
4. Copy `.env.example` to `.env` and set `AIVENTRA_AGENT_DOMAIN` to your DNS name.
5. Run `docker compose up -d --build`.
6. Set `VITE_RESEARCH_AGENT_URL=https://research-agent.example.com` in the Vercel project and redeploy the dashboard.
7. In the worker logs, copy the one-time pairing code into **Research Sessions**. Pair once per worker restart.
8. Start a session. The user signs in manually in the remote browser; use **Open browser** to watch or take over.

## Security notes

- Do not expose ports 3210, 5900, or 6080 publicly. Only Caddy's HTTPS ports should be public; the VNC listener binds to loopback inside the container.
- The browser viewer uses a short-lived token minted after checking the signed-in Aiventra user and workspace membership. The token is required to open the VNC websocket.
- A browser session temporarily contains sign-in cookies in memory while it runs. They are discarded when the session ends; do not enable persistent browser profiles for this deployment without a separate security review.
- Pairing holds the Aiventra refresh token in worker memory, as in the local companion. Restarting the worker clears it and generates a new pairing code.
- Keep the VM and its Docker packages updated. Anyone with VM root access can inspect the active browser session.
- Google and each social platform can still reject or restrict automation-controlled browser sign-in. The agent stops for login challenges, CAPTCHAs, unusual activity, and rate-limit prompts rather than trying to bypass them.

This is a single-worker pilot. Do not run multiple replicas against the same workspace: the worker intentionally processes one active browser session at a time, and each deployment has its own pairing state.
