# Addere Ads Control — Plano Total de Produto

> Documento vivo. Atualizar seções "Concluído" e "Em execução" a cada sessão.
> Baseado em: Amanda Ads Control (auditoria completa em 2026-05-31).

---

## STATUS ATUAL

| Fase | Status |
|------|--------|
| 0 — Infraestrutura | ✅ Concluída |
| 1 — Backend Foundation | ✅ Concluída |
| 2 — Job Engine Multi-tenant | ✅ Concluída |
| 3 — Frontend | ✅ Concluída |
| 4 — Produção | 🔄 Em andamento |

**Concluído:** Fases 0–3 completas.
**Em execução:** Fase 4 — configuração de produção (render.yaml criado; env vars pendentes no Render dashboard).
**Próximo passo:** Paulo preencher env vars no Render → verificar GET /health após primeiro deploy.

---

## PARTE 1 — AUDITORIA CRÍTICA DO AMANDA ADS CONTROL

### Bugs confirmados

| # | Arquivo | Problema | Impacto |
|---|---------|----------|---------|
| B1 | `server.js:552` | `parseFloat(monthlyFeePotential)` envia float ao Prisma (`Decimal`). Regra global: valores monetários em **centavos** (inteiro). | Dados inconsistentes — valor armazenado sem arredondamento garantido |
| B2 | `server.js:57-65` | `requireSiteSecret` faz `next()` se `SITE_SECRET` não estiver configurado — endpoint `/api/site/lead` fica **totalmente aberto** | Qualquer bot pode inserir leads falsos |
| B3 | `instagramScheduler.js:108` | Retorna `return` no final do step 6 (notify) antes de atualizar `JobExecution` para SUCCESS quando `actionPosts.length === 0` — `JobExecution` do step 6 fica RUNNING para sempre em ciclos sem posts INVEST/REMOVE | Poluição no log de execuções; agente aparece "rodando" indefinidamente |
| B4 | `server.js:474` | `new Date().toISOString().slice(0, 7)` para mês-padrão da meta mensal usa UTC, não BRT. Em BRT às 21h–23h de qualquer dia, retorna o mês **errado** | Meta do mês incorreta nas últimas horas de cada mês |

### Pontos fracos arquiteturais

| # | Categoria | Problema | Severidade |
|---|-----------|----------|-----------|
| A1 | **Monólito** | `server.js` com 700+ linhas — rotas, middleware, lógica de negócio, tudo junto. Impossível escalar ou testar por unidade | Alta |
| A2 | **Auth primitiva** | JWT com `{ sub: "dashboard" }` — sem usuário, sem role, sem clientId. Um token vale para tudo, para sempre (30 dias) | Alta |
| A3 | **Credenciais em ENV** | Google Ads, Meta Ads, Instagram — todos em `process.env`. Para N clientes é inviável; cada deploy serviria apenas 1 cliente | Alta (bloqueante para multi-tenant) |
| A4 | **Agente de tendências hardcoded** | Fontes (Conjur, JOTA, Migalhas, r/direito, STJ), queries YouTube e prompt Claude são fixos para Direito. Inútil para qualquer outro nicho | Alta (bloqueante para multi-tenant) |
| A5 | **Scheduler em memória** | `lastRunKey` reseta no redeploy. Catch-up compensa parcialmente, mas não é à prova de falhas | Média |
| A6 | **Sem validação de input** | Validação manual com regex e `if (!x)`. Fácil de vazar dados inválidos para o banco | Média |
| A7 | **Sem rate limiting** | Qualquer endpoint pode ser chamado ilimitadamente | Média |
| A8 | **Migrations manuais** | `render.yaml` documenta que migrations não rodam automaticamente — processo manual, propenso a erros | Média |
| A9 | **Lead.source enum fixo** | `GOOGLE_ADS, META_ADS, ORGANIC, REFERRAL, SITE, OTHER` — sem `TIKTOK`, `YOUTUBE`, `WHATSAPP`, etc. Inadequado para outros nichos | Média |
| A10 | **Frontend em um arquivo** | `App.jsx` com milhares de linhas, sem React Router, sem lazy loading, sem code splitting | Média |
| A11 | **Sem error boundary** | Um erro JS derruba o app inteiro; sem fallback de UI | Baixa |
| A12 | **Sem paginação real** | Leads e campanhas limitados por `take:200` — sem cursor, sem páginas | Baixa |
| A13 | **`estimatedLeads` como Float** | `BoostSuggestion.estimatedLeads Float?` — leads são inteiros | Baixa |
| A14 | **CORS aberto se mal configurado** | `credentials: true` sem verificar se `CORS_ORIGINS` é válido | Baixa |
| A15 | **Sem testes** | Zero testes automatizados. Qualquer regressão vai para produção | Alta (qualidade) |

