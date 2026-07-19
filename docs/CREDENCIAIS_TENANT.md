# Credenciais por Tenant — Padrão de Provisionamento

## Por que existe

Cada tenant (Client) tem suas próprias credenciais de IA e e-mail no vault `ClientCredential`
(AES-256-GCM via `backend/src/lib/crypto.js`). Motivos:

- **Custo rastreável**: chave Anthropic dedicada por cliente permite ver o gasto de IA de cada um no console.
- **Revogação isolada**: revogar a chave de um tenant não afeta os demais.
- **Entregabilidade de e-mail**: sem `from_email` próprio, o `notify.js` cai no fallback
  `onboarding@resend.dev`, que **só entrega ao dono da conta Resend** — alertas nunca chegam ao cliente.

Fallback geral: credencial do tenant → env global (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`).

## Kit completo por tenant

| Platform | Key | Valor / convenção |
|----------|-----|-------------------|
| ANTHROPIC | `api_key` | Chave dedicada no console Anthropic, nome `addere-<slug>` |
| ANTHROPIC | `youtube_api_key` | Opcional (jobs de pauta) |
| RESEND | `api_key` | Chave dedicada, nome `addere-<slug>`, permissão `sending_access` restrita ao domínio `addereon.com.br` |
| RESEND | `from_email` | `adscontrol@addereon.com.br` (remetente oficial — confirmado 19/07/2026) |
| RESEND | `notify_emails` | E-mails extras separados por vírgula (`""` = só usuários ativos do tenant) |
| RESEND | `notify_daily_summary` | `"true"` / `"false"` |
| RESEND | `notify_token_alert` | `"true"` / `"false"` |
| RESEND | `notify_budget_alert` | `"true"` / `"false"` |
| INSTAGRAM | `access_token` | Token de Página (ver `docs/PUBLICACAO_INSTAGRAM_CLAUDIA.md`) — **preencher `issuedAt`** e, se for token estendido de 60 dias, `expiresAt` |
| INSTAGRAM | `user_id` | IG Business Account ID |

Destinatários de notificação = usuários **ativos** do tenant + `notify_emails`.
O alerta de idade de token lê `issuedAt` de `INSTAGRAM/access_token` — **sem `issuedAt` o alerta fica mudo**
(`getTokenDaysUsed` em `backend/src/jobs/instagram/notify.js`).

## Como provisionar um tenant novo

1. **Anthropic**: console.anthropic.com → API Keys → criar `addere-<slug>` → colar na UI
   (Clientes → editar → ANTHROPIC/api_key) ou via `PUT /clients/:clientId/credentials/ANTHROPIC/api_key`.
2. **Resend**: criar chave `addere-<slug>` com `sending_access` restrita a `addereon.com.br`
   (única domain verificada; ID `36403c2f-c909-4d8d-879e-073b4fb7189f`). Gravar `api_key` + `from_email`.
3. **Notify**: gravar os 4 `notify_*` explícitos (padrão: alertas `"true"`, `notify_emails` `""`).
4. **Instagram**: token de Página via "Login do Facebook" (não "Login do Instagram") — gravar
   `access_token` **com `issuedAt`** (e `expiresAt` se aplicável, epochs do Access Token Debugger) + `user_id`.

### Gravação por script local (alternativa à UI)

`CREDENTIAL_ENCRYPTION_KEY` do `backend/.env` local = a de produção (validar decifrando uma
credencial existente antes de gravar). Rodar de `backend/`:

```bash
node --env-file=.env script.mjs
```

No script, importar via URL: `await import("file:///C:/AddereAdsControl/backend/src/lib/prisma.js")`
e usar upsert em `clientId_platform_key` com `encrypt()` de `lib/crypto.js` — mesmo padrão de
`routes/credentials.js`.

## Estado dos tenants (19/07/2026)

| Tenant | Anthropic | Resend | notify_* | IG issuedAt |
|--------|-----------|--------|----------|-------------|
| claudia-ramalho-croche | dedicada | dedicada | explícitos | 19/07/2026 · expira 17/09/2026 (60d) |
| paulo-ramalho | dedicada | dedicada | explícitos | 30/06/2026 |
| amanda-ramalho | dedicada | dedicada | explícitos | 02/06/2026 (estimativa) — **token EXPIRADO, regenerar** |

## Troubleshooting

- **E-mail não chega ao cliente** → falta `from_email` no tenant (fallback `onboarding@resend.dev` só entrega ao dono da conta).
- **Alerta de idade de token nunca dispara** → `issuedAt` nulo em `INSTAGRAM/access_token`.
- **Erro de decrypt ao ler credencial** → `CREDENTIAL_ENCRYPTION_KEY` divergente entre local e Render (64 chars hex).
- **Key inexistente lida como `undefined`** → só as keys listadas acima são consumidas; keys fora do padrão
  (ex.: `RESEND/from`) são ignoradas pelo código — não criar variantes de nome.
