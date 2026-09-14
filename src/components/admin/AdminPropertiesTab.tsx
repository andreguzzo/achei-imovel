import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Loader2, Search, RotateCcw, Eye, ExternalLink, MoreVertical, Trash2, Edit, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import type { Tables, Database } from "@/integrations/supabase/types";

type Property = Tables<"properties"> & { property_images: { url: string }[] };

const statusLabels: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", sold: "Vendido", rented: "Alugado",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  inactive: "bg-muted text-muted-foreground",
  sold: "bg-blue-500/10 text-blue-700 border-blue-200",
  rented: "bg-amber-500/10 text-amber-700 border-amber-200",
};

const AdminPropertiesTab = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [editTarget, setEditTarget] = useState<Property | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const fetchProperties = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("properties")
      .select("*, property_images(url)")
      .order("created_at", { ascending: false });
    setProperties((data as Property[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProperties(); }, []);

  const filtered = properties.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.id.includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleChangeStatus = async (propId: string, newStatus: string) => {
    const { error } = await supabase.from("properties").update({ status: newStatus as Database["public"]["Enums"]["property_status"] }).eq("id", propId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status alterado para ${statusLabels[newStatus]}` });
      await fetchProperties();
      if (selected?.id === propId) setSelected(null);
    }
  };

  const handleDeleteProperty = async (prop: Property) => {
    try {
      // Delete images from storage bucket
      for (const img of prop.property_images ?? []) {
        const urlParts = img.url.split("/property-images/");
        if (urlParts.length === 2) {
          await supabase.storage.from("property-images").remove([urlParts[1]]);
        }
      }
      // Delete sale_documents via sales_pipeline
      const { data: pipelines } = await supabase.from("sales_pipeline").select("id").eq("property_id", prop.id);
      if (pipelines && pipelines.length > 0) {
        for (const pl of pipelines) {
          await supabase.from("sale_documents").delete().eq("pipeline_id", pl.id);
          await supabase.from("broker_appointments").delete().eq("pipeline_id", pl.id);
        }
        await supabase.from("sales_pipeline").delete().eq("property_id", prop.id);
      }
      // Delete related data
      await supabase.from("property_images").delete().eq("property_id", prop.id);
      await supabase.from("property_private_data").delete().eq("property_id", prop.id);
      await supabase.from("property_documents").delete().eq("property_id", prop.id);
      await supabase.from("contact_requests").delete().eq("property_id", prop.id);
      await supabase.from("favorites").delete().eq("property_id", prop.id);
      await supabase.from("property_group_members").delete().eq("property_id", prop.id);
      // Delete property
      const { error } = await supabase.from("properties").delete().eq("id", prop.id);
      if (error) {
        toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Imóvel excluído com sucesso" });
        await fetchProperties();
      }
    } catch (err: unknown) {
      toast({ title: "Erro inesperado", description: err instanceof Error ? err.message : "Falha ao excluir", variant: "destructive" });
    }
    setDeleteTarget(null);
  };

  const openEdit = (prop: Property) => {
    setEditTarget(prop);
    setEditTitle(prop.title);
    setEditPrice(String(prop.price));
    setEditStatus(prop.status);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const { error } = await supabase.from("properties").update({
      title: editTitle,
      price: Number(editPrice),
      status: editStatus as Database["public"]["Enums"]["property_status"],
    }).eq("id", editTarget.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Imóvel atualizado com sucesso" });
      await fetchProperties();
    }
    setEditTarget(null);
  };

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Imóveis"
        description="Todos os anúncios da plataforma, com acesso completo à edição."
        count={filtered.length}
      />
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, cidade ou ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="sold">Vendidos</SelectItem>
            <SelectItem value="rented">Alugados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title="Nenhum imóvel encontrado"
          description="Ajuste a busca ou o filtro de situação para ver outros anúncios."
        />
      )}

      <div className="space-y-2">
        {filtered.map(p => (
          <Card key={p.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.property_images?.[0]?.url ? <img src={p.property_images[0].url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">—</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{p.title}</p>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColors[p.status] ?? ""}`}>{statusLabels[p.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.city} - {p.state} · {fmt(p.price)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">{p.view_count ?? 0}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setSelected(p)} title="Ver detalhes">
                  <Eye className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/admin/imovel/${p.id}`)} className="gap-2 cursor-pointer">
                      <Edit className="h-4 w-4" /> Editar tudo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(p)} className="gap-2 cursor-pointer">
                      <Edit className="h-4 w-4" /> Edição rápida
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                      <a href={`/imovel/${p.id}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" /> Ver página
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {p.status === "active" ? (
                      <DropdownMenuItem onClick={() => handleChangeStatus(p.id, "inactive")} className="gap-2 cursor-pointer">
                        <Ban className="h-4 w-4" /> Desativar
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleChangeStatus(p.id, "active")} className="gap-2 cursor-pointer">
                        <CheckCircle2 className="h-4 w-4" /> Reativar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detalhes do Imóvel</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Título:</span> {selected.title}</div>
                <div><span className="text-muted-foreground">Preço:</span> {fmt(selected.price)}</div>
                <div><span className="text-muted-foreground">Cidade:</span> {selected.city}</div>
                <div><span className="text-muted-foreground">Estado:</span> {selected.state}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {selected.property_type}</div>
                <div><span className="text-muted-foreground">Listagem:</span> {selected.listing_type}</div>
                <div><span className="text-muted-foreground">Status:</span> {statusLabels[selected.status]}</div>
                <div><span className="text-muted-foreground">Views:</span> {selected.view_count}</div>
                <div className="col-span-2"><span className="text-muted-foreground">ID:</span> <code className="text-xs">{selected.id}</code></div>
                <div className="col-span-2"><span className="text-muted-foreground">Corretor ID:</span> <code className="text-xs">{selected.user_id}</code></div>
                <div className="col-span-2"><span className="text-muted-foreground">Criado em:</span> {new Date(selected.created_at).toLocaleDateString("pt-BR")}</div>
              </div>
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium w-full mb-1">Alterar Status:</p>
                <div className="flex gap-2 flex-wrap">
                  {(["active", "inactive", "sold", "rented"] as const).map(s => (
                    <Button key={s} size="sm" variant={selected.status === s ? "default" : "outline"} onClick={() => handleChangeStatus(selected.id, s)} disabled={selected.status === s}>
                      {statusLabels[s]}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="border-t pt-3 flex gap-2 flex-wrap">
                <Button className="gap-1" onClick={() => navigate(`/admin/imovel/${selected.id}`)}>
                  <Edit className="h-4 w-4" /> Editar tudo
                </Button>
                <Button variant="outline" className="gap-1" onClick={() => { setSelected(null); openEdit(selected); }}>
                  <Edit className="h-4 w-4" /> Edição rápida
                </Button>
                <a href={`/imovel/${selected.id}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="gap-1">
                    <ExternalLink className="h-4 w-4" /> Ver página
                  </Button>
                </a>
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
          <DialogHeader><DialogTitle>Editar Imóvel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Título</label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Preço (R$)</label>
              <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="sold">Vendido</SelectItem>
                  <SelectItem value="rented">Alugado</SelectItem>
                </SelectContent>
              </Select>
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
            <AlertDialogTitle>Excluir imóvel?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.title}</strong>? As imagens associadas também serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && handleDeleteProperty(deleteTarget)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPropertiesTab;