### O que está BOM e deve ser preservado

- Padrão ESM (import/export)
- Prisma ORM com migrations versionadas
- Modelo `JobExecution` para auditoria de jobs
- Lógica de `catch-up` de scheduler
- Abordagem T12:00:00Z para datas
- Multi-source no agente de tendências (conceito correto, implementação hardcoded)
- Algoritmo de boost (INVEST + CPL + saldo mensal)
- Cloudflare R2 para mídia
- Resend para e-mails transacionais
- Detector de anomalias (conceito)
- `sanitizeUnicodeString` para payload Anthropic

---

## PARTE 2 — ARQUITETURA DO ADDERE ADS CONTROL

### Princípios

1. **Multi-tenant from day one** — `clientId` em todas as tabelas de dados
2. **Credenciais no banco** — criptografadas, por cliente, por plataforma
3. **Agente de tendências configurável** — fontes, queries e prompt gerados dinamicamente pelo perfil do cliente
4. **Backend modular** — um arquivo por rota, um arquivo por job
5. **Validação rigorosa** — Zod em todas as entradas de API
6. **Migrations automáticas** — `prisma migrate deploy` no start (estratégia correta para Render)
7. **Jobs por cliente** — schedulers iteram sobre clientes ativos, não rodam globalmente

### Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Backend | Node.js ESM + Express | Mantém o que funciona; familiar |
| Validação | Zod | Schema-first, TypeScript-friendly, excelente DX |
| ORM | Prisma | Mantém o que funciona |
| Banco | PostgreSQL — Neon (serverless) | Mantém o que funciona |
| Auth | JWT (access 15min + refresh 7d) | Sessões reais, não tokens de 30 dias sem revogação |
| Storage | Cloudflare R2 | Mantém; prefix por cliente |
| E-mail | Resend | Mantém |
| IA | Anthropic Claude Haiku | Mantém |
| Frontend | React + Vite + Tailwind + React Router | Adiciona Router para pages reais |
| Deploy BE | Render | Mantém |
| Deploy FE | Vercel | Mantém |

### Schema de banco — modelos novos/alterados

```
Client
  id, slug, name, status(ACTIVE/SUSPENDED/TRIAL)
  niche              — "direito", "nutrição", "arquitetura", "finanças"...
  targetAudience     — "empreendedores endividados", "mulheres 30-50"
  keywords String[]  — termos para busca de tendências
  contentTone        — "formal", "didático", "próximo", "descontraído"
  primaryColor       — hex para white-label UI
  logoUrl            — URL da logo no R2
  rssSources Json?   — array de {name, url} customizados
  timezone           — "America/Belem", "America/Sao_Paulo"...
  createdAt, updatedAt

User
  id, email, passwordHash
  clientId → Client (null = super-admin Addere)
  role: SUPER_ADMIN | ADMIN | VIEWER
  name
  createdAt, updatedAt

RefreshToken
  id, userId, token(hash), expiresAt, revokedAt?
  createdAt

ClientCredential
  id, clientId → Client
  platform: GOOGLE_ADS | META_ADS | INSTAGRAM | ANTHROPIC | RESEND
  key        — nome da credencial (ex: "access_token", "customer_id")
  value      — valor criptografado (AES-256-GCM)
  expiresAt? — para tokens com vencimento (Instagram: 60 dias)
  issuedAt?  — para cálculo de expiração
  createdAt, updatedAt

Lead                     + clientId FK
CampaignDaily            + clientId FK
InstagramPost            + clientId FK
PostAnalysis             — via InstagramPost.clientId (sem FK direta necessária)
ContentSuggestion        + clientId FK
BoostSuggestion          — via InstagramPost.clientId
ScheduledPost            + clientId FK
WeeklyReport             + clientId FK
MonthlyGoal              + clientId FK
JobExecution             + clientId FK (null = job global/sistema)

-- estimatedLeads: Float → Int (bug fix A13)
-- Lead.monthlyFeePotential: Decimal → Int (centavos, bug fix B1)
```

### Estrutura de diretórios — Backend

