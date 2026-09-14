import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import Seo from "@/components/Seo";
import { brl, reportDate, type OwnerReportMetrics } from "@/lib/ownerReport";

interface ReportRow {
  period_start: string;
  period_end: string;
  summary: string | null;
  created_at: string;
  metrics: OwnerReportMetrics;
}

const typeLabels: Record<string, string> = {
  apartment: "Apartamento",
  house: "Casa",
  land: "Terreno",
  commercial: "Comercial",
};

const OwnerReport = () => {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setErrorMsg("Link inválido.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("get-owner-report", {
        body: { token },
      });
      const payload = data as (ReportRow & { error?: string }) | null;
      if (error || !payload || payload.error || !payload.metrics) {
        setErrorMsg(payload?.error ?? "Relatório não encontrado.");
      } else {
        setReport(payload);
      }
      setLoading(false);
    };
    void load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-foreground">Relatório não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">O link pode ter expirado ou o relatório foi removido.</p>
      </div>
    );
  }

  const m = report.metrics;
  const p = m.property;
  const c = m.comparison;

  return (
    <div className="bg-background">
      <Seo
        title={`Relatório de performance — ${p.title}`}
        description="Relatório de performance do imóvel enviado pelo corretor responsável."
        type="article"
      />

      <div className="mx-auto max-w-3xl px-4 py-8 print:py-0">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <p className="text-sm text-muted-foreground">
            Gerado em {new Date(report.created_at).toLocaleDateString("pt-BR")}
          </p>
          <Button className="gap-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>

        <header className="border-b border-border pb-5">
          <p className="text-xs uppercase tracking-widest text-primary">Relatório de performance</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{p.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.reference_code ? `Cód. ${p.reference_code} • ` : ""}
            {[p.neighborhood, `${p.city} - ${p.state}`].filter(Boolean).join(", ")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Período: {reportDate(report.period_start)} a {reportDate(report.period_end)}
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-[220px_1fr]">
          {p.cover_url && (
            <img src={p.cover_url} alt="" width={220} height={160} className="h-40 w-full rounded-lg object-cover sm:w-[220px]" />
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-muted-foreground">Tipo</dt><dd className="font-medium text-foreground">{typeLabels[p.property_type] ?? p.property_type}</dd></div>
            <div><dt className="text-muted-foreground">Finalidade</dt><dd className="font-medium text-foreground">{p.listing_type === "rent" ? "Locação" : "Venda"}</dd></div>
            <div><dt className="text-muted-foreground">Valor anunciado</dt><dd className="font-medium text-foreground">{brl(p.price)}</dd></div>
            <div><dt className="text-muted-foreground">Área</dt><dd className="font-medium text-foreground">{p.area ? `${p.area} m²` : "—"}</dd></div>
            <div><dt className="text-muted-foreground">Quartos / suítes</dt><dd className="font-medium text-foreground">{p.bedrooms ?? 0} / {p.suites ?? 0}</dd></div>
            <div><dt className="text-muted-foreground">Banheiros / vagas</dt><dd className="font-medium text-foreground">{p.bathrooms ?? 0} / {p.parking_spots ?? 0}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Publicado em</dt><dd className="font-medium text-foreground">{new Date(p.published_at).toLocaleDateString("pt-BR")}</dd></div>
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Desempenho no período</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Visualizações", value: m.views },
              { label: "Contatos recebidos", value: m.leads },
              { label: "Visitas agendadas", value: m.visits_scheduled },
              { label: "Visitas realizadas", value: m.visits_done },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{k.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Canais de divulgação</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {m.channels.map((ch) => (
              <li key={ch} className="rounded-full border border-border bg-muted/40 px-3 py-1 text-foreground">{ch}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Comparação de mercado</h2>
          {c ? (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
              <p className="text-muted-foreground">
                Média de {c.sample_count} imóveis semelhantes em {p.city}, na mesma faixa de área e finalidade.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Preço médio</p><p className="font-semibold text-foreground">{c.avg_price ? brl(c.avg_price) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Preço mediano</p><p className="font-semibold text-foreground">{c.median_price ? brl(c.median_price) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor médio por m²</p><p className="font-semibold text-foreground">{c.avg_price_per_area ? brl(c.avg_price_per_area) : "—"}</p></div>
              </div>
              {c.diff_percent !== null && (
                <p className="text-foreground">
                  Este imóvel está <strong>{Math.abs(c.diff_percent)}% {c.diff_percent >= 0 ? "acima" : "abaixo"}</strong> da média da amostra.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Não há imóveis semelhantes suficientes na base para uma comparação estatística confiável neste período.
            </p>
          )}
        </section>

        {report.summary && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Comentários do corretor</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">{report.summary}</p>
          </section>
        )}

        <footer className="mt-10 border-t border-border pt-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{m.broker.name}</p>
          {m.broker.creci && <p>CRECI {m.broker.creci}</p>}
          {m.broker.phone && <p>{m.broker.phone}</p>}
        </footer>
      </div>
    </div>
  );
};

export default OwnerReport;
