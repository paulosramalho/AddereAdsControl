# Addere Ads Control — Estado do Produto

Referência operacional: o que está implementado, como funciona end-to-end, e o que está planejado.

---

## Arquitetura geral

Multi-tenant SaaS de marketing digital. Um SUPER_ADMIN (Addere) gerencia N clientes. Cada cliente tem credentials próprias (criptografadas), jobs de IA independentes e dados isolados.

```
Frontend (React + Vite + Tailwind) → Vercel
Backend  (Node.js ESM + Express + Prisma) → Render
Banco    (PostgreSQL — Neon serverless)
IA       (Anthropic Claude Haiku 4.5)
```

---

## Módulos implementados

### 1. Autenticação e multi-tenant

**Arquivos:** `routes/auth.js`, `middleware/auth.js`, `lib/crypto.js`

- Login via `POST /auth/login` → JWT (15 min) + refresh token httpOnly cookie (7 dias, rotacionado)
- Roles: `SUPER_ADMIN` (Addere) · `ADMIN` (cliente) · `VIEWER`
- Credenciais externas (Google Ads, Meta Ads, Instagram, Anthropic) armazenadas criptografadas por cliente (AES-256-GCM) em `ClientCredential`
- SUPER_ADMIN acessa dados de qualquer cliente; ADMIN só vê o próprio tenant

**UI:** `LoginPage.jsx` — tela única, sem cadastro público

---

### 2. Dashboard

**Arquivos:** `routes/dashboard.js`, `DashboardPage.jsx`

- KPIs: total de leads · dias de campanha · sugestões de conteúdo · leads do mês · gasto do mês
- Gráfico de linha: gasto diário dos últimos 30 dias (Recharts)
- Mini-ranking: top 3 campanhas por conversão no mês
- Card de meta mensal: leadsGoal vs real · budgetCents vs gasto real (barra de progresso)
- Formulário de meta mensal (ADMIN/SUPER_ADMIN) — cria/edita `MonthlyGoal`
- Seletor de cliente para SUPER_ADMIN — visualizar dashboard de qualquer tenant via `?clientId=`
- Endpoint: `GET /dashboard/summary[?clientId=]`

---

### 3. Leads

**Arquivos:** `routes/leads.js`, `LeadsPage.jsx`

- CRUD completo (criar, editar, excluir, mudar status)
- Status funnel: `NEW → CONTACTED → QUALIFIED → CONVERTED | LOST`
- Origens: SITE · INSTAGRAM · WHATSAPP · REFERRAL · OTHER
- Campo `monthlyFeePotential` em centavos (honorário potencial mensal)

---

### 4. Campanhas

**Arquivos:** `routes/campaigns.js`, `jobs/ads/collection.js`, `CampaignsPage.jsx`

- Métricas diárias de Google Ads e Meta Ads por campanha
- Filtro de período: 7 / 14 / 30 / 90 dias
- Cards: gasto total · impressões · cliques · conversões
- Tabela: campanha · plataforma · CTR · CPC calculado no frontend
- Job `ads-collection` popula `CampaignDaily` via providers `googleAds.js` + `metaAds.js`

**Doc completo:** `docs/CAMPANHAS.md`

---

### 5. Conteúdo — página em abas

**Arquivos:** `routes/suggestions.js`, `routes/posts.js`, `jobs/content/trending.js`, `jobs/content/suggestions.js`, `jobs/content/boost.js`, `ContentPage.jsx`, `CalendarGrid.jsx`

Página `/content` organizada em 4 abas:

#### Aba Sugestões (`ContentSuggestion`)