```
backend/
  src/
    server.js              — entry point, monta app, inicia schedulers
    middleware/
      auth.js              — requireAuth, requireRole, requireSuperAdmin
      validate.js          — validateBody(schema) usando Zod
      rateLimit.js         — express-rate-limit por rota
    routes/
      auth.js              — POST /auth/login, POST /auth/refresh, POST /auth/logout
      clients.js           — CRUD de clientes (super-admin)
      users.js             — CRUD de usuários
      credentials.js       — gerenciar credenciais por cliente
      dashboard.js         — summary, daily, campaigns, weekly-reports, monthly-goal
      leads.js             — CRUD de leads
      instagram.js         — posts, análises, agendamentos
      suggestions.js       — content + boost suggestions
      media.js             — upload R2
      jobs.js              — disparo manual de jobs
      agents.js            — status dos agentes (cockpit)
      site.js              — webhook público de leads do site
    jobs/
      engine/
        scheduler.js       — tick global, itera clientes
        catchUp.js         — catch-up por cliente na inicialização
        runner.js          — executa job com JobExecution lifecycle
      ads/
        collection.js      — coleta Google + Meta por cliente
        providers/
          googleAds.js
          metaAds.js
      instagram/
        collection.js      — coleta posts por cliente
        analysis.js        — análise Claude por cliente
        publisher.js       — publicação agendada por cliente
      content/
        suggestions.js     — sugestões baseadas em posts
        trending.js        — agente configurável por nicho
        boost.js           — sugestões de impulsionamento
      reports/
        weekly.js          — relatório semanal por cliente
      anomaly/
        detector.js        — detecção de anomalias por cliente
      sources/             — mantidos do Amanda, generalizados
        youtube.js         — aceita queries dinâmicas
        googleTrends.js    — aceita keywords dinâmicas
        reddit.js          — aceita subreddits dinâmicos
        rss.js             — aceita qualquer lista de feeds
    lib/
      prisma.js            — singleton
      crypto.js            — AES-256-GCM encrypt/decrypt para credenciais
      anthropic.js         — cliente Anthropic + sanitize
      r2.js                — upload com prefix por cliente
      resend.js            — envio de e-mail
      notify.js            — notificações admin + cliente
      businessDate.js      — mantido do Amanda
      trendingEngine.js    — monta fontes + prompt dinamicamente pelo perfil do cliente
  prisma/
    schema.prisma
    migrations/
```

### Estrutura de diretórios — Frontend

```
frontend/
  src/
    main.jsx
    App.jsx               — Router + AuthProvider
    pages/
      Login.jsx
      Dashboard.jsx       — overview de métricas
      Leads.jsx           — tabela de leads
      Content.jsx         — sugestões + agendamentos
      Weekly.jsx          — relatório semanal
      Agents.jsx          — monitoramento de agentes
      Media.jsx           — biblioteca de mídia
      Admin/
        Clients.jsx       — super-admin: lista clientes
        ClientEdit.jsx    — super-admin: editar perfil + credenciais
        Users.jsx         — super-admin: usuários
    components/
      ui/
        Toast.jsx
        Modal.jsx
        Confirm.jsx
        MoneyInput.jsx
        Badge.jsx
        Spinner.jsx
      layout/
        Sidebar.jsx
        Header.jsx
        PageContainer.jsx
      charts/
        SpendLeadsChart.jsx
        CampaignTable.jsx
    hooks/
      useAuth.js
      useClient.js
      useToast.js
    lib/
      api.js              — fetch wrapper com token + refresh
      formatters.js       — brl, pct, fmtDate, fmtDatetime
      constants.js
```

---

## PARTE 3 — ETAPAS ORDENADAS POR DEPENDÊNCIA

### FASE 0 — Infraestrutura (pré-requisito de tudo)

> Nenhuma linha de código nesta fase. Só configurações externas.
> Cada item é pré-requisito do próximo.

**0.1** Criar repositório GitHub `AddereAdsControl` (público ou privado)
- Inicializar com README
- Criar branch `main` como padrão
- Resultado: URL do repo disponível

**0.2** Criar projeto no Neon
- Acessar console.neon.tech
- Criar projeto: nome `addere-ads-control`, região `aws-sa-east-1` (São Paulo)
- Anotar: `DATABASE_URL` (pooled) e `DIRECT_URL` (direct connection)
- Resultado: duas connection strings disponíveis

