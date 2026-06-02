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

- 3 KPIs: total de leads · dias de campanha · sugestões de conteúdo
- Tabela de leads recentes com status colorido
- Endpoint: `GET /dashboard/summary`

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

### 5. Conteúdo — Sugestões e Boost

**Arquivos:** `routes/suggestions.js`, `jobs/content/trending.js`, `jobs/content/suggestions.js`, `jobs/content/boost.js`, `ContentPage.jsx`

Página única com duas seções:

#### 5a. Sugestões de Pauta (`ContentSuggestion`)

- Job `trending-suggestions` varre 7 fontes em paralelo → Claude Haiku → 7 sugestões
- Fontes: Conjur · JOTA · Migalhas · YouTube BR · Google Trends BR · Reddit BR · Instituições BR (STJ/Câmara/Senado)
- Cada sugestão tem: título · hook · formato (REEL/CAROUSEL/POST/STORIES) · fontes · reasoning
- Workflow de aprovação: `PENDING → APPROVED → DONE | REJECTED`
- Botão "Gerar novas" dispara o job manualmente

#### 5b. Sugestões de Boost (`BoostSuggestion`)

- Job `boost-suggestions` cruza posts orgânicos com tração + análise INVEST + saldo mensal + CPL histórico
- Sugere valor de budget + leads estimados por post
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

## À Implementar

Funcionalidades presentes no Amanda Ads Control e/ou com modelo de dados já no schema, que agregam valor ao produto.

---

### A. Posts Orgânicos — página dedicada

**Prioridade: alta**

O modelo `InstagramPost` e `PostAnalysis` já estão populados pelo job `instagram-collection` + `post-analysis`. Não há página no frontend para visualizá-los.

**O que implementar:**
- Página `PostsPage.jsx` com tabela de posts: thumbnail (via permalink) · caption truncada · tipo (REEL/CAROUSEL/IMAGE) · likes · comentários · reach · impressões
- Badge de análise IA: `INVEST` (score ≥ 7) · `MANTER` · `REDIRECIONAR` · `REMOVER`
- Filtro por tipo e por status de análise
- Botão "Analisar posts" dispara `post-analysis` manualmente
- Expandir linha mostra strengths, improvements e reasoning completo

**Dependências:** nenhuma — dados já existem no banco após primeiro job.

---

### B. Calendário Editorial

**Prioridade: alta**

O modelo `ScheduledPost` e o job `publish-scheduled` (com gate `IG_PUBLISH_ENABLED`) já existem. Falta a UI.

**O que implementar:**
- Componente de calendário mensal (`CalendarPage.jsx` ou aba dentro de Conteúdo)
- Cada dia mostra badges dos posts agendados naquele dia
- Clique abre modal com: caption · formato · mídia(s) · status · ação (cancelar/republicar)
- Botão "Agendar post" em sugestões aprovadas → abre `SchedulePostModal` para definir data, hora, mídia
- Indicador de status: DRAFT · SCHEDULED · PUBLISHING · PUBLISHED · FAILED · CANCELLED
- Gate: ao tentar publicar, verificar `IG_PUBLISH_ENABLED` — exibir aviso se desabilitado

**Dependências:** upload de mídia (R2/S3 já configurado em `lib/r2.js`) deve estar funcional.

---

### C. Reorganização da página de Conteúdo em abas

**Prioridade: média**

A página atual (`ContentPage.jsx`) mistura Sugestões de Pauta + Boost em uma única tela com filtro de status. Conforme o produto cresce (posts orgânicos + calendário), fica sobrecarregada.

**O que implementar:**
- Navegação por abas dentro da rota `/content`:
  - **Sugestões** — lista atual de `ContentSuggestion`
  - **Posts** — posts orgânicos (item A acima)
  - **Calendário** — calendário editorial (item B acima)
  - **Impulsionar** — lista atual de `BoostSuggestion`
- Cada aba preserva o filtro de status independentemente

---

### D. Dashboard expandido — gráficos e metas

**Prioridade: média**

O dashboard atual mostra apenas 3 KPIs numéricos. O modelo `MonthlyGoal` existe mas não tem UI.

**O que implementar:**
- Gráfico de linha: gasto diário de anúncios (últimos 30 dias) — dados já disponíveis em `CampaignDaily`
- Card de meta mensal: leadsGoal vs leads reais · budgetCents vs gasto real (percentual de atingimento)
- Formulário de meta mensal (SUPER_ADMIN/ADMIN): criar/editar `MonthlyGoal` para o mês corrente
- Mini-ranking de campanhas por conversão na home

**Dependências:** biblioteca de gráficos — sugestão: `recharts` (leve, sem dependências pesadas).

---

### E. Notificações por e-mail por cliente

**Prioridade: baixa**

O job `instagram-notify` envia e-mail diário, mas com destinatário fixo por cliente (configurado em credencial). Não há UI para o cliente configurar preferências de notificação.

**O que implementar:**
- Campo de e-mail de notificação no `ClientEditPage` (ou seção de Preferências)
- Toggle: receber resumo diário · alerta de token expirando · alerta de campanha com custo acima do normal
- Salvar em `ClientCredential` (platform `RESEND`, key `notify_emails`)

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
