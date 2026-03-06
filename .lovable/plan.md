

## Revisao Geral do Sistema - Cronograma de Testes

Abaixo esta o cronograma organizado por modulos, em ordem de prioridade (fluxos criticos primeiro).

---

### Fase 1 - Autenticacao e Perfil (base de tudo)

| # | Teste | O que verificar |
|---|-------|-----------------|
| 1.1 | Cadastro de usuario | Preencher formulario em `/cadastro`, verificar se cria conta e perfil |
| 1.2 | Login / Logout | Login em `/login`, sessao persistida, logout funcional |
| 1.3 | Esqueci senha | Fluxo `/esqueci-senha` → email → `/redefinir-senha` |
| 1.4 | Verificacao de email | Codigo de verificacao no painel (`EmailVerification`) |
| 1.5 | Edicao de perfil | No painel, alterar nome, CRECI, WhatsApp, redes sociais, foto de perfil e banner |

---

### Fase 2 - Cadastro e Gestao de Imoveis

| # | Teste | O que verificar |
|---|-------|-----------------|
| 2.1 | Criar imovel | Fluxo completo em `/anunciar` (todos os cards ate titulo/descricao com IA) |
| 2.2 | Upload de fotos | Adicionar, reordenar e remover fotos do imovel |
| 2.3 | Video URL | Adicionar URL de video ao imovel |
| 2.4 | Dados privados | Preencher dados do proprietario (PrivateInfoCard) |
| 2.5 | Editar imovel | Acessar `/editar/:id`, verificar se carrega dados existentes |
| 2.6 | Alterar status | No painel, mudar status para vendido/inativo e verificar reflexo nos relatorios |
| 2.7 | Excluir imovel | Deletar imovel no painel |
| 2.8 | Clicar no imovel no painel | Verificar se redireciona para `/imovel/:id` |

---

### Fase 3 - Pagina Publica do Imovel

| # | Teste | O que verificar |
|---|-------|-----------------|
| 3.1 | Visualizacao do anuncio | Fotos, descricao, mapa, detalhes em `/imovel/:id` |
| 3.2 | Card do corretor | Nome, CRECI, foto de perfil, botao WhatsApp com mensagem padrao |
| 3.3 | Formulario de contato (anonimo) | Enviar mensagem SEM estar logado - deve funcionar via edge function `send-contact` |
| 3.4 | Formulario de contato (logado) | Enviar mensagem estando logado |
| 3.5 | Contador de visualizacoes | Verificar se `view_count` incrementa |

---

### Fase 4 - Busca e Favoritos

| # | Teste | O que verificar |
|---|-------|-----------------|
| 4.1 | Busca com filtros | Filtrar por cidade, tipo, preco, quartos em `/busca` |
| 4.2 | Mapa de resultados | Markers no mapa (Leaflet) correspondem aos resultados |
| 4.3 | Favoritar imovel | Adicionar/remover favorito, verificar em `/favoritos` |

---

### Fase 5 - Painel do Corretor (Gestao de Vendas)

| # | Teste | O que verificar |
|---|-------|-----------------|
| 5.1 | Contatos recebidos | Tab "Contatos" lista mensagens recebidas |
| 5.2 | Converter contato em lead | Botao "Salvar Lead" cria entrada no pipeline |
| 5.3 | Pipeline de vendas | Mover lead entre stages (lead → negociacao → closed_won) |
| 5.4 | VGV Ativo (clicavel) | Clicar mostra lista de imoveis ativos para venda |
| 5.5 | VGV Realizado (clicavel) | Clicar mostra imoveis vendidos com preco correto |
| 5.6 | Comissoes | Verificar calculo (pipeline + vendas diretas sem duplicidade) |
| 5.7 | Agenda | Criar, editar e completar compromissos (BrokerAgenda) |
| 5.8 | Propostas/Parcerias | Enviar e aceitar parcerias (BrokerProposals) |

---

### Fase 6 - Pagina Publica do Corretor

| # | Teste | O que verificar |
|---|-------|-----------------|
| 6.1 | Perfil publico | `/corretor/:username` exibe dados, bio, CRECI |
| 6.2 | Banner e foto de perfil | Imagens definidas no painel aparecem corretamente |
| 6.3 | Botao "Ver fotos" | Lightbox abre com galeria de fotos do corretor |
| 6.4 | Listagem de imoveis | Imoveis ativos do corretor aparecem na pagina |

---

### Fase 7 - Planos e Assinatura

| # | Teste | O que verificar |
|---|-------|-----------------|
| 7.1 | Pagina de planos | `/planos` exibe opcoes com precos |
| 7.2 | Checkout Stripe | Botao de assinar redireciona para Stripe (edge function `create-checkout`) |
| 7.3 | Verificar assinatura | `check-subscription` retorna status correto |
| 7.4 | Portal do cliente | Botao "Gerenciar assinatura" abre portal Stripe |
| 7.5 | Card de assinatura no painel | `SubscriptionCard` mostra plano ativo e data |

---

### Fase 8 - Admin

| # | Teste | O que verificar |
|---|-------|-----------------|
| 8.1 | Acesso restrito | Apenas usuarios com role `admin` acessam `/admin` |
| 8.2 | Metricas | Tab de metricas carrega dados |
| 8.3 | Gestao de usuarios | Listar, buscar, resetar senha |
| 8.4 | Gestao de imoveis | Listar e moderar imoveis |
| 8.5 | Assinaturas | Listar assinantes via `admin-list-subscribers` |
| 8.6 | Suporte | Visualizar e responder mensagens de suporte |

---

### Fase 9 - Outros

| # | Teste | O que verificar |
|---|-------|-----------------|
| 9.1 | Homepage | Hero, cards de cidades/estados, CTA |
| 9.2 | Financiamento | Simulador em `/financiamento` |
| 9.3 | Idioma PT-BR / EN | Trocar idioma e verificar traducoes |
| 9.4 | Responsividade | Testar em mobile (header hamburger, cards empilhados) |
| 9.5 | 404 | Acessar rota inexistente mostra NotFound |
| 9.6 | Suporte | Enviar ticket via `SupportForm` no painel |

---

### Recomendacao de execucao

Sugiro comecarmos pela **Fase 1** (autenticacao) ja que e pre-requisito para quase tudo. Posso testar cada fase usando o navegador automatizado e reportar bugs encontrados. Qual fase voce quer que eu comece a testar primeiro?

