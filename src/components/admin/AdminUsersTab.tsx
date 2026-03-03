import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, KeyRound, Eye, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Role = Tables<"user_roles">;

const AdminUsersTab = () => {
  const [profiles, setProfiles] = useState<(Profile & { roles: Role[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<(Profile & { roles: Role[] }) | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    const roles = rolesRes.data ?? [];
    const merged = (profilesRes.data ?? []).map(p => ({
      ...p,
      roles: roles.filter(r => r.user_id === p.user_id),
    }));
    setProfiles(merged);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase();
    return !q || (p.full_name?.toLowerCase().includes(q)) || (p.creci?.toLowerCase().includes(q)) || p.user_id.includes(q);
  });

  const handleResetPassword = async (userId: string, email: string) => {
    // Use edge function to reset password via admin API
    const { error } = await supabase.functions.invoke("admin-reset-password", {
      body: { userId, email },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Link de redefinição enviado para " + email });
    }
  };

  const handleToggleRole = async (userId: string, role: string, hasRole: boolean) => {
    if (hasRole) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    }
    await fetchUsers();
    toast({ title: `Role ${role} ${hasRole ? "removida" : "adicionada"}` });
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CRECI ou ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} usuários encontrados</p>

      <div className="space-y-2">
        {filtered.map(p => (
          <Card key={p.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {p.avatar_url ? <img src={p.avatar_url} className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-muted-foreground">{(p.full_name ?? "?")[0]}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.full_name ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground truncate">{p.creci ? `CRECI: ${p.creci}` : "Sem CRECI"} · {p.phone ?? "Sem telefone"}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {p.roles.map(r => (
                  <Badge key={r.id} variant="secondary" className="text-[10px]">{r.role}</Badge>
                ))}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" title="Ver detalhes" onClick={() => setSelected(p)}><Eye className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalhes do Usuário</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nome:</span> {selected.full_name}</div>
                <div><span className="text-muted-foreground">CRECI:</span> {selected.creci ?? "—"}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {selected.phone ?? "—"}</div>
                <div><span className="text-muted-foreground">WhatsApp:</span> {selected.whatsapp ?? "—"}</div>
                <div><span className="text-muted-foreground">Username:</span> {selected.username ?? "—"}</div>
                <div><span className="text-muted-foreground">Email verificado:</span> {selected.email_verified ? "Sim" : "Não"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">ID:</span> <code className="text-xs">{selected.user_id}</code></div>
                <div className="col-span-2"><span className="text-muted-foreground">Criado em:</span> {new Date(selected.created_at).toLocaleDateString("pt-BR")}</div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-1"><Shield className="h-4 w-4" /> Roles</p>
                <div className="flex gap-2 flex-wrap">
                  {(["admin", "broker", "moderator", "user"] as const).map(role => {
                    const has = selected.roles.some(r => r.role === role);
                    return (
                      <Button key={role} size="sm" variant={has ? "default" : "outline"} onClick={() => handleToggleRole(selected.user_id, role, has)}>
                        {role} {has ? "✓" : "+"}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-3">
                <Button variant="outline" className="gap-1" onClick={() => {
                  const email = prompt("Confirme o e-mail do usuário para enviar o link de redefinição:");
                  if (email) handleResetPassword(selected.user_id, email);
                }}>
                  <KeyRound className="h-4 w-4" /> Enviar link de redefinição de senha
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersTab;
