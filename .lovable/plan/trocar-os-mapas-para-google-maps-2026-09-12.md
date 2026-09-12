# Trocar os mapas para Google Maps

Sim, é possível. Hoje o site usa mapas OpenStreetMap (biblioteca Leaflet) em três lugares:

- Busca (`/busca`) — mapa com os preços dos imóveis e agrupamento de marcadores
- Página do imóvel — mapa de localização
- Cadastro/edição de imóvel — seletor de ponto no mapa (clicar/arrastar marcador)

Todos passam a usar o Google Maps, mantendo exatamente as mesmas funcionalidades.

## O que será feito

1. **Conexão com o Google Maps**: será aberto um cartão para você autorizar o serviço Google Maps. Sem isso, o mapa não carrega.
2. **Mapa da busca**: marcadores com o preço (vermelho para venda, roxo para aluguel), agrupamento quando há muitos imóveis próximos, balão com foto, título, endereço, link "Ver detalhes" e botão de compartilhar. Seleção sincronizada com a lista lateral.
3. **Mapa do imóvel**: marcador único centralizado no endereço.
4. **Seletor de localização no cadastro**: clicar no mapa ou arrastar o marcador atualiza latitude/longitude; botão "Usar minha localização" continua funcionando.
5. **Limpeza**: remoção das bibliotecas de mapa antigas depois que tudo estiver funcionando.

## Pontos de atenção

- O Google Maps é um serviço pago por uso. O uso aqui é apenas de exibição de mapa (o mais barato) e há um limite diário de proteção.
- Se você publicar em domínio próprio, será necessária uma chave própria do Google — aviso na hora.
- Nenhuma busca de endereço/autocomplete será adicionada nesta etapa; apenas a troca dos mapas.

## Detalhes técnicos

- Carregar a Maps JavaScript API com `loading=async` + `callback`, usando `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` e `channel=VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID`, via um hook `useGoogleMaps` que resolve um único script compartilhado.
- Sem `mapId`, sem `libraries=places`, sem AdvancedMarkerElement. Usar `google.maps.Marker`, `InfoWindow` e `clickableIcons: false`.
- Reescrever `src/components/PropertyMap.tsx`: marcadores de preço via ícone SVG/`label`, agrupamento com `@googlemaps/markerclusterer`, `fitBounds` mantendo a lógica atual de só reenquadrar quando o conjunto de imóveis muda, e `onBoundsChange` em `idle`.
- Reescrever `src/components/LocationPicker.tsx`: listener de `click` no mapa e marcador `draggable` com `dragend`, mesma interface de props.
- Substituir o mapa Leaflet em `src/pages/PropertyDetail.tsx`.
- Remover `leaflet`, `leaflet.markercluster` e seus tipos/CSS do projeto.
