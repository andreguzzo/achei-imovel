

## Mapa com visual mais limpo e compartilhamento de localização

### Situação atual
O mapa usa tiles do OpenStreetMap padrão via Leaflet, que têm um visual carregado com muitas cores e informações.

### Proposta

**1. Visual mais limpo do mapa**

Trocar o provedor de tiles para **CartoDB Voyager** — um estilo gratuito, moderno e limpo, muito similar ao visual do Google Maps, sem necessidade de API key:

```
https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
```

Alternativa ainda mais minimalista: **CartoDB Positron** (tons de cinza).

> Nota: usar o Google Maps diretamente exigiria uma API key paga do Google Cloud. O CartoDB Voyager oferece resultado visual muito próximo sem custo.

**2. Compartilhar localização do imóvel**

Adicionar um botão "Compartilhar" no popup do marcador do mapa que:
- Gera um link do Google Maps com as coordenadas (`https://www.google.com/maps?q=lat,lng`)
- Usa a Web Share API (nativa do celular) quando disponível, com fallback para copiar o link para a área de transferência

### Arquivos a editar
- `src/components/PropertyMap.tsx` — trocar tile layer e adicionar botão de compartilhar no popup

### Escopo técnico
- Substituir a URL do tile layer
- Atualizar a attribution do CartoDB
- Adicionar botão "Compartilhar" no HTML do popup com `navigator.share()` + fallback `navigator.clipboard`

