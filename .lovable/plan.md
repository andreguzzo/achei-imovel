

# LarBrasil — Plano Atualizado com Agentes de IA

## Tudo que já estava planejado permanece (Home, Busca, Detalhes, Auth, Dashboards, Simulador, i18n, etc.)

## Novas Funcionalidades: Agentes de IA

### 10. Assistente IA para Criação de Anúncios (Corretor/Anunciante)
No painel do corretor, ao cadastrar um imóvel, um assistente de IA ajuda a elaborar o anúncio:
- O corretor preenche dados básicos (tipo, área, quartos, bairro, diferenciais) e opcionalmente anexa fotos
- Botão "Gerar anúncio com IA" cria título atrativo e descrição completa e persuasiva em português
- O corretor pode refinar pedindo ajustes ("mais formal", "destaque a vista", "mencione proximidade do metrô")
- Interface de chat inline ao lado do formulário de cadastro
- Sugestões automáticas de palavras-chave e destaques baseados nas características do imóvel
- Geração bilíngue (PT-BR e EN) para alcançar compradores estrangeiros
- Implementação via Edge Function usando Lovable AI Gateway (Gemini)

### 11. Assistente IA de Análise de Localização (Comprador)
Na página de detalhes do imóvel, uma seção "Análise do Bairro" powered by IA:
- Ao abrir, o comprador vê um botão "Analisar localização com IA"
- A IA gera um panorama completo do bairro/região contendo:
  - **Prós e contras** da localidade (segurança, barulho, trânsito, áreas verdes)
  - **Preços médios** de imóveis similares na região (baseado nos dados do banco)
  - **Infraestrutura**: escolas, hospitais, transporte, comércio próximo
  - **Tendência de valorização**: análise geral da região
  - **Perfil do bairro**: ideal para famílias, jovens, investidores, etc.
- Interface em formato de relatório com seções expansíveis
- Opção de fazer perguntas de follow-up via chat ("É seguro à noite?", "Tem metrô perto?")
- Também bilíngue conforme idioma selecionado pelo usuário
- Implementação via Edge Function usando Lovable AI Gateway (Gemini)

### Backend para os Agentes
- Duas Edge Functions: `ai-listing-assistant` e `ai-location-analysis`
- Ambas usam Lovable AI Gateway com `LOVABLE_API_KEY`
- System prompts especializados para cada caso (especialista imobiliário brasileiro)
- Suporte a streaming para respostas em tempo real
- Os dados de imóveis do banco são passados como contexto para a IA de localização

### Ordem de Implementação Atualizada
1. Estrutura base, layout, header/footer, i18n
2. Supabase: auth + tabelas + RLS
3. Home page com busca
4. Listagem de resultados com filtros
5. Página de detalhes do imóvel
6. Simulador de financiamento
7. Painel do usuário (favoritos, buscas salvas)
8. Painel do corretor (CRUD de imóveis)
9. **Assistente IA para criação de anúncios** (integrado ao painel do corretor)
10. **Assistente IA de análise de localização** (integrado à página do imóvel)
11. Painel admin
12. Refinamentos visuais e responsividade

