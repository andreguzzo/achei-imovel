

## Plano: Atualizar imagens do hero

### O que muda
- **Manter**: `rio.jpg`, `sao-paulo-new.jpg`, `recife-new.jpg`
- **Remover**: `salvador-new.jpg`, `brasilia-new.jpg`, `floripa-new.jpg`, `curitiba-new.jpg`, `bh-new.jpg`
- **Adicionar 5 novas imagens** com temas variados:
  1. Parque urbano brasileiro (ex: Ibirapuera ou similar)
  2. Rua de bairro histórico / arquitetura colonial
  3. Skyline / prédios modernos
  4. Interior de apartamento moderno (sala de estar)
  5. Interior de casa (cozinha ou quarto aconchegante)

### Implementação
1. Deletar os 5 arquivos de imagem não desejados
2. Baixar 5 novas imagens com os temas acima para `public/images/cities/` (ou `public/images/interiors/` conforme o tema)
3. Atualizar o array `HERO_IMAGES` em `src/pages/Index.tsx` para referenciar as 8 imagens (3 cidades + 5 novas)

### Observação
Como não consigo pré-visualizar as imagens no chat, vou buscar imagens de alta qualidade e sem direitos autorais. Após implementar, você pode conferir no preview e me dizer se quer trocar alguma.

