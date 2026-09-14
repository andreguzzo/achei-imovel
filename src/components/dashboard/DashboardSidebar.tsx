import { useMemo } from "react";
import {
  Home, Inbox, CalendarDays, Building2, Handshake, BarChart3,
  User, CreditCard, MessageCircle, ChevronsLeft, ChevronsRight,
  KeyRound, Receipt, ClipboardCheck, PieChart, QrCode, ShieldCheck, Users2, Users, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

export type DashboardSection =
  | "inicio" | "clientes" | "negociacoes" | "contatos" | "agenda"
  | "imoveis" | "parcerias" | "relatorios" | "perfil" | "assinatura" | "suporte"
  | "contratos" | "alugueis" | "vistorias" | "relatorios_locacao" | "cobranca_locacao"
  | "verificacao" | "equipe" | "financeiro";

export interface NavItem {
  key: DashboardSection;
  label: string;
  icon: typeof Home;
  brokerOnly?: boolean;
  professionalOnly?: boolean;
  agencyOnly?: boolean;
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const useDashboardNav = (badges?: Partial<Record<DashboardSection, number>>) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  return useMemo<NavGroup[]>(() => [
    {
      label: pt ? "Início" : "Home",
      items: [{ key: "inicio", label: pt ? "Resumo do dia" : "Today's summary", icon: Home }],
    },
    {
      label: pt ? "Clientes" : "Clients",
      items: [
        { key: "clientes", label: pt ? "Carteira de clientes" : "Buyer book", icon: Users, brokerOnly: true },
        { key: "atendimentos", label: pt ? "Atendimentos" : "Client desk", icon: Inbox, brokerOnly: true, badge: badges?.atendimentos },
        
      ],
    },
    {
      label: pt ? "Agenda" : "Calendar",
      items: [
        { key: "agenda", label: pt ? "Visitas e compromissos" : "Visits & appointments", icon: CalendarDays, brokerOnly: true, badge: badges?.agenda },
      ],
    },
    {
      label: pt ? "Imóveis" : "Properties",
      items: [
        { key: "imoveis", label: pt ? "Meus anúncios" : "My listings", icon: Building2 },
        { key: "parcerias", label: pt ? "Parcerias" : "Partnerships", icon: Handshake, brokerOnly: true, badge: badges?.parcerias },
      ],
    },
    {
      label: pt ? "Locação" : "Rentals",
      items: [
        { key: "contratos", label: pt ? "Contratos" : "Contracts", icon: KeyRound, brokerOnly: true, badge: badges?.contratos },
        { key: "alugueis", label: pt ? "Aluguéis do mês" : "Monthly charges", icon: Receipt, brokerOnly: true, badge: badges?.alugueis },
        { key: "vistorias", label: pt ? "Vistorias" : "Inspections", icon: ClipboardCheck, brokerOnly: true },
        { key: "cobranca_locacao", label: pt ? "Cobrança e recebimento" : "Billing setup", icon: QrCode, brokerOnly: true },
        { key: "relatorios_locacao", label: pt ? "Relatórios de locação" : "Rental reports", icon: PieChart, brokerOnly: true },
      ],
    },
    {
      label: pt ? "Desempenho" : "Performance",
      items: [
        { key: "relatorios", label: pt ? "Relatórios de venda" : "Sales reports", icon: BarChart3, brokerOnly: true },
        { key: "financeiro", label: pt ? "Financeiro" : "Finance", icon: Wallet, brokerOnly: true },
      ],
    },
    {
      label: pt ? "Conta" : "Account",
      items: [
        { key: "perfil", label: pt ? "Perfil e fotos" : "Profile & photos", icon: User },
        { key: "verificacao", label: pt ? "Verificação" : "Verification", icon: ShieldCheck, professionalOnly: true },
        { key: "equipe", label: pt ? "Equipe" : "Team", icon: Users2, agencyOnly: true },
        { key: "assinatura", label: pt ? "Assinatura" : "Subscription", icon: CreditCard },
        { key: "suporte", label: pt ? "Suporte" : "Support", icon: MessageCircle },
      ],
    },
  ], [pt, badges]);
};

interface DashboardSidebarProps {
  groups: NavGroup[];
  active: DashboardSection;
  onSelect: (section: DashboardSection) => void;
  isBroker: boolean;
  isProfessional?: boolean;
  isAgency?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const DashboardSidebar = ({
  groups, active, onSelect, isBroker, isProfessional = false, isAgency = false, collapsed, onToggleCollapsed,
}: DashboardSidebarProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  return (
    <nav
      className={cn(
        "flex h-full flex-col gap-1 transition-all duration-200",
        collapsed ? "w-16" : "w-full lg:w-60",
      )}
      aria-label={pt ? "Seções do painel" : "Dashboard sections"}
    >
      <div className="hidden lg:flex justify-end pb-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={onToggleCollapsed}
          title={collapsed ? (pt ? "Expandir menu" : "Expand menu") : (pt ? "Recolher menu" : "Collapse menu")}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </Button>
      </div>

      {groups.map((group) => {
        const items = group.items.filter(
          (i) =>
            (!i.brokerOnly || isBroker) &&
            (!i.professionalOnly || isProfessional) &&
            (!i.agencyOnly || isAgency),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
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
                    {!!item.badge && (
                      <span className={cn(
                        "rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground",
                        collapsed && "absolute",
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
};

export default DashboardSidebar;
