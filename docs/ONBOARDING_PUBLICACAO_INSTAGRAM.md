# Onboarding de Publicação Instagram

Data de referência: 18/07/2026

Manual operacional para preparar qualquer cliente do Addere Ads Control para publicar no Instagram via API Meta.

O fluxo atual do produto usa **Instagram API with Facebook Login**, `graph.facebook.com/v22.0`, `INSTAGRAM.access_token` como **Page Access Token** e `INSTAGRAM.user_id` como o ID da conta Instagram profissional vinculada à Página.

## Resultado esperado

Ao final do onboarding, o painel `Configurações > Prontidão de publicação` deve marcar todos os itens como aprovados:

- Cliente ativo
- Plano com publicação
- Biblioteca de mídia configurada
- Publicador habilitado no ambiente
- Token Instagram salvo e válido
- ID da conta Instagram salvo
- Conta Instagram acessível pelo token
- Permissão de publicação confirmada

## Regras de segurança

- Não pedir senha de Instagram, Facebook ou Meta pelo chat.
- Não colar token em conversa, documento público, issue, commit ou log.
- Preferir que o cliente faça login no próprio navegador durante chamada assistida.
- Se a Addere precisar operar, usar acesso delegado no Meta Business Suite ou perfil operacional com 2FA.
- Salvar token somente no vault do Addere Ads Control.
- Depois do onboarding, remover acessos temporários que não serão usados.

## Pré-requisitos do cliente

Antes de mexer no Addere Ads Control, confirmar:

| Item | Necessário | Observação |
|---|---|---|
| Instagram | Conta profissional `Business` ou `Creator` | Conta pessoal não publica via API |
| Privacidade | Perfil público | Contas profissionais não devem ficar privadas |
| Facebook | Página vinculada ao Instagram | Obrigatória no fluxo Facebook Login usado pelo produto |
| Permissão humana | Usuário com controle/admin da Página | Precisa enxergar a Página em `/me/accounts` |
| Meta App | App Business da Addere ou app do cliente | Precisa conceder permissões de publicação |
| Addere | Cliente `ACTIVE` e plano com `publish` | Hoje: `COMPLETO` ou `AGENCIA` |
| Mídia | R2 configurado no ambiente | URLs precisam ser públicas para a Meta baixar |

## Permissões Meta necessárias

Para o fluxo atual:

- `pages_show_list`
- `pages_read_engagement`
- `instagram_basic`
- `instagram_content_publish`

Permissões recomendadas quando também houver métricas/comentários:

- `instagram_manage_insights`
- `instagram_manage_comments`

Observação: para clientes que a Addere não possui/gerencia diretamente no app Meta, o app pode exigir **Advanced Access** e revisão da Meta. Para contas próprias, teste ou contas adicionadas ao app, o Standard Access pode bastar durante implantação controlada.

## Passo 1 — Preparar a conta Instagram

No celular do cliente:

1. Abrir o Instagram e entrar em `@cliente`.
2. Ir em perfil e confirmar se aparece painel/ferramentas profissionais.
3. Se ainda for conta pessoal, trocar para conta profissional.
4. Escolher `Business` quando a publicação de Stories for parte do escopo; `Creator` funciona para feed/Reels/carrossel, mas Stories pela API têm restrição.
5. Escolher categoria adequada ao nicho.
6. Confirmar que o perfil está público.
7. Conferir nome, bio, foto, link e informações de contato.

## Passo 2 — Criar ou validar Página Facebook

No Facebook ou Meta Business Suite:

1. Confirmar se já existe Página oficial do cliente.
2. Se não existir, criar uma Página com nome comercial claro.
3. Vincular o Instagram profissional à Página.
4. Confirmar que o usuário que vai gerar token tem acesso/admin à Página.
5. Se a Addere operar via Business Suite, adicionar a pessoa/parceiro com permissão de criação de conteúdo e leitura.

Checklist de validação:

- A Página aparece no Meta Business Suite.
- O Instagram aparece como ativo/vinculado à Página.
- O usuário operacional consegue ver a Página e a conta Instagram vinculada.

## Passo 3 — Gerar token e localizar o IG User ID

Este passo deve ser feito usando o app Meta correto da Addere.

1. Abrir o Graph API Explorer, Postman oficial da Meta ou fluxo interno equivalente.
2. Selecionar o app Meta correto.
3. Gerar um **User Access Token** com as permissões necessárias.
4. Consultar as Páginas disponíveis:

```http
GET https://graph.facebook.com/v22.0/me/accounts?fields=name,id,access_token,tasks,instagram_business_account&access_token=<USER_ACCESS_TOKEN>
```

