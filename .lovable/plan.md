# Painel do corretor mais fluído e organizado

Hoje o painel tem 4 abas no topo e, dentro de "Gestão de Vendas", outras 6 abas escondidas. Isso cria abas dentro de abas e faz o corretor se perder. A proposta acaba com esse aninhamento.

## Nova estrutura

Menu lateral fixo (recolhível para só ícones), com uma seção por item:

```text
INÍCIO
  Resumo do dia
CLIENTES
  Negociações (pipeline)
  Contatos recebidos
  Propostas
AGENDA
  Visitas e compromissos
IMÓVEIS
  Meus anúncios
  Parcerias
DESEMPENHO
  Relatórios
CONTA
  Perfil e álbum de fotos
  Assinatura
  Suporte
```

No celular o menu vira um painel deslizante, aberto por um botão sempre visível no topo.

## Tela inicial: Resumo do dia

Primeira tela ao entrar, priorizando clientes e agenda:

- Faixa de números clicáveis: leads novos, visitas de hoje, propostas em aberto, solicitações de parceria pendentes, anúncios ativos, VGV realizado.
- "Sua agenda de hoje": próximos compromissos com contato rápido.
- "Precisa de atenção": contatos ainda não trabalhados, propostas sem resposta, parcerias aguardando aprovação.
- Atalhos: Anunciar imóvel, Novo lead, Agendar visita.

Cada número e cada item leva direto para a seção correspondente já filtrada.

## Acabamento visual

- Cabeçalho por seção com título, contagem e a ação principal do lado direito.
- Listas mais limpas e respiráveis: menos molduras aninhadas, mais espaçamento, informação hierarquizada (nome, imóvel, valor, data).
- Estados vazios com uma frase e um botão de ação, em vez de caixas vazias.
- Números e etiquetas usando as cores do sistema (hoje há cores fixas nas etapas do funil), mantendo a identidade branco/azul.
- Tudo em PT-BR e EN, como já é hoje.

## Detalhes técnicos

- `src/pages/Dashboard.tsx` (673 linhas) é dividido: casca com menu lateral + seções em arquivos próprios (`DashboardOverview`, `DashboardProperties`, `DashboardProfile`).
- Novo `src/components/dashboard/DashboardSidebar.tsx` usando o componente de sidebar do shadcn com `collapsible="icon"`; `SidebarTrigger` no cabeçalho.
- `DashboardSalesTab.tsx` é desmembrado: pipeline, contatos e KPIs passam a ser seções independentes; `BrokerAgenda`, `BrokerProposals`, `PropertyPartnerships` e `BrokerAnalytics` passam a ser páginas de seção diretas, sem sub-abas.
- Seção ativa controlada por estado + `?secao=` na URL, para poder voltar/recarregar na mesma seção. `/painel` continua a única rota; `/corretor/vendas` segue redirecionando.
- Nenhuma mudança de banco, RLS ou Edge Function. Consultas atuais reaproveitadas; o resumo agrega o que já é buscado, evitando consultas duplicadas.

## Ordem de execução

1. Casca do painel: menu lateral, cabeçalhos de seção, seção via URL, seções atuais movidas sem alterar conteúdo.
2. Tela de Resumo do dia com números clicáveis, agenda de hoje e pendências.
3. Desmembrar Gestão de Vendas em Negociações, Contatos, Propostas, Agenda, Parcerias e Relatórios.
4. Acabamento visual das listas, cabeçalhos e estados vazios, com revisão no celular.
