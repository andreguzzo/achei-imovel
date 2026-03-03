import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, RotateCcw, Eye, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Property = Tables<"properties"> & { property_images: { url: string }[]; profiles?: { full_name: string | null } };

const statusLabels: Record<string, string> = {
  active: "Ativo", inactive: "Inativo", sold: "Vendido", rented: "Alugado",
};

const AdminPropertiesTab = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Property | null>(null);

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
    const { error } = await supabase.from("properties").update({ status: newStatus as any }).eq("id", propId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status alterado para ${statusLabels[newStatus]}` });
      await fetchProperties();
      if (selected?.id === propId) setSelected(null);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
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

      <p className="text-sm text-muted-foreground">{filtered.length} imóveis encontrados</p>

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
                  <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[10px] shrink-0">{statusLabels[p.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.city} - {p.state} · {fmt(p.price)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">{p.view_count ?? 0}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                {p.status !== "active" && (
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleChangeStatus(p.id, "active")}>
                    <RotateCcw className="h-3 w-3" /> Reativar
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => setSelected(p)}><Eye className="h-4 w-4" /></Button>
                <a href={`/imovel/${p.id}`} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button></a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
              <div className="border-t pt-3 flex gap-2 flex-wrap">
                <p className="text-sm font-medium w-full mb-1">Alterar Status:</p>
                {(["active", "inactive", "sold", "rented"] as const).map(s => (
                  <Button key={s} size="sm" variant={selected.status === s ? "default" : "outline"} onClick={() => handleChangeStatus(selected.id, s)} disabled={selected.status === s}>
                    {statusLabels[s]}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPropertiesTab;
