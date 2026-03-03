

## Suporte a Dupla Função (Admin + Corretor)

A ideia é excelente e totalmente viável. O sistema de roles já suporta múltiplos papéis por usuário (tabela `user_roles` com `unique(user_id, role)`). O que falta é apenas a UI para navegar entre os painéis.

### Plano

**1. Header: botão de troca de contexto**
No `Header.tsx`, ao detectar que o usuário tem ambos os roles (`admin` + `broker`), exibir um botão/dropdown ao lado de "Minha Conta" que permite escolher entre:
- "Painel do Corretor" → `/painel`
- "Painel Admin" → `/admin`

Se o usuário tiver apenas um role, o botão não aparece — comportamento atual mantido.

**2. Verificação de roles no Header**
Adicionar uma query que busca todos os roles do usuário logado via `supabase.from('user_roles').select('role').eq('user_id', user.id)` e condicionar a exibição do seletor.

**3. Atribuir roles ao seu usuário**
Inserir dois registros na tabela `user_roles`: um com `role = 'admin'` e outro com `role = 'broker'` para o seu `user_id`. Será necessário que você informe seu email ou eu busque seu ID no banco.

### Arquivos alterados
- `src/components/layout/Header.tsx` — adicionar dropdown de contexto com ícone Shield/Building2
- Migration ou insert de dados — atribuir roles

### Complexidade
Baixa. Sem mudanças de schema, apenas UI + insert de dados.

