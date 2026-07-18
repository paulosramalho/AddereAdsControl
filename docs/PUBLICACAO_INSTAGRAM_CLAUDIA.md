# Publicação Instagram — Cláudia Ramalho Crochê

Data de referência: 18/07/2026
Cliente: `claudia-ramalho-croche`
Instagram: `@claudiaramalhocroche`

## Objetivo

Deixar a cliente apta a publicar pelo Addere Ads Control: upload de mídia, agendamento, publicação automática no Instagram e leitura posterior de métricas básicas do post publicado.

## Estado no Addere Ads Control

- Cliente existe e está `ACTIVE`.
- Plano está `COMPLETO`, necessário para `settings`, `calendar`, `publish` e `boost`.
- Usuária Amanda Maia Ramalho já existe como `ADMIN`.
- R2 está configurado no ambiente local consultado (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE`).
- `render.yaml` declara `IG_PUBLISH_ENABLED=true` em produção.
- `.env` local está com publicação desligada, o que evita posts acidentais durante teste local.
- Ainda faltam as credenciais `INSTAGRAM.access_token` e `INSTAGRAM.user_id` no vault da cliente.

## Adequação da conta Instagram/Meta

A conta precisa estar preparada antes de salvar credenciais no sistema:

1. Confirmar que `@claudiaramalhocroche` é conta profissional do Instagram (`Business` ou `Creator`). Para publicação de Stories via API, preferir `Business`.
2. Garantir que a conta não esteja privada.
3. Vincular a conta Instagram a uma Página do Facebook.
4. Garantir que a pessoa que vai gerar o token tenha permissão administrativa na Página e acesso à conta Instagram vinculada.
5. Usar um app Meta do tipo Business ou o app já aprovado/operacional da Addere.
6. Solicitar/conceder permissões compatíveis com o fluxo atual:
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights` se a coleta/análise de métricas for usada
   - `instagram_manage_comments` se o primeiro comentário ou moderação for usado
7. Gerar token e identificar a conta IG vinculada pela Graph API:
   - `GET /me/accounts?fields=name,access_token,tasks,instagram_business_account`
   - Salvar o `access_token` da Página em `INSTAGRAM.access_token`.
   - Salvar `instagram_business_account.id` em `INSTAGRAM.user_id`.

Referências: documentação da coleção oficial Meta/Postman para Instagram API e Central de Ajuda do Instagram sobre contas profissionais.

## Configuração no Addere Ads Control

1. A usuária Amanda deve sair e entrar novamente após mudança de plano, para o JWT carregar `clientPlan=COMPLETO`.
2. Acessar `Configurações`.
3. Em `Instagram`, preencher:
   - `Access Token`: Page Access Token com permissão de publicação.
   - `User ID`: ID numérico da conta Instagram Business/Creator.
4. Usar `Verificar token`.
5. Conferir o painel `Prontidão de publicação`:
   - Cliente ativo
   - Plano com publicação
   - Biblioteca de mídia configurada
   - Publicador habilitado no ambiente
   - Token salvo e válido
   - ID da conta Instagram salvo
   - Conta Instagram acessível pelo token

## Primeiro teste de publicação

1. Usar uma imagem simples, aprovada pela cliente, em JPEG ou PNG.
2. Preferir feed quadrado `1080x1080` ou vertical `1080x1350`.
3. Em `Conteúdo > Calendário`, criar um agendamento para 10 a 15 minutos no futuro.
4. Subir a mídia pelo botão de upload, para usar URL pública do R2.
5. Escrever legenda curta, sem marcações sensíveis no primeiro teste.
6. Salvar como `SCHEDULED`.
7. Aguardar o publisher do scheduler ou disparar `publish-scheduled` pela tela de Agentes como super admin.
8. Verificar se o agendamento mudou para `PUBLISHED` e abriu o link do Instagram.
9. Rodar `instagram-collection` depois da publicação para coletar métricas do post no banco.

## Especificações de mídia recomendadas

- Foto de feed: largura ideal de 1080 px; proporção entre `1.91:1` e `3:4` conforme orientação pública do Instagram.
- Carrossel: 2 a 10 itens; para primeiro uso, manter todas as imagens na mesma proporção.
- Reel: MOV ou MP4, codec H.264 ou HEVC, áudio AAC, 23 a 60 FPS, até 1920 px de largura, 3 segundos a 15 minutos, até 1 GB conforme coleção Meta/Postman.
- Story: usar conta `Business`; preferir vertical `9:16`.

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `Token Instagram salvo e válido` falha | token expirado, token errado ou sem permissões | gerar novo token com permissões corretas |
| `Conta Instagram acessível pelo token` falha | `user_id` não pertence à Página/token usado | consultar `/me/accounts` novamente e copiar `instagram_business_account.id` correto |
| Upload falha | R2 ausente ou arquivo inválido | confirmar envs R2 e usar JPEG/PNG/MP4 válido |
| Agendamento fica `SCHEDULED` e não publica | `IG_PUBLISH_ENABLED` desligado no ambiente em execução | confirmar env no Render e reiniciar/deployar backend |
| Post fica `FAILED` com erro Meta | mídia fora do padrão, permissão ausente ou token sem publicação | abrir erro no modal do post, ajustar mídia/token e reagendar |
| Reel fica demorando | processamento assíncrono da Meta | aguardar até alguns minutos; se falhar, revisar codec/duração/tamanho |

## Direção editorial inicial

Para uma conta de crochê ainda crua no controle, começar com publicações de baixo risco e alto contexto:

- 3 posts de portfólio: peça pronta, detalhe do ponto, aplicação no ambiente/uso.
- 2 Reels curtos: processo acelerado, antes/depois, textura da linha e finalização.
- 1 carrossel educativo: cuidado com peças de crochê, escolha de cores ou tipos de linha.
- 1 Story de bastidor: mesa de trabalho, encomenda em andamento ou enquete simples.

Tom recomendado: acolhedor, artesanal, visual e de estilo de vida, sem promessa agressiva de venda no primeiro ciclo.