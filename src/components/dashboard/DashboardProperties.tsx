import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Eye, Edit, Trash2, Instagram, Building2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SocialPostExporter from "@/components/social/SocialPostExporter";
import PropertyMatchingLeads from "@/components/dashboard/PropertyMatchingLeads";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & { property_images: Tables<"property_images">[] };

interface Props {
  userId: string;
  isBroker: boolean;
  broker: { name: string; creci: string; phone: string };
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const DashboardProperties = ({ userId, isBroker, broker }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const navigate = useNavigate();

  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [socialTarget, setSocialTarget] = useState<PropertyWithImages | null>(null);
  const [leadsTarget, setLeadsTarget] = useState<PropertyWithImages | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<PropertyWithImages | null>(null);
  const [statusAction, setStatusAction] = useState("active");
  const [soldPrice, setSoldPrice] = useState("");
  const [soldCommission, setSoldCommission] = useState("");
  const [soldByOtherPrice, setSoldByOtherPrice] = useState("");

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("properties")
      .select("*, property_images(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const list = (data as PropertyWithImages[]) ?? [];
    setProperties(list);

    // Private authorization terms — broker only, never rendered publicly
    if (list.length > 0) {
      const { data: privateRows } = await supabase
        .from("property_private_data")
        .select("property_id, authorization_end")
        .in("property_id", list.map((p) => p.id));
      const map: Record<string, string> = {};
      for (const row of privateRows ?? []) {
        if (row.authorization_end) map[row.property_id] = row.authorization_end;
      }
      setAuthEnds(map);
    } else {
      setAuthEnds({});
    }
    setLoading(false);
  }, [userId]);

