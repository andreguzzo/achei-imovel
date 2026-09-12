# Remover a barra do Google AdSense

A barra de anúncios inferior (AdSense) será removida por completo do site.

## O que será feito

1. **Remover do layout** — tirar a importação e o uso de `AdSenseBar` em `src/components/layout/MainLayout.tsx`, fazendo a barra inferior de anúncio desaparecer de todas as páginas.
2. **Excluir o componente** — apagar `src/components/layout/AdSenseSidebar.tsx` (o componente da barra com os controles de recolher/fechar).

## Detalhes técnicos

- Apenas 2 referências existem no código: a importação e a renderização em `MainLayout.tsx` (linhas 4 e 12).
- Nenhuma outra página ou configuração usa o AdSense; não há scripts no `index.html` nem chaves de anúncio salvas.
- Nenhuma mudança no banco de dados ou em outras funcionalidades.