**0.3** Criar serviço no Render
- PRÉ-REQUISITO: 0.1 (repo deve existir)
- Acessar render.com → New → Web Service
- Conectar ao repo `AddereAdsControl`
- Root directory: `backend`
- Build command: `npm install`
- Start command: `node src/server.js`
- Anotar: URL do serviço (ex: `addere-api.onrender.com`)
- Resultado: serviço criado (falhará no deploy até o código existir — normal)

**0.4** Criar projeto no Vercel
- PRÉ-REQUISITO: 0.1
- Importar repo no Vercel
- Root directory: `frontend`
- Framework: Vite
- Resultado: URL do projeto (ex: `addere-ads.vercel.app`)

**0.5** Criar bucket Cloudflare R2
- Acessar dash.cloudflare.com → R2
- Criar bucket: `addere-media`
- Habilitar acesso público (Public R2.dev subdomain)
- Criar API Token com permissão `Object Read & Write` para este bucket
- Anotar: Account ID, Access Key ID, Secret Access Key, Bucket Name, Public URL Base
- Resultado: 5 credenciais R2 disponíveis

**0.6** Obter/confirmar API Keys de serviços
- Anthropic: criar nova API key em console.anthropic.com (ou reutilizar)
- Resend: criar conta em resend.com, verificar domínio de envio, gerar API key
- Resultado: ANTHROPIC_API_KEY e RESEND_API_KEY disponíveis

**0.7** Definir segredos de aplicação
- Gerar `JWT_SECRET` (mínimo 64 chars aleatórios): `openssl rand -hex 32`
- Gerar `CREDENTIAL_ENCRYPTION_KEY` (AES-256 = 32 bytes): `openssl rand -hex 32`
- Anotar ambos com segurança
- Resultado: dois secrets de aplicação disponíveis

**0.8** Configurar ENV VARs no Render
- PRÉ-REQUISITO: 0.2 (Neon), 0.3 (Render), 0.5 (R2), 0.6 (APIs), 0.7 (secrets)
- Variáveis obrigatórias:
  ```
  NODE_ENV=production
  DATABASE_URL=<pooled Neon>
  DIRECT_URL=<direct Neon>
  JWT_SECRET=<gerado em 0.7>
  CREDENTIAL_ENCRYPTION_KEY=<gerado em 0.7>
  CORS_ORIGINS=https://addere-ads.vercel.app
  ANTHROPIC_API_KEY=<de 0.6>
  RESEND_API_KEY=<de 0.6>
  RESEND_FROM=noreply@<dominio-verificado>
  R2_ACCOUNT_ID=<de 0.5>
  R2_ACCESS_KEY_ID=<de 0.5>
  R2_SECRET_ACCESS_KEY=<de 0.5>
  R2_BUCKET_NAME=addere-media
  R2_PUBLIC_URL_BASE=<URL pública do bucket de 0.5>
  SUPER_ADMIN_EMAIL=paulosramalho@gmail.com
  SUPER_ADMIN_PASSWORD=<senha forte inicial>
  ```
- Resultado: Render pronto para receber o código

**0.9** Configurar ENV VARs no Vercel
- PRÉ-REQUISITO: 0.3 (URL do Render), 0.4 (Vercel criado)
  ```
  VITE_API_BASE_URL=https://addere-api.onrender.com
  ```
- Resultado: Vercel pronto para receber o frontend

---

### FASE 1 — Backend Foundation

> PRÉ-REQUISITO: Fase 0 completa (repo + Neon + secrets configurados)

**1.1** Inicializar projeto Node.js no repositório
- Criar `backend/package.json` (ESM, scripts: start, dev, prisma:*)
- Dependências: express, prisma/@prisma/client, zod, jsonwebtoken, dotenv, cors, bcryptjs, @aws-sdk/client-s3, @anthropic-ai/sdk, resend, multer, express-rate-limit
- Criar `.gitignore`, `.env.example`

**1.2** Prisma schema completo
- PRÉ-REQUISITO: 1.1
- Criar `backend/prisma/schema.prisma` com todos os modelos do Parte 2
- Rodar `prisma migrate dev --name init` localmente
- Commitar migrations

**1.3** `lib/prisma.js` — singleton do cliente

**1.4** `lib/crypto.js` — AES-256-GCM para credenciais
- `encrypt(plaintext)` → `{ iv, tag, ciphertext }` (tudo em hex)
- `decrypt({ iv, tag, ciphertext })` → plaintext
- Chave: `CREDENTIAL_ENCRYPTION_KEY` do env

