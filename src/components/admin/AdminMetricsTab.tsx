import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Eye, MessageSquare, TrendingUp, Handshake } from "lucide-react";
import { Loader2 } from "lucide-react";

interface Metrics {
  totalUsers: number;
  totalBrokers: number;
  totalProperties: number;
  activeProperties: number;
  soldProperties: number;
  totalViews: number;
  totalContacts: number;
  totalPipeline: number;
}

const AdminMetricsTab = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [profiles, roles, properties, contacts, pipeline] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "broker"),
        supabase.from("properties").select("status, view_count"),
        supabase.from("contact_requests").select("id", { count: "exact", head: true }),
        supabase.from("sales_pipeline").select("id", { count: "exact", head: true }),
      ]);

      const props = properties.data ?? [];
      const totalViews = props.reduce((s, p) => s + (p.view_count ?? 0), 0);

      setMetrics({
        totalUsers: profiles.count ?? 0,
        totalBrokers: roles.count ?? 0,
        totalProperties: props.length,
        activeProperties: props.filter(p => p.status === "active").length,
        soldProperties: props.filter(p => p.status === "sold").length,
        totalViews,
        totalContacts: contacts.count ?? 0,
        totalPipeline: pipeline.count ?? 0,
      });
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
    { label: "Pipeline de Vendas", value: metrics.totalPipeline, icon: TrendingUp, color: "text-amber-500" },
  ];

  return (
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
  );
};

export default AdminMetricsTab;
