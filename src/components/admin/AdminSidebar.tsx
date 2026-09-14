import { useMemo } from "react";
import {
  Home, Users, Building2, Layers, CreditCard, Receipt, MessageCircle, ShieldCheck,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminSection =
  | "resumo" | "usuarios" | "verificacoes" | "imoveis" | "planos" | "assinaturas" | "financeiro" | "suporte";

export const ADMIN_SECTIONS: AdminSection[] = [
  "resumo", "usuarios", "verificacoes", "imoveis", "planos", "assinaturas", "financeiro", "suporte",
];

export interface AdminNavItem {
  key: AdminSection;
  label: string;
  icon: typeof Home;
  badge?: number;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const useAdminNav = (badges?: Partial<Record<AdminSection, number>>) =>
  useMemo<AdminNavGroup[]>(() => [
    { label: "Visão geral", items: [{ key: "resumo", label: "Resumo", icon: Home }] },
    {
      label: "Pessoas",
      items: [
        { key: "usuarios", label: "Usuários", icon: Users },
        { key: "verificacoes", label: "Verificações", icon: ShieldCheck, badge: badges?.verificacoes },
      ],
    },
    { label: "Catálogo", items: [{ key: "imoveis", label: "Imóveis", icon: Building2 }] },
    {
      label: "Financeiro",
      items: [
        { key: "planos", label: "Planos", icon: Layers },
        { key: "assinaturas", label: "Assinaturas", icon: CreditCard },
        { key: "financeiro", label: "Financeiro", icon: Receipt },
      ],
    },
    {
      label: "Atendimento",
      items: [{ key: "suporte", label: "Suporte", icon: MessageCircle, badge: badges?.suporte }],
    },
  ], [badges]);


interface AdminSidebarProps {
  groups: AdminNavGroup[];
  active: AdminSection;
  onSelect: (section: AdminSection) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const AdminSidebar = ({ groups, active, onSelect, collapsed, onToggleCollapsed }: AdminSidebarProps) => (
  <nav
    className={cn(
      "flex h-full flex-col gap-1 transition-all duration-200",
      collapsed ? "w-16" : "w-full lg:w-60",
    )}
    aria-label="Seções do painel administrativo"
  >
    <div className="hidden lg:flex justify-end pb-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        onClick={onToggleCollapsed}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
      </Button>
    </div>

    {groups.map((group) => (
      <div key={group.label} className="mb-2">
        {!collapsed && (
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
        )}
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                {!!item.badge && !collapsed && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </nav>
);

export default AdminSidebar;