**1.5** `lib/businessDate.js` — portado do Amanda, sem alterações

**1.6** `lib/anthropic.js` — portado + `createConfiguredClient(apiKey)` que aceita chave por cliente

**1.7** `lib/r2.js` — portado + `pathFor(clientId, filename)` com prefix por cliente

**1.8** `middleware/auth.js`
- `requireAuth` — verifica JWT, extrai `{ userId, clientId, role }`, coloca em `req.user`
- `requireRole(...roles)` — verifica se `req.user.role` está na lista
- `requireSuperAdmin` — atalho para `requireRole("SUPER_ADMIN")`
- `requireSameClient` — verifica `req.user.clientId === req.params.clientId`

**1.9** `middleware/validate.js`
- `validateBody(zodSchema)` — middleware que valida `req.body`, retorna 400 com mensagens Zod se inválido

**1.10** `routes/auth.js` — autenticação
- `POST /auth/login` → email + password → access token (15min) + refresh token (7d, httpOnly cookie)
- `POST /auth/refresh` → valida refresh token → novo access token
- `POST /auth/logout` → revoga refresh token
- Seed: ao subir, verificar se existe `SUPER_ADMIN_EMAIL`; se não, criar usuário SUPER_ADMIN

**1.11** `routes/clients.js` — gestão de clientes (SUPER_ADMIN)
- `GET /clients` — lista todos
- `POST /clients` — criar cliente com perfil editorial
- `GET /clients/:id` — detalhes
- `PUT /clients/:id` — editar perfil
- `PATCH /clients/:id/status` — ativar/suspender

**1.12** `routes/credentials.js` — credenciais por cliente
- `GET /clients/:id/credentials` — lista (sem valores descriptografados — só metadados)
- `PUT /clients/:id/credentials/:platform/:key` — upsert credencial (criptografa antes de salvar)
- `DELETE /clients/:id/credentials/:platform/:key`
- `POST /clients/:id/credentials/test` — testa conectividade das credenciais (chama API da plataforma)

**1.13** `routes/dashboard.js` — métricas (portado + clientId)
- Todos os endpoints filtram por `req.user.clientId`
- Fix do B4: usar `currentMonth()` com timezone BRT

**1.14** `routes/leads.js` — leads (portado + clientId + Fix B1 + Fix B2)
- Fix B1: `monthlyFeePotential` em centavos (Int)
- Fix B2: endpoint público de lead do site valida `SITE_SECRET` obrigatório

**1.15** `server.js` — monta app, registra rotas, inicia schedulers
- `GET /health` e `GET /health/db`
- Migrations automáticas no start: `prisma.migrate.deploy()` via subprocess

**1.16** Primeiro deploy funcional
- PRÉ-REQUISITO: 1.1–1.15 + Fase 0 completa
- Push para `main` → Render faz deploy
- Verificar: `GET /health` retorna 200
- Verificar: `POST /auth/login` com super-admin funciona
- Verificar: `GET /health/db` retorna `db: "reachable"`

---

### FASE 2 — Job Engine Multi-tenant

> PRÉ-REQUISITO: Fase 1 completa e em produção

**2.1** `jobs/engine/runner.js` — executa qualquer job com ciclo JobExecution
- `runJob(clientId, jobName, fn)` — cria RUNNING, chama fn, atualiza SUCCESS/FAILED
- Abstrai o padrão repetido em todos os jobs do Amanda

**2.2** `jobs/engine/scheduler.js` — tick global
- Carrega clientes ativos do banco
- Para cada cliente: verifica se é hora de rodar cada job configurado
- `lastRunKey` por clientId (não global)

**2.3** `jobs/engine/catchUp.js` — catch-up por cliente na inicialização
- Para cada cliente ativo: verifica se o job de hoje rodou
- Se não, agenda para rodar imediatamente

**2.4** `lib/trendingEngine.js` — motor configurável de tendências
- `buildSources(clientProfile)` — monta lista de feeds RSS + subreddits + YouTube queries com base em `niche`, `keywords`, `rssSources`
- `buildPrompt(clientProfile, allTitles)` — gera prompt Claude contextualizado por nicho e público-alvo
- Fontes padrão por nicho:
  - `direito`: Conjur, JOTA, Migalhas, r/direito, r/conselhojuridico, STJ/Câmara/Senado RSS
  - `nutricao`: CRN RSS, r/alimentacaosaudavel, queries YouTube ["nutrição", "dieta"]
  - `arquitetura`: AU RSS, r/arquitetura, queries YouTube ["projeto arquitetônico"]
  - `financas`: Valor Econômico RSS, r/investimentos, queries YouTube ["finanças pessoais"]
  - `generico`: Google Trends + YouTube com keywords do cliente
