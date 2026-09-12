import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Search, KeyRound, Eye, MoreVertical, Trash2, UserX, UserCheck,
  Edit, Plus, ShieldCheck, ShieldOff, Ban, Building2, CreditCard, MessageCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables, Database } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Role = Tables<"user_roles">;
type AppRole = Database["public"]["Enums"]["app_role"];

type AuthInfo = {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed: boolean;
};

type Row = Profile & { roles: Role[]; auth?: AuthInfo };

type Activity = {
  properties: { id: string; title: string; status: string; price: number }[];
  subscription: { plan_slug: string; expires_at: string | null; cancelled_at: string | null; source: string } | null;
  tickets: { id: string; subject: string; status: string; created_at: string }[];
};

const AdminUsersTab = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selected, setSelected] = useState<Row | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Row | null>(null);

  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCreci, setEditCreci] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>("user");
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, authRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.functions.invoke("admin-list-users"),
    ]);
    const roles = rolesRes.data ?? [];
    const authUsers: AuthInfo[] = (authRes.data as { users?: AuthInfo[] } | null)?.users ?? [];
    if (authRes.error) {
      toast({ title: "Não foi possível carregar os e-mails de login", description: authRes.error.message, variant: "destructive" });
    }
    const authMap = new Map(authUsers.map(u => [u.user_id, u]));
    setRows((profilesRes.data ?? []).map(p => ({
      ...p,
      roles: roles.filter(r => r.user_id === p.user_id),
      auth: authMap.get(p.user_id),
    })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const isSuspended = (r: Row) =>
    !!r.suspended_at || (!!r.auth?.banned_until && new Date(r.auth.banned_until) > new Date());

  const filtered = useMemo(() => rows.filter(r => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q
      || r.full_name?.toLowerCase().includes(q)
      || r.creci?.toLowerCase().includes(q)
      || r.auth?.email?.toLowerCase().includes(q)
      || r.user_id.includes(q);
    if (!matchesSearch) return false;

    if (roleFilter !== "all") {
      const has = r.roles.some(x => x.role === roleFilter);
      if (roleFilter === "user" ? r.roles.length > 0 && !has : !has) return false;
    }
    if (statusFilter === "suspended" && !isSuspended(r)) return false;
    if (statusFilter === "active" && isSuspended(r)) return false;
    return true;
  }), [rows, search, roleFilter, statusFilter]);

  const openDetails = async (row: Row) => {
    setSelected(row);
    setActivity(null);
    setActivityLoading(true);
    const [props, sub, tickets] = await Promise.all([
      supabase.from("properties").select("id, title, status, price").eq("user_id", row.user_id).order("created_at", { ascending: false }).limit(20),
      supabase.from("subscription_overrides").select("plan_slug, expires_at, cancelled_at, source").eq("user_id", row.user_id).maybeSingle(),
      supabase.from("support_messages").select("id, subject, status, created_at").eq("user_id", row.user_id).order("created_at", { ascending: false }).limit(10),
    ]);
    setActivity({
      properties: props.data ?? [],
      subscription: sub.data ?? null,
      tickets: tickets.data ?? [],
    });
    setActivityLoading(false);
  };

  const handleResetPassword = async (userId: string, email: string) => {
    const { error } = await supabase.functions.invoke("admin-reset-password", { body: { userId, email } });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Link de redefinição enviado para " + email });
  };

  const handleToggleRole = async (userId: string, role: AppRole, hasRole: boolean) => {
    const { error } = hasRole
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    await fetchUsers();
    toast({ title: `Papel ${role} ${hasRole ? "removido" : "adicionado"}` });
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    const suspend = !isSuspended(suspendTarget);
    const { error } = await supabase.functions.invoke("admin-set-user-status", {
      body: { userId: suspendTarget.user_id, suspend },
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: suspend ? "Acesso suspenso" : "Acesso reativado" }); await fetchUsers(); }
    setSuspendTarget(null);
  };

  const handleCreate = async () => {
    setCreating(true);
    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: newEmail, password: newPassword, fullName: newName, roles: newRole === "user" ? [] : [newRole] },
    });
    if (error) {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário criado com sucesso" });
      setCreateOpen(false);
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("user");
      await fetchUsers();
    }
    setCreating(false);
  };

  const handleDeleteUser = async (row: Row) => {
    try {
      for (const r of row.roles) await supabase.from("user_roles").delete().eq("id", r.id);
      await supabase.from("favorites").delete().eq("user_id", row.user_id);
      await supabase.from("saved_searches").delete().eq("user_id", row.user_id);
      const { error } = await supabase.from("profiles").delete().eq("id", row.id);
      if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      else { toast({ title: "Perfil excluído com sucesso" }); await fetchUsers(); }
    } catch (err) {
      toast({ title: "Erro inesperado", description: err instanceof Error ? err.message : "Falha ao excluir", variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const openEdit = (row: Row) => {
    setEditTarget(row);
    setEditName(row.full_name ?? "");
    setEditPhone(row.phone ?? "");
    setEditCreci(row.creci ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const { error } = await supabase.from("profiles").update({
      full_name: editName,
      phone: editPhone,
      creci: editCreci || null,
    }).eq("id", editTarget.id);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else { toast({ title: "Perfil atualizado com sucesso" }); await fetchUsers(); }
    setEditTarget(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail, CRECI ou ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os papéis</SelectItem>
            <SelectItem value="admin">Administradores</SelectItem>
            <SelectItem value="broker">Corretores</SelectItem>
            <SelectItem value="user">Sem papel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="suspended">Suspensas</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)} className="gap-1"><Plus className="h-4 w-4" /> Novo usuário</Button>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} usuários encontrados</p>

      <div className="space-y-2">
        {filtered.map(p => {
          const isBroker = p.roles.some(r => r.role === "broker");
          const isAdmin = p.roles.some(r => r.role === "admin");
          const suspended = isSuspended(p);
          return (
            <Card key={p.id} className={suspended ? "border-destructive/40" : ""}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {p.avatar_url
                    ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <span className="text-sm font-bold text-muted-foreground">{(p.full_name ?? "?")[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{p.full_name ?? "Sem nome"}</p>
                    {suspended && <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">Suspenso</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.auth?.email ?? "e-mail indisponível"} · {p.creci ? `CRECI: ${p.creci}` : "Sem CRECI"}
                  </p>
                </div>
                <div className="hidden sm:flex gap-1 shrink-0">
                  {p.roles.map(r => <Badge key={r.id} variant="secondary" className="text-[10px]">{r.role}</Badge>)}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" title="Ver ficha" onClick={() => openDetails(p)}>
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
                      <DropdownMenuItem onClick={() => handleToggleRole(p.user_id, "broker", isBroker)} className="gap-2 cursor-pointer">
                        {isBroker ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        {isBroker ? "Remover corretor" : "Tornar corretor"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleRole(p.user_id, "admin", isAdmin)} className="gap-2 cursor-pointer">
                        {isAdmin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                        {isAdmin ? "Remover administrador" : "Tornar administrador"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const email = p.auth?.email ?? prompt("Confirme o e-mail do usuário:") ?? "";
                          if (email) handleResetPassword(p.user_id, email);
                        }}
                        className="gap-2 cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4" /> Redefinir senha
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSuspendTarget(p)} className="gap-2 cursor-pointer">
                        <Ban className="h-4 w-4" /> {suspended ? "Reativar acesso" : "Suspender acesso"}
                      </DropdownMenuItem>
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

      {/* User file */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setActivity(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ficha do usuário</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nome:</span> {selected.full_name ?? "—"}</div>
                <div><span className="text-muted-foreground">E-mail:</span> {selected.auth?.email ?? "—"}</div>
                <div><span className="text-muted-foreground">CRECI:</span> {selected.creci ?? "—"}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {selected.phone ?? "—"}</div>
                <div><span className="text-muted-foreground">WhatsApp:</span> {selected.whatsapp ?? "—"}</div>
                <div><span className="text-muted-foreground">Usuário:</span> {selected.username ?? "—"}</div>
                <div><span className="text-muted-foreground">Cadastro:</span> {selected.auth ? new Date(selected.auth.created_at).toLocaleDateString("pt-BR") : "—"}</div>
                <div><span className="text-muted-foreground">Último acesso:</span> {selected.auth?.last_sign_in_at ? new Date(selected.auth.last_sign_in_at).toLocaleString("pt-BR") : "—"}</div>
                <div><span className="text-muted-foreground">Situação:</span> {isSuspended(selected) ? "Suspenso" : "Ativo"}</div>
                <div><span className="text-muted-foreground">Papéis:</span> {selected.roles.map(r => r.role).join(", ") || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">ID:</span> <code className="text-xs">{selected.user_id}</code></div>
              </div>

              {activityLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : activity && (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Building2 className="h-4 w-4" /> Imóveis ({activity.properties.length})</p>
                    {activity.properties.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum imóvel publicado.</p>
                    ) : (
                      <div className="space-y-1">
                        {activity.properties.map(prop => (
                          <div key={prop.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                            <span className="truncate">{prop.title}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{prop.status} · {fmt(prop.price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium"><CreditCard className="h-4 w-4" /> Assinatura manual</p>
                    {activity.subscription ? (
                      <p className="text-sm">
                        {activity.subscription.plan_slug} · {activity.subscription.cancelled_at ? "cancelada" : "ativa"}
                        {activity.subscription.expires_at ? ` até ${new Date(activity.subscription.expires_at).toLocaleDateString("pt-BR")}` : ""}
                        {` · origem: ${activity.subscription.source}`}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma assinatura concedida manualmente.</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4" /> Suporte ({activity.tickets.length})</p>
                    {activity.tickets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum ticket aberto.</p>
                    ) : (
                      <div className="space-y-1">
                        {activity.tickets.map(t => (
                          <div key={t.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                            <span className="truncate">{t.subject}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{t.status} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo</Label><Input value={newName} onChange={e => setNewName(e.target.value)} /></div>
            <div><Label>E-mail</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} /></div>
            <div><Label>Senha inicial</Label><Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="mínimo 8 caracteres" /></div>
            <div>
              <Label>Papel</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="broker">Corretor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit profile */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar perfil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div><Label>Telefone</Label><Input value={editPhone} onChange={e => setEditPhone(e.target.value)} /></div>
            <div><Label>CRECI</Label><Input value={editCreci} onChange={e => setEditCreci(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend */}
      <AlertDialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{suspendTarget && isSuspended(suspendTarget) ? "Reativar acesso?" : "Suspender acesso?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget && isSuspended(suspendTarget)
                ? `${suspendTarget.full_name ?? "O usuário"} poderá entrar novamente na conta.`
                : `${suspendTarget?.full_name ?? "O usuário"} não conseguirá entrar até ser reativado. A conta e os imóveis são mantidos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O perfil de {deleteTarget?.full_name ?? "usuário"} e os dados relacionados serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDeleteUser(deleteTarget)} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersTab;
