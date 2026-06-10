# ADS-Tools API — Documentação Completa

> API RESTful para integração de leads, contatos e campanhas de marketing digital.  
> Sincronize dados em tempo real com seu CRM ou aplicação.

**Versão:** v1.0.2  
**Base URL:** `https://api-tools.helbioads.com`  
**Integration Base URL:** `https://api-tools.helbioads.com/api/v1/integration`

---

## Índice

1. [Início Rápido](#início-rápido)
2. [Autenticação](#autenticação)
3. [Sync API](#sync-api) ⭐
4. [Leads API](#leads-api)
5. [Contacts API](#contacts-api)
6. [Tags API](#tags-api)
7. [Interactions API](#interactions-api)
8. [Conversations API](#conversations-api)
9. [Google Ads](#google-ads)
10. [Google Analytics](#google-analytics)
11. [Webhooks](#webhooks)
12. [Tratamento de Erros](#tratamento-de-erros)
13. [Postman Collection](#postman-collection)
14. [Changelog](#changelog)

---

## Início Rápido

Configure sua primeira integração em 5 minutos.

**Pré-requisitos:**
- Conta ativa no ADS-Tools
- Acesso ao dashboard do cliente
- Ferramenta para testar APIs (Postman, curl, etc.)

### 1. Obter sua API Key

Acesse o dashboard → **Configurações → API Keys** → crie uma nova key com os escopos necessários.

> ⚠️ A API Key completa é exibida **apenas uma vez**. Guarde em local seguro.

**Escopos recomendados para começar:**
- `sync:write` — Sincronização de dados
- `leads:read` — Leitura de leads
- `leads:write` — Criação/atualização de leads

### 2. Testar a conexão

```bash
curl -X GET "https://api-tools.helbioads.com/api/v1/integration/health" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 3. Criar seu primeiro lead

```bash
curl -X POST "https://api-tools.helbioads.com/api/v1/integration/sync" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "meu-primeiro-lead",
    "contact": {
      "name": "João Silva",
      "email": "joao@example.com",
      "phone": "+5511999999999"
    },
    "lead": {
      "source": "api-test",
      "status": "open"
    },
    "tags": ["teste", "api"]
  }'
```

### 4. Resposta esperada

```json
{
  "success": true,
  "message": "Sync completed successfully",
  "data": {
    "contact": {
      "id": "clx123abc...",
      "externalId": "meu-primeiro-lead",
      "name": "João Silva",
      "email": "joao@example.com"
    },
    "lead": {
      "id": "clx456def...",
      "status": "open",
      "tags": ["teste", "api"]
    },
    "tags": { "created": 2, "linked": 2 }
  }
}
```

---

## Autenticação

A API utiliza **Bearer Tokens (API Keys)** para autenticação.

```
Authorization: Bearer ads_live_abc123...
```

### Prefixos de API Key

| Prefixo     | Uso                              |
|-------------|----------------------------------|
| `sk_live_*` | Produção                         |
| `sk_test_*` | Desenvolvimento e testes         |

### Escopos Disponíveis

| Escopo                | Descrição                                  | Endpoints                               |
|-----------------------|--------------------------------------------|-----------------------------------------|
| `sync`                | Sincronização de dados em lote             | POST /sync                              |
| `leads:read`          | Leitura de leads                           | GET /leads, GET /leads/:id              |
| `leads:write`         | Criação e atualização de leads             | POST /leads, PUT /leads/:id             |
| `contacts:read`       | Leitura de contatos                        | GET /contacts, GET /contacts/:id        |
| `contacts:write`      | Criação e atualização de contatos          | POST /contacts, PUT /contacts/:id       |
| `tags:read`           | Leitura de tags                            | GET /tags                               |
| `tags:write`          | Criação de tags                            | POST /tags                              |
| `interactions:write`  | Registro de interações                     | POST /leads/:id/interactions            |
| `conversations:read`  | Leitura de conversas                       | GET /leads/:id/conversations            |
| `conversations:write` | Criação de conversas e mensagens           | POST /leads/:id/conversations           |

### Rate Limiting

Limite padrão: **1000 requisições por minuto**.

**Headers informativos em todas as respostas:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 985
X-RateLimit-Reset: 1704067200
```

**Erro 429 — Rate limit excedido:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45
  }
}
```

### Erros de Autenticação

| HTTP | Código              | Descrição                                    | Ação                                        |
|------|---------------------|----------------------------------------------|---------------------------------------------|
| 401  | UNAUTHORIZED        | API Key inválida ou não fornecida            | Verifique o header Authorization            |
| 403  | FORBIDDEN           | API Key válida mas sem permissão             | Verifique os escopos da key                 |
| 403  | API_KEY_REVOKED     | API Key revogada                             | Crie uma nova API Key no dashboard          |
| 429  | RATE_LIMIT_EXCEEDED | Limite de requisições excedido               | Aguarde o tempo indicado em Retry-After     |

### Boas Práticas

✅ Use variáveis de ambiente para armazenar a API Key  
✅ Crie API Keys separadas por ambiente (dev, staging, prod)  
✅ Implemente retry com backoff exponencial para erros 429 e 5xx  
✅ Monitore os headers de rate limit  
❌ Nunca exponha a API Key em código frontend ou repositórios públicos  

---

## Sync API

> ⭐ **Endpoint recomendado.** Permite criar/atualizar contato, lead, tags, interações e conversas em uma única requisição.

### `POST /api/v1/integration/sync`

**Permissão:** `sync:write`

#### Como Funciona

1. Você envia dados com um `externalId` (seu identificador único) ou `protocol` (do Magic Link)
2. Se `protocol` for fornecido: busca lead existente pelo protocolo. Senão, busca/cria contato por `externalId`, `email`, `phone` ou `cpf`
3. O sistema busca ou cria o lead vinculado ao contato
4. Tags são criadas (se não existirem) e vinculadas ao lead
5. Interações e conversas são registradas no histórico
6. Você recebe todos os dados criados/atualizados na resposta

#### Parâmetros do Sync

| Campo                     | Tipo               | Obrigatório | Descrição |
|---------------------------|--------------------|:-----------:|-----------|
| `externalId`              | string             | ⚠️ *        | Seu identificador único. Obrigatório se `protocol` não for fornecido ou não encontrado |
| `protocol`                | string             | ❌          | Protocolo do Magic Link para vincular a lead existente |
| `createContactIfNotFound` | boolean            | ❌          | Quando `false`, não cria contato novo se não encontrar referência. Retorna 404 |
| `action`                  | enum               | ❌          | `upsert` (padrão), `update`, `delete` |
| `contact`                 | object             | ❌          | Dados do contato |
| `lead`                    | object             | ❌          | Dados do lead |
| `tags`                    | string[] / object[]| ❌          | Tags como strings ou objetos completos |
| `interactions`            | array              | ❌          | Lista de interações a registrar |
| `conversation`            | object             | ❌          | Criar/atualizar conversa com mensagens |
| `metadata`                | object             | ❌          | Dados extras (não afeta comportamento) |

#### Campos do `contact`

| Campo          | Tipo   | Descrição |
|----------------|--------|-----------|
| `name`         | string | Nome completo |
| `email`        | string | Email (usado para deduplicação) |
| `phone`        | string | Telefone (formato internacional recomendado) |
| `mobilePhone`  | string | Celular alternativo |
| `cpf`          | string | CPF (com ou sem formatação) |
| `cnpj`         | string | CNPJ |
| `company`      | string | Nome da empresa |
| `jobTitle`     | string | Cargo ou função |
| `website`      | string | Website |
| `address`      | string | Endereço completo |
| `city`         | string | Cidade |
| `state`        | string | Estado |
| `country`      | string | País |
| `zipCode`      | string | CEP |
| `customFields` | object | Campos customizados (qualquer JSON) |

#### Campos do `lead`

| Campo            | Tipo            | Descrição |
|------------------|-----------------|-----------|
| `status`         | enum            | Status no funil |
| `priority`       | enum            | Prioridade |
| `source`         | enum            | Origem do lead |
| `estimatedValue` | number          | Valor estimado (BRL) |
| `saleDate`       | string ISO 8601 | Data/hora da venda. Usado como timestamp em conversões offline (Google Ads / Meta Ads) |
| `notes`          | string          | Notas e observações |

**Status do Lead:**

| Valor         | Descrição                          | Cor      |
|---------------|------------------------------------|----------|
| `open`        | Novo lead, ainda não trabalhado    | Azul     |
| `in_progress` | Lead em negociação ativa           | Amarelo  |
| `waiting`     | Aguardando resposta do cliente     | Laranja  |
| `closed_won`  | Venda concluída                    | Verde    |
| `closed_lost` | Lead perdido/desqualificado        | Vermelho |

**Prioridade do Lead:**

| Valor    | Descrição         | SLA             |
|----------|-------------------|-----------------|
| `low`    | Baixa prioridade  | 48–72 horas     |
| `medium` | Normal            | 24–48 horas     |
| `high`   | Alta prioridade   | 4–24 horas      |
| `urgent` | Urgente           | Imediato (<4h)  |

**Origem do Lead (`source`):**  
`form`, `magic_link`, `api`, `import`, `manual`, `chat`, `whatsapp`, `phone`, `email`, `social`, `referral`, `other`

#### Vinculação por Protocolo (Magic Link)

Quando um usuário acessa um Magic Link, recebe um protocolo único (ex: `ML-20251030-143052-A8F3D-META`). Envie-o no campo `protocol` para vincular dados ao lead existente.

| `protocol`                | `externalId`  | Resultado |
|---------------------------|---------------|-----------|
| Válido e encontrado       | Qualquer      | Vincula ao lead existente |
| Válido mas não encontrado | Fornecido     | Cria novo lead usando externalId |
| Válido mas não encontrado | Não fornecido | Erro 400 |
| Não fornecido             | Fornecido     | Fluxo normal |

**Formatos de Protocolo:**

| Formato    | Exemplo                         |
|------------|---------------------------------|
| FULL       | `ML-20251030-143052-A8F3D-META` |
| DATE_HASH  | `ML-20251030-A8F3D-META`        |
| SHORT      | `ML-A8F3D-META`                 |
| TIMESTAMP  | `ML-1730303452-META`            |

#### Exemplo Completo (Sync)

```bash
curl -X POST "https://api-tools.helbioads.com/api/v1/integration/sync" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "chatbot_ticket_101",
    "action": "upsert",
    "contact": {
      "name": "Maria Santos",
      "email": "maria@empresa.com",
      "phone": "+5511988888888",
      "company": "Empresa ABC",
      "jobTitle": "Gerente de Marketing",
      "city": "São Paulo",
      "state": "SP",
      "customFields": { "segmento": "varejo" }
    },
    "lead": {
      "status": "in_progress",
      "priority": "high",
      "source": "chat",
      "estimatedValue": 15000,
      "notes": "Cliente interessado em plano enterprise"
    },
    "tags": [
      "lead-qualificado",
      {
        "name": "enterprise",
        "color": "#8B5CF6",
        "isConversion": true,
        "categoryConversion": "LEAD"
      }
    ],
    "interactions": [
      {
        "type": "CALL",
        "title": "Ligação de qualificação",
        "description": "Conversamos sobre necessidades do cliente",
        "metadata": { "duration": 900 }
      }
    ],
    "conversation": {
      "channel": "WHATSAPP",
      "externalId": "whatsapp_5511988888888",
      "messages": [
        {
          "direction": "INBOUND",
          "content": "Olá! Gostaria de saber mais sobre o plano enterprise",
          "externalId": "msg_001"
        },
        {
          "direction": "OUTBOUND",
          "content": "Olá Maria! Claro, vou te explicar...",
          "externalId": "msg_002"
        }
      ]
    }
  }'
```

#### Resposta de Sucesso

```json
{
  "success": true,
  "message": "Sync completed successfully",
  "data": {
    "contact": { "id": "clx123abc...", "name": "Maria Santos" },
    "lead": { "id": "clx456def...", "status": "in_progress" },
    "tags": { "created": 1, "linked": 2 },
    "interactions": { "created": 1 },
    "conversation": { "id": "clx789ghi...", "messagesCreated": 2 }
  }
}
```

### `GET /api/v1/integration/sync/protocol/{protocol}`

**Permissão:** `sync:read` — Buscar dados completos pelo protocolo do Magic Link.

```bash
curl -X GET "https://api-tools.helbioads.com/api/v1/integration/sync/protocol/ML-20251030-143052-A8F3D-META" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Leads API

Endpoints para listar, criar, atualizar e gerenciar leads.

### `GET /api/v1/integration/leads`

**Permissão:** `leads:read` — Listar leads com paginação e filtros.

| Campo           | Tipo   | Descrição |
|-----------------|--------|-----------|
| `page`          | number | Página atual (default: 1) |
| `limit`         | number | Itens por página (default: 20, max: 100) |
| `status`        | string | Filtrar por status |
| `priority`      | string | Filtrar por prioridade |
| `source`        | string | Filtrar por origem |
| `tag`           | string | Filtrar por tag (nome ou ID) |
| `search`        | string | Busca por nome, email ou telefone |
| `createdAfter`  | date   | Criados após esta data (ISO 8601) |
| `createdBefore` | date   | Criados antes desta data (ISO 8601) |

```bash
curl "https://api-tools.helbioads.com/api/v1/integration/leads?status=open&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### `GET /api/v1/integration/leads/:identifier`

**Permissão:** `leads:read` — Buscar lead por ID interno ou `externalId`.

```bash
# Por ID interno
curl "https://api-tools.helbioads.com/api/v1/integration/leads/clx123abc456" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Por externalId
curl "https://api-tools.helbioads.com/api/v1/integration/leads/meu-lead-001" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### `POST /api/v1/integration/leads`

**Permissão:** `leads:write` — Criar novo lead.

| Campo                     | Tipo     | Obrigatório | Descrição |
|---------------------------|----------|:-----------:|-----------|
| `externalId`              | string   | ⚠️ *        | ID único. Obrigatório se `protocol` não for fornecido |
| `protocol`                | string   | ❌          | Protocolo do Magic Link |
| `createContactIfNotFound` | boolean  | ❌          | Se `false`, não cria contato novo (retorna 404) |
| `contactId`               | string   | ❌          | ID de contato existente |
| `contact`                 | object   | ❌          | Dados para criar novo contato |
| `status`                  | enum     | ❌          | Status inicial (default: `open`) |
| `priority`                | enum     | ❌          | Prioridade (default: `medium`) |
| `source`                  | enum     | ❌          | Origem do lead |
| `estimatedValue`          | number   | ❌          | Valor estimado (BRL) |
| `saleDate`                | string   | ❌          | Data da venda (ISO 8601) |
| `notes`                   | string   | ❌          | Notas |
| `tags`                    | string[] | ❌          | Tags a associar |

```bash
curl -X POST "https://api-tools.helbioads.com/api/v1/integration/leads" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "lead-001",
    "contact": {
      "name": "Maria Santos",
      "email": "maria@empresa.com",
      "phone": "+5511988888888"
    },
    "status": "open",
    "priority": "high",
    "source": "api",
    "tags": ["api-test"]
  }'
```

### `PATCH /api/v1/integration/leads/:uuid/status`

**Permissão:** `leads:write` — Atualizar apenas o status do lead.

```bash
curl -X PATCH "https://api-tools.helbioads.com/api/v1/integration/leads/abc12345-e5f6-7890-abcd-ef1234567890/status" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "status": "closed_won" }'
```

### `POST /api/v1/integration/leads/:id/interactions`

**Permissão:** `interactions:write` — Adicionar interação ao lead.

| Campo         | Tipo   | Obrigatório | Descrição |
|---------------|--------|:-----------:|-----------|
| `type`        | enum   | ✅          | `NOTE`, `CALL`, `EMAIL`, `MEETING`, `COMMENT`, `TASK_CREATED`, `TASK_COMPLETED`, `CUSTOM` |
| `title`       | string | ❌          | Título |
| `description` | string | ❌          | Descrição detalhada |
| `metadata`    | object | ❌          | Dados extras (duration, result, etc) |

```bash
curl -X POST "https://api-tools.helbioads.com/api/v1/integration/leads/clx123abc456/interactions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CALL",
    "title": "Ligação de follow-up",
    "description": "Cliente interessado, agendou reunião",
    "metadata": { "duration": 480, "result": "positive" }
  }'
```

---

## Contacts API

Endpoints para listar, criar e atualizar contatos. Contatos são a base para criação de leads.

### `GET /api/v1/integration/contacts`

**Permissão:** `contacts:read` — Listar contatos com paginação e filtros.

| Campo     | Tipo   | Descrição |
|-----------|--------|-----------|
| `page`    | number | Página atual (default: 1) |
| `limit`   | number | Itens por página (default: 20, max: 100) |
| `search`  | string | Busca por nome, email, telefone ou empresa |
| `email`   | string | Filtrar por email exato |
| `phone`   | string | Filtrar por telefone |
| `company` | string | Filtrar por empresa |

### `GET /api/v1/integration/contacts/:id`

**Permissão:** `contacts:read` — Buscar contato por ID ou `externalId`.

### `POST /api/v1/integration/contacts`

**Permissão:** `contacts:write` — Criar novo contato.

| Campo                     | Tipo    | Obrigatório | Descrição |
|---------------------------|---------|:-----------:|-----------|
| `name`                    | string  | ✅          | Nome completo |
| `externalId`              | string  | ⚠️ *        | ID único. Obrigatório se `protocol` não fornecido |
| `protocol`                | string  | ❌          | Protocolo do Magic Link |
| `createContactIfNotFound` | boolean | ❌          | Se `false`, retorna 404 se não encontrar |
| `email`                   | string  | ❌          | Email (deduplicação) |
| `phone`                   | string  | ❌          | Telefone |
| `mobilePhone`             | string  | ❌          | Celular alternativo |
| `cpf`                     | string  | ❌          | CPF |
| `cnpj`                    | string  | ❌          | CNPJ |
| `company`                 | string  | ❌          | Empresa |
| `jobTitle`                | string  | ❌          | Cargo |
| `website`                 | string  | ❌          | Website |
| `address`                 | string  | ❌          | Endereço |
| `city`                    | string  | ❌          | Cidade |
| `state`                   | string  | ❌          | Estado |
| `country`                 | string  | ❌          | País |
| `zipCode`                 | string  | ❌          | CEP |
| `customFields`            | object  | ❌          | Campos customizados |

### `PATCH /api/v1/integration/contacts/:id`

**Permissão:** `contacts:write` — Atualizar contato existente (campos parciais).

### Deduplicação de Contatos

O sistema detecta duplicatas automaticamente na seguinte ordem de prioridade:

1. `externalId`
2. `email`
3. `phone`
4. `cpf`

Se nenhum campo corresponder, um novo contato é criado.

---

## Tags API

Endpoints para listar e criar tags. Tags classificam leads e podem disparar eventos de conversão.

### `GET /api/v1/integration/tags`

**Permissão:** `tags:read` — Listar todas as tags.

```bash
curl "https://api-tools.helbioads.com/api/v1/integration/tags" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Exemplo de resposta:**

```json
{
  "success": true,
  "data": {
    "tags": [
      {
        "id": "clx123...",
        "name": "lead-qualificado",
        "color": "#10b981",
        "isConversion": true,
        "categoryConversion": "LEAD",
        "sendToMarketingPlatform": true,
        "leadsCount": 45
      }
    ]
  }
}
```

### `POST /api/v1/integration/tags`

**Permissão:** `tags:write` — Criar nova tag.

| Campo                     | Tipo    | Obrigatório | Descrição |
|---------------------------|---------|:-----------:|-----------|
| `name`                    | string  | ✅          | Nome da tag (único) |
| `description`             | string  | ❌          | Descrição |
| `color`                   | string  | ❌          | Cor hexadecimal (ex: `#8b5cf6`) |
| `orderNumber`             | number  | ❌          | Ordem de exibição |
| `kanban`                  | number  | ❌          | Coluna no Kanban (1–5) |
| `isConversion`            | boolean | ❌          | É evento de conversão? |
| `categoryConversion`      | enum    | ❌          | Categoria de conversão |
| `eventName`               | string  | ❌          | Nome do evento para tracking |
| `sendToMarketingPlatform` | boolean | ❌          | Enviar para Meta/Google Ads |

### Categorias de Conversão

| Valor              | Descrição                  |
|--------------------|----------------------------|
| `PURCHASE`         | Compra realizada           |
| `LEAD`             | Lead qualificado           |
| `SIGNUP`           | Cadastro/registro          |
| `CONTACT`          | Contato realizado          |
| `ADD_TO_CART`      | Adição ao carrinho         |
| `BEGIN_CHECKOUT`   | Início de checkout         |
| `SUBSCRIBE`        | Assinatura                 |
| `BOOK_APPOINTMENT` | Agendamento                |
| `REQUEST_QUOTE`    | Solicitação de orçamento   |
| `DOWNLOAD`         | Download                   |
| `OTHER`            | Outro                      |

### Colunas do Kanban

| Valor | Coluna      |
|-------|-------------|
| 1     | Novo        |
| 2     | Contato     |
| 3     | Negociação  |
| 4     | Proposta    |
| 5     | Fechado     |

---

## Interactions API

Interações registram o histórico de atividades de um lead.

### `GET /api/v1/integration/leads/:identifier/interactions`

**Permissão:** `interactions:read`

| Campo   | Tipo   | Descrição |
|---------|--------|-----------|
| `page`  | number | Página atual (default: 1) |
| `limit` | number | Itens por página (default: 20, max: 100) |
| `type`  | string | Filtrar por tipo (NOTE, CALL, etc) |

### `POST /api/v1/integration/leads/:identifier/interactions`

**Permissão:** `interactions:write`

| Campo         | Tipo    | Obrigatório | Descrição |
|---------------|---------|:-----------:|-----------|
| `type`        | enum    | ✅          | Tipo da interação |
| `title`       | string  | ❌          | Título |
| `description` | string  | ❌          | Descrição detalhada |
| `metadata`    | object  | ❌          | Dados extras |
| `isInternal`  | boolean | ❌          | Se `true`, não visível para integradores |

### Tipos de Interação

**Disponíveis via API:**

| Tipo             | Descrição                    |
|------------------|------------------------------|
| `NOTE`           | Nota ou observação           |
| `CALL`           | Ligação realizada/recebida   |
| `EMAIL`          | Email enviado/recebido       |
| `MEETING`        | Reunião agendada/realizada   |
| `COMMENT`        | Comentário interno           |
| `TASK_CREATED`   | Tarefa criada                |
| `TASK_COMPLETED` | Tarefa concluída             |
| `CUSTOM`         | Tipo personalizado           |

**Gerados automaticamente pelo sistema (somente leitura):**  
`STATUS_CHANGE`, `PRIORITY_CHANGE`, `TAG_ADDED`, `TAG_REMOVED`, `ASSIGNED`, `UNASSIGNED`, `CREATED`, `UPDATED`, `CONVERTED`, `CLOSED`

### Metadata Sugerido por Tipo

| Tipo      | Campos sugeridos                                           |
|-----------|------------------------------------------------------------|
| `CALL`    | `duration` (segundos), `result`, `phoneNumber`             |
| `EMAIL`   | `subject`, `from`, `to`, `messageId`                       |
| `MEETING` | `duration`, `platform`, `participants`, `link`             |
| `CUSTOM`  | Qualquer estrutura JSON                                    |

```bash
curl -X POST "https://api-tools.helbioads.com/api/v1/integration/leads/clx123abc456/interactions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MEETING",
    "title": "Reunião de demonstração",
    "description": "Demonstração do produto para equipe de vendas",
    "metadata": {
      "duration": 3600,
      "platform": "zoom",
      "participants": ["maria@cliente.com", "jose@cliente.com"]
    }
  }'
```

---

## Conversations API

Gerencie conversas e mensagens de leads. Ideal para integração com chatbots, WhatsApp Business, sistemas de atendimento e CRMs.

### `GET /api/v1/integration/leads/:leadId/conversations`

**Permissão:** `conversations:read` — Listar conversas de um lead.

| Campo     | Tipo   | Descrição |
|-----------|--------|-----------|
| `page`    | number | Página atual (default: 1) |
| `limit`   | number | Itens por página (default: 20, max: 100) |
| `channel` | string | Filtrar por canal (`WHATSAPP`, `EMAIL`, etc) |
| `status`  | string | Filtrar por status (`open`, `closed`) |

```bash
curl "https://api-tools.helbioads.com/api/v1/integration/leads/clx123abc456/conversations" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### `GET /api/v1/integration/conversations/:id`

**Permissão:** `conversations:read` — Buscar conversa com mensagens.

```bash
curl "https://api-tools.helbioads.com/api/v1/integration/conversations/conv_001?includeMessages=true&messagesLimit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### `POST /api/v1/integration/leads/:leadId/conversations`

**Permissão:** `conversations:write` — Criar nova conversa.

| Campo        | Tipo   | Obrigatório | Descrição |
|--------------|--------|:-----------:|-----------|
| `channel`    | enum   | ✅          | Canal da conversa (ex: `WHATSAPP`) |
| `externalId` | string | ❌          | ID externo para deduplicação |
| `subject`    | string | ❌          | Assunto/título |
| `messages`   | array  | ❌          | Mensagens iniciais |

### `POST /api/v1/integration/conversations/:id/messages`

**Permissão:** `conversations:write` — Adicionar mensagem à conversa.

| Campo        | Tipo   | Obrigatório | Descrição |
|--------------|--------|:-----------:|-----------|
| `direction`  | enum   | ✅          | `INBOUND` (cliente) ou `OUTBOUND` (você) |
| `type`       | enum   | ❌          | Tipo da mensagem (default: `TEXT`) |
| `content`    | string | ✅          | Conteúdo da mensagem |
| `externalId` | string | ❌          | ID da mensagem no seu sistema |
| `metadata`   | object | ❌          | Dados extras: `mediaUrl`, `mimeType`, etc |

```bash
curl -X POST "https://api-tools.helbioads.com/api/v1/integration/conversations/conv_001/messages" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "direction": "OUTBOUND",
    "type": "TEXT",
    "content": "Obrigado pelo contato! Retorno em instantes.",
    "externalId": "wamid.xyz789"
  }'
```

### Canais Disponíveis

`WHATSAPP`, `EMAIL`, `CHAT`, `PHONE`, `SMS`, `FACEBOOK`, `INSTAGRAM`, `TELEGRAM`, `MANUAL`, `API`, `OTHER`

### Tipos de Mensagem

| Tipo          | Descrição               | Metadata sugerido |
|---------------|-------------------------|----------------------------------------|
| `TEXT`        | Texto simples           | —                                      |
| `IMAGE`       | Imagem                  | `mediaUrl`, `mimeType`, `caption`      |
| `AUDIO`       | Áudio/Voz               | `mediaUrl`, `mimeType`, `duration`     |
| `VIDEO`       | Vídeo                   | `mediaUrl`, `mimeType`, `duration`     |
| `FILE`        | Documento/Arquivo       | `mediaUrl`, `mimeType`, `fileSize`, `fileName` |
| `LOCATION`    | Localização             | `latitude`, `longitude`, `address`     |
| `TEMPLATE`    | Template HSM (WhatsApp) | `templateName`, `components`           |
| `INTERACTIVE` | Botões/Lista            | `buttons[]`, `sections[]`              |
| `SYSTEM`      | Mensagem do sistema     | —                                      |
| `NOTE`        | Nota interna            | —                                      |

**Exemplo com mídia:**

```json
{
  "direction": "INBOUND",
  "type": "IMAGE",
  "content": "Foto do produto",
  "externalId": "wamid.img_001",
  "metadata": {
    "mediaUrl": "https://example.com/image.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 125000,
    "caption": "Esse é o modelo que me interessa"
  }
}
```

---

## Google Ads

Rotas para gerenciamento de conexões do Google Ads.

**Base URL:** `https://api-tools.helbioads.com/api/integrations/google-ads`

### Endpoints

| Método   | Rota                              | Permissão       | Descrição |
|----------|-----------------------------------|-----------------|-----------|
| `GET`    | `/:clientId`                      | `clients:read`  | Status da conexão |
| `GET`    | `/:clientId/accounts`             | `clients:read`  | Listar contas Google Ads |
| `POST`   | `/:clientId/accounts/select`      | `clients:write` | Selecionar conta ativa |
| `POST`   | `/:clientId/mcc/load`             | `clients:write` | Carregar contas filhas de MCC |
| `GET`    | `/:clientId/mcc/:mccId`           | `clients:read`  | Informações do MCC |
| `GET`    | `/:clientId/mcc/:mccId/accounts`  | `clients:read`  | Listar contas filhas do MCC |
| `POST`   | `/:clientId/sync`                 | `clients:write` | Sincronizar contas |
| `DELETE` | `/:clientId`                      | `clients:delete`| Desconectar Google Ads |

### Parâmetros

| Campo      | Tipo   | Obrigatório | Descrição |
|------------|--------|:-----------:|-----------|
| `clientId` | string | ✅          | ID do cliente (CUID) |
| `mccId`    | string | ❌          | ID do MCC |
| `limit`    | number | ❌          | Limite de contas filhas (1–100) |

### Exemplos

```bash
# Listar contas
curl -X GET "https://api-tools.helbioads.com/api/integrations/google-ads/<clientId>/accounts" \
  -H "Authorization: Bearer YOUR_JWT"

# Selecionar conta
curl -X POST "https://api-tools.helbioads.com/api/integrations/google-ads/<clientId>/accounts/select" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json"
```
