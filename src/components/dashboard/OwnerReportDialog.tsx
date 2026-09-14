import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppUrl, formatBrPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, FileText, MessageCircle, ExternalLink, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import {
  brl,
  buildReportUrl,
  // whatsappLink replaced by buildWhatsAppUrl
  type OwnerReportComparison,
  type OwnerReportMetrics,
} from "@/lib/ownerReport";

interface Props {
  property: (Tables<"properties"> & { property_images?: Tables<"property_images">[] }) | null;
  broker: { name: string; creci: string; phone: string };
  onClose: () => void;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const OwnerReportDialog = ({ property, broker, onClose }: Props) => {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  const [periodStart, setPeriodStart] = useState(isoDate(monthAgo));
  const [periodEnd, setPeriodEnd] = useState(isoDate(today));
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<OwnerReportMetrics | null>(null);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  const collect = useCallback(async () => {
    if (!property) return;
    setLoading(true);
    setReportUrl(null);

    const startTs = `${periodStart}T00:00:00`;
    const endTs = `${periodEnd}T23:59:59`;

    const [leadsRes, waLeadsRes, apptRes, socialRes, privateRes, statsRes] = await Promise.all([
      supabase
        .from("contact_requests")
        .select("id", { count: "exact", head: true })
        .eq("property_id", property.id)
        .gte("created_at", startTs)
        .lte("created_at", endTs),
      supabase
        .from("contact_requests")
        .select("id", { count: "exact", head: true })
        .eq("property_id", property.id)
        .eq("request_type", "whatsapp")
        .gte("created_at", startTs)
        .lte("created_at", endTs),
      supabase
        .from("broker_appointments")
        .select("id, completed")
        .eq("property_id", property.id)
        .gte("appointment_date", periodStart)
        .lte("appointment_date", periodEnd),
      supabase.from("social_post_exports").select("format").eq("property_id", property.id),
      supabase
        .from("property_private_data")
        .select("owner_name, owner_phone")
        .eq("property_id", property.id)
        .maybeSingle(),
      supabase.rpc("similar_price_stats", {
        _city: property.city,
        _state: property.state,
        _property_type: property.property_type,
        _listing_type: property.listing_type,
        _area: property.area,
      }),
    ]);

    const appts = apptRes.data ?? [];
    const channels = ["Portal Abitzo"];
    if (property.video_url) channels.push("Vídeo (YouTube)");
    const formats = new Set((socialRes.data ?? []).map((r) => r.format));
    if (formats.has("instagram") || formats.has("instagram_story")) channels.push("Instagram");
    if (formats.has("facebook")) channels.push("Facebook");

    const stats = (statsRes.data as OwnerReportComparison[] | null)?.[0] ?? null;
    let comparison: OwnerReportComparison | null = null;
    if (stats && Number(stats.sample_count) >= 5) {
      const avg = stats.avg_price ? Number(stats.avg_price) : null;
      comparison = {
        sample_count: Number(stats.sample_count),
        avg_price: avg,
        median_price: stats.median_price ? Number(stats.median_price) : null,
        avg_price_per_area: stats.avg_price_per_area ? Number(stats.avg_price_per_area) : null,
        diff_percent: avg ? Number((((property.price - avg) / avg) * 100).toFixed(1)) : null,
      };
    }

    setOwnerPhone(privateRes.data?.owner_phone ?? null);
    setOwnerName(privateRes.data?.owner_name ?? null);

    setMetrics({
      property: {
        id: property.id,
        title: property.title,
        reference_code: property.reference_code,
        property_type: property.property_type,
        listing_type: property.listing_type,
        status: property.status,
        price: Number(property.price),
        area: property.area ? Number(property.area) : null,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        suites: property.suites,
        parking_spots: property.parking_spots,
        neighborhood: property.neighborhood,
        city: property.city,
        state: property.state,
        published_at: property.created_at,
        cover_url: property.property_images?.[0]?.url ?? null,
      },
      broker: { name: broker.name, creci: broker.creci || null, phone: broker.phone || null },
      views: property.view_count ?? 0,
      leads: leadsRes.count ?? 0,
      leads_whatsapp: waLeadsRes.count ?? 0,
      visits_scheduled: appts.length,
      visits_done: appts.filter((a) => a.completed).length,
      channels,
      comparison,
    });
    setLoading(false);
  }, [property, periodStart, periodEnd, broker]);

  useEffect(() => {
    if (property) void collect();
  }, [property, collect]);

  const generate = async () => {
    if (!property || !metrics) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("owner_reports")
      .insert({
        property_id: property.id,
        broker_id: property.user_id,
        period_start: periodStart,
        period_end: periodEnd,
        summary: summary.trim() || null,
        metrics: JSON.parse(JSON.stringify(metrics)),
      })
      .select("share_token")
      .single();
    setSaving(false);

    if (error || !data?.share_token) {
      toast({ title: "Não foi possível gerar o relatório", description: error?.message, variant: "destructive" });
      return;
    }
    const url = buildReportUrl(data.share_token);
    setReportUrl(url);
    window.open(url, "_blank", "noopener");
  };

  const sendWhatsapp = () => {
    if (!reportUrl || !ownerPhone) return;
    const greeting = ownerName ? `Olá, ${ownerName}!` : "Olá!";
    const msg = `${greeting} Preparei o relatório de performance do imóvel "${property?.title}". Você pode acessar aqui: ${reportUrl}`;
    const url = buildWhatsAppUrl(ownerPhone, msg);
    if (!url) {
      toast({
        title: "Telefone do proprietário inválido para WhatsApp",
        description: `O número ${formatBrPhone(ownerPhone)} não permite envio pelo WhatsApp.`,
        variant: "destructive",
      });
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  return (
    <Dialog open={!!property} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório ao proprietário</DialogTitle>
          <DialogDescription className="truncate">{property?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-start">Início do período</Label>
              <Input id="report-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-end">Fim do período</Label>
              <Input id="report-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : metrics ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Visualizações", value: metrics.views, hint: null },
                  { label: "Contatos recebidos", value: metrics.leads, hint: metrics.leads_whatsapp ? `${metrics.leads_whatsapp} via WhatsApp` : null },
                  { label: "Visitas agendadas", value: metrics.visits_scheduled, hint: null },
                  { label: "Visitas realizadas", value: metrics.visits_done, hint: null },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground">{m.label}</p>
                    <p className="text-xl font-semibold text-foreground">{m.value}</p>
                    {m.hint && <p className="text-[10px] text-muted-foreground">{m.hint}</p>}
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium text-foreground">Comparação de preço</p>
                {metrics.comparison ? (
                  <p className="mt-1 text-muted-foreground">
                    Amostra de {metrics.comparison.sample_count} imóveis semelhantes em {metrics.property.city}.
                    Média {metrics.comparison.avg_price ? brl(metrics.comparison.avg_price) : "—"}
                    {metrics.comparison.diff_percent !== null && (
                      <> • este imóvel está {Math.abs(metrics.comparison.diff_percent)}%{" "}
                      {metrics.comparison.diff_percent >= 0 ? "acima" : "abaixo"} da média</>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    Amostra insuficiente (menos de 5 imóveis semelhantes na base). A comparação não será exibida.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="report-summary">Resumo do corretor</Label>
                <Textarea
                  id="report-summary"
                  rows={5}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Comentários sobre o desempenho do imóvel, perfil dos interessados, sugestões de ajuste de preço..."
                />
              </div>

              {reportUrl && (
                <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-medium text-foreground">Relatório gerado</p>
                  <p className="break-all text-muted-foreground">{reportUrl}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(reportUrl, "_blank", "noopener")}>
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={async () => {
                        await navigator.clipboard.writeText(reportUrl);
                        toast({ title: "Link copiado" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar link
                    </Button>
                    {buildWhatsAppUrl(ownerPhone) && (
                      <Button size="sm" className="gap-1" onClick={sendWhatsapp}>
                        <MessageCircle className="h-3.5 w-3.5" /> Enviar ao proprietário
                      </Button>
                    )}
                  </div>
                  {!ownerPhone ? (
                    <p className="text-xs text-muted-foreground">
                      Cadastre o telefone do proprietário nos dados privados do imóvel para enviar por WhatsApp.
                    </p>
                  ) : !buildWhatsAppUrl(ownerPhone) ? (
                    <p className="text-xs text-muted-foreground">
                      {formatBrPhone(ownerPhone)} — número cadastrado não é válido para WhatsApp.
                    </p>
                  ) : null}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Fechar</Button>
                <Button className="gap-1" onClick={generate} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Gerar relatório
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OwnerReportDialog;
