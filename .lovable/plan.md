# Gestão de aluguéis no painel do corretor

Hoje o painel é todo voltado para venda (VGV, negociações, comissão de venda). Vamos criar uma área própria de **Locação**, com administração completa: contrato, aluguéis mensais, repasse ao proprietário, taxa de administração, inadimplência, vistorias e relatórios de receita recorrente.

## Nova seção no menu: "Locação"

Dentro dela, quatro áreas:

1. **Contratos** — lista de locações com inquilino, imóvel, valor do aluguel, início/fim, índice de reajuste (IGP-M/IPCA), data do próximo reajuste, garantia (fiador, caução, seguro-fiança), taxa de administração (%) e situação (ativo, em aviso, encerrado). Criar contrato a partir de um imóvel de aluguel já cadastrado.
2. **Aluguéis do mês** — quadro único com todas as parcelas: a receber, pagas, atrasadas. Marcar como pago, registrar valor/data, e ver o repasse calculado (aluguel − taxa de administração − encargos).
3. **Vistorias e documentos** — registro de vistoria de entrada/saída com fotos e observações, e documentos do contrato guardados na área protegida que já existe para imóveis.
4. **Relatórios de aluguel** — receita recorrente do mês, total de taxas de administração, inadimplência (valor e %), contratos vencendo em 90 dias e reajustes previstos.

## Avisos automáticos no "Resumo do dia"

- Aluguéis vencendo nos próximos 5 dias e aluguéis atrasados
- Contratos que vencem em até 90 dias (renovar ou desocupar)
- Reajustes a aplicar no mês

## Cobrança online (segunda etapa)

Você pediu cobrança de verdade (Pix/boleto). Isso depende de uma conta de pagamentos habilitada no Brasil para Pix e boleto, o que é uma configuração à parte do que já usamos para as assinaturas do site. Proposta:

- **Agora:** cada parcela ganha um link de cobrança que pode ser enviado ao inquilino por WhatsApp/e-mail, com registro de pago/atrasado dentro da plataforma.
- **Depois:** quando você confirmar a conta de pagamentos brasileira, ligamos a geração automática de Pix e boleto e a baixa automática da parcela quando o inquilino paga.

Assim a gestão já funciona inteira desde o primeiro dia e a cobrança automática entra sem retrabalho.

## Cronograma

- **Etapa 1** — base de dados de locação, contratos e parcelas geradas automaticamente até o fim do contrato
- **Etapa 2** — telas de Contratos e Aluguéis do mês, com baixa manual e cálculo de repasse
- **Etapa 3** — vistorias, documentos e envio de cobrança por WhatsApp/e-mail
- **Etapa 4** — relatórios de aluguel e avisos no resumo do dia
- **Etapa 5** — cobrança automática Pix/boleto (após a conta de pagamentos)

## Detalhes técnicos

- Novas tabelas: `rental_contracts` (property_id, broker_id, tenant, valor, encargos, índice, admin_fee_percent, garantia, datas, status), `rental_charges` (contract_id, competência, vencimento, valor, valor pago, data de pagamento, status, repasse), `rental_inspections` (contract_id, tipo entrada/saída, fotos, notas), `rental_payouts` opcional para consolidar repasse mensal. Todas com GRANT + RLS por `broker_id` e políticas de administrador equivalentes às existentes.
- Geração de parcelas por função `SECURITY DEFINER` ao criar/renovar contrato; reajuste aplicado por ação explícita do corretor (nunca automático sobre valores já emitidos).
- Frontend: `DashboardSidebar` ganha o grupo "Locação" com seções `locacoes`, `alugueis`, `vistorias`, e `Dashboard.tsx` roteia via `?secao=`. Novos componentes em `src/components/dashboard/rental/`.
- Relatórios de aluguel ficam separados de `BrokerAnalytics` (venda) para não misturar VGV com receita recorrente.
- Cobrança online usará Edge Function dedicada e webhook próprio, sem tocar no fluxo de assinaturas atual.
