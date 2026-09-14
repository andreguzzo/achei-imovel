import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, Menu, Shield } from "lucide-react";
import AdminSidebar, { ADMIN_SECTIONS, useAdminNav, type AdminSection } from "@/components/admin/AdminSidebar";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminPlansTab from "@/components/admin/AdminPlansTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminPropertiesTab from "@/components/admin/AdminPropertiesTab";
import AdminSubscriptionsTab from "@/components/admin/AdminSubscriptionsTab";
import AdminSupportTab from "@/components/admin/AdminSupportTab";
import AdminFinanceTab from "@/components/admin/AdminFinanceTab";
import AdminVerificationsTab from "@/components/admin/AdminVerificationsTab";
import AdminDeletionRequestsTab from "@/components/admin/AdminDeletionRequestsTab";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSupport, setOpenSupport] = useState(0);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [pendingDeletions, setPendingDeletions] = useState(0);

  const rawSection = searchParams.get("secao") as AdminSection | null;
  const section: AdminSection =
    rawSection && ADMIN_SECTIONS.includes(rawSection) ? rawSection : "resumo";

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const checkAdmin = async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!data) { navigate("/"); return; }
      setIsAdmin(true);
      setChecking(false);
      const [support, verifications, deletions] = await Promise.all([
        supabase.from("support_messages").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase
          .from("identity_verifications")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "manual_review"]),
        supabase
          .from("deletion_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "processing"]),
      ]);
      setOpenSupport(support.count ?? 0);
      setPendingVerifications(verifications.count ?? 0);
      setPendingDeletions(deletions.count ?? 0);
    };
    checkAdmin();
  }, [user, authLoading, navigate]);

  const goToSection = useCallback((next: AdminSection) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("secao", next);
      return params;
    });
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setSearchParams]);

  const groups = useAdminNav({ suporte: openSupport, verificacoes: pendingVerifications, exclusoes: pendingDeletions });

  const activeLabel = useMemo(() => {
    for (const g of groups) {
      const found = g.items.find((i) => i.key === section);
      if (found) return found.label;
    }
    return "";
  }, [groups, section]);

  if (authLoading || checking || !isAdmin) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const renderSection = () => {
    switch (section) {
      case "resumo": return <AdminOverview onNavigate={goToSection} />;
      case "usuarios": return <AdminUsersTab />;
      case "imoveis": return <AdminPropertiesTab />;
      case "planos": return <AdminPlansTab />;
      case "assinaturas": return <AdminSubscriptionsTab />;
      case "financeiro": return <AdminFinanceTab />;
      case "verificacoes": return <AdminVerificationsTab />;
      case "suporte": return <AdminSupportTab />;
      case "exclusoes": return <AdminDeletionRequestsTab />;
      default: return null;
    }
  };

  const sidebar = (mobile = false) => (
    <AdminSidebar
      groups={groups}
      active={section}
      onSelect={goToSection}
      collapsed={mobile ? false : collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
    />
  );

  return (
    <div className="container py-6">
      <div className="mb-5 flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold text-foreground">Painel Administrativo</h1>
      </div>

      <div className="mb-4 flex items-center gap-3 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Menu className="h-4 w-4" /> Seções
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <p className="mb-4 font-display text-lg font-semibold">Administração</p>
            {sidebar(true)}
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm text-muted-foreground">{activeLabel}</span>
      </div>

      <div className="flex gap-8">
        <aside className="hidden shrink-0 lg:block">
          <div className="sticky top-24">{sidebar()}</div>
        </aside>
        <main className="min-w-0 flex-1">{renderSection()}</main>
      </div>
    </div>
  );
};

export default Admin;
