# Backend Fase 1 — Infraestrutura Multi-tenant

Núcleo do Addere Ads Control: autenticação, isolamento por cliente, vault de credenciais e CRUD de leads.

---

## Por que existe

Centraliza a gestão de anúncios e leads de múltiplos clientes (advogados, consultores) em um único painel. Cada cliente vê apenas seus próprios dados; credenciais de APIs externas ficam criptografadas no banco.

---

## Pré-requisitos

### Variáveis de ambiente obrigatórias

| Var | Descrição |
|-----|-----------|
| `DATABASE_URL` | Neon pooled — `postgresql://...?sslmode=require` |
| `DIRECT_URL` | Neon direct — sem pooler, para migrations |
| `JWT_SECRET` | ≥ 64 chars aleatórios |
| `CREDENTIAL_ENCRYPTION_KEY` | 64 chars hex = 32 bytes (AES-256-GCM) |
| `CORS_ORIGINS` | URLs do frontend separadas por vírgula |
| `SUPER_ADMIN_EMAIL` | Email do primeiro usuário raiz |
| `SUPER_ADMIN_PASSWORD` | Senha do primeiro usuário raiz |

### Variáveis opcionais

| Var | Descrição |
|-----|-----------|
| `ANTHROPIC_API_KEY` | Fallback global (cada cliente pode ter o próprio) |
| `RESEND_API_KEY` | Envio de e-mails |
| `RESEND_FROM` | Remetente (padrão: `adscontrol@addereon.com.br`) |
| `R2_*` | Cloudflare R2 para upload de mídia |
| `R2_PUBLIC_URL_BASE` | URL pública do bucket R2 |

---

## Fluxo end-to-end

```
Cliente HTTP
   │
   ├── POST /auth/login  ──► bcrypt compare → JWT (15min) + httpOnly cookie (refresh 7d)
   ├── POST /auth/refresh ──► hash lookup → revoga antigo → emite novo par
   ├── POST /auth/logout  ──► revoga refresh token + clearCookie
   │
   ├── /clients/**             (requireAuth + requireSuperAdmin)
   │     GET    /clients                → lista todos
   │     POST   /clients                → cria (slug único)
   │     GET    /clients/:id            → detalhe
   │     PUT    /clients/:id            → edita
   │     PATCH  /clients/:id/status     → muda status
   │
   ├── /clients/:clientId/credentials  (requireAuth + requireSuperAdmin)
   │     GET    /                       → metadados (sem value descriptografado)
   │     PUT    /:platform/:key         → upsert criptografado (AES-256-GCM)
   │     DELETE /:platform/:key         → remove
   │
   ├── /clients/:clientId/leads        (requireAuth + requireSameClient)
   │     GET/POST/GET/:id/PUT/:id/DELETE/:id
   │
   ├── GET /dashboard/summary          (requireAuth)  → counts por clientId
   │
   └── GET /health / GET /health/db    (público)
```

---

## Modelo de dados

### Client
Tenant raiz. Tem `slug` (único, URL-safe), `niche`, `keywords` e cor primária para personalização futura da IA.

### User
`email` globalmente único. `clientId = null` para SUPER_ADMIN. Role: `SUPER_ADMIN | ADMIN | VIEWER`.

### RefreshToken
Hash SHA-256 do token bruto. Rotacionado a cada `/auth/refresh`. `revokedAt` marca invalidação sem deletar o registro.

### ClientCredential
`@@unique([clientId, platform, key])`. Valor sempre criptografado com AES-256-GCM — nunca retornado na API. Plataformas: `GOOGLE_ADS | META_ADS | INSTAGRAM | ANTHROPIC | RESEND`.

### Lead
`monthlyFeePotential` em **centavos** (Int). Status: `NEW → CONTACTED → QUALIFIED → CONVERTED | LOST`.

---

## Segurança

- **JWT** expira em 15 minutos; refresh token httpOnly roda em cookie (7 dias, rotacionado).
- **AES-256-GCM**: IV aleatório 96 bits por operação; tag de autenticação impede adulteração.
- `getKey()` valida o `CREDENTIAL_ENCRYPTION_KEY` no momento do uso (lazy) — servidor inicia limpo mesmo sem a var em dev.
- Rate limit: `/auth/*` → 10 req/15min; APIs gerais → 100 req/min.
- `requireSameClient` deixa SUPER_ADMIN passar qualquer clientId; outros papéis só acessam seu próprio tenant.

---

## Startup em produção

`server.js` roda `prisma migrate deploy` de forma síncrona antes de `app.listen()`. Se a migration falhar, o processo termina com `exit(1)` — o Render marca o deploy como falho em vez de subir com schema desatualizado.

Após `listen()`, `seedSuperAdmin()` cria o primeiro usuário raiz se `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` estiverem definidos e o usuário ainda não existir.

---

## Troubleshooting

| Erro | Causa provável | Solução |
|------|---------------|---------|
| `P1013: scheme is not recognized` | `DATABASE_URL` com aspas extras ou vazia | Remover aspas; checar env var no Render |
| `P1001: Can't reach database` | `DATABASE_URL` incorreta ou Neon pausado | Verificar string de conexão; acordar o projeto Neon |
| `Migration falhou` no Render | `DIRECT_URL` não configurada | Adicionar a connection string sem pooler |
| `CREDENTIAL_ENCRYPTION_KEY deve ter 64 chars` | Var ausente ou tamanho errado | Gerar com `openssl rand -hex 32` |
| `Token inválido ou expirado` | JWT_SECRET diferente entre deploys | Garantir que JWT_SECRET é estável (não regenerar a cada deploy) |
| 409 no `POST /clients` | Slug já em uso | Escolher slug diferente |
