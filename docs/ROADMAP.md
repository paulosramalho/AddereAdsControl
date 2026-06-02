# Roadmap de Implementação — Addere Ads Control

Sequência de desenvolvimento definida em 02/06/2026.
**Ao retomar:** implementar na ordem abaixo, um item por sessão.

---

## Sequência

### Fase 1 — Posts Orgânicos `[x]`

**Por que primeiro:** dados já existem no banco (`InstagramPost` + `PostAnalysis`) após o job `instagram-collection` + `post-analysis` rodarem. Zero mudança de backend — apenas frontend. Máximo valor com mínimo esforço. Valida o pipeline de IA para o cliente.

**O que fazer:**
1. Criar `frontend/src/pages/PostsPage.jsx`
   - Tabela: caption truncada · tipo (REEL/CAROUSEL/IMAGE) · likes · comentários · reach · impressões · data
   - Badge de análise IA por linha: `INVEST` (score ≥ 7) · `MANTER` · `REDIRECIONAR` · `REMOVER`
   - Expandir linha → strengths, improvements, reasoning completo
   - Filtros: tipo de mídia · status de análise
   - Botão "Analisar posts" → dispara `post-analysis` (padrão AgentsPage: fire-and-forget + polling)
2. Criar `GET /clients/:clientId/posts` em `backend/src/routes/posts.js`
   - Retorna `InstagramPost` com `analysis` incluído (Prisma `include`)
   - Params: `limit`, `offset`, filtros de tipo e score
3. Registrar rota em `server.js`
4. Adicionar item "Posts" na nav lateral (`App.jsx` ou componente de sidebar)

**Dependências:** nenhuma — dados já populados após primeiro job.

---

### Fase 2 — Dashboard Expandido `[x]`

**Por que segundo:** `MonthlyGoal` já está no schema mas sem UI. Gráfico de gasto diário usa `CampaignDaily` que já existe. Self-contained — não interfere em outras páginas.

**O que fazer:**
1. Instalar `recharts` no frontend
2. Expandir `DashboardPage.jsx`:
   - Gráfico de linha: gasto diário (últimos 30 dias) via `CampaignDaily`
   - Card de meta mensal: leadsGoal vs leads reais + budgetCents vs gasto real (% atingimento)
   - Mini-ranking top 3 campanhas por conversão
3. Criar `GET /clients/:clientId/goals/current` e `PUT /clients/:clientId/goals/:month` em nova rota `goals.js`
4. Modal de edição de meta mensal (SUPER_ADMIN + ADMIN): leads, budget, notas

**Dependências:** dados de `CampaignDaily` — garante que `ads-collection` já rodou ao menos uma vez.

---

### Fase 3 — Conteúdo em Abas `[x]`

**Por que terceiro:** refactor natural depois que Posts existe. Reorganiza `ContentPage.jsx` em abas sem criar nova lógica — apenas move o que já existe e adiciona a aba de Posts.

**O que fazer:**
1. Refatorar `ContentPage.jsx` em 4 abas com navegação interna:
   - **Sugestões** — lista `ContentSuggestion` (código atual, sem mudança)
   - **Posts** — embute `PostsPage` como componente (não rota separada)
   - **Calendário** — placeholder "Em breve" até Fase 4
   - **Impulsionar** — lista `BoostSuggestion` (código atual)
2. Cada aba preserva filtro de status independente
3. URL reflete aba ativa: `/content?tab=suggestions` (via `URLSearchParams`)
4. Remover rota `/posts` separada se foi criada — consolidar tudo em `/content`

**Dependências:** Fase 1 concluída (componente de Posts disponível).

---

### Fase 4 — Calendário Editorial `[x]`

**Por que quarto:** modelo `ScheduledPost` e job `publish-scheduled` já existem no schema. Upload de mídia via R2 já implementado em Amanda Ads Control (`lib/r2.js` + endpoint multer) — portar com prefixo multi-tenant. Esforço real é médio, não alto.

**Referência de implementação:** `C:\Amanda\backend\src\lib\r2.js` e linhas ~1019–1070 de `C:\Amanda\backend\src\server.js` (endpoint `POST /api/media/upload` + multer config).

**O que fazer:**
1. Portar endpoint de upload para Addere com isolamento por cliente:
   - `POST /clients/:clientId/media/upload` em nova rota `routes/media.js`
   - Multer em memória (mesmo padrão Amanda) → `uploadBuffer()` → retorna URL pública R2
   - Prefixo de key: `clients/{clientSlug}/{ano-mes}/{uuid}.{ext}` (isolamento por tenant)
2. Componente de calendário mensal (`CalendarGrid.jsx`):
   - Grade de dias com badges de posts agendados por dia
   - Clique no badge → modal de detalhes (caption, formato, status, ações: cancelar/reeditar)
   - Status coloridos: DRAFT · SCHEDULED · PUBLISHING · PUBLISHED · FAILED · CANCELLED
3. Botão "Agendar" nas sugestões aprovadas (`status === "APPROVED"`):
   - Abre `SchedulePostModal`: data, hora, formato, upload de mídia (drag-and-drop ou file picker)
   - Cria `ScheduledPost` vinculado à `ContentSuggestion`
4. Backend: `routes/scheduledPosts.js` com 5 rotas (listar por período, criar, detalhe, atualizar, cancelar)
5. Gate de segurança: exibir aviso se `IG_PUBLISH_ENABLED=false` mas não bloquear agendamento

**Dependências:** Fase 3 (aba Calendário como placeholder). `R2_*` env vars configuradas no Render.

---

### Fase 5 — Notificações Configuráveis `[x]`

**Por que último:** menor impacto imediato. Additive — não quebra nada existente.

**O que fazer:**
1. Seção "Preferências de Notificação" em `ClientEditPage.jsx`:
   - Campo de e-mails (separados por vírgula)
   - Toggles: resumo diário · alerta de token expirando · alerta de campanha acima do budget
2. Salvar em `ClientCredential` (platform `RESEND`, key `notify_emails`)
3. `instagram-notify` lê a credencial em vez de variável de ambiente
4. Adicionar alerta: se gasto diário > X% do budget mensal → e-mail de aviso

**Dependências:** Fases 1–4 concluídas. Resend configurado.

---

## Resumo

| # | Feature | Esforço | Backend | Frontend |
|---|---------|---------|---------|---------|
| 1 | Posts Orgânicos | Baixo | 1 rota nova | 1 página nova |
| 2 | Dashboard Expandido | Médio | 1 rota nova | Expandir página existente |
| 3 | Conteúdo em Abas | Baixo | — | Refactor de 1 página |
| 4 | Calendário Editorial | Médio | 2 rotas novas + upload (portar de Amanda) | 1 componente complexo |
| 5 | Notificações Configuráveis | Baixo | Ajuste em 1 job | Seção em página existente |

---

## Como retomar

Diga: **"Continuar roadmap"** — implemente a próxima fase `[ ]` sem perguntar.
Ao concluir cada fase, marcar como `[x]` e commitar.
