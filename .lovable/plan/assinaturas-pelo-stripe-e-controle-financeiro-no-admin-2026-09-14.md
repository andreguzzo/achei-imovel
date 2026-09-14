# Assinaturas pelo Stripe e controle financeiro no admin

Hoje os planos Corretor (R$ 79,90) e Imobiliária (R$ 159,90) existem no cadastro, mas sem preço criado no Stripe — o botão "Assinar" não conclui. E a liberação do acesso depende de uma consulta periódica ao Stripe, não de um aviso do próprio Stripe.

## 1. Cobrança dos planos

- Criar no Stripe o produto e o preço mensal recorrente de Corretor (R$ 79,90) e Imobiliária (R$ 159,90), em reais, e gravar essas referências no cadastro de planos. O plano Proprietário continua grátis, sem cobrança.
- A página de Planos passa a abrir o pagamento do plano escolhido; quem já assina vê "Gerenciar assinatura" e pode trocar de plano ou cancelar pela central do Stripe.
- Como a conta Stripe está em modo de teste, os pagamentos serão feitos com cartões de teste até você ativar o modo real.

## 2. Liberação automática do acesso

- Um endereço de aviso (webhook) recebe do Stripe cada pagamento aprovado, renovação, falha de cobrança e cancelamento.
- Ao aprovar o pagamento, o sistema libera na hora: registra a assinatura ativa, ajusta o tipo de conta para corretor ou imobiliária e libera anúncios ilimitados. Corretor e imobiliária ainda precisam da verificação de documentos para publicar — o pagamento libera o plano, não substitui a validação do CRECI.
- Em falha de pagamento ou cancelamento, o acesso volta ao gratuito ao fim do período pago, e o corretor recebe aviso no painel.
- A conferência periódica atual continua como rede de segurança, caso um aviso do Stripe se perca.

## 3. Controle financeiro no painel administrativo

Nova área "Financeiro" com:

- Resumo do mês: receita recebida, receita recorrente ativa, assinantes por plano, pagamentos pendentes, falhas e reembolsos.
- Lista de todas as transações: data, cliente (nome e e-mail), plano, valor, situação (paga, pendente, falhou, reembolsada, estornada), forma de pagamento e link para o recibo.
- Filtros por período, plano e situação; busca por e-mail; exportação em CSV.
- Botão para sincronizar com o Stripe, trazendo transações anteriores à ativação do webhook.
- Indicação clara de que os valores são de ambiente de teste enquanto a conta não estiver ativada para cobrança real.

## O que precisa de você

- Um código de segurança do webhook, gerado por você no painel do Stripe depois que eu publicar o endereço de aviso — eu te mostro o endereço e onde colar.
- Para receber de verdade: ativar a conta Stripe para modo real e recriar os preços nesse modo.

## Detalhes técnicos

Banco:
- `billing_transactions`: user_id, email, stripe_customer_id, stripe_invoice_id (único), stripe_payment_intent_id, plan_slug, amount_cents, currency, status, description, receipt_url, period_start/end, created_at. RLS: leitura só admin; escrita só service_role. GRANT para `service_role` e `authenticated` (select via policy admin).
- `billing_subscriptions`: user_id, email, stripe_customer_id, stripe_subscription_id (único), plan_slug, status, current_period_end, cancel_at_period_end, updated_at. Mesma política.
- `subscription_plans`: gravar `stripe_product_id`/`stripe_price_id` de `corretor` e `imobiliaria`.

Stripe: criar produtos/preços recorrentes mensais em BRL via ferramenta Stripe; ids escritos no cadastro (não em código).

Edge Functions:
- `stripe-webhook` (novo, `verify_jwt = false`, assinatura verificada com `STRIPE_WEBHOOK_SECRET` usando `constructEventAsync`): trata `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`. Resolve o usuário por e-mail do customer, faz upsert em `billing_subscriptions`/`billing_transactions` e atualiza `profiles.account_type` conforme o slug do plano (mapeado pelo price/product id).
- `create-checkout`: passar `client_reference_id` com o user id e `metadata.plan_slug`, e reaproveitar/criar customer com metadata do user id.
- `check-subscription`: resolver o slug pelo `subscription_plans.stripe_product_id` (deixar de depender do mapa legado `TIERS`) e cair para `billing_subscriptions` quando o Stripe estiver indisponível.
- `admin-financial` (novo, `requireAdmin`): retorna resumo agregado + página de transações do banco, e ação `sync` que importa invoices/charges do Stripe para `billing_transactions`.

Frontend:
- `src/components/admin/AdminFinanceTab.tsx` (resumo, tabela, filtros, CSV, sincronizar) e item "Financeiro" em `AdminSidebar.tsx`/`Admin.tsx` com rota `?secao=financeiro`.
- `src/hooks/useAuth.tsx`: derivar `tier` pelo slug do plano vindo do backend; manter compatibilidade com assinantes antigos.
- `SubscriptionCard.tsx` mostra plano, próxima cobrança, aviso de falha e botão de gerenciar.

Verificação: typecheck e build; webhook testado com evento de teste do Stripe; checkout de teste ponta a ponta confirmando liberação imediata; tela financeira conferida na prévia.
