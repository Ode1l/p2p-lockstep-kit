# Signaling Server Deployment

This project deploys as a small Node.js WebSocket service behind a reverse proxy.

## Server Layout

Recommended path:

```bash
/opt/p2p-lockstep/signaling-server
```

Recommended public endpoint:

```text
wss://signal.example.com
```

## First-Time Server Setup

```bash
sudo mkdir -p /opt/p2p-lockstep
sudo chown -R $USER:$USER /opt/p2p-lockstep
cd /opt/p2p-lockstep
git clone <your-repo-url> signaling-server
cd signaling-server
npm ci
npm run typecheck
npm run build
```

## systemd Service

Create `/etc/systemd/system/p2p-signaling.service`:

```ini
[Unit]
Description=P2P Lockstep Signaling Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/p2p-lockstep/signaling-server
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=SIGNALING_HOST=127.0.0.1
Environment=SIGNALING_PORT=8787

[Install]
WantedBy=multi-user.target
```

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable p2p-signaling
sudo systemctl start p2p-signaling
sudo systemctl status p2p-signaling
```

## Nginx WebSocket Proxy

```nginx
server {
  server_name signal.example.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
  }
}
```

Use Certbot or your server panel to enable HTTPS for `signal.example.com`.

## GitHub Actions Secrets

Required:

```text
SERVER_HOST
SERVER_USER
SERVER_SSH_KEY
```

Optional:

```text
SERVER_SSH_PORT
SERVER_APP_DIR
SERVER_SERVICE_NAME
```

Defaults:

```text
SERVER_SSH_PORT=22
SERVER_APP_DIR=/opt/p2p-lockstep/signaling-server
SERVER_SERVICE_NAME=p2p-signaling
```

The workflow deploys on every push to `main`, and can also be started manually from GitHub Actions.