- Cliente pode sobrescrever com `rssSources` customizados

**2.5** `jobs/ads/collection.js` — coleta Google + Meta por cliente
- Lê credenciais do banco via `ClientCredential`
- Descriptografa na hora do uso
- Nunca loga credenciais

**2.6** `jobs/instagram/collection.js` — coleta posts por cliente

**2.7** `jobs/instagram/analysis.js` — análise Claude por cliente

**2.8** `jobs/content/suggestions.js` — sugestões baseadas em posts

**2.9** `jobs/content/trending.js` — usa `trendingEngine.js` por cliente

**2.10** `jobs/content/boost.js` — boost suggestions por cliente

**2.11** `jobs/reports/weekly.js` — relatório semanal por cliente

**2.12** `jobs/instagram/publisher.js` — publicação agendada por cliente

**2.13** `routes/jobs.js` — endpoints de disparo manual (requer auth)
- `POST /jobs/:jobName/run` — dispara job para o clientId do usuário logado
- SUPER_ADMIN pode passar `?clientId=xxx` para disparar para qualquer cliente

**2.14** `routes/agents.js` — status dos agentes
- Retorna últimas execuções de jobs para o cliente do usuário
- Inclui `nextRun` calculado no backend (não no frontend como no Amanda)

---

### FASE 3 — Frontend

> PRÉ-REQUISITO: Fase 2 completa (API estável)

**3.1** Inicializar projeto React + Vite + Tailwind
- `frontend/package.json`
- Tailwind CSS, React Router v6, Recharts (mantido)
- `lib/api.js` — fetch wrapper com auto-refresh de token e interceptor 401

**3.2** AuthProvider + ProtectedRoute
- Contexto de autenticação: `user`, `client`, `login()`, `logout()`
- Token de acesso em memória (não localStorage — mais seguro)
- Refresh token em httpOnly cookie
- `ProtectedRoute` redireciona para login se não autenticado

**3.3** Layout base: Sidebar + Header
- Sidebar com navegação por página
- Header com nome do cliente, usuário logado, botão de logout
- Responsivo: sidebar colapsável em mobile

**3.4** Componentes UI base
- `Toast.jsx` + `useToast()` — substituindo todos os `alert()` 
- `Modal.jsx` — header fixo + body rolável + footer fixo (padrão do CLAUDE.md)
- `Confirm.jsx` — confirmação destrutiva com nome do objeto
- `MoneyInput.jsx` — entrada em centavos, exibição pt-BR
- `Spinner.jsx`, `Badge.jsx`, `EmptyState.jsx`

**3.5** `pages/Login.jsx` — tela de login com email + senha

**3.6** `pages/Dashboard.jsx` — visão geral de métricas
- KPIs: gasto, leads, CPL, impressões, CTR, cliques
- Gráfico de gasto + leads por dia
- Tabela de campanhas
- Metas mensais
- Qualidade relativa (delta vs período anterior)

**3.7** `pages/Leads.jsx` — gestão de leads
- Tabela com status, fonte, data
- Filtros: status, fonte, período
- Atualizar status (modal de confirmação para WON/LOST)
- Paginação real (cursor-based)

**3.8** `pages/Content.jsx` — sugestões + agendamentos
- Lista de `ContentSuggestion` pendentes
- Agendamento de post (ScheduledPost)
- Status de publicação (DRAFT → PUBLISHED)
- Boost suggestions com valor e estimativa de leads

**3.9** `pages/Weekly.jsx` — relatório semanal
- Histórico de relatórios
- Exibição formatada de whatWorked, whatToPause, whereToScale

**3.10** `pages/Agents.jsx` — monitoramento de agentes
- Tabela de agentes com última execução, próxima, status
- Destaque de atraso (mantido do Amanda, mas calculado no backend)
- Disparo manual

**3.11** `pages/Media.jsx` — biblioteca de mídia
- Grid de arquivos no R2
- Upload de imagem/vídeo
- Seleção para usar em ScheduledPost

