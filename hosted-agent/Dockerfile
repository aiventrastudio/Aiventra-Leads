FROM mcr.microsoft.com/playwright:v1.65.0-noble

USER root
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    fluxbox nginx novnc supervisor websockify x11vnc xvfb \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default \
  && mkdir -p /var/log/supervisor /run/nginx

WORKDIR /app
COPY local-agent/package.json local-agent/package-lock.json ./
RUN npm ci --omit=dev
COPY local-agent/src ./src
COPY hosted-agent/nginx.conf /etc/nginx/conf.d/default.conf
COPY hosted-agent/supervisord.conf /etc/supervisor/conf.d/hosted-agent.conf

ENV AIVENTRA_CLOUD_MODE=true \
    AIVENTRA_AGENT_PORT=3210 \
    DISPLAY=:99 \
    HOME=/home/pwuser
EXPOSE 8080
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
