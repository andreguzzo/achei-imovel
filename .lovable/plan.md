

# Plano: Agrupamento de Anuncios + Painel de Gestão do Corretor

## 1. Agrupamento de Imóveis Duplicados (Anuncio Coletivo + Parcerias)

### Conceito
Quando dois ou mais corretores anunciam o mesmo imóvel (identificado por endereço + tipo + area similar), o sistema agrupa automaticamente em um "anuncio coletivo". O comprador vê um unico card com a lista de corretores disponíveis. Corretores podem formalizar parcerias de venda entre si.

### Novas tabelas no banco de dados

```text
property_groups
├── id (uuid, PK)
├── canonical_address (text)       -- endereço normalizado
├── city, state, neighborhood
├── property_type (enum)
├── area_approx (numeric)          -- área aproximada para matching
├── created_at

property_group_members
├── id (uuid, PK)
├── group_id (uuid, FK → property_groups)
├── property_id (uuid, FK → properties)
├── broker_id (uuid)               -- user_id do corretor
├── joined_at

broker_partnerships
├── id (uuid, PK)
├── group_id (uuid, FK → property_groups)
├── broker_a_id (uuid)
├── broker_b_id (uuid)
├── status (enum: pending, active, declined, completed)
├── commission_split (numeric)     -- % do broker_a (ex: 50)
├── terms (text)                   -- termos livres
├── created_at, updated_at
```

### Lógica de agrupamento
- Database function `find_or_create_group` que normaliza endereço e busca grupo existente com mesma cidade + bairro + endereço similar + tipo + area (tolerância de 10%)
- Trigger `after insert` em `properties` que chama essa function automaticamente
- Na busca, query agrupa por `group_id` e mostra o menor preço + quantidade de corretores

### Frontend
- **PropertyCard**: badge "X corretores" quando grupo tem mais de 1 membro
- **Página de detalhes**: seção "Corretores que anunciam este imóvel" com perfil, CRECI, preço de cada um
- **Botão "Propor parceria"**: corretor logado pode enviar proposta de parceria a outro corretor do mesmo grupo, definindo split de comissão
- **Painel do corretor**: aba "Parcerias" para gerenciar propostas recebidas/enviadas

### RLS
- `property_groups` e `property_group_members`: SELECT publico, INSERT/UPDATE restrito a owners
- `broker_partnerships`: SELECT/INSERT/UPDATE restrito aos dois brokers envolvidos

---

## 2. Painel de Gestão de Vendas do Corretor

### Nova tabela

```text
sales_pipeline
├── id (uuid, PK)
├── broker_id (uuid)
├── property_id (uuid, FK → properties)
├── client_name (text)
├── client_email, client_phone (text)
├── stage (enum: lead, visit_scheduled, visited, proposal, negotiation, documentation, closed_won, closed_lost)
├── notes (text)
├── expected_close_date (date)
├── actual_close_date (date)
├── commission_value (numeric)
├── created_at, updated_at

sale_documents
├── id (uuid, PK)
├── pipeline_id (uuid, FK → sales_pipeline)
├── name (text)
├── file_url (text)
├── document_type (text)          -- contrato, procuração, certidão, etc.
├── uploaded_at
```

### Frontend — Página `/corretor/vendas`
- **Kanban board** com colunas por stage (Lead → Visita → Proposta → Negociação → Documentação → Fechado)
- Cards arrastáveis com nome do cliente, imóvel, valor
- **Indicadores no topo**: total de leads, visitas agendadas, propostas ativas, vendas fechadas no mês, comissão acumulada
- **Detalhe do pipeline**: modal/drawer com timeline, notas, upload de documentos
- **Gráficos**: funil de conversão e evolução mensal (usando recharts, já instalado)

### RLS
- `sales_pipeline` e `sale_documents`: todas operações restritas a `auth.uid() = broker_id`

### Rota e navegação
- Nova rota `/corretor/vendas` dentro do MainLayout
- Link no Header para corretores autenticados com role `broker`

---

## Ordem de implementação

1. **Migration SQL**: criar tabelas `property_groups`, `property_group_members`, `broker_partnerships`, `sales_pipeline`, `sale_documents` + enums + RLS + function de agrupamento
2. **Agrupamento no frontend**: atualizar PropertyCard e criar seção de corretores na página de detalhes
3. **Sistema de parcerias**: UI para propor/aceitar/recusar parcerias
4. **Painel de vendas do corretor**: página com kanban, indicadores e gestão de documentos
5. **Atualizar i18n**: adicionar traduções PT-BR e EN para as novas seções

