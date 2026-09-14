import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, Loader2, Rss } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/** Shows the broker's public XML feed URL to paste into the portals. */
const FeedExportCard = () => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc("ensure_feed_token");
      if (!cancelled) {
        if (error) console.error("ensure_feed_token", error);
        setToken(typeof data === "string" ? data : null);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const feedUrl = token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feed-xml?token=${token}`
    : "";

  const copy = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: pt ? "Link copiado" : "Link copied" });
    } catch {
      toast({ title: pt ? "Não foi possível copiar" : "Could not copy", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Rss className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-medium text-foreground">{pt ? "Exportar para os portais" : "Export to portals"}</p>
            <p className="text-sm text-muted-foreground">
              {pt
                ? "Este é o seu feed XML no padrão VivaReal/ZAP com todos os seus anúncios ativos. Ele se atualiza sozinho."
                : "This is your VivaReal/ZAP standard XML feed with all your active listings. It updates automatically."}
            </p>
          </div>

          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : feedUrl ? (
            <>
              <div className="flex gap-2">
                <Input readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copy} title={pt ? "Copiar link" : "Copy link"}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">{pt ? "Onde colar" : "Where to paste"}</p>
                {pt ? (
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>VivaReal / ZAP: Canal Pro → Configurações → Integração XML → cole o link e valide.</li>
                    <li>OLX Imóveis: Painel do anunciante → Integração / Importação XML → cole o link.</li>
                    <li>Os portais leem o feed periodicamente; novas alterações aparecem na próxima leitura.</li>
                  </ul>
                ) : (
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>VivaReal / ZAP: Canal Pro → Settings → XML integration → paste and validate.</li>
                    <li>OLX: advertiser panel → XML import → paste the link.</li>
                    <li>Portals read the feed periodically; changes show up on the next read.</li>
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {pt ? "Não foi possível gerar seu link de feed. Tente recarregar a página." : "Could not generate your feed link. Try reloading."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedExportCard;
