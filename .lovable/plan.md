# Integrações pendentes do Abitzo — levantamento e plano de ativação

## O que está pendente hoje

**Google**
- O mapa já está ligado com a chave do Google e funciona no app publicado; na pré-visualização a chave recusa o endereço de teste, então precisa autorizar os endereços (pré-visualização, domínio publicado e domínio próprio).
- O login com Google e Apple já tem botão na tela de entrada, mas os provedores precisam ser confirmados/ativados — hoje não há como garantir que a entrada funciona.

**Instagram / Facebook**
- A geração de post (imagem + legenda por IA) já funciona e o corretor baixa e publica na mão.
- A publicação direta ainda não existe: falta o aplicativo Meta, a autorização da conta do corretor e o envio do post. A tabela para guardar a conta conectada já está criada e vazia.

**Cobranças**
- Assinaturas dos corretores: funcionando em ambiente de teste. Os planos no banco ainda não têm todos os produtos/preços vinculados, e falta ativar o recebimento real.
- Aluguéis: hoje é só Pix "copia e cola" e baixa manual. Falta o corretor conectar a conta dele (Asaas ou Mercado Pago), a emissão automática das cobranças mensais e a baixa automática quando o inquilino paga. O controle manual continua disponível para quem não quiser conectar conta.

## Plano de execução

### Etapa 1 — Google (rápida)
1. Autorizar os endereços da pré-visualização e do site publicado na chave do mapa, e confirmar que o mapa abre nos três lugares (busca, cadastro e página do imóvel).
2. Ativar/confirmar entrada com Google e Apple e testar o login de ponta a ponta, incluindo o retorno para a página em que o visitante estava.

### Etapa 2 — Cobrança das assinaturas (recebimento real)
1. Revisar os planos cadastrados e vincular cada um ao produto e preço correspondentes na cobrança.
2. Revisar assinatura, portal do cliente e checagem de plano, incluindo o que acontece quando alguém cancela ou o cartão falha.
3. Trocar o ambiente de teste pelo real e fazer uma compra de validação.

### Etapa 3 — Aluguéis: conectar conta do corretor
1. Na tela "Locação › Cobrança e recebimento", permitir que cada corretor conecte a própria conta do Asaas ou do Mercado Pago informando a credencial dele, guardada em área protegida.
2. Manter "manual" como opção padrão, sem perder nada de quem já usa Pix copia e cola.
3. Emitir a cobrança (Pix e boleto) para cada parcela do contrato, gerando o link de pagamento que já aparece na parcela e na mensagem de WhatsApp.
4. Baixa automática: quando o pagamento é confirmado, a parcela passa a "paga" sozinha, com valor e data.
5. Geração automática das parcelas do mês e marcação de atraso, sem o corretor precisar clicar.
6. Testar com a conta de teste do provedor antes de liberar.

### Etapa 4 — Instagram / Facebook: publicação direta
1. Criar o aplicativo Meta e guardar as credenciais em área protegida (essa parte depende de você criar a conta de desenvolvedor Meta e pedir a análise da Meta — normalmente alguns dias).
2. Tela para o corretor conectar a conta profissional do Instagram junto com a página do Facebook, com renovação automática do acesso.
3. Publicar direto do painel: imagem única e carrossel, com a legenda gerada, e registro do que foi publicado.
4. Enquanto a análise da Meta não sair, o corretor continua baixando e postando manualmente.

### Ordem e prazo sugeridos
1. Google (mesmo dia)
2. Assinaturas no ar de verdade
3. Aluguéis com conta conectada e baixa automática
4. Instagram/Facebook (começa em paralelo, porque depende da análise da Meta)

## Detalhes técnicos
- Google Maps: chave do conector já injetada (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`); ajustar restrições de HTTP referrer no conector. Login social via `lovable.auth.signInWithOAuth` — confirmar provedores com `configure_social_auth`.
- Assinaturas: `STRIPE_SECRET_KEY` já configurado (BYOK); popular `subscription_plans.stripe_product_id/stripe_price_id`; revisar `create-checkout`, `customer-portal`, `check-subscription`.
- Aluguéis: estender `rental_payment_settings` com credencial por corretor (armazenada em coluna protegida por RLS do próprio corretor) e status de conexão; novas edge functions `rental-charge-create` (emite cobrança no provedor) e `rental-webhook` (baixa automática, `verify_jwt = false`, validação de assinatura do provedor); job agendado (pg_cron + `generate_rental_charges`) para emitir parcelas e marcar `overdue`.
- Instagram: secrets `META_APP_ID` / `META_APP_SECRET`; edge functions `meta-oauth-callback` (troca de código, long-lived token em `social_accounts`) e `social-publish` (Graph API: container → publish, carrossel com children); imagem do post enviada ao bucket de imagens para gerar URL pública exigida pela Meta.
- Sem mudanças nas regras de acesso existentes além das novas tabelas/colunas descritas.
