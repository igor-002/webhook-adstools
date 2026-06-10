# webhook-adstools

Node.js service that receives webhooks from **Atendai** and forwards lead data to
**ADS-Tools** via its `/sync` endpoint. Runs on the VPS (AlmaLinux 9.5, `104.234.186.129`)
under PM2.

## How it works

1. Atendai sends `POST /webhook` with a payload containing a `data` object.
2. The service reads `data.evento`. Only `ENTRADA_NOVA_CONVERSA_FILA` is handled for now.
3. It reads `data.filaPersonalizada.nome_fila` and maps it to an ADS-Tools lead status + tags.
4. It calls `POST https://api-tools.helbioads.com/api/v1/integration/sync` with a Bearer token.
5. It **always** returns `200` to Atendai (to avoid retry loops). ADS-Tools failures are logged, not surfaced.

If the queue is not in the mapping table, the request is logged and `200` is returned **without** calling ADS-Tools.

## Queue mapping (`src/config/filaMap.js`)

| nome_fila        | lead.status   | tags               |
|------------------|---------------|--------------------|
| Novo Lead        | `open`        | `["novo-lead"]`    |
| Em atendimento   | `in_progress` | `["em-atendimento"]` |
| Orçamento        | `in_progress` | `["orcamento"]`    |
| Em Negociação    | `in_progress` | `["em-negociacao"]` |
| Convertido       | `closed_won`  | `["convertido"]`   |

## /sync payload sent to ADS-Tools

```json
{
  "externalId": "<data.whatsappid>",
  "contact": { "name": "<data.nome>", "phone": "<data.whatsappid>" },
  "lead": { "status": "<mapped>", "source": "whatsapp" },
  "tags": ["<mapped>"],
  "metadata": {
    "atendimento_id": "<data.id>",
    "fila_id": "<data.filaPersonalizada.id>",
    "fila_nome": "<data.filaPersonalizada.nome_fila>"
  }
}
```

## Environment

Copy `.env.example` to `.env` and fill in:

| Var               | Required | Description |
|-------------------|----------|-------------|
| `PORT`            | no (default `3002`) | HTTP port |
| `ADSTOOLS_API_KEY`| yes | Bearer token for ADS-Tools `/sync` |
| `WEBHOOK_SECRET`  | no  | If set, requests must provide a matching secret via header `x-webhook-secret` **or** query param `?secret=`. If empty, validation is skipped. |

> **Note:** Atendai cannot send custom headers, so use the query param form:
> `http://104.234.186.129:3011/webhook?secret=YOUR_SECRET`

## Local run

```bash
npm install
cp .env.example .env   # fill values
npm start
```

Health check: `GET http://localhost:3002/health`

Test webhook:

```bash
curl -X POST http://localhost:3002/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_SECRET" \
  -d '{
    "data": {
      "evento": "ENTRADA_NOVA_CONVERSA_FILA",
      "id": "atend_123",
      "nome": "João Silva",
      "whatsappid": "5511999999999",
      "filaPersonalizada": { "id": "fila_1", "nome_fila": "Novo Lead" }
    }
  }'
```

## Deploy on the VPS (AlmaLinux 9.5)

### 1. Install Node.js + PM2 (once)

```bash
# Node.js 20 LTS via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo npm install -g pm2
```

### 2. Get the code onto the server

```bash
# example path
sudo mkdir -p /var/www
cd /var/www
git clone <repo-url> webhook-adstools   # or rsync/scp the folder
cd webhook-adstools
npm install --omit=dev
```

### 3. Configure environment

```bash
cp .env.example .env
nano .env   # set ADSTOOLS_API_KEY and (optionally) WEBHOOK_SECRET
```

### 4. Start with PM2

```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd    # run the command it prints, to start PM2 on boot
```

### 5. Useful PM2 commands

```bash
pm2 status
pm2 logs webhook-adstools
pm2 restart webhook-adstools
pm2 stop webhook-adstools
pm2 reload webhook-adstools     # zero-downtime reload
```

### 6. Firewall / reverse proxy

The app listens on `PORT` (default `3002`). Expose it via Nginx reverse proxy
(recommended, for TLS) or open the port directly:

```bash
sudo firewall-cmd --permanent --add-port=3002/tcp
sudo firewall-cmd --reload
```

Configure Atendai to send webhooks to `http://104.234.186.129:3002/webhook`
(or your HTTPS domain if behind Nginx).

## Logs

Structured JSON, one line per event, written to stdout/stderr (captured by PM2 in `logs/`).
Each webhook logs: queue received, externalId, status sent, and the ADS-Tools response or error.