- Job `trending-suggestions` varre fontes em paralelo → Claude Haiku → 7 sugestões
- Fontes por nicho: RSS (Conjur/JOTA/Migalhas + 17 nichos), Reddit, YouTube BR
- `trendingEngine.js`: personaliza por `client.niche`, `client.keywords`, `client.targetAudience`, `client.contentTone`
- `NICHE_DEFAULTS` cobre 17 nichos: direito, nutricao, arquitetura, financas, contabilidade, saude, psicologia, tecnologia, marketing, educacao, fitness, imoveis, beleza, gastronomia, moda, veterinaria, odontologia
- Workflow: `PENDING → APPROVED → DONE | REJECTED`
- Botão "Gerar novas" dispara job manualmente

#### Aba Posts (`InstagramPost` + `PostAnalysis`)

- Tabela de posts coletados via `instagram-collection`: thumbnail · caption · tipo · likes · comentários · reach
- Badge IA: `INVEST` (score ≥ 7) · `MANTER` · `REDIRECIONAR` · `REMOVER`
- Expandir linha: strengths, improvements e reasoning do Claude
- Filtros por tipo de post e por recomendação de análise
- Botão "Analisar posts" dispara `post-analysis` manualmente

#### Aba Calendário (`ScheduledPost`)

- Calendário mensal (`CalendarGrid.jsx`) — badges de posts agendados por dia
- Status: `DRAFT · SCHEDULED · PUBLISHING · PUBLISHED · FAILED · CANCELLED`
- Modal de agendamento: caption · formato · data · hora · mídia (upload R2)
- Modal de detalhe: ação cancelar/republicar
- Gate `IG_PUBLISH_ENABLED`: exibe aviso se publicação automática estiver desabilitada
- Job `publish-scheduled` roda a cada 5 min e publica os posts devidos

#### Aba Impulsionar (`BoostSuggestion`)

- Job `boost-suggestions`: cruza posts com tração + análise INVEST + saldo mensal + CPL histórico
- Sugere budget e leads estimados por post
- Mesmo workflow `PENDING → APPROVED → DONE | REJECTED`

---

### 6. Relatório Semanal

**Arquivos:** `routes/weekly.js`, `jobs/reports/weekly.js`, `WeeklyPage.jsx`

- Claude Haiku gera relatório consolidado toda segunda-feira às 07h BRT
- Conteúdo: resumo executivo · bullets de insights · dados brutos (impressões, cliques, leads)
- Lista em accordion — mais recente aberto por padrão
- Botão "Gerar relatório" dispara manualmente

---

### 7. Agentes (cockpit de jobs)

**Arquivos:** `routes/agents.js`, `routes/jobs.js`, `jobs/engine/runner.js`, `jobs/engine/scheduler.js`, `AgentsPage.jsx`

- Tabela por cliente: nome do job · status badge · última execução · próxima execução · botão Executar
- Botão dispara fire-and-forget (backend retorna 200 imediatamente); frontend faz polling a cada 2s
- Safety timeout de 120s limpa o botão caso polling não detecte a transição
- Jobs disponíveis:

| Job | Horário BRT | Função |
|-----|-------------|--------|
| `instagram-collection` | 01h | Coleta posts e métricas via Graph API |
| `ads-collection` | 02h | Métricas Google Ads + Meta Ads |
| `post-analysis` | 03h | Avalia posts com Claude |
| `trending-suggestions` | 04h | 7 fontes → Claude → 7 sugestões de pauta |
| `content-suggestions` | 05h | Sugestões baseadas no histórico do perfil |
| `boost-suggestions` | 06h | Sugere budget de boost por post |
| `instagram-notify` | 07h | E-mail diário com posts INVEST/REMOVE |
| `weekly-report` | 07h (seg) | Relatório semanal Claude |
| `publish-scheduled` | contínuo (5min) | Publica posts agendados no Instagram |

---

### 8. Gestão de clientes (SUPER_ADMIN)

**Arquivos:** `routes/clients.js`, `routes/credentials.js`, `ClientsPage.jsx`, `ClientEditPage.jsx`

