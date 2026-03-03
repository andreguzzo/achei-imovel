import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, KeyRound, Eye, Shield, MoreVertical, Trash2, UserX, UserCheck, Edit } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Role = Tables<"user_roles">;

const AdminUsersTab = () => {
  const [profiles, setProfiles] = useState<(Profile & { roles: Role[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<(Profile & { roles: Role[] }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(Profile & { roles: Role[] }) | null>(null);
  const [editTarget, setEditTarget] = useState<(Profile & { roles: Role[] }) | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCreci, setEditCreci] = useState("");

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

  const handleDeleteUser = async (user: Profile & { roles: Role[] }) => {
    // Remove all roles first, then delete profile
    for (const r of user.roles) {
      await supabase.from("user_roles").delete().eq("id", r.id);
    }
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil excluído com sucesso" });
      await fetchUsers();
    }
    setDeleteTarget(null);
  };

  const handleToggleBroker = async (user: Profile & { roles: Role[] }) => {
    const isBroker = user.roles.some(r => r.role === "broker");
    await handleToggleRole(user.user_id, "broker", isBroker);
  };

  const openEdit = (user: Profile & { roles: Role[] }) => {
    setEditTarget(user);
    setEditName(user.full_name ?? "");
    setEditPhone(user.phone ?? "");
    setEditCreci(user.creci ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const { error } = await supabase.from("profiles").update({
      full_name: editName,
      phone: editPhone,
      creci: editCreci || null,
    }).eq("id", editTarget.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado com sucesso" });
      await fetchUsers();
    }
    setEditTarget(null);
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
        {filtered.map(p => {
          const isBroker = p.roles.some(r => r.role === "broker");
          return (
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
                  <Button size="icon" variant="ghost" title="Ver detalhes" onClick={() => setSelected(p)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(p)} className="gap-2 cursor-pointer">
                        <Edit className="h-4 w-4" /> Editar perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleBroker(p)} className="gap-2 cursor-pointer">
                        {isBroker ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        {isBroker ? "Remover corretor" : "Tornar corretor"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const email = prompt("Confirme o e-mail do usuário:");
                        if (email) handleResetPassword(p.user_id, email);
                      }} className="gap-2 cursor-pointer">
                        <KeyRound className="h-4 w-4" /> Redefinir senha
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" /> Excluir usuário
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Dialog */}
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

              <div className="border-t pt-3 flex gap-2 flex-wrap">
                <Button variant="outline" className="gap-1" onClick={() => {
                  const email = prompt("Confirme o e-mail do usuário para enviar o link de redefinição:");
                  if (email) handleResetPassword(selected.user_id, email);
                }}>
                  <KeyRound className="h-4 w-4" /> Redefinir senha
                </Button>
                <Button variant="outline" className="gap-1" onClick={() => { setSelected(null); openEdit(selected); }}>
                  <Edit className="h-4 w-4" /> Editar
                </Button>
                <Button variant="destructive" className="gap-1" onClick={() => { setSelected(null); setDeleteTarget(selected); }}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome completo</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Telefone</label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">CRECI</label>
              <Input value={editCreci} onChange={e => setEditCreci(e.target.value)} placeholder="Deixe vazio para remover" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
              <Button onClick={handleSaveEdit}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil de <strong>{deleteTarget?.full_name}</strong>? Esta ação removerá o perfil e todas as roles associadas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && handleDeleteUser(deleteTarget)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersTab;
