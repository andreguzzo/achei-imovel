# Demarcação de áreas rurais no mapa

Adicionar ao cadastro do imóvel a possibilidade de definir os limites do terreno, por upload de arquivo KMZ/KML ou desenhando no mapa. A área demarcada passa a aparecer no mapa da página pública do imóvel.

## O que o corretor vai ver

No formulário de criação/edição do imóvel, uma nova seção "Área do imóvel" logo abaixo da localização:

- Campo de upload aceitando arquivos `.kmz` e `.kml`
- Ao subir, o mapa mostra a área demarcada e ajusta o enquadramento automaticamente
- Botão "Desenhar no mapa" para marcar os limites clicando ponto a ponto
- Depois de desenhado, os pontos podem ser arrastados para ajustar
- Botão "Limpar área" para remover a demarcação
- Mensagem de erro clara se o arquivo não tiver uma área válida

Na página pública do imóvel, o mapa exibe o contorno da área preenchido em azul translúcido, em vez de apenas o alfinete de localização. Quando não houver área definida, o mapa continua exatamente como é hoje.

## Detalhes técnicos

**Banco de dados**
- Nova coluna `boundary` (tipo `jsonb`) na tabela `properties`, guardando um GeoJSON `Polygon`/`MultiPolygon`. Nenhuma mudança nas políticas de acesso é necessária — a coluna herda as regras existentes da tabela.

**Leitura do KMZ**
- KMZ é um zip contendo um `doc.kml`. Usar `fflate` (leve, já compatível com o bundle) para descompactar no navegador e `DOMParser` para ler o KML.
- Extrair `<Polygon>` (incluindo `outerBoundaryIs`/`innerBoundaryIs` e `MultiGeometry`) das `Placemark`s e converter as coordenadas para GeoJSON.
- Limite de 5 MB por arquivo e validação de que existe pelo menos um polígono.

**Novos arquivos**
- `src/lib/kmlParser.ts` — descompacta KMZ, faz o parse do KML e devolve GeoJSON.
- `src/components/BoundaryEditor.tsx` — mapa Google com desenho manual, exibição do polígono importado, edição de vértices, limpar área. Reaproveita o hook `useGoogleMaps` existente e usa `google.maps.Polygon` com `editable`/`draggable` (sem a biblioteca Drawing, para manter o carregamento leve).

**Arquivos alterados**
- `src/pages/CreateProperty.tsx` — estado do polígono, seção nova no formulário, gravação e leitura de `boundary`.
- `src/components/PropertyMap.tsx` — aceita um polígono opcional e o desenha sobre o mapa.
- `src/pages/PropertyDetail.tsx` — repassa a área do imóvel ao mapa.
- Textos em português e inglês seguindo o padrão de i18n do formulário.

**Pacote novo**: `fflate`
