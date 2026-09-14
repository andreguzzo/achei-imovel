# Painel administrativo mais fluido e organizado

Aplicar ao painel administrativo o mesmo padrão já adotado no painel do corretor: menu lateral por área, tela inicial de resumo, cabeçalhos consistentes e endereço próprio para cada seção.

## O que muda

**1. Menu lateral em vez de abas no topo**
Hoje as seis áreas (Métricas, Usuários, Imóveis, Planos, Assinaturas, Suporte) ficam em uma fila de abas que quebra em várias linhas. Passam para um menu lateral agrupado:

```text
Visão geral      Resumo
Pessoas          Usuários
Catálogo         Imóveis
Financeiro       Planos · Assinaturas
Atendimento      Suporte
```

- Recolhível para só ícones no computador.
- Menu deslizante no celular, com o nome da área atual visível.
- Contadores no menu para itens que pedem ação (suporte aberto).

**2. Tela inicial "Resumo"**
A área de métricas atual vira a página inicial do painel, reorganizada:
- Blocos numéricos clicáveis que levam direto à área correspondente (usuários, imóveis, assinaturas, suporte).
- Bloco "Precisa de atenção": chamados de suporte abertos, imóveis aguardando revisão, assinaturas vencendo.
- Listas de novos usuários e suporte recente mantidas, com visual alinhado ao painel do corretor.

**3. Endereço por seção**
Cada área ganha um endereço próprio (`/admin?secao=usuarios`), então é possível recarregar, voltar e compartilhar o link de uma área específica. O botão "Editar tudo" de um imóvel volta para a área de imóveis, não para o início do painel.

**4. Acabamento e usabilidade nas áreas existentes**
- Cabeçalho padronizado em toda área: título, descrição curta, contagem e ação principal à direita.
- Busca e filtros no topo das listas de usuários, imóveis e assinaturas.
- Estados vazios com texto explicativo em vez de tabela em branco.
- Tabelas com rolagem horizontal controlada e ações agrupadas em menu, reduzindo a fileira de botões atual.

## Fora de escopo

Sem mudanças em banco de dados, permissões, funções de servidor ou nas regras de negócio. Só organização, navegação e apresentação. As ferramentas administrativas continuam funcionando exatamente como hoje.

## Detalhes técnicos

- Novo `src/components/admin/AdminSidebar.tsx` (com `useAdminNav`) espelhando `DashboardSidebar`.
- Novo `src/components/admin/AdminOverview.tsx` a partir do conteúdo de `AdminMetricsTab.tsx`, com KPIs clicáveis via `onNavigate`.
- `src/pages/Admin.tsx` reescrito como casca fina: verificação de admin, seção ativa via `useSearchParams` (`?secao=`), sidebar + `<main>`, sem `Tabs`.
- Reutilizar `SectionHeader`/`EmptyState` de `src/components/dashboard/SectionHeader.tsx`.
- `AdminUsersTab`, `AdminPropertiesTab`, `AdminSubscriptionsTab`, `AdminPlansTab`, `AdminSupportTab` mantêm sua lógica; recebem cabeçalho padronizado, campo de busca/filtro e ações em `DropdownMenu`.
- Ajustar o retorno de `CreateProperty` em modo admin para `/admin?secao=imoveis`.
- Validar com `bunx tsgo --noEmit`, `bun run build` e conferência visual do painel.
