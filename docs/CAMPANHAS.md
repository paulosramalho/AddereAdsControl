# Página de Campanhas

Visualização agregada de métricas de anúncios (Google Ads + Meta Ads) por campanha, com filtro de período.

## Por que existe

SUPER_ADMIN e clientes (ADMIN) precisam ver desempenho por campanha sem precisar acessar os painéis do Google/Meta. Os dados vêm do modelo `CampaignDaily` populado pelo job de coleta.

## Pré-requisitos

- Credenciais do Google Ads e/ou Meta Ads configuradas por cliente (tabela `ClientCredential`)
- Job `adsCollectionJob` rodando (popula `CampaignDaily`)
- Enquanto não há dados, a página exibe empty state orientando a configurar credenciais

## Fluxo end-to-end

```
Frontend → GET /clients/:clientId/campaigns?days=N
         → backend agrupa CampaignDaily por [campaignId, campaignName, platform]
         → retorna { period, totals, campaigns[], daily[] }
         → CampaignsPage renderiza cards + tabela
```

## Modelo de dados

`CampaignDaily` — campos usados:
- `clientId`, `date`, `platform` (GOOGLE_ADS | META_ADS)
- `campaignId`, `campaignName`
- `impressions`, `clicks`, `spendCents` (Int, centavos), `conversions`, `ctr` (Float)

## Endpoint

`GET /clients/:clientId/campaigns?days=N`

- Autenticação: JWT Bearer + `requireSameClient`
- Query param `days`: 1–365, padrão 30
- Retorno:
```json
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "days": 30 },
  "totals": { "impressions": 0, "clicks": 0, "spendCents": 0, "conversions": 0 },
  "campaigns": [{ "campaignId", "campaignName", "platform", "impressions", "clicks", "spendCents", "conversions", "ctr" }],
  "daily": [{ "date", "spendCents", "impressions", "clicks" }]
}
```

## UI

- `frontend/src/pages/CampaignsPage.jsx`
- 4 cards de totais (gasto, impressões, cliques, conversões)
- Filtro de período: 7 / 14 / 30 / 90 dias
- Tabela: Campanha · Plataforma (badge) · Impressões · Cliques · Gasto · Conversões · CTR · CPC
- CPC calculado no frontend: `spendCents / clicks` (evita divisão por zero)
- CTR vem da média do banco (`_avg.ctr`)

## Acesso por role

| Role | Como acessa |
|------|-------------|
| ADMIN | Nav lateral → "Campanhas" → `/campaigns` |
| SUPER_ADMIN | Clientes → card do cliente → botão "Campanhas" → `/clients/:clientId/campaigns` |

## Troubleshooting

| Sintoma | Causa | Solução |
|---------|-------|---------|
| Empty state sempre | Nenhum `CampaignDaily` no banco | Configurar credenciais e rodar job de coleta |
| 401 na API | Token expirado ou clientId errado | Fazer logout e login novamente |
| CTR zerado | Coleta não gravou o campo `ctr` | Verificar `adsCollectionJob` — campo pode ser `null` no provider |
