import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, Building2, MessageSquare, TrendingUp, Handshake, UserPlus, Clock,
  MessageCircle, Eye, Loader2, AlertTriangle, CreditCard, ChevronRight,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import type { AdminSection } from "@/components/admin/AdminSidebar";

interface Metrics {
  totalUsers: number;
  totalBrokers: number;
  totalProperties: number;
  activeProperties: number;
  soldProperties: number;
  totalViews: number;
  totalContacts: number;
  totalPipeline: number;
  openSupport: number;
  inactiveProperties: number;
  expiringSubs: number;
}

interface RecentUser {
  full_name: string | null;
  creci: string | null;
  created_at: string;
}

interface SupportRow {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

const timeAgo = (date: string) => {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
};

interface AdminOverviewProps {
  onNavigate: (section: AdminSection) => void;
}

const AdminOverview = ({ onNavigate }: AdminOverviewProps) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentSupport, setRecentSupport] = useState<SupportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const [
        profiles, roles, allProps, activeProps, soldProps, inactiveProps,
        contacts, pipeline, viewsRes, recentProfiles, supportMsgs, openSupportCount, expiring,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "broker"),
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "sold"),
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("status", "inactive"),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }),
        supabase.from("sales_pipeline").select("id", { count: "exact", head: true }),
        supabase.from("properties").select("view_count"),
        supabase.from("profiles").select("full_name, creci, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("support_messages").select("id, subject, message, status, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("subscription_overrides").select("id", { count: "exact", head: true })
          .is("cancelled_at", null).not("expires_at", "is", null).lte("expires_at", soon),
      ]);

      setMetrics({
        totalUsers: profiles.count ?? 0,
        totalBrokers: roles.count ?? 0,
        totalProperties: allProps.count ?? 0,
        activeProperties: activeProps.count ?? 0,
        soldProperties: soldProps.count ?? 0,
        inactiveProperties: inactiveProps.count ?? 0,
        totalViews: (viewsRes.data ?? []).reduce((sum, p) => sum + (p.view_count ?? 0), 0),
        totalContacts: contacts.count ?? 0,
        totalPipeline: pipeline.count ?? 0,
        openSupport: openSupportCount.count ?? 0,
        expiringSubs: expiring.count ?? 0,
      });
      setRecentUsers((recentProfiles.data as RecentUser[]) ?? []);
      setRecentSupport((supportMsgs.data as SupportRow[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!metrics) return null;

  const cards: { label: string; value: number; icon: typeof Users; section: AdminSection }[] = [
    { label: "Usuários", value: metrics.totalUsers, icon: Users, section: "usuarios" },
    { label: "Corretores", value: metrics.totalBrokers, icon: Handshake, section: "usuarios" },
    { label: "Imóveis totais", value: metrics.totalProperties, icon: Building2, section: "imoveis" },
    { label: "Imóveis ativos", value: metrics.activeProperties, icon: TrendingUp, section: "imoveis" },
    { label: "Imóveis vendidos", value: metrics.soldProperties, icon: Building2, section: "imoveis" },
    { label: "Negociações", value: metrics.totalPipeline, icon: TrendingUp, section: "imoveis" },
    { label: "Visualizações", value: metrics.totalViews, icon: Eye, section: "imoveis" },
    { label: "Contatos", value: metrics.totalContacts, icon: MessageSquare, section: "suporte" },
    { label: "Suporte aberto", value: metrics.openSupport, icon: MessageCircle, section: "suporte" },
  ];

  const attention = [
    metrics.openSupport > 0 && {
      icon: MessageCircle,
      label: `${metrics.openSupport} chamado(s) de suporte aguardando resposta`,
      section: "suporte" as AdminSection,
    },
    metrics.inactiveProperties > 0 && {
      icon: Building2,
      label: `${metrics.inactiveProperties} imóvel(is) inativo(s) para revisar`,
      section: "imoveis" as AdminSection,
    },
    metrics.expiringSubs > 0 && {
      icon: CreditCard,
      label: `${metrics.expiringSubs} assinatura(s) vencendo nos próximos 7 dias`,
      section: "assinaturas" as AdminSection,
    },
  ].filter(Boolean) as { icon: typeof Users; label: string; section: AdminSection }[];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Resumo"
        description="Panorama da plataforma: usuários, anúncios, receita e atendimento."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <button key={c.label} type="button" onClick={() => onNavigate(c.section)} className="text-left">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="rounded-lg bg-primary/10 p-2 text-primary"><c.icon className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold">{c.value.toLocaleString("pt-BR")}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-primary" /> Precisa de atenção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada pendente por aqui. Tudo em ordem.</p>
          ) : attention.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onNavigate(a.section)}
              className="flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted"
            >
              <a.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">{a.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-5 w-5 text-primary" /> Novos usuários</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário recente</p>
            ) : recentUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{u.full_name ?? "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{u.creci ? `CRECI: ${u.creci}` : "Sem CRECI"}</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{timeAgo(u.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-5 w-5 text-primary" /> Suporte recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSupport.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem de suporte</p>
            ) : recentSupport.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onNavigate("suporte")}
                className="flex w-full items-center justify-between border-b pb-2 text-left text-sm last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{m.subject}</p>
                    <Badge variant={m.status === "open" ? "default" : "secondary"} className="shrink-0 text-[10px]">
                      {m.status === "open" ? "Aberto" : m.status === "replied" ? "Respondido" : "Fechado"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{m.message}</p>
                </div>
                <span className="ml-2 flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{timeAgo(m.created_at)}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
