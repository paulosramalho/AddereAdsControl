# Otimização Neon — scale-to-zero (AddereAdsControl)

Doc viva de tudo que afeta o **consumo de compute do Neon** neste projeto. Princípio
inarredável (global): **o menor toque possível no banco**. O Neon suspende o compute após
**5 min sem nenhuma query**; qualquer toque em intervalo `< 5 min` mantém o compute aceso
24/7 e a fatura no teto.

> Monitoramento externo: o **Neon Monitor** (`C:\Paulo\Neon\monitor`) vigia os 5 projetos
> Neon — incluindo este — via API de controle do Neon (não toca o banco). O painel mostra
> uptime/CU-h por projeto e dispara alerta quando um projeto deixa de hibernar. A
> autovalidação do monitor é justamente que **AddereAdsControl continue hibernando** no
> painel — prova de que nenhum scheduler/poll virou ofensor.

---

## Histórico de ajustes

### 2026-06-29 — Publisher de posts não acorda mais o banco a cada tick (commit `a415b62`)

**Problema:** com `IG_PUBLISH_ENABLED=true`, o gate do scheduler (`scheduler.js`) nunca
cortava o tick de 5 min → todo tick rodava `publishScheduledPosts`, que fazia
`scheduledPost.findMany` por cliente ativo **mesmo sem nenhum post pendente**. Isso é uma
query a cada 5 min → o compute do Neon nunca completa a janela de 5 min idle → aceso 24/7
(mesmo padrão que levou o AMR a ~US$ 80–91/mês).

**Correção (cache em memória do próximo vencimento):**
- `backend/src/jobs/instagram/publisher.js` mantém `_nextDueCache` (Map `clientId → ts` do
  próximo post `SCHEDULED`, ou `null` se não há nenhum).
- Guarda no topo de `publishScheduledPosts`: se já sabemos o próximo vencimento e ele ainda
  não chegou (ou não há nenhum), **retorna sem tocar o banco**.
- Quando precisa consultar, faz **1** `findMany` de todos os `SCHEDULED` ordenados, separa
  vencidos × futuros em memória e cacheia o próximo vencimento.
- `invalidatePublisherCache(clientId)` é exportada e chamada em `scheduledPosts.js`
  (create / put / delete) para refrescar o cache quando o agendamento muda.
- Tudo no mesmo processo Node do scheduler → cache compartilhado, zero query extra.

**Resultado:** sem posts agendados vencendo, o publisher não emite nenhuma query — o banco
volta a hibernar. A lista de clientes ativos já tinha cache de 30 min.

---

## Checklist ao mexer em consumo (health / poll / scheduler / sessão)

1. **Health** novo/alterado toca o banco? → tornar opt-in `?db=1` (liveness puro por padrão).
2. **Poll** novo no frontend? → guard `document.hidden` / lock.
3. **Scheduler** novo? → intervalo ≥ 5 min (idealmente ≥ 10 min); se residente, gate em
   memória antes de qualquer `findMany`.
4. **Enforcement/refresh de sessão**? → stateless (JWT deslizante), **nunca** tabela de
   sessão no banco.
5. Registrar aqui qualquer mudança que afete consumo.
