import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { AGENCY_PERMISSIONS, DEFAULT_PERMISSIONS, type PermissionMap } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import { Copy, Loader2, Trash2, Users } from "lucide-react";

type MemberRow = {
  id: string;
  user_id: string;
  status: string;
  permissions: PermissionMap;
};

type InviteRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  token: string;
  permissions: PermissionMap;
  expires_at: string;
};

const PermissionToggles = ({
  value, onChange, disabled,
}: { value: PermissionMap; onChange: (v: PermissionMap) => void; disabled?: boolean }) => (
  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {AGENCY_PERMISSIONS.map((p) => (
      <label key={p.key} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
        <span>{p.label}</span>
        <Switch
          checked={value[p.key] === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, [p.key]: checked })}
        />
      </label>
    ))}
  </div>
);

const AgencyTeam = ({ userId }: { userId: string }) => {
  const { agency, isOwner, loading, refetch } = useAgency(userId);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePerms, setInvitePerms] = useState<PermissionMap>(DEFAULT_PERMISSIONS);
  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    if (!agency) return;
    const [membersRes, invitesRes] = await Promise.all([
      supabase.from("agency_members").select("id, user_id, status, permissions").eq("agency_id", agency.id),
      supabase.from("agency_invites").select("*").eq("agency_id", agency.id).order("created_at", { ascending: false }),
    ]);
    const memberRows = (membersRes.data ?? []).map((m) => ({
      ...m,
      permissions: (m.permissions ?? {}) as PermissionMap,
    })) as MemberRow[];
    setMembers(memberRows);
    setInvites((invitesRes.data ?? []) as unknown as InviteRow[]);

    if (memberRows.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", memberRows.map((m) => m.user_id));
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p) => { map[p.user_id] = p.full_name ?? ""; });
      setNames(map);
    }
  }, [agency]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const createAgency = async () => {
    if (name.trim().length < 2) {
      toast({ title: "Informe o nome da imobiliária", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("agencies").insert({
      owner_user_id: userId,
      name: name.trim(),
      cnpj: cnpj.trim() || null,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Imobiliária criada" });
    await refetch();
  };

  const sendInvite = async () => {
    if (!agency) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteEmail.trim())) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }
    setInviting(true);
    const { data, error } = await supabase
      .from("agency_invites")
      .insert({
        agency_id: agency.id,
        email: inviteEmail.trim().toLowerCase(),
        permissions: invitePerms,
        invited_by: userId,
      })
      .select("token")
      .single();
    setInviting(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    const link = `${window.location.origin}/convite/${data.token}`;
    await navigator.clipboard.writeText(link).catch(() => undefined);
    toast({ title: "Convite criado", description: "Link copiado — envie para a pessoa." });
    setInviteEmail("");
    await loadTeam();
  };

  const savePermissions = async (member: MemberRow, permissions: PermissionMap) => {
    setSaving(member.id);
    const { error } = await supabase.from("agency_members").update({ permissions }).eq("id", member.id);
    setSaving(null);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, permissions } : m)));
    toast({ title: "Permissões atualizadas" });
  };

  const removeMember = async (member: MemberRow) => {
    const { error } = await supabase.from("agency_members").delete().eq("id", member.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Integrante removido" });
    await loadTeam();
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!agency) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Equipe" description="Crie a sua imobiliária para convidar corretores e definir permissões." />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Criar imobiliária</CardTitle>
            <CardDescription>Você será o responsável e poderá convidar a equipe.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ag-name">Nome</Label>
                <Input id="ag-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ag-cnpj">CNPJ</Label>
                <Input id="ag-cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
              </div>
            </div>
            <Button onClick={createAgency} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar imobiliária
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Equipe" description={`Você faz parte de ${agency.name}.`} />
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Apenas o responsável da imobiliária pode convidar pessoas e alterar permissões.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Equipe" description={`${agency.name} — convites e permissões por funcionalidade.`} count={members.length} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convidar pessoa</CardTitle>
          <CardDescription>Escolha o que ela poderá acessar. O link do convite é copiado ao criar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inv-email">E-mail</Label>
            <Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="max-w-sm" />
          </div>
          <PermissionToggles value={invitePerms} onChange={setInvitePerms} />
          <Button onClick={sendInvite} disabled={inviting}>
            {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar convite
          </Button>
        </CardContent>
      </Card>

      {invites.filter((i) => i.status === "pending").length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Convites pendentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {invites.filter((i) => i.status === "pending").map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0 text-sm">
                <div>
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Pendente</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/convite/${inv.token}`);
                      toast({ title: "Link copiado" });
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar link
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await supabase.from("agency_invites").delete().eq("id", inv.id);
                      await loadTeam();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {members.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="Nenhum integrante ainda" description="Convide corretores por e-mail para começar." />
      ) : (
        <div className="space-y-4">
          {members.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{names[m.user_id] || "Corretor"}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.status === "active" ? "default" : "secondary"}>
                      {m.status === "active" ? "Ativo" : m.status}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => removeMember(m)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <PermissionToggles
                  value={m.permissions}
                  disabled={saving === m.id}
                  onChange={(perms) => savePermissions(m, perms)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgencyTeam;
