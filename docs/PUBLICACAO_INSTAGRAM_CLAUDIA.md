# Publicação Instagram — Cláudia Ramalho Crochê

Data de referência: 18/07/2026

Este documento aplica o manual geral [ONBOARDING_PUBLICACAO_INSTAGRAM.md](ONBOARDING_PUBLICACAO_INSTAGRAM.md) ao cliente `claudia-ramalho-croche`.

## Identificação

| Campo | Valor |
|---|---|
| Cliente Addere | `claudia-ramalho-croche` |
| Nome no sistema | Cláudia Maia Ramalho |
| Instagram | `@claudiaramalhocrochet` |
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

## Avanço do onboarding

Atualizado em 18/07/2026:

- Conta profissional confirmada.
- Conta alterada de `Criador de conteúdo` para `Comercial/Business`.
- Conta pública confirmada.
- Username correto confirmado: `@claudiaramalhocrochet`.
- Campo de Página Facebook apareceu no celular.
- Ainda não existe Página Facebook vinculada.
- Tentativa de criar Página pelo fluxo interno do Instagram não liberou o botão `Criar`.
- Nome tentado: `Cláudia Ramalho Crochê`.
- Categoria tentada: `Criador de conteúdo digital`.
- Página Facebook criada diretamente pelo Facebook.
- Nome da Página criada: `Cláudia Ramalho Crochê`.
- Categoria da Página: `Criador de conteúdo`.
- Página `Cláudia Ramalho Crochê` vinculada ao Instagram `@claudiaramalhocrochet`.
- Meta Business Suite acessado via Facebook.
- Página `Cláudia Ramalho Crochê` visível no Meta Business Suite.
- Instagram `@claudiaramalhocrochet` aparece vinculado à Página no Meta Business Suite.
- Graph API Explorer acessado.
- Apps Meta disponíveis no seletor: `Paulo Experimento` e `AMR Controles`.
- App escolhido para o onboarding: `Paulo Experimento`.
- App `Paulo Experimento` informado como válido, ativo e em uso no Addere Ads Control (`paulo-ramalho`).
- Permissões disponíveis/selecionadas: `pages_show_list`, `business_management`, `instagram_basic`, `instagram_manage_insights`, `instagram_content_publish`, `pages_read_engagement`.
- Permissão `instagram_manage_comments` não listada nesta etapa; primeiro teste deve deixar `firstComment` vazio.
- Decisão posterior: criar app Meta dedicado `AddereAdsControl` para este onboarding e futuras contas. `Paulo Experimento` fica como contingência se o app novo ainda não estiver liberado.
- Criação do app `AddereAdsControl` iniciada com caso de uso `Gerenciar Mensagens e Conteúdos no Instagram`.
- Durante criação do app, a Meta ofereceu conectar ao portfólio empresarial `Cláudia Ramalho | Crochê autoral`. Para app reutilizável do produto, não conectar ao portfólio da cliente; usar/criar portfólio empresarial da Addere.
- App `AddereAdsControl` configurado na criação com e-mail `financeiro@addereon.com.br`.
- Caso de uso selecionado: `Gerenciar mensagens e conteúdo no Instagram`.
- Empresa/portfólio empresarial: nenhuma empresa selecionada na criação, para evitar vincular o app ao portfólio da cliente.
- App Meta `AddereAdsControl` criado e painel acessado.
- App ID localizado no painel do app. Chave secreta existe e não deve ser registrada em documento/chat.
- No Graph API Explorer, ao escolher `AddereAdsControl > Usuário ou Página > Obter token de acesso do usuário`, apareceu `Nenhuma configuração disponível`.
- Próximo ajuste: configurar o caso de uso/produto de login Instagram/Facebook no painel do app para liberar geração de token de usuário.
- Tela de setup encontrada: API do Instagram com app Instagram `AddereAdsControl-IG`.
- A tela informou que, para hashtags/insights, deve ser usado `API setup with Facebook login`.
- O backend atual do Addere Ads Control usa `graph.facebook.com/v22.0`, `Page Access Token` e `instagram_business_account.id`; portanto, este onboarding deve usar o setup com Facebook Login, não o fluxo novo de Instagram Login.
- ID do app Instagram foi localizado, mas não deve ser necessário para o fluxo atual. Chave secreta não foi registrada.
- Na tela `Permissões e recursos`, foram localizadas/acionáveis: `pages_show_list`, `instagram_content_publish`, `instagram_basic`, `instagram_manage_insights`, `instagram_manage_comments`.
- Em `Casos de uso > Gerenciar mensagens e conteúdo no Instagram > Personalizar > Configuração da API com login no Facebook`, a Meta confirmou as permissões obrigatórias para gerenciar conteúdo: `instagram_basic`, `instagram_content_publishing` (nomenclatura exibida pela UI), `pages_read_engagement`, `business_management`, `pages_show_list`.
- Próximo ponto no app: `Configurar o Login do Facebook para Empresas`.
- Graph API Explorer com app `AddereAdsControl` passou a exibir token/permissões.
- Permissões selecionadas no Graph API Explorer: `business_management`, `pages_read_engagement`, `pages_show_list`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`.
- Arquivo interno `Depósito/AddereAdsControl_IG.txt` lido para conferência dos dados do app.
- O arquivo contém IDs de app e chaves secretas; as chaves não devem ser copiadas para chat, docs, commits ou logs.

## O que falta fazer

1. Gerar token no app Meta `AddereAdsControl`.
2. Obter o `Page Access Token` e o `instagram_business_account.id`.
3. Salvar os dois valores no vault da cliente.
4. Conferir o painel de prontidão.
5. Fazer primeira publicação de teste.
6. Rodar coleta de Instagram após publicação.

## Roteiro guiado da chamada

Regra: não pedir senha pelo chat. O ideal é a cliente/Amanda compartilhar tela e fazer login no próprio navegador/celular.

### 1. Instagram

No celular logado em `@claudiaramalhocrochet`:

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
3. Vincular o Instagram `@claudiaramalhocrochet` à Página.
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
| Botão `Criar Página` não habilita no Instagram | fluxo embutido incompleto, categoria não aceita ou limitação da interface | criar a Página diretamente no Facebook/Meta Business Suite e depois vincular ao Instagram |
| Token verifica, mas prontidão não fecha | falta permissão de publicação | revisar `instagram_content_publish` e app review |
| Upload falha | R2 ou mídia inválida | validar R2 e formato do arquivo |
| Agendamento não publica | publisher desligado no ambiente | confirmar `IG_PUBLISH_ENABLED=true` em produção |
| Post falha na Meta | mídia, token ou permissão | abrir erro no modal, corrigir e reagendar |