**3.12** `pages/Admin/Clients.jsx` — SUPER_ADMIN
- Lista de clientes com status e saúde
- Criar novo cliente
- Acesso ao painel de qualquer cliente (impersonation)

**3.13** `pages/Admin/ClientEdit.jsx` — SUPER_ADMIN
- Editar perfil editorial: nicho, público-alvo, keywords, tom
- Gerenciar credenciais por plataforma (Google Ads, Meta, Instagram)
- Testar conectividade de cada credencial

---

### FASE 4 — Produção e Polimento

> PRÉ-REQUISITO: Fase 3 completa

**4.1** Configurar auto-migrate no Render
- `startCommand: prisma migrate deploy && node src/server.js`
- Testar em staging antes

**4.2** Domínio customizado (opcional)
- Backend: `api.addere.com.br` (CNAME para Render)
- Frontend: `app.addere.com.br` (CNAME para Vercel)

**4.3** Monitoramento
- Render health check configurado
- Alerta de token por cliente (Instagram, Meta Ads)
- Dashboard de saúde: todos os clientes em uma tela (Cockpit ou próprio)

**4.4** Migração do Amanda
- Criar cliente "Amanda Ramalho" no Addere
- Inserir credenciais da Amanda via painel admin
- Migrar dados históricos do banco Amanda → Addere (script de migração)
- Validar que todos os dados estão corretos
- Descomissionar Amanda Ads Control após validação

---

## PARTE 4 — ENV VARS DE REFERÊNCIA

### Backend (Render)

```env
# Core
NODE_ENV=production
PORT=3000  # Render injeta automaticamente

# Banco
DATABASE_URL=postgresql://...?sslmode=require  # pooled (Neon)
DIRECT_URL=postgresql://...?sslmode=require    # direct (para migrations)

# Segurança
JWT_SECRET=<64+ chars>
CREDENTIAL_ENCRYPTION_KEY=<32 bytes hex = 64 chars>

# CORS
CORS_ORIGINS=https://app.addere.com.br,https://addere-ads.vercel.app

# Super-admin inicial (seed na primeira execução)
SUPER_ADMIN_EMAIL=paulosramalho@gmail.com
SUPER_ADMIN_PASSWORD=<senha forte>

# IA
ANTHROPIC_API_KEY=sk-ant-...

# E-mail
RESEND_API_KEY=re_...
RESEND_FROM=noreply@addere.com.br

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=addere-media
R2_PUBLIC_URL_BASE=https://pub-xxx.r2.dev

# Cockpit (opcional)
COCKPIT_URL=https://cockpit-agentes.onrender.com
COCKPIT_PROJECT_TOKEN=...
COCKPIT_PROJECT_SLUG=addere
```

### Frontend (Vercel)

```env
VITE_API_BASE_URL=https://api.addere.com.br
```

---

## PROGRESSO

### ✅ Concluído
- Fase 0 — Infraestrutura (repo GitHub, Neon, Render, Vercel, R2, secrets)
- Fase 1 — Backend Foundation (schema Prisma, auth JWT, rotas clients/leads/dashboard/credentials, server.js)
- Fase 2 — Job Engine Multi-tenant (runner.js, scheduler por cliente, todos os jobs portados e multi-tenant)
- Fase 3 — Frontend (Login, Dashboard, Leads, Campaigns, Content, Weekly, Agents, ClientsPage, ClientEditPage; Layout + React Router v6)
- Fase 4.1 — render.yaml criado (startCommand com migrate deploy, IG_PUBLISH_ENABLED=false, vars sync:false)

### 🔄 Em execução
- Fase 4 — Deploy de produção

### ⬜ A fazer
- **Paulo (ação manual):** preencher env vars no Render dashboard (checklist no session_snapshot.md)
- **Paulo (ação manual):** confirmar env var `VITE_API_URL` no Vercel apontando para o backend Render  
  *(atenção: o código usa `VITE_API_URL`, não `VITE_API_BASE_URL` como está neste plano — ajustar no Vercel)*
- Verificar deploy: `GET /health` retorna 200 após primeiro push
- Fase 4.2 — Domínio customizado (opcional)
- Fase 4.3 — Monitoramento (alertas de token por cliente)
- Fase 4.4 — Migração do Amanda (criar cliente, migrar dados históricos, descomissionar Amanda)

---

*Última atualização: 2026-06-01*
*Autor do plano: Paulo Soares Ramalho + Claude (Addere)*