  const renderAuthBadge = (propId: string) => {
    const end = authEnds[propId];
    if (!end) return null;
    const { status, days } = authorizationStatus(end);
    const text = authorizationBadgeText(status, days, pt);
    if (!text) return null;
    return (
      <Badge
        variant={status === "expired" ? "destructive" : "outline"}
        className={`shrink-0 gap-1 text-[10px] ${
          status === "expiring"
            ? "border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300"
            : ""
        }`}
      >
        <AlertTriangle className="h-3 w-3" />
        {text}
      </Badge>
    );
  };

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleDelete = async (propId: string) => {
    if (!confirm(pt ? "Tem certeza que deseja excluir este imóvel?" : "Are you sure you want to delete this property?")) return;
    const { error } = await supabase.from("properties").delete().eq("id", propId);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
    } else {
      setProperties((prev) => prev.filter((p) => p.id !== propId));
      toast({ title: pt ? "Imóvel excluído" : "Property deleted" });
    }
  };

  const openStatusDialog = (p: PropertyWithImages) => {
    setStatusTarget(p);
    setStatusAction(p.status);
    setSoldPrice("");
    setSoldCommission("");
    setSoldByOtherPrice("");
    setStatusDialogOpen(true);
  };

  const handleStatusConfirm = async () => {
    if (!statusTarget) return;
    if (statusAction === "sold" && (!soldPrice || !soldCommission)) {
      toast({ title: pt ? "Informe o valor e a comissão" : "Enter value and commission", variant: "destructive" });
      return;
    }
    const isSoldByOther = statusAction === "sold_by_other";
    const finalStatus = isSoldByOther ? "sold" : statusAction;

    const updateData: Record<string, unknown> = { status: finalStatus };
    if (statusAction === "sold") {
      updateData.sold_price = Number(soldPrice);
      updateData.sold_commission = Number(soldCommission);
    }
    if (isSoldByOther && soldByOtherPrice) {
      updateData.sold_by_other_price = Number(soldByOtherPrice);
    }

    const { error } = await supabase.from("properties").update(updateData).eq("id", statusTarget.id);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    if (statusAction === "sold") {
      await supabase
        .from("sales_pipeline")
        .update({
          stage: "closed_won",
          actual_close_date: new Date().toISOString().split("T")[0],
          commission_value: Number(soldCommission),
        })
        .eq("broker_id", userId)
        .eq("property_id", statusTarget.id);
    }
    toast({ title: pt ? "Status atualizado!" : "Status updated!" });
    setStatusDialogOpen(false);
    fetchProperties();
  };

  const totalViews = properties.reduce((sum, p) => sum + (p.view_count ?? 0), 0);
  const activeCount = properties.filter((p) => p.status === "active").length;

  const statusLabels: Record<string, string> = pt
    ? { active: "Ativo", inactive: "Fora de negociação", sold: "Vendido", rented: "Alugado" }
    : { active: "Active", inactive: "Withdrawn", sold: "Sold", rented: "Rented" };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Meus anúncios" : "My listings"}
        description={pt ? "Gerencie status, fotos e informações de cada imóvel." : "Manage status, photos and details of each property."}
        count={properties.length}
        action={
          <Link to="/anunciar">
            <Button className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Novo imóvel" : "New property"}</Button>
          </Link>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {isBroker && properties.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: pt ? "Anúncios ativos" : "Active listings", value: activeCount },
                { label: pt ? "Total cadastrado" : "Total listed", value: properties.length },
                { label: pt ? "Visualizações" : "Views", value: totalViews },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {properties.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              title={pt ? "Nenhum imóvel cadastrado" : "No properties listed"}
              description={pt ? "Cadastre seu primeiro imóvel para começar a receber contatos." : "List your first property to start receiving contacts."}
              action={<Link to="/anunciar"><Button className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Anunciar imóvel" : "List property"}</Button></Link>}
            />
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {properties.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/imovel/${p.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.property_images?.[0]?.url ? (
                        <img src={p.property_images[0].url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">—</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{p.title}</p>
                        <Badge variant={p.status === "active" ? "default" : "secondary"} className="shrink-0 text-[10px]">
                          {statusLabels[p.status] ?? p.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {p.reference_code ? `${pt ? "Cód." : "Ref."} ${p.reference_code} • ` : ""}{p.city} - {p.state}
                      </p>
                      <p className="text-sm font-semibold text-primary">{brl(p.price)}</p>
                    </div>
                  </button>

                  {isBroker && (
                    <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      <span className="text-sm font-semibold text-foreground">{p.view_count ?? 0}</span>
                    </div>
                  )}

                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => openStatusDialog(p)}>
                      {pt ? "Status" : "Status"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={pt ? "Clientes compatíveis" : "Matching buyers"}
                      onClick={() => setLeadsTarget(p)}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={pt ? "Exportar post para redes sociais" : "Export social post"}
                      onClick={() => setSocialTarget(p)}
                    >
                      <Instagram className="h-4 w-4" />
                    </Button>
                    <Link to={`/editar/${p.id}`}>
                      <Button size="icon" variant="ghost"><Edit className="h-4 w-4" /></Button>
                    </Link>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pt ? "Alterar status do imóvel" : "Change property status"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {statusTarget && <p className="truncate text-sm text-muted-foreground">{statusTarget.title}</p>}
            <Select value={statusAction} onValueChange={setStatusAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{pt ? "Ativo (disponível)" : "Active"}</SelectItem>
                <SelectItem value="sold">{pt ? "Vendido (por mim)" : "Sold (by me)"}</SelectItem>
                <SelectItem value="rented">{pt ? "Alugado" : "Rented"}</SelectItem>
                <SelectItem value="inactive">{pt ? "Fora de negociação" : "Withdrawn"}</SelectItem>
                <SelectItem value="sold_by_other">{pt ? "Vendido por outro corretor" : "Sold by other"}</SelectItem>
              </SelectContent>
            </Select>

            {statusAction === "sold" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">{pt ? "Valor de venda (R$) *" : "Sale price (R$) *"}</label>
                  <Input type="number" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} min="0" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{pt ? "Comissão (R$) *" : "Commission (R$) *"}</label>
                  <Input type="number" value={soldCommission} onChange={(e) => setSoldCommission(e.target.value)} min="0" />
                </div>
              </>
            )}

            {statusAction === "sold_by_other" && (
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Valor de venda informado (R$)" : "Reported sale price (R$)"}</label>
                <Input type="number" value={soldByOtherPrice} onChange={(e) => setSoldByOtherPrice(e.target.value)} min="0" />
                <p className="mt-1 text-xs text-muted-foreground">{pt ? "Usado como referência de mercado." : "Used as market reference."}</p>
              </div>
            )}

            {statusAction === "inactive" && (
              <p className="text-sm text-muted-foreground">{pt ? "O imóvel não aparecerá mais nas buscas." : "Property won't appear in searches."}</p>
            )}

            <Button onClick={handleStatusConfirm} className="w-full">{pt ? "Confirmar" : "Confirm"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <PropertyMatchingLeads
        open={!!leadsTarget}
        onOpenChange={(o) => !o && setLeadsTarget(null)}
        brokerId={userId}
        property={leadsTarget}
      />

      <SocialPostExporter
        open={!!socialTarget}
        onOpenChange={(o) => !o && setSocialTarget(null)}
        broker={broker}
        property={
          socialTarget
            ? {
                id: socialTarget.id,
                title: socialTarget.title,
                price: socialTarget.price,
                listing_type: socialTarget.listing_type,
                property_type: socialTarget.property_type,
                city: socialTarget.city,
                state: socialTarget.state,
                neighborhood: socialTarget.neighborhood,
                bedrooms: socialTarget.bedrooms,
                bathrooms: socialTarget.bathrooms,
                parking_spots: socialTarget.parking_spots,
                area: socialTarget.area,
                description: socialTarget.description,
                images: [...(socialTarget.property_images ?? [])]
                  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                  .map((i) => i.url),
              }
            : null
        }
      />
    </div>
  );
};

export default DashboardProperties;
