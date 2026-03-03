import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Eye, MessageSquare, TrendingUp, Handshake, UserPlus, Clock, MessageCircle } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
}

interface RecentUser {
  full_name: string | null;
  creci: string | null;
  created_at: string;
}

const AdminMetricsTab = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [recentSupport, setRecentSupport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [profiles, roles, properties, contacts, pipeline, recentProfiles, supportMsgs] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "broker"),
        supabase.from("properties").select("status, view_count"),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }),
        supabase.from("sales_pipeline").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("full_name, creci, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("support_messages").select("*").order("created_at", { ascending: false }).limit(5),
      ]);

      const props = properties.data ?? [];
      const totalViews = props.reduce((s, p) => s + (p.view_count ?? 0), 0);
      const openSupport = (supportMsgs.data ?? []).filter((m: any) => m.status === "open").length;

      setMetrics({
        totalUsers: profiles.count ?? 0,
        totalBrokers: roles.count ?? 0,
        totalProperties: props.length,
        activeProperties: props.filter(p => p.status === "active").length,
        soldProperties: props.filter(p => p.status === "sold").length,
        totalViews,
        totalContacts: contacts.count ?? 0,
        totalPipeline: pipeline.count ?? 0,
        openSupport,
      });
      setRecentUsers((recentProfiles.data as RecentUser[]) ?? []);
      setRecentSupport(supportMsgs.data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!metrics) return null;

  const cards = [
    { label: "Usuários", value: metrics.totalUsers, icon: Users, color: "text-blue-500" },
    { label: "Corretores", value: metrics.totalBrokers, icon: Handshake, color: "text-emerald-500" },
    { label: "Imóveis Totais", value: metrics.totalProperties, icon: Building2, color: "text-violet-500" },
    { label: "Imóveis Ativos", value: metrics.activeProperties, icon: TrendingUp, color: "text-green-500" },
    { label: "Imóveis Vendidos", value: metrics.soldProperties, icon: Building2, color: "text-orange-500" },
    { label: "Visualizações", value: metrics.totalViews, icon: Eye, color: "text-cyan-500" },
    { label: "Contatos", value: metrics.totalContacts, icon: MessageSquare, color: "text-pink-500" },
    { label: "Suporte Aberto", value: metrics.openSupport, icon: MessageCircle, color: "text-red-500" },
  ];

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <c.icon className={`h-8 w-8 ${c.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value.toLocaleString("pt-BR")}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent users */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-5 w-5 text-blue-500" /> Novos Usuários</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário recente</p>
            ) : recentUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div>
                  <p className="font-medium">{u.full_name ?? "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{u.creci ? `CRECI: ${u.creci}` : "Sem CRECI"}</p>
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(u.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent support messages */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-5 w-5 text-red-500" /> Suporte Recente</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentSupport.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem de suporte</p>
            ) : recentSupport.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{m.subject}</p>
                    <Badge variant={m.status === "open" ? "default" : "secondary"} className="text-[10px] shrink-0">{m.status === "open" ? "Aberto" : m.status === "replied" ? "Respondido" : "Fechado"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.message}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2 flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(m.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMetricsTab;
