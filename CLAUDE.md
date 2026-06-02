# Addere Ads Control

SaaS multi-tenant de gestão de anúncios e leads para escritórios jurídicos e profissionais liberais.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js ESM, Express, Prisma ORM |
| Banco | PostgreSQL — Neon (serverless) |
| Frontend | React + Vite + Tailwind CSS |
| IA | Anthropic SDK — Claude Haiku (jobs em lote) |
| Deploy | Backend → Render · Frontend → Vercel |

---

## Comandos

```bash
# Backend
cd backend
npm run dev           # node --env-file=.env --watch src/server.js (porta 3000)
npx prisma migrate dev --name <nome>   # nova migration
npx prisma generate                    # regenerar client

# Frontend
cd frontend
npm run dev           # Vite dev server
npm run build         # build de produção
```

---

## Estrutura do backend

```
backend/src/
  server.js              # entry point — startup migration + rotas + seed
  lib/
    prisma.js            # PrismaClient singleton
    crypto.js            # AES-256-GCM encrypt/decrypt (vault de credenciais)
    businessDate.js      # helpers de data em BRT (America/Belem)
    seed.js              # cria SUPER_ADMIN na primeira subida
    anthropic.js         # factory de AnthropicClient por clientId
    r2.js                # upload Cloudflare R2 com prefixo por clientSlug
    resend.js            # envio de e-mail via Resend
  middleware/
    auth.js              # requireAuth / requireRole / requireSameClient
    validate.js          # validateBody(zodSchema)
    rateLimit.js         # authLimiter (10/15min) + apiLimiter (100/min)
  routes/
    auth.js              # POST /auth/login|refresh|logout
    clients.js           # CRUD /clients (SUPER_ADMIN only)
    credentials.js       # PUT/DELETE /clients/:clientId/credentials/:platform/:key
    dashboard.js         # GET /dashboard/summary
    leads.js             # CRUD /clients/:clientId/leads
```

---

## Modelos Prisma principais

| Modelo | Uso |
|--------|-----|
| `Client` | Tenant raiz — tem slug, niche, keywords |
| `User` | Autenticação — email globalmente único; clientId null = SUPER_ADMIN |
| `RefreshToken` | Hash SHA-256 do token; rotacionado a cada refresh |
| `ClientCredential` | Credenciais criptografadas AES-256-GCM por cliente |
| `Lead` | Leads capturados — monthlyFeePotential em centavos |
| `CampaignDaily` | Métricas diárias Google+Meta — spendCents/cpc/cpm em centavos |
| `ContentSuggestion` | Sugestões de pauta da IA por cliente |
| `BoostSuggestion` | Sugestões de impulsionamento — suggestedBudget em centavos |
| `JobExecution` | Log RUNNING→SUCCESS/FAILED de todos os jobs |

---

## Multi-tenancy

- Todo modelo tem `clientId` (FK para `Client`)
- `requireSameClient` no middleware garante isolamento — SUPER_ADMIN bypassa
- Credentials e leads montados ANTES de `/clients` em server.js (Express routing order)
- `mergeParams: true` nos routers de credentials e leads herda `:clientId` do path pai

---

## Autenticação

JWT via Bearer header (access token 15min) + httpOnly cookie (refresh token 7d, rotacionado).
Token armazenado em `localStorage` no frontend. Middleware `requireAuth` em `backend/src/middleware/auth.js`.

---

## Documentação de features

- **Estado do produto** (módulos implementados, roadmap, troubleshooting): `docs/ESTADO_PRODUTO.md`
- **Backend Fase 1** (schema, auth, credentials, leads): `docs/BACKEND_FASE1.md`
- **Campanhas** (GET /clients/:id/campaigns, CampaignsPage, acesso por role): `docs/CAMPANHAS.md`

---

## Observações importantes

- `CREDENTIAL_ENCRYPTION_KEY` deve ter exatamente 64 chars hex (32 bytes). Gerar: `openssl rand -hex 32`
- `DATABASE_URL` deve começar com `postgresql://` — sem aspas ao colar no Render
- Migrations rodam automaticamente no start em produção via `prisma migrate deploy`
- Projeto não tem testes automatizados — validar manualmente antes de push
