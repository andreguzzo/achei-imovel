

## Plano de Testes do Sistema -- Execução em Etapas

O plano cobre todas as funcionalidades do sistema, agrupadas em 6 etapas. Cada etapa será executada via browser automation, verificando fluxos reais e identificando melhorias.

---

### Etapa 1: Autenticação e Controle de Acesso

**Testes:**
- Login com credenciais válidas -- confirmar redirecionamento para `/`
- Login com credenciais inválidas -- confirmar mensagem de erro
- Cadastro de novo usuário -- confirmar criação de perfil
- Logout -- confirmar limpeza de sessão
- Acesso a `/admin` sem role admin -- confirmar redirecionamento
- Acesso a `/painel` sem login -- confirmar redirecionamento para `/login`
- Acesso a `/anunciar` sem login -- confirmar tela de "faça login"
- Context switcher no header -- verificar se aparece para dual-role e navega corretamente

**Melhorias a buscar:** falta de "esqueci senha", UX de erros de login, proteção de rotas faltantes.

---

### Etapa 2: Dashboard do Corretor (Perfil + Imóveis)

**Testes:**
- Editar perfil (nome, telefone, CRECI, bio, redes sociais, username)
- Validações de perfil (CRECI obrigatório, username inválido, username duplicado)
- Upload e gerenciamento de fotos do álbum (upload, definir capa, excluir)
- Verificação de email (envio e validação de código)
- Listagem de imóveis no painel
- Alterar status de imóvel (ativo, vendido, inativo, vendido por outro)
- Excluir imóvel pelo painel
- Visualização de stats (views, total de imóveis)
- Aba de suporte -- envio de mensagem

**Melhorias a buscar:** feedback visual insuficiente, campos faltantes, tratamento de erros.

---

### Etapa 3: Cadastro e Edição de Imóveis

**Testes:**
- Criar imóvel com dados mínimos (título, cidade, estado, preço)
- Validação de campos obrigatórios (zod schema)
- Upload de imagens (até 10)
- Preenchimento de dados privados (proprietários, documentos)
- Limite de imóveis por plano -- confirmar bloqueio
- Editar imóvel existente -- confirmar carregamento de dados
- Seleção de localização no mapa
- URL de vídeo

**Melhorias a buscar:** UX de upload, feedback de salvamento, validações faltantes.

---

### Etapa 4: Busca, Listagem e Detalhes de Imóveis

**Testes:**
- Página inicial -- carregamento de imóveis destacados
- Busca com filtros (cidade, tipo, preço, quartos)
- Mapa de imóveis (Leaflet)
- Página de detalhe -- dados, imagens, contato com corretor
- Favoritar/desfavoritar imóvel
- Perfil público do corretor (`/corretor/:username`)
- Contador de views (increment_view_count)
- Página de financiamento

**Melhorias a buscar:** SEO, performance de busca, UX mobile.

---

### Etapa 5: Painel Administrativo

**Testes:**
- Aba Métricas -- carregamento de dados
- Aba Usuários -- busca, editar perfil, toggle role, excluir usuário
- Aba Imóveis -- busca, filtro por status, editar, alterar status, excluir
- Aba Assinaturas -- verificar assinatura, bonificar, lista de pagantes
- Aba Suporte -- visualizar e responder mensagens
- RLS policies -- confirmar que admin pode deletar profiles, properties, property_images

**Melhorias a buscar:**
- RLS faltante para admin deletar `contact_requests`, `property_documents`, `property_private_data`, `property_group_members`, `favorites`, `saved_searches` (atualmente deletions dessas tabelas podem falhar silenciosamente)
- Falta paginação nas listas de usuários e imóveis (limite de 1000 rows do Supabase)
- Exclusão de usuário não remove o registro em `auth.users` (apenas o profile)

---

### Etapa 6: Edge Functions e Integrações

**Testes:**
- `check-subscription` -- retorno correto para user com/sem assinatura
- `admin-check-user-subscription` -- verificação por email
- `admin-grant-subscription` -- concessão de trial via Stripe
- `admin-list-subscribers` -- paginação e retorno de dados
- `admin-reset-password` -- envio de link
- `send-verification-code` e `verify-code` -- fluxo de verificação de email
- `create-checkout` e `customer-portal` -- fluxo Stripe

**Melhorias a buscar:** tratamento de erros, rate limiting, logging.

---

### Detalhes Técnicos

**Ferramentas:** Browser automation para testes E2E das etapas 1-5. Edge function testing tool para etapa 6.

**Melhorias já identificadas na análise de código:**
1. `AdminUsersTab` e `AdminPropertiesTab` deletam dados de tabelas que **não possuem RLS policy de DELETE para admins** (`contact_requests`, `property_documents`, `property_private_data`, `saved_searches`). Essas operações falham silenciosamente.
2. Não há paginação -- listas com mais de 1000 registros serão truncadas.
3. Login não oferece "Esqueci minha senha".
4. Rotas `/favoritos` e `/corretor/vendas` não verificam autenticação no componente (apenas dependem de queries que retornam vazio).
5. `handleDeleteUser` remove o profile mas **não** remove o usuário de `auth.users`, permitindo re-login.

**Ordem de execução sugerida:** Etapas 1 → 2 → 3 → 4 → 5 → 6, pois cada etapa depende do estado construído nas anteriores.

Deseja que eu inicie a execução pela Etapa 1?

