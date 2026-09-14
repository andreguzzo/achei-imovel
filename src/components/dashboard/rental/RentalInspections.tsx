import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Loader2, Plus, Trash2 } from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import { compressImage } from "@/lib/imageCompression";
import { formatDate, inspectionTypeLabel, type InspectionType, type RentalContract, type RentalInspection } from "@/lib/rentals";

interface InspectionRow extends RentalInspection {
  rental_contracts: { tenant_name: string; property_label: string | null } | null;
}

interface Props {
  userId: string;
}

const RentalInspections = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [contracts, setContracts] = useState<Pick<RentalContract, "id" | "tenant_name" | "property_label">[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contractId, setContractId] = useState("");
  const [type, setType] = useState<InspectionType>("entrada");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [insRes, contractRes] = await Promise.all([
      supabase
        .from("rental_inspections")
        .select("*, rental_contracts(tenant_name, property_label)")
        .eq("broker_id", userId)
        .order("inspection_date", { ascending: false }),
      supabase
        .from("rental_contracts")
        .select("id, tenant_name, property_label")
        .eq("broker_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    if (insRes.error) toast.error(pt ? "Não foi possível carregar as vistorias." : "Could not load inspections.");
    setInspections((insRes.data ?? []) as InspectionRow[]);
    setContracts(contractRes.data ?? []);
    setLoading(false);
  }, [userId, pt]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => {
    setContractId("");
    setType("entrada");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setFiles([]);
  };

  const handleSave = async () => {
    if (!contractId) {
      toast.error(pt ? "Selecione o contrato." : "Select the contract.");
      return;
    }
    setSaving(true);
    const urls: string[] = [];
    for (const file of files.slice(0, 20)) {
      const compressed = await compressImage(file);
      const path = `${userId}/vistorias/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage.from("property-images").upload(path, compressed);
      if (error) continue;
      urls.push(supabase.storage.from("property-images").getPublicUrl(path).data.publicUrl);
    }

    const { error } = await supabase.from("rental_inspections").insert({
      contract_id: contractId,
      broker_id: userId,
      inspection_type: type,
      inspection_date: date,
      notes: notes.trim() || null,
      photos: urls,
    });
    setSaving(false);
    if (error) {
      toast.error(pt ? "Não foi possível salvar a vistoria." : "Could not save the inspection.");
      return;
    }
    toast.success(pt ? "Vistoria registrada." : "Inspection saved.");
    setOpen(false);
    resetForm();
    fetchAll();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("rental_inspections").delete().eq("id", id);
    if (error) {
      toast.error(pt ? "Não foi possível excluir a vistoria." : "Could not delete the inspection.");
      return;
    }
    fetchAll();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Vistorias" : "Inspections"}
        description={pt
          ? "Registre o estado do imóvel na entrada e na saída do inquilino, com fotos."
          : "Record the property condition at move-in and move-out, with photos."}
        count={inspections.length}
        action={
          <Button size="sm" className="gap-1" onClick={() => { resetForm(); setOpen(true); }} disabled={contracts.length === 0}>
            <Plus className="h-4 w-4" /> {pt ? "Nova vistoria" : "New inspection"}
          </Button>
        }
      />

      {inspections.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-7 w-7" />}
          title={pt ? "Nenhuma vistoria registrada" : "No inspections yet"}
          description={contracts.length === 0
            ? (pt ? "Cadastre um contrato de locação para registrar vistorias." : "Add a rental contract to record inspections.")
            : (pt ? "Fotografe o imóvel na entrada e na saída para evitar disputas." : "Photograph the property at move-in and move-out to avoid disputes.")}
        />
      ) : (
        <div className="space-y-3">
          {inspections.map((i) => {
            const photos = Array.isArray(i.photos) ? (i.photos as string[]) : [];
            return (
              <Card key={i.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={i.inspection_type === "entrada" ? "default" : "secondary"}>
                          {inspectionTypeLabel(i.inspection_type, pt)}
                        </Badge>
                        <p className="font-medium text-foreground">{i.rental_contracts?.tenant_name}</p>
                        <span className="text-sm text-muted-foreground">{formatDate(i.inspection_date, pt)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {i.rental_contracts?.property_label || "—"}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(i.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {i.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{i.notes}</p>}
                  {photos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {photos.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={pt ? "Foto da vistoria" : "Inspection photo"} loading="lazy"
                            className="h-20 w-24 rounded-md object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{pt ? "Nova vistoria" : "New inspection"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{pt ? "Contrato" : "Contract"}</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger><SelectValue placeholder={pt ? "Selecione" : "Select"} /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tenant_name}{c.property_label ? ` — ${c.property_label}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{pt ? "Tipo" : "Type"}</Label>
                <Select value={type} onValueChange={(v) => setType(v as InspectionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["entrada", "saida"] as InspectionType[]).map((t) => (
                      <SelectItem key={t} value={t}>{inspectionTypeLabel(t, pt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{pt ? "Data" : "Date"}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{pt ? "Observações" : "Notes"}</Label>
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={pt ? "Estado das paredes, pisos, louças, pintura..." : "Condition of walls, floors, fixtures, paint..."} />
            </div>
            <div>
              <Label>{pt ? "Fotos" : "Photos"}</Label>
              <Input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              {files.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {pt ? `${files.length} foto(s) selecionada(s)` : `${files.length} photo(s) selected`}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{pt ? "Cancelar" : "Cancel"}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pt ? "Salvar vistoria" : "Save inspection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RentalInspections;
