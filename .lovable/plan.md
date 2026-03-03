

# Filtros Zillow-style para a Busca

## Situação Atual
A busca tem 5 filtros básicos escondidos num painel expansível: tipo de imóvel, comprar/alugar, preço min/max, quartos. A UX é diferente do Zillow, que usa **botões-dropdown inline na barra de filtros** (sempre visíveis, não escondidos).

## O que falta (inspirado no Zillow)

### 1. Barra de filtros inline (sempre visível)
Substituir o painel expansível por **botões-dropdown na própria barra**, cada um abrindo um Popover com opções:
- **Comprar / Alugar** - Toggle ou tabs
- **Preço** - Range com slider duplo + inputs min/max
- **Quartos & Banheiros** - Botões tipo "1+", "2+", "3+", "4+", "5+"
- **Tipo de imóvel** - Checkboxes (apartamento, casa, terreno, comercial)
- **Mais filtros** - Popover com: área mínima/máxima, vagas de garagem, condomínio, IPTU, features

### 2. Filtros adicionais (dados já existem na tabela)
Campos disponíveis na tabela `properties` que ainda não são filtráveis:
- `bathrooms` - Banheiros
- `parking_spots` - Vagas de garagem
- `area` - Área (m²)
- `condo_fee` - Condomínio
- `iptu` - IPTU
- `features` - Características (array text)

### 3. Comportamento Zillow-like
- Filtros aplicam **automaticamente** ao mudar (sem botão "Aplicar")
- Contagem de filtros ativos nos botões
- Tags/chips dos filtros ativos abaixo da barra com "X" para remover
- Ordenação (preço, data, relevância)
- Salvar busca (tabela `saved_searches` já existe)

## Plano de implementação

### Arquivo: `src/components/SearchFilters.tsx` (novo)
Componente com a barra de filtros Zillow-style usando Popovers do Radix. Cada filtro é um botão que abre um dropdown inline. Inclui:
- `PriceFilter` - Slider duplo + inputs
- `BedroomBathroomFilter` - Botões segmentados "qualquer, 1+, 2+, 3+, 4+, 5+"
- `PropertyTypeFilter` - Checkboxes múltiplos
- `MoreFiltersFilter` - Área, vagas, condomínio, features
- `SortSelect` - Ordenar por preço, data, relevância
- Chips de filtros ativos com remoção individual

### Arquivo: `src/pages/Search.tsx` (editar)
- Substituir painel de filtros pelo novo componente
- Adicionar novos estados para banheiros, área, vagas, ordenação
- Aplicação automática dos filtros (debounced)
- Sincronizar todos os filtros com URL params

### Arquivo: `src/i18n/locales/pt-BR.ts` e `en.ts` (editar)
- Adicionar traduções dos novos filtros

## Detalhes Técnicos

```text
┌──────────────────────────────────────────────────────────────────────┐
│  [🔍 Buscar...]  [Comprar▾] [Preço▾] [Quartos▾] [Tipo▾] [Mais▾] [Ordenar▾] [Mapa] │
├──────────────────────────────────────────────────────────────────────┤
│  Filtros ativos: [SP ✕] [2+ quartos ✕] [R$200k-500k ✕]            │
└──────────────────────────────────────────────────────────────────────┘
```

- Usa `Popover` do Radix para os dropdowns
- `Slider` duplo para range de preço e área
- `ToggleGroup` para quartos/banheiros
- `Checkbox` para tipo de imóvel e features
- Debounce de 300ms na aplicação automática
- URL sync bidirecional com `useSearchParams`

