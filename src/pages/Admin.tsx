import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Building2, BarChart3, CreditCard, Shield, MessageCircle, Layers } from "lucide-react";
import AdminPlansTab from "@/components/admin/AdminPlansTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminPropertiesTab from "@/components/admin/AdminPropertiesTab";
import AdminMetricsTab from "@/components/admin/AdminMetricsTab";
import AdminSubscriptionsTab from "@/components/admin/AdminSubscriptionsTab";
import AdminSupportTab from "@/components/admin/AdminSupportTab";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const checkAdmin = async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!data) { navigate("/"); return; }
      setIsAdmin(true);
      setChecking(false);
    };
    checkAdmin();
  }, [user, authLoading, navigate]);

  if (authLoading || checking || !isAdmin) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl font-bold text-foreground">Painel Administrativo</h1>
      </div>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="metrics" className="gap-1"><BarChart3 className="h-4 w-4" /> Métricas</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="properties" className="gap-1"><Building2 className="h-4 w-4" /> Imóveis</TabsTrigger>
          <TabsTrigger value="plans" className="gap-1"><Layers className="h-4 w-4" /> Planos</TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-1"><CreditCard className="h-4 w-4" /> Assinaturas</TabsTrigger>
          <TabsTrigger value="support" className="gap-1"><MessageCircle className="h-4 w-4" /> Suporte</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics"><AdminMetricsTab /></TabsContent>
        <TabsContent value="users"><AdminUsersTab /></TabsContent>
        <TabsContent value="properties"><AdminPropertiesTab /></TabsContent>
        <TabsContent value="plans"><AdminPlansTab /></TabsContent>
        <TabsContent value="subscriptions"><AdminSubscriptionsTab /></TabsContent>
        <TabsContent value="support"><AdminSupportTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
