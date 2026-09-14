import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, Upload, AlertTriangle, CheckCircle2, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { featureLabel } from "@/lib/propertyFeatures";

export interface ParsedItem {
  externalRef: string;
  title: string;
  description: string | null;
  property_type: string;
  listing_type: string;
  price: number;
  condo_fee: number | null;
  iptu: number | null;
  area: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  features: string[];
  images: string[];
  unmapped: string[];
  missing: string[];
  exists: boolean;
}

interface PreviewResult {
  items: ParsedItem[];
  summary: { total: number; newCount: number; existingCount: number; invalid: number };
  limits: { current: number; max: number | null };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const BATCH = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const ImportListings = ({ open, onOpenChange, onImported }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  const [feedUrl, setFeedUrl] = useState("");
  const [source, setSource] = useState("vivareal");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview(null);
    setSelected({});
    setProgress(0);
  };

  const runPreview = async (payload: { url?: string; xml?: string }) => {
    setLoading(true);
    reset();
    const { data, error } = await supabase.functions.invoke("import-listings", {
      body: { action: "preview", ...payload },
    });
    setLoading(false);

    const errMessage = (data as { error?: string } | null)?.error ?? (error ? error.message : null);
    if (errMessage) {
      toast({ title: pt ? "Não foi possível ler o feed" : "Could not read the feed", description: errMessage, variant: "destructive" });
      return;
    }
    const result = data as PreviewResult;
    setPreview(result);
    const initial: Record<string, boolean> = {};
    for (const item of result.items) initial[item.externalRef] = item.missing.length === 0 || !item.missing.some((m) => ["cidade", "estado", "preço"].includes(m));
    setSelected(initial);
  };

