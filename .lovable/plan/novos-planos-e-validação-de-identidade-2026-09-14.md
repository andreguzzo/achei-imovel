# Novos planos e validação de identidade

Reorganizar os planos em três: proprietário (grátis, 1 anúncio), corretor (R$ 79,90, ilimitado) e imobiliária (R$ 159,90, vários usuários com permissões). Incluir validação de documento com leitura por IA.

## 1. Planos

| Plano | Preço | Anúncios | Para quem |
| --- | --- | --- | --- |
| Proprietário | Grátis | 1 | Quem vende ou aluga o próprio imóvel |
| Corretor | R$ 79,90/mês | Ilimitados | Corretor autônomo com CRECI validado |
| Imobiliária | R$ 159,90/mês | Ilimitados | Equipe com vários usuários e permissões |

- Os planos Básico, Pro e Premium saem da vitrine (ficam inativos, sem afetar quem já assina).
- A página de Planos passa a mostrar os três novos, com o de corretor em destaque.
- O limite de 1 anúncio do proprietário é aplicado no cadastro e também no banco, para não ser burlado.
- Quem é proprietário não vê as áreas de corretor (parcerias, locação, pipeline, relatórios) — só o próprio anúncio, contatos recebidos e favoritos.

## 2. Cadastro: proprietário ou profissional

Na criação da conta, a pessoa escolhe:

- **Vou anunciar meu imóvel** → conta gratuita, publica após confirmar e-mail e telefone (WhatsApp por código, como já existe). Sem envio de documento.
- **Sou corretor** → envia CRECI e documento pessoal para validação antes de publicar.
- **Sou imobiliária** → envia CNPJ/CRECI jurídico e documento do responsável; ao ser aprovada, ganha o painel de equipe.

## 3. Validação por IA

Tela "Verificação de identidade" no painel:

1. A pessoa envia foto/PDF do CRECI (ou CNPJ) e de um documento pessoal (RG/CNH), com arraste e solte.
2. A IA lê as imagens e extrai nome, número do CRECI, estado, validade e nome do documento pessoal.
3. Conferência automática: nome do documento x nome do perfil, CRECI x número informado, documento dentro da validade, arquivo legível.
4. Resultado:
   - **Aprovado** — tudo confere: o selo "Corretor verificado" aparece na página pública e a publicação é liberada.
   - **Revisão manual** — algo não confere ou a leitura ficou duvidosa: vai para a fila do administrador, com os dados lidos pela IA e o motivo.
   - **Recusado** — documento ilegível, vencido ou de outra pessoa; a pessoa pode reenviar.
5. Nova área no painel administrativo: fila de verificações com visualizar documento, o que a IA leu, aprovar, recusar (com motivo) e histórico.
6. Os documentos ficam em armazenamento privado, visíveis somente para a própria pessoa e para administradores.
7. Reforço anti-fraude: limite de tentativas por dia, registro de cada análise e alerta quando o mesmo número de CRECI é usado por contas diferentes.

## 4. Imobiliária: equipe e permissões

- A imobiliária tem um administrador que convida pessoas por e-mail.
- Para cada pessoa, o administrador liga ou desliga o acesso a: imóveis, locação, vendas e clientes, agenda, relatórios, financeiro/cobrança, documentos sigilosos, parcerias e gestão da equipe.
- Os imóveis pertencem à imobiliária; corretores da equipe aparecem como responsáveis no anúncio.
- Ao sair da equipe, a pessoa perde o acesso imediatamente e os imóveis continuam com a imobiliária.
- O painel mostra a equipe: quem é, o que pode acessar, situação do convite e último acesso.

## Detalhes técnicos

Banco (migrações, com GRANT e RLS em cada nova tabela):
- `subscription_plans`: inserir `owner` (0, max 1), `corretor` (7990, ilimitado), `imobiliaria` (15990, ilimitado); desativar `basic`/`pro`/`premium`; manter Stripe product/price a preencher.
- `identity_verifications`: user_id, kind (`creci`|`agency`|`personal`), status (`pending`|`approved`|`rejected`|`manual_review`), arquivos, campos extraídos (jsonb), score, motivo, reviewed_by, timestamps. RLS: dono lê/insere a própria; admin lê/atualiza todas.
- `profiles`: `verified_at`, `verification_status`, `account_type` (`owner`|`broker`|`agency`).
- `agencies` (nome, cnpj, owner_user_id) + `agency_members` (agency_id, user_id, status, permissions jsonb) + `agency_invites` (email, token, permissions, expires_at).
- Enum `app_role` recebe `agency_admin`; funções `has_agency_permission(_user, _perm)` e `current_agency_id()` (SECURITY DEFINER, `EXECUTE` só para authenticated) usadas nas policies de `properties`, `rental_*`, `sales_pipeline`, `property_private_data`.
- Trigger em `properties` que bloqueia o segundo anúncio quando o plano efetivo é `owner`.
- `sync_broker_role` passa a exigir `profiles.verified_at`, não só CRECI preenchido.

Edge Functions:
- `verify-identity`: recebe os caminhos no bucket privado, gera signed URLs, chama Lovable AI (`openai/gpt-6-astra` via Responses API, streaming, com esquema estrito) para extrair e conferir os campos, grava em `identity_verifications` e decide aprovado/revisão/recusado. Valida JWT com `getClaims`.
- `admin-review-verification`: admin aprova/recusa, grava `profiles.verified_at` e registra auditoria.
- `agency-invite` e `agency-accept-invite`: convite por e-mail com token e permissões.
- Novo bucket privado `identity-documents` com policies por dono/admin.

Frontend:
- `Signup.tsx`: escolha do tipo de conta; `useAuth` expõe `accountType`, `verificationStatus` e limite efetivo (`owner` = 1).
- Novas telas: `IdentityVerification.tsx` (painel), `AgencyTeam.tsx` (equipe/permissões), `AdminVerificationsTab.tsx` (fila).
- `usePermissions` centraliza a checagem; `DashboardSidebar` e `AdminSidebar` esconderem seções sem permissão; `CreateProperty` respeita limite e exige verificação para corretor/imobiliária.
- `Plans.tsx` e `useAuth.TIERS` deixam de usar os tiers fixos e passam a ler só `subscription_plans`.

Verificação: typecheck, build, teste real da função de IA com um documento de exemplo e smoke test autenticado de proprietário, corretor e imobiliária.
