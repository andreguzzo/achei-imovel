# Revisão geral do Abitzo: falhas encontradas e cronograma

Levantamento feito agora sobre o código, o banco e a varredura de segurança. A compilação está OK — os problemas abaixo são de segurança, privacidade, desempenho e organização.

## O que foi encontrado

### Privacidade e segurança
1. **Telefone e WhatsApp dos corretores visíveis para qualquer visitante.** A tabela de perfis é pública, então robôs podem coletar todos os contatos em massa. Correção: manter nome, foto, bio e CRECI públicos e liberar telefone/WhatsApp apenas por um caminho controlado (visitante identificado ou envio pelo formulário de contato).
2. **Proteção contra senhas vazadas desligada.** Ativar a verificação para bloquear senhas já expostas em vazamentos conhecidos.
3. **Funções internas do banco chamáveis por qualquer visitante.** Restringir a execução às pessoas que realmente precisam (ex.: contador de visitas continua público, criação de parceria só para corretores).
4. **Rotas privadas sem proteção real.** `/painel`, `/anunciar`, `/editar/:id` e `/admin` hoje só escondem o conteúdo; falta redirecionar quem não está logado (e quem não é admin) antes de a página carregar.

### Funcionamento e conteúdo
5. **Página de vendas duplicada.** `/corretor/vendas` repete o que já existe no painel unificado; manter uma só evita divergência de números.
6. **Imagem de compartilhamento é a padrão da Lovable.** Ao compartilhar um imóvel ou o site no WhatsApp aparece uma imagem genérica; usar a marca Abitzo e, nas páginas de imóvel, título/descrição próprios.
7. **Sem mapa do site nem endereço canônico.** Isso limita o aparecimento no Google.
8. **Sem página de erro amigável para falhas inesperadas** — hoje uma falha em uma aba pode deixar a tela branca.

### Desempenho
9. **Arquivos muito grandes** (cadastro de imóvel com 822 linhas, relatórios com 749, painel com 673). Dificultam manutenção e deixam o carregamento inicial mais pesado.
10. **Todo o site carrega de uma vez.** Painel, admin, criação de imóvel e mapas podem ser carregados só quando abertos, deixando a home e a busca visivelmente mais rápidas.
11. **Fotos antigas não foram otimizadas.** A compressão só vale para envios novos; vale uma rotina para reprocessar o acervo existente.

### Qualidade
12. **Praticamente sem testes automatizados** (apenas um teste de exemplo). Sem rede de segurança, cada correção pode reintroduzir bugs já resolvidos.
13. **Restos de código frágil**: cerca de 30 pontos com tipos "soltos" e mensagens de depuração no console.

## Cronograma sugerido

**Etapa 1 — Segurança (fazer primeiro)**
- Proteger telefone/WhatsApp dos corretores
- Ativar proteção de senhas vazadas
- Restringir execução das funções internas
- Proteger de verdade as rotas privadas e o admin

**Etapa 2 — Correções de experiência**
- Unificar a gestão de vendas em um único lugar
- Imagem e textos de compartilhamento próprios por imóvel
- Tela de erro amigável em vez de tela branca

**Etapa 3 — Velocidade**
- Carregar painel/admin/mapas somente quando abertos
- Dividir os arquivos maiores
- Rotina para otimizar as fotos já cadastradas

**Etapa 4 — SEO**
- Mapa do site, endereço canônico e dados estruturados de imóvel

**Etapa 5 — Testes**
- Testes das regras de negócio (VGV, comissões, filtros, favoritos, limites do plano)
- Roteiro de teste guiado das telas críticas

## Detalhes técnicos

- **Perfis**: nova coluna/visão pública sem `phone`/`whatsapp`, `REVOKE SELECT` de `anon` na tabela, política de leitura completa apenas para `authenticated` (ou função `SECURITY DEFINER` que devolve contato mediante registro em `contact_requests`). Ajustar `BrokerProfile`, `PropertyDetail` e `ContactForm`.
- **Auth**: `configure_auth` para leaked-password protection.
- **Funções**: `REVOKE EXECUTE ... FROM anon` em `create_partnership_group`, `has_role`, `sync_broker_role`, `find_or_create_property_group`; manter `increment_view_count` para `anon`.
- **Rotas**: componentes `RequireAuth` / `RequireAdmin` em `App.tsx` com `Navigate` e estado de carregamento do `useAuth`.
- **Code-splitting**: `React.lazy` + `Suspense` para `Dashboard`, `Admin`, `CreateProperty`, `BrokerSales`; `PropertyMap`/`BoundaryEditor` em import dinâmico.
- **SEO**: `react-helmet`-like via efeito de `document.title`/meta em `PropertyDetail` e `BrokerProfile`, `public/sitemap.xml` gerado no build, `<link rel="canonical">`, JSON-LD `RealEstateListing`.
- **Erro**: `ErrorBoundary` em `MainLayout`.
- **Testes**: Vitest para `src/lib/*` e cálculos de VGV/comissão extraídos de `BrokerAnalytics`.
- **Fotos legadas**: Edge Function/rotina administrativa que baixa, recomprime (1920px/80%) e reenvia ao bucket `property-images`.
