# Parcerias: anúncio consolidado por imóvel

Hoje cada corretor cria um anúncio próprio e o agrupamento automático é invisível para o público: o mesmo imóvel pode aparecer várias vezes na busca. A proposta é ter **um anúncio consolidado por imóvel**, com subanúncios de cada corretor, e formalizar os tipos de parceria do mercado.

## Como vai funcionar

**1. Cadastro com detecção de duplicado**
Ao cadastrar um imóvel, o sistema verifica se já existe anúncio no mesmo endereço/cidade com tipo e área semelhantes. Se existir, o corretor vê o anúncio consolidado encontrado e duas opções:
- Solicitar participação nesse imóvel (escolhendo o tipo de parceria);
- Confirmar que é outro imóvel e criar um anúncio consolidado novo.

**2. Solicitação sempre aprovada pelo captador**
O corretor que captou o imóvel recebe a solicitação em Parcerias e aprova ou recusa, definindo:
- **Tipo de parceria**: captação conjunta, parceria de venda, ou imóvel sem exclusividade (autorizado pelo proprietário);
- **Divisão de comissão** (%);
- Observações/termos.
Enquanto pendente, o subanúncio do solicitante não aparece publicamente.

**3. Anúncio consolidado público**
- A busca e o mapa passam a mostrar **um cartão por imóvel**, com a faixa de preço quando os corretores anunciarem valores diferentes e um selo "X corretores".
- Na página do imóvel: dados do imóvel (fotos, descrição, mapa, limites rurais) uma única vez, **captador em destaque** no card de contato, e abaixo a lista de corretores parceiros com o tipo de parceria e o preço de cada um. Cada parceiro tem seu próprio botão de contato/WhatsApp (respeitando a regra de só exibir contato para quem está logado).

**4. Painel do corretor**
A aba Parcerias passa a ter três blocos:
- **Solicitações recebidas** (aprovar/recusar, definindo tipo e divisão);
- **Solicitações enviadas** (pendente/aprovada/recusada);
- **Parcerias ativas**, agrupadas por imóvel, com tipo, divisão de comissão e ação de encerrar a participação.
A busca por corretor e a proposta direta de parceria continuam disponíveis.

## Detalhes técnicos

**Banco**
- `property_groups`: adicionar `primary_broker_id` (captador), `exclusive boolean default true`, `title`, `description`, `price_from`/`price_to` derivados; `is_partnership_only boolean` para separar os grupos artificiais criados hoje pela RPC `create_partnership_group`.
- `property_group_members`: adicionar `role` (`captador` | `parceiro`), `partnership_type` enum novo (`co_listing`, `sale_partnership`, `non_exclusive`), `status` (`pending` | `approved` | `declined`), `commission_split numeric`, `approved_at`, `requested_by`.
- Novo enum `partnership_type`. RLS: leitura pública apenas de membros `approved`; escrita restrita ao próprio corretor (solicitar) e ao `primary_broker_id` (aprovar/recusar) via política com `EXISTS` sobre `property_groups`.
- Função `SECURITY DEFINER` `find_property_group(address, city, state, property_type, area)` para detecção de duplicado sem expor dados privados, e `request_group_membership(...)` / `respond_group_membership(...)` para as transições de status.
- Ajustar `find_or_create_property_group()` para marcar o primeiro membro como `captador`/`approved` e os demais como `pending`, mantendo o grupo de partnership fora do fluxo público.
- Manter `broker_partnerships` para os termos financeiros, referenciando o `group_id` real do imóvel.

**Frontend**
- `CreateProperty.tsx`: passo de verificação de duplicado antes do salvar, com diálogo de escolha.
- `Search.tsx` / `PropertyCard.tsx`: consultar via grupo, deduplicando por `group_id` e exibindo faixa de preço e contagem de corretores.
- `PropertyDetail.tsx`: reaproveitar o bloco `groupBrokers` já existente, mostrando captador em destaque, tipo de parceria e preço por corretor.
- `DashboardSalesTab.tsx` (aba Parcerias) e `BrokerTab.tsx`: novos blocos de solicitações recebidas/enviadas e parcerias ativas por imóvel.
- i18n pt-BR/en para todos os rótulos novos.

**Fora de escopo**
- Cálculo automático de rateio de comissão no fechamento;
- Validação documental da autorização do proprietário (fica como campo de observação/anexo já existente no cofre de documentos).
