import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlans, formatPlanPrice, type Plan } from "@/hooks/usePlans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Edit, Trash2, ArrowUp, ArrowDown, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/dashboard/SectionHeader";

type Draft = {
  slug: string;
  name: string;
  description: string;
  price: string;
  maxProperties: string;
  features: string;
  stripeProductId: string;
  stripePriceId: string;
  highlighted: boolean;
  active: boolean;
};

const emptyDraft: Draft = {
  slug: "", name: "", description: "", price: "", maxProperties: "",
  features: "", stripeProductId: "", stripePriceId: "", highlighted: false, active: true,
};

const AdminPlansTab = () => {
  const { plans, loading, refetch } = usePlans(true);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (plan: Plan) => {
    setDraft({
      slug: plan.slug,
      name: plan.name,
      description: plan.description ?? "",
      price: (plan.price_cents / 100).toString(),
      maxProperties: plan.max_properties === null ? "" : String(plan.max_properties),
      features: plan.features.join("\n"),
      stripeProductId: plan.stripe_product_id ?? "",
      stripePriceId: plan.stripe_price_id ?? "",
      highlighted: plan.highlighted,
      active: plan.active,
    });
    setCreating(false);
    setEditing(plan);
  };

  const closeDialog = () => { setEditing(null); setCreating(false); };

  const handleSave = async () => {
    const slug = draft.slug.trim().toLowerCase();
    if (!slug || !draft.name.trim()) {
      toast({ title: "Informe o identificador e o nome do plano", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      slug,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price_cents: Math.round(Number(draft.price || 0) * 100),
      max_properties: draft.maxProperties.trim() === "" ? null : Number(draft.maxProperties),
      features: draft.features.split("\n").map(f => f.trim()).filter(Boolean),
      stripe_product_id: draft.stripeProductId.trim() || null,
      stripe_price_id: draft.stripePriceId.trim() || null,
      highlighted: draft.highlighted,
      active: draft.active,
    };

    const { error } = editing
      ? await supabase.from("subscription_plans").update(payload).eq("id", editing.id)
      : await supabase.from("subscription_plans").insert({ ...payload, sort_order: plans.length });

    if (error) {
      toast({ title: "Erro ao salvar plano", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editing ? "Plano atualizado" : "Plano criado" });
      closeDialog();
      await refetch();
    }
    setSaving(false);
  };

  const handleToggleActive = async (plan: Plan) => {
    const { error } = await supabase.from("subscription_plans").update({ active: !plan.active }).eq("id", plan.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else await refetch();
  };

  const move = async (plan: Plan, dir: -1 | 1) => {
    const idx = plans.findIndex(p => p.id === plan.id);
    const target = plans[idx + dir];
    if (!target) return;
    await Promise.all([
      supabase.from("subscription_plans").update({ sort_order: target.sort_order }).eq("id", plan.id),
      supabase.from("subscription_plans").update({ sort_order: plan.sort_order }).eq("id", target.id),
    ]);
    await refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else { toast({ title: "Plano excluído" }); await refetch(); }
    setDeleteTarget(null);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Planos"
        description="Catálogo de assinaturas: preço, limites, recursos e ordem de exibição."
        count={plans.length}
        action={<Button onClick={openCreate} className="gap-1"><Plus className="h-4 w-4" /> Novo plano</Button>}
      />

      <div className="space-y-2">
        {plans.map((plan, i) => (
          <Card key={plan.id} className={plan.active ? "" : "opacity-60"}>
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{plan.name}</p>
                  <Badge variant="secondary" className="text-[10px]">{plan.slug}</Badge>
                  {plan.highlighted && <Badge className="gap-1 text-[10px]"><Star className="h-3 w-3" /> Destaque</Badge>}
                  {!plan.active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatPlanPrice(plan.price_cents)}/mês · {plan.max_properties === null ? "imóveis ilimitados" : `${plan.max_properties} imóveis`} · {plan.features.length} recursos
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={plan.active} onCheckedChange={() => handleToggleActive(plan)} aria-label="Ativo" />
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(plan, -1)} title="Subir"><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" disabled={i === plans.length - 1} onClick={() => move(plan, 1)} title="Descer"><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(plan)} title="Editar"><Edit className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(plan)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Identificador</Label>
                <Input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} placeholder="basic" disabled={!!editing} />
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Básico" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço mensal (R$)</Label>
                <Input type="number" step="0.01" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} />
              </div>
              <div>
                <Label>Limite de imóveis</Label>
                <Input type="number" value={draft.maxProperties} onChange={e => setDraft({ ...draft, maxProperties: e.target.value })} placeholder="vazio = ilimitado" />
              </div>
            </div>
            <div>
              <Label>Recursos (um por linha)</Label>
              <Textarea rows={5} value={draft.features} onChange={e => setDraft({ ...draft, features: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ID do produto (pagamento)</Label>
                <Input value={draft.stripeProductId} onChange={e => setDraft({ ...draft, stripeProductId: e.target.value })} placeholder="prod_..." />
              </div>
              <div>
                <Label>ID do preço (pagamento)</Label>
                <Input value={draft.stripePriceId} onChange={e => setDraft({ ...draft, stripePriceId: e.target.value })} placeholder="price_..." />
              </div>
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.highlighted} onCheckedChange={v => setDraft({ ...draft, highlighted: v })} /> Destacar como mais popular
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.active} onCheckedChange={v => setDraft({ ...draft, active: v })} /> Ativo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              O plano "{deleteTarget?.name}" deixará de aparecer na página de planos. Assinantes atuais não são cancelados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPlansTab;
