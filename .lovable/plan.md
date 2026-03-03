

# Próximos Passos - Abitzo

## O que já está pronto
- Homepage com imóveis reais do banco
- Busca com filtros
- Página de detalhes do imóvel (com seção de corretores agrupados e parcerias)
- Painel de vendas do corretor (Kanban + indicadores)
- Simulador de financiamento (SAC/Price)
- Formulário de anúncio de imóvel
- Login/Cadastro com autenticação
- Agrupamento automático de imóveis (backend)

## Funcionalidades ausentes (sugestões priorizadas)

### 1. Página de Favoritos (`/favoritos`)
A tabela `favorites` já existe com RLS. Falta apenas a página frontend para listar imóveis favoritados e o botão de coração funcional no PropertyCard.

### 2. Perfil do Corretor / Painel do Usuário (`/painel`)
O Header já tem link para `/painel` mas a rota não existe. Criar página com:
- Edição de dados pessoais (nome, telefone, CRECI, avatar)
- Listagem dos imóveis do corretor com ações de editar/excluir
- Resumo de contatos recebidos

### 3. Página de contato / Envio de mensagem ao corretor
A tabela `contact_requests` existe. Adicionar formulário na página de detalhes do imóvel para visitantes enviarem mensagens ao corretor.

### 4. Atualizar i18n
As traduções PT-BR e EN não cobrem as novas seções (pipeline, parcerias, financiamento, criação de imóvel). Completar ambos os arquivos de locale.

### 5. Melhorias visuais
- Imagens hero na homepage
- Seção de cidades populares
- Responsividade mobile refinada

## Ordem sugerida
1. Favoritos (rápido, tabela já existe)
2. Painel do usuário/corretor
3. Formulário de contato na página de detalhes
4. i18n completo
5. Melhorias visuais