5. Localizar a Página vinculada ao cliente.
6. Copiar:
   - `access_token` da Página: salvar como `INSTAGRAM.access_token`
   - `instagram_business_account.id`: salvar como `INSTAGRAM.user_id`

Se a Página não aparecer:

- O usuário logado não tem permissão suficiente.
- O Instagram não está vinculado à Página correta.
- O token foi gerado sem `pages_show_list`.
- O app Meta ainda não tem acesso/revisão necessária.

## Passo 4 — Validar antes de salvar no Addere

Com o **Page Access Token** e o `instagram_business_account.id`, validar:

```http
GET https://graph.facebook.com/v22.0/<IG_USER_ID>?fields=id,username,name,account_type,media_count&access_token=<PAGE_ACCESS_TOKEN>
```

Depois validar permissão de publicação:

```http
GET https://graph.facebook.com/v22.0/<IG_USER_ID>/content_publishing_limit?access_token=<PAGE_ACCESS_TOKEN>
```

Se o segundo endpoint falhar, não considerar a conta pronta. A falha normalmente indica token sem `instagram_content_publish`, app sem acesso aprovado, Página/Instagram errado ou usuário sem permissão.

## Passo 5 — Salvar no Addere Ads Control

No Addere Ads Control:

1. Entrar como `ADMIN` do cliente ou `SUPER_ADMIN`.
2. Se o plano foi alterado agora, sair e entrar novamente para renovar o JWT.
3. Acessar `Configurações`.
4. Em `Instagram`, salvar:
   - `Access Token`: Page Access Token
   - `User ID`: `instagram_business_account.id`
5. Clicar em `Verificar token`.
6. Atualizar `Prontidão de publicação`.
7. Só avançar para agendamento quando todos os checks estiverem aprovados.

## Passo 6 — Primeiro teste de publicação

Usar um post real, simples e aprovado pelo cliente:

1. Separar imagem JPEG/PNG em `1080x1080` ou `1080x1350`.
2. Entrar em `Conteúdo > Calendário`.
3. Criar agendamento para 10 a 15 minutos no futuro.
4. Fazer upload da mídia pelo Addere, usando R2.
5. Escrever legenda curta.
6. Evitar marcações, collabs, música e localização no primeiro teste.
7. Salvar como `Agendado`.
8. Aguardar o scheduler ou rodar `publish-scheduled` em `Agentes`.
9. Confirmar status `Publicado` e abrir o link no Instagram.
10. Rodar `instagram-collection` depois para coletar métricas.

## Especificações de mídia

Recomendações seguras para o primeiro ciclo:

- Foto: JPEG ou PNG, URL pública, preferir 1080 px de largura.
- Carrossel: 2 a 10 mídias; manter mesma proporção entre as imagens.
- Reel: MOV ou MP4, H.264 ou HEVC, áudio AAC, 23 a 60 FPS, até 15 minutos e até 1 GB.
- Story: usar conta `Business`, formato vertical `9:16`.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Página não aparece em `/me/accounts` | usuário sem acesso/admin | ajustar acesso no Meta Business Suite |
| `instagram_business_account` vem vazio | Instagram não está vinculado à Página | vincular conta IG profissional à Página correta |
| Token válido, mas publicação não confirma | falta `instagram_content_publish` ou app sem acesso | revisar permissões e app review |
| Prontidão falha em `IG_PUBLISH_ENABLED` | ambiente não publica | configurar env no Render e redeployar |
| Upload falha | R2 ausente ou arquivo inválido | validar envs R2 e mídia |
| Post fica `FAILED` | erro da Meta em mídia/token/permissão | abrir modal do agendamento, corrigir e reagendar |

## Checklist final de aceite

- [ ] Cliente ativo e plano com publicação.
- [ ] Instagram profissional e público.
- [ ] Página Facebook vinculada.
- [ ] Usuário operacional com acesso à Página.
- [ ] Token gerado no app Meta correto.
- [ ] `INSTAGRAM.access_token` salvo no vault.
- [ ] `INSTAGRAM.user_id` salvo no vault.
- [ ] Painel de prontidão 100% aprovado.
- [ ] Primeiro post de teste publicado.
- [ ] `instagram-collection` executado após publicação.
- [ ] Cliente orientado sobre uso do calendário e uploads.

## Referências oficiais

- Meta/Postman — Instagram API: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- Instagram Help Center — contas profissionais: https://www.facebook.com/help/instagram/138925576505882
- Instagram Help Center — conectar Instagram profissional a uma Página: https://www.facebook.com/help/instagram/402748553849926