  const handleUrl = () => {
    if (!feedUrl.trim()) {
      toast({ title: pt ? "Informe a URL do feed" : "Enter the feed URL", variant: "destructive" });
      return;
    }
    runPreview({ url: feedUrl.trim() });
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: pt ? "Arquivo maior que 25 MB" : "File larger than 25 MB", variant: "destructive" });
      return;
    }
    const xml = await file.text();
    runPreview({ xml });
  };

  const selectedItems = (preview?.items ?? []).filter((i) => selected[i.externalRef]);
  const newSelected = selectedItems.filter((i) => !i.exists).length;
  const limitMax = preview?.limits.max ?? null;
  const room = limitMax === null ? Infinity : Math.max(0, limitMax - (preview?.limits.current ?? 0));
  const exceeds = newSelected > room;

  const confirmImport = async () => {
    if (selectedItems.length === 0) return;
    setImporting(true);
    setProgress(0);

    let created = 0;
    let updated = 0;
    let images = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (let i = 0; i < selectedItems.length; i += BATCH) {
      const chunk = selectedItems.slice(i, i + BATCH);
      const { data, error } = await supabase.functions.invoke("import-listings", {
        body: { action: "commit", source, items: chunk },
      });
      const res = data as {
        created?: number; updated?: number; imagesSaved?: number;
        errors?: { ref: string; message: string }[]; skippedByLimit?: string[]; error?: string;
      } | null;

      if (error || res?.error) {
        failures.push(res?.error ?? error?.message ?? "erro");
      } else {
        created += res?.created ?? 0;
        updated += res?.updated ?? 0;
        images += res?.imagesSaved ?? 0;
        skipped += res?.skippedByLimit?.length ?? 0;
        for (const e of res?.errors ?? []) failures.push(`${e.ref}: ${e.message}`);
      }
      setProgress(Math.min(selectedItems.length, i + chunk.length));
    }

    setImporting(false);
    onImported();

    toast({
      title: pt ? "Importação concluída" : "Import finished",
      description: pt
        ? `${created} novo(s), ${updated} atualizado(s), ${images} foto(s) salva(s)${skipped ? `, ${skipped} bloqueado(s) pelo limite do plano` : ""}${failures.length ? `, ${failures.length} com erro` : ""}.`
        : `${created} new, ${updated} updated, ${images} photos${skipped ? `, ${skipped} blocked by plan limit` : ""}${failures.length ? `, ${failures.length} failed` : ""}.`,
      variant: failures.length ? "destructive" : undefined,
    });
    if (failures.length === 0) {
      onOpenChange(false);
      reset();
    }
  };

  const allUnmapped = [...new Set((preview?.items ?? []).flatMap((i) => i.unmapped))];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pt ? "Importar anúncios" : "Import listings"}</DialogTitle>
          <DialogDescription>
            {pt
              ? "Leia o feed XML que você já usa no VivaReal/ZAP (Canal Pro) ou na OLX. Nada é gravado antes da sua confirmação."
              : "Read the XML feed you already use on VivaReal/ZAP or OLX. Nothing is saved before you confirm."}
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <Tabs defaultValue="url" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url">{pt ? "URL do feed" : "Feed URL"}</TabsTrigger>
              <TabsTrigger value="file">{pt ? "Arquivo XML" : "XML file"}</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-3">
              <label className="block text-sm font-medium">{pt ? "Endereço do seu feed" : "Your feed address"}</label>
              <Input
                placeholder="https://meusite.com.br/feed.xml"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
              />
              <Button onClick={handleUrl} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {pt ? "Ler feed" : "Read feed"}
              </Button>
            </TabsContent>

            <TabsContent value="file" className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {pt ? "Escolher arquivo XML" : "Choose XML file"}
              </Button>
              <p className="text-xs text-muted-foreground">
                {pt ? "Formatos aceitos: VivaReal/ZAP (Canal Pro) e OLX. Até 25 MB." : "Accepted: VivaReal/ZAP and OLX. Up to 25 MB."}
              </p>
            </TabsContent>

            <div>
              <label className="mb-1 block text-sm font-medium">{pt ? "Origem" : "Source"}</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="vivareal">VivaReal / ZAP</option>
                <option value="olx">OLX</option>
                <option value="outro">{pt ? "Outro portal" : "Other portal"}</option>
              </select>
            </div>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: pt ? "Lidos" : "Read", value: preview.summary.total },
                { label: pt ? "Novos" : "New", value: preview.summary.newCount },
                { label: pt ? "Já existem" : "Existing", value: preview.summary.existingCount },
                { label: pt ? "Ignorados" : "Skipped", value: preview.summary.invalid },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-semibold">{s.value}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {limitMax === null
                ? pt ? "Seu plano permite anúncios ilimitados." : "Your plan allows unlimited listings."
                : pt
                  ? `Seu plano permite ${limitMax} anúncio(s). Você já tem ${preview.limits.current}.`
                  : `Your plan allows ${limitMax}. You already have ${preview.limits.current}.`}
            </p>

            {exceeds && (
              <div className="flex gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {pt
                    ? `A seleção tem ${newSelected} imóveis novos e só cabem ${room} no seu plano. Os excedentes não serão importados.`
                    : `Selection has ${newSelected} new listings but only ${room} fit your plan. The extras will be skipped.`}
                </span>
              </div>
            )}

            {allUnmapped.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium">{pt ? "Características sem equivalente (serão ignoradas)" : "Unmapped features (ignored)"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{allUnmapped.slice(0, 20).join(" • ")}</p>
              </div>
            )}

            <div className="divide-y divide-border rounded-lg border border-border">
              {preview.items.map((item) => (
                <label key={item.externalRef} className="flex cursor-pointer items-start gap-3 p-3 text-sm">
                  <Checkbox
                    checked={!!selected[item.externalRef]}
                    onCheckedChange={(c) => setSelected((prev) => ({ ...prev, [item.externalRef]: !!c }))}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      <Badge variant={item.exists ? "secondary" : "default"} className="text-[10px]">
                        {item.exists ? (pt ? "Já existe" : "Existing") : (pt ? "Novo" : "New")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">#{item.externalRef}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.city}{item.state ? ` - ${item.state}` : ""} • {item.listing_type === "rent" ? (pt ? "Aluguel" : "Rent") : (pt ? "Venda" : "Sale")} • {item.price ? brl(item.price) : "—"} • {item.images.length} {pt ? "foto(s)" : "photos"}
                    </p>
                    {item.features.length > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.features.slice(0, 6).map((f) => featureLabel(f, pt)).join(" • ")}
                      </p>
                    )}
                    {item.missing.length > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" />
                        {pt ? "Sem" : "Missing"}: {item.missing.join(", ")}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={confirmImport} disabled={importing || selectedItems.length === 0} className="gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {importing
                  ? `${progress}/${selectedItems.length}`
                  : pt ? `Importar ${selectedItems.length} anúncio(s)` : `Import ${selectedItems.length} listings`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={importing}>
                {pt ? "Ler outro feed" : "Read another feed"}
              </Button>
              <span className="text-xs text-muted-foreground">
                <Download className="mr-1 inline h-3 w-3" />
                {pt ? "As fotos são baixadas e regravadas no Abitzo." : "Photos are downloaded and re-hosted on Abitzo."}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportListings;
