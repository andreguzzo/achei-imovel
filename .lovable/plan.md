# Painel Administrativo — Gestão completa

Ampliar o painel de administração com quatro frentes: usuários, planos, assinaturas e imóveis.

## 1. Usuários (administradores e corretores)

Nova aba de usuários mais completa:

- Lista com e-mail real de login, data de cadastro, papéis e situação da conta.
- Filtros por papel (administrador, corretor, usuário) e por situação (ativo/suspenso).
- Criar usuário direto no painel (e-mail, nome, senha inicial, papel) e convidar administradores.
- Promover ou remover papel de administrador e de corretor.
- Suspender e reativar o acesso sem excluir a conta.
- Ficha do usuário em um só lugar: imóveis publicados, assinatura vigente, tickets de suporte e histórico de parcerias.
- Mantém o que já existe: editar perfil, redefinir senha, excluir.

## 2. Planos

Cadastro de planos gerenciável pelo painel (hoje os três planos estão fixos no código):

- Campos: nome, descrição, preço mensal, limite de imóveis, lista de recursos, ordem de exibição, destaque, ativo/inativo e vínculo com o produto/preço do provedor de pagamento.
- Criar, editar, reordenar, ativar e desativar planos.
- A página pública de Planos e os limites de publicação passam a ler esse cadastro, com os três planos atuais migrados para não haver quebra.

## 3. Assinaturas

- Lista de assinantes com plano, início, validade e origem (paga ou bonificada).
- Trocar o plano de um usuário.
- Estender ou reduzir a data de validade.
- Cancelar a assinatura ativa.
- Histórico de alterações: quem alterou, o que mudou e quando.
- Mantém verificar assinatura por e-mail e bonificar assinatura.

## 4. Imóveis — edição total

- Na lista de imóveis, a ação "Editar" abre o mesmo formulário completo usado pelo corretor, já preenchido: dados, valores, endereço e mapa, área rural, fotos, vídeo e status.
- O administrador pode editar qualquer imóvel, de qualquer corretor, sem limite de plano e sem a checagem de anúncio duplicado.
- A ficha de detalhes passa a mostrar todos os campos do imóvel, incluindo o corretor responsável e as parcerias do grupo.

## Detalhes técnicos

Banco (migrações):
- `subscription_plans`: slug, name, description, price_cents, max_properties, features (jsonb), stripe_product_id, stripe_price_id, sort_order, highlighted, active. Leitura pública dos planos ativos; escrita apenas para admin. Seed com basic/pro/premium a partir de `TIERS`.
- `subscription_overrides`: user_id, plan_slug, starts_at, expires_at, source (`granted`/`manual`), cancelled_at, created_by. Admin gerencia; usuário lê a própria.
- `subscription_audit_log`: user_id alvo, admin_id, action, before/after (jsonb), created_at. Apenas admin lê.
- Coluna `profiles.suspended_at` (ou tabela equivalente) para bloqueio de acesso.
- Políticas de admin com `has_role(auth.uid(),'admin')` e GRANTs em cada tabela nova.

Edge Functions (todas com validação `getClaims` + `has_role` admin, padrão já usado):
- `admin-list-users`: junta `auth.users` (e-mail, último acesso, banido) com `profiles` e papéis.
- `admin-create-user`: cria conta via Admin API e atribui papel.
- `admin-set-user-status`: suspende/reativa (`ban_duration`) e grava `suspended_at`.
- `admin-manage-subscription`: trocar plano, ajustar validade, cancelar — atualiza Stripe quando houver assinatura real, senão grava em `subscription_overrides`; registra em `subscription_audit_log`.
- `admin-grant-subscription`: passa a resolver o price id pelo cadastro `subscription_plans` em vez do mapa fixo.

Frontend:
- `src/hooks/usePlans.ts` lê `subscription_plans`; `useAuth`/`Plans.tsx` passam a usar o cadastro (mantendo fallback local durante o carregamento).
- Novo `AdminPlansTab.tsx`; `AdminUsersTab.tsx` reescrito com filtros, criação, suspensão e ficha do usuário; `AdminSubscriptionsTab.tsx` recebe ações de gestão e histórico.
- `CreateProperty.tsx` ganha modo administrador: carrega imóvel por id ignorando `user_id`, preserva o `user_id` original ao salvar, pula limite de plano e detecção de duplicidade. Rota `/admin/imovel/:id` protegida por papel de administrador.
- Guarda de rota do `/admin` continua via `has_role`.

Verificação: typecheck e build; smoke test das telas administrativas na pré-visualização.
