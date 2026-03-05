

## Plano: Login com Google e Apple

### Contexto
O projeto já possui autenticação por email/senha via Lovable Cloud. Vamos adicionar login social com Google e Apple usando a solução gerenciada do Lovable Cloud (sem necessidade de configuração externa).

### Implementação

1. **Configurar Social Login** — Usar a ferramenta "Configure Social Auth" para gerar o módulo `src/integrations/lovable/` com suporte a Google e Apple OAuth.

2. **Atualizar página de Login** (`src/pages/Login.tsx`)
   - Adicionar botões "Entrar com Google" e "Entrar com Apple" abaixo do formulário de email/senha
   - Usar `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` e equivalente para Apple

3. **Atualizar página de Cadastro** (`src/pages/Signup.tsx`)
   - Adicionar os mesmos botões de login social com separador visual "ou"

4. **Tradução** — Adicionar strings para os botões em `pt-BR` e `en` nos arquivos de locale.

### Arquivos alterados
- `src/pages/Login.tsx` — botões OAuth
- `src/pages/Signup.tsx` — botões OAuth
- `src/i18n/locales/pt-BR.ts` — novas strings
- `src/i18n/locales/en.ts` — novas strings
- `src/integrations/lovable/` — gerado automaticamente pela ferramenta

