# Publicação Instagram — Cláudia Ramalho Crochê

Data de referência: 18/07/2026

Este documento aplica o manual geral [ONBOARDING_PUBLICACAO_INSTAGRAM.md](ONBOARDING_PUBLICACAO_INSTAGRAM.md) ao cliente `claudia-ramalho-croche`.

## Identificação

| Campo | Valor |
|---|---|
| Cliente Addere | `claudia-ramalho-croche` |
| Nome no sistema | Cláudia Maia Ramalho |
| Instagram | `@claudiaramalhocroche` |
| Nicho | Crochê |
| Público-alvo | Adultos de 25 em diante |
| Keywords | crochê, linhas, argolas, correntes |
| Tom | Estilo de vida |
| Admin cliente | Amanda Maia Ramalho — `amanda.ramalho15@gmail.com` |

## O que já foi feito

- Cliente criado no Addere Ads Control.
- Cliente está `ACTIVE`.
- Plano está `COMPLETO`, liberando `settings`, `calendar`, `publish`, `boost` e módulos de conteúdo.
- Amanda Maia Ramalho está criada como `ADMIN`.
- R2 está configurado no ambiente consultado, permitindo upload e biblioteca de mídia.
- `render.yaml` declara `IG_PUBLISH_ENABLED=true` para produção.
- `.env` local está com publicação desligada, evitando publicação acidental em teste local.
- Painel `Configurações > Prontidão de publicação` foi implementado no produto.
- Endpoint `GET /clients/:clientId/settings/publishing-readiness` foi implementado.
- Manual geral de onboarding foi criado em `docs/ONBOARDING_PUBLICACAO_INSTAGRAM.md`.

## Estado atual

Ainda não há credenciais Instagram no vault da cliente:

- `INSTAGRAM.access_token`: pendente
- `INSTAGRAM.user_id`: pendente

Também ainda não há posts coletados, sugestões ou agendamentos para esta cliente.

## O que falta fazer

1. Confirmar se `@claudiaramalhocroche` já é conta profissional.
2. Se necessário, converter para conta profissional, preferencialmente `Business`.
3. Confirmar que o perfil está público.
4. Criar ou validar uma Página Facebook para a marca.
5. Vincular a conta Instagram profissional à Página.
6. Garantir que a pessoa operacional tenha permissão/admin na Página.
7. Gerar token no app Meta correto da Addere.
8. Obter o `Page Access Token` e o `instagram_business_account.id`.
9. Salvar os dois valores no vault da cliente.
10. Conferir o painel de prontidão.
11. Fazer primeira publicação de teste.
12. Rodar coleta de Instagram após publicação.

## Roteiro guiado da chamada

Regra: não pedir senha pelo chat. O ideal é a cliente/Amanda compartilhar tela e fazer login no próprio navegador/celular.

### 1. Instagram

No celular logado em `@claudiaramalhocroche`:

1. Abrir o perfil.
2. Confirmar se aparece painel/ferramentas profissionais.
3. Se não aparecer, ir em configurações da conta e alternar para conta profissional.
4. Escolher `Business`, pois dá o caminho mais completo para publicação, Stories, contato e loja futura.
5. Selecionar categoria ligada a artesanato/crochê.
6. Confirmar que a conta está pública.
7. Revisar nome, bio, foto, link e contato.

Resultado esperado: Instagram profissional público.

### 2. Página Facebook

No Facebook/Meta Business Suite:

1. Confirmar se já existe Página oficial.
2. Se não existir, criar Página com nome próximo de `Cláudia Ramalho Crochê`.
3. Vincular o Instagram `@claudiaramalhocroche` à Página.
4. Confirmar que a pessoa operacional tem acesso/admin.
5. Se a Addere for operar, adicionar acesso delegado da Addere pelo Business Suite.

Resultado esperado: Página aparece no Business Suite com Instagram vinculado.

### 3. Token Meta

Usar o app Meta correto da Addere e gerar token com:

- `pages_show_list`
- `pages_read_engagement`
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_insights`, se for coletar métricas
- `instagram_manage_comments`, se for usar primeiro comentário/gestão de comentários

Consultar:

```http
GET https://graph.facebook.com/v22.0/me/accounts?fields=name,id,access_token,tasks,instagram_business_account&access_token=<USER_ACCESS_TOKEN>
```

Da Página correta, coletar:

- `access_token` da Página
- `instagram_business_account.id`

Não registrar o token neste documento.

### 4. Validação antes do vault

Validar a conta:

```http
GET https://graph.facebook.com/v22.0/<IG_USER_ID>?fields=id,username,name,account_type,media_count&access_token=<PAGE_ACCESS_TOKEN>
```

Validar permissão de publicação:

```http
GET https://graph.facebook.com/v22.0/<IG_USER_ID>/content_publishing_limit?access_token=<PAGE_ACCESS_TOKEN>
```

Se `content_publishing_limit` falhar, parar e corrigir permissões antes de salvar/agendar.

### 5. Vault no Addere

No Addere Ads Control:

1. Entrar com a Amanda ou com `SUPER_ADMIN`.
2. Se o plano foi alterado recentemente, sair e entrar novamente.
3. Ir em `Configurações > Instagram`.
4. Salvar `Access Token` com o Page Access Token.
5. Salvar `User ID` com o `instagram_business_account.id`.
6. Clicar em `Verificar token`.
7. Atualizar `Prontidão de publicação`.

Resultado esperado: todos os checks aprovados.

### 6. Primeira publicação

Usar um post simples e real:

1. Imagem JPEG/PNG de uma peça pronta de crochê.
2. Formato sugerido: `1080x1080` ou `1080x1350`.
3. Legenda curta, sem marcações no primeiro teste.
4. Agendar para 10 a 15 minutos no futuro.
5. Fazer upload pelo Addere para usar URL R2.
6. Salvar como `Agendado`.
7. Aguardar o scheduler ou rodar `publish-scheduled` em `Agentes`.
8. Confirmar status `Publicado`.
9. Abrir o link no Instagram.
10. Rodar `instagram-collection` para trazer métricas.

## Dados a registrar após a chamada

Não registrar tokens. Registrar apenas metadados operacionais:

| Campo | Valor |
|---|---|
| Página Facebook usada | Pendente |
| Page ID | Pendente |
| IG User ID | Pendente |
| Tipo da conta IG | Pendente |
| Token salvo no vault | Pendente |
| Prontidão 100% aprovada | Pendente |
| Primeiro post publicado | Pendente |
| Link do primeiro post | Pendente |

## Critério de pronto

A cliente só estará pronta quando:

- A conta Instagram estiver profissional, pública e vinculada à Página.
- O vault tiver `INSTAGRAM.access_token` e `INSTAGRAM.user_id`.
- O painel de prontidão estiver 100% aprovado.
- Um post de teste tiver sido publicado com sucesso pelo Addere Ads Control.
- A coleta pós-publicação tiver sido executada ao menos uma vez.

## Direção editorial inicial

Para a entrada da Cláudia no controle, começar com conteúdo simples, visual e seguro:

- 3 posts de portfólio: peça pronta, detalhe do ponto, aplicação no ambiente/uso.
- 2 Reels curtos: processo acelerado, textura da linha e finalização.
- 1 carrossel educativo: cuidados com peças de crochê ou escolha de cores.
- 1 Story de bastidor, se a conta for `Business` e o token validar Story.

Tom recomendado: acolhedor, artesanal, visual e de estilo de vida, sem promessa agressiva de venda no primeiro ciclo.

## Troubleshooting rápido

| Sintoma | Causa provável | Ação |
|---|---|---|
| Página não aparece em `/me/accounts` | usuário sem acesso/admin | ajustar acesso no Business Suite |
| `instagram_business_account` não aparece | Instagram não vinculado à Página | refazer vínculo Página/Instagram |
| Token verifica, mas prontidão não fecha | falta permissão de publicação | revisar `instagram_content_publish` e app review |
| Upload falha | R2 ou mídia inválida | validar R2 e formato do arquivo |
| Agendamento não publica | publisher desligado no ambiente | confirmar `IG_PUBLISH_ENABLED=true` em produção |
| Post falha na Meta | mídia, token ou permissão | abrir erro no modal, corrigir e reagendar |
