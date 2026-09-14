export const AGENCY_PERMISSIONS = [
  { key: "imoveis", label: "Imóveis" },
  { key: "locacao", label: "Locação" },
  { key: "vendas", label: "Vendas e clientes" },
  { key: "agenda", label: "Agenda" },
  { key: "relatorios", label: "Relatórios" },
  { key: "financeiro", label: "Financeiro e cobrança" },
  { key: "documentos", label: "Documentos sigilosos" },
  { key: "parcerias", label: "Parcerias" },
  { key: "equipe", label: "Gestão da equipe" },
] as const;

export type AgencyPermission = (typeof AGENCY_PERMISSIONS)[number]["key"];

export type PermissionMap = Partial<Record<AgencyPermission, boolean>>;

export const DEFAULT_PERMISSIONS: PermissionMap = {
  imoveis: true,
  vendas: true,
  agenda: true,
};

export function permissionLabel(key: string) {
  return AGENCY_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
}