- CRUD de clientes: nome · slug · nicho · público-alvo · keywords · tom · timezone · logo
- Status: TRIAL · ACTIVE · SUSPENDED
- Vault de credenciais por cliente: formulário por plataforma (Google Ads / Meta Ads / Instagram / Anthropic / Resend)
- Credenciais salvas criptografadas; nunca retornadas pela API

---

## Modelos de dados principais

| Modelo | Descrição |
|--------|-----------|
| `Client` | Tenant raiz — slug único, nicho, keywords, config |
| `User` | Usuário — role + clientId (null = SUPER_ADMIN) |
| `ClientCredential` | Vault criptografado por (clientId, platform, key) |
| `Lead` | Lead capturado — status funnel + honorário potencial |
| `CampaignDaily` | Métricas diárias por campanha e plataforma |
| `InstagramPost` | Posts coletados da Graph API |
| `PostAnalysis` | Análise Claude por post (score, strengths, improvements) |
| `ContentSuggestion` | Sugestão de pauta gerada por IA |
| `BoostSuggestion` | Sugestão de impulsionamento — budget + leads estimados |
| `ScheduledPost` | Post agendado para publicação automática |
| `WeeklyReport` | Relatório semanal consolidado |
| `MonthlyGoal` | Metas mensais por cliente |
| `JobExecution` | Log de cada execução de job (RUNNING → SUCCESS/FAILED) |

---

## Status do produto

Todas as fases planejadas foram implementadas. Não há backlog pendente.

---

## Variáveis de ambiente por cliente

Credenciais configuradas em `ClientEditPage` → vault → `ClientCredential`:

| Plataforma | Chave | Descrição |
|------------|-------|-----------|
| `GOOGLE_ADS` | `customer_id`, `developer_token`, `client_id`, `client_secret`, `refresh_token` | OAuth2 Google Ads |
| `META_ADS` | `access_token`, `ad_account_id` | Token Meta Ads |
| `INSTAGRAM` | `access_token`, `user_id` | Facebook User Access Token + IG Business Account ID |
| `ANTHROPIC` | `api_key` | Chave da API Claude (fallback: env global) |
| `RESEND` | `api_key`, `from`, `notify_emails` | E-mail transacional |

**Importante:** o `INSTAGRAM.access_token` é um Facebook User Access Token (prefixo `EAA`), usado com `graph.facebook.com/v22.0` — **não** com `graph.instagram.com` (Instagram Basic Display API, token diferente).

---

## Infraestrutura e deploy

| Serviço | Plataforma | Trigger |
|---------|-----------|---------|
| Backend | Render (Node 20) | Push em `main` → deploy automático |
| Frontend | Vercel | Push em `main` → deploy automático |
| Banco | Neon (PostgreSQL serverless) | Migrations automáticas no startup |

Migrations rodam via `prisma migrate deploy` no startup do `server.js`. Se falhar, processo termina com `exit(1)` — Render marca o deploy como falho.

**Startup healing:** ao iniciar, `server.js` sana registros `JobExecution` presos em `RUNNING` de deploys anteriores, marcando-os como `FAILED`.

---

## Troubleshooting

| Sintoma | Causa | Solução |
|---------|-------|---------|
| Instagram retorna code 190 | `access_token` expirado ou usando `graph.instagram.com` | Renovar token via Graph API Explorer; confirmar que o código usa `graph.facebook.com/v22.0` |
| Botão "Executar" fica "..." > 2 min | Safety timeout não disparou + job travado | Verificar JobExecution no banco; reiniciar backend se necessário |
| Job falha com "credenciais incompletas" | ClientCredential ausente para o cliente | Configurar em ClientEditPage → plataforma correspondente |
| CampaignDaily vazio | Job `ads-collection` nunca rodou ou credenciais inválidas | Rodar manualmente via AgentsPage; checar logs no Render |
| `P1013: scheme is not recognized` | `DATABASE_URL` com aspas extras | Remover aspas na env var do Render |
