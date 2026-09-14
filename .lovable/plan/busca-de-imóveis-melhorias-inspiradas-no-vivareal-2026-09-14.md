# Busca de imóveis: melhorias inspiradas no VivaReal

Comparação entre a página de busca do VivaReal (imagens enviadas) e a nossa `/busca`.

## O que o VivaReal faz melhor

1. **Contagem contextual**: "4.707 imóveis na área do mapa" — o número acompanha o que está visível no mapa. Hoje mostramos apenas "X resultados" fixos (limite de 100).
2. **Preço no mapa**: os pinos mostram o valor (R$ 800.000) e agrupamentos mostram a quantidade. Nossos pinos são genéricos.
3. **Busca por área do mapa**: mover/dar zoom no mapa refaz a busca. Hoje o mapa só exibe o que já foi buscado por filtro de texto.
4. **Cartão mais informativo**: carrossel de fotos com setas, linha de resumo ("Apartamento para comprar com 60 m², 2 quartos…"), condomínio e IPTU, selo de imobiliária/destaque e botão de contato direto no cartão.
5. **Ações no cartão**: favoritar + "Contatar" sempre visíveis.
6. **Botão "Fechar mapa" e "Ordenar por" no topo da lista**, separados da barra de filtros.
7. **Autocomplete de localização** no campo de busca (bairro, cidade), em vez de texto livre.

## O que vamos implementar

### Fase 1 — Mapa e resultados (maior impacto)
- Pinos com **preço formatado** (R$ 590 mil / R$ 1,9 mi) e agrupamentos com contagem, no estilo VivaReal.
- **Buscar nesta área**: ao mover o mapa, filtrar resultados pelos limites visíveis, com botão "Buscar nesta área" e opção de acompanhar automaticamente.
- Contagem do cabeçalho passa a dizer "N imóveis na área do mapa" quando o mapa está aberto.
- Sincronia lista ↔ mapa nos dois sentidos: passar o mouse no cartão destaca o pino (já existe) e clicar no pino rola até o cartão na lista.

### Fase 2 — Cartão do imóvel
- **Carrossel de fotos** no cartão (setas no hover, sem sair da busca).
- Linha de resumo automática: "Apartamento para comprar com 60 m², 2 quartos, 1 suíte, 1 vaga".
- Exibir **condomínio e IPTU** quando informados.
- Botão **"Contatar"** no cartão, abrindo WhatsApp/formulário sem sair da busca.
- Endereço com fallback "Endereço não informado".

### Fase 3 — Filtros e navegação
- **Autocomplete de localização** no campo de busca, sugerindo cidades e bairros existentes no banco.
- Mover "Ordenar por" e "Fechar mapa" para a faixa acima da lista, deixando a barra de filtros só com filtros.
- Filtros rápidos de Quartos/Banheiros/Vagas visíveis direto na barra (como no VivaReal), com "Filtros (n)" reunindo o restante.
- **Paginação/carregamento incremental** para superar o limite atual de 100 resultados.

## Detalhes técnicos
- `PropertyMap.tsx`: marcadores customizados com rótulo de preço, `MarkerClusterer` com renderizador próprio, evento `idle` do mapa para emitir os limites visíveis.
- `Search.tsx`: novo estado de `bounds` incluído na query (`gte/lte` em `latitude`/`longitude`), com `range()` para paginação; deduplicação por grupo mantida.
- `PropertyCard.tsx`: carrossel controlado por índice local, sem biblioteca extra; resumo derivado dos campos existentes; `condo_fee`/`iptu` lidos das colunas atuais (verificar existência de `iptu` antes de exibir).
- Sem alterações de banco, RLS ou Edge Functions.
