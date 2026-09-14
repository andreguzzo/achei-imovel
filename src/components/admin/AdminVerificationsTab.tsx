import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/dashboard/SectionHeader";

type Row = {
  id: string;
  user_id: string;
  kind: string;
  status: string;
  reason: string | null;
  confidence: number | null;
  extracted: Record<string, unknown> | null;
  claimed_name: string | null;
  claimed_creci: string | null;
  professional_doc_path: string | null;
  personal_doc_path: string | null;
  created_at: string;
};

const AdminVerificationsTab = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [onlyPending, setOnlyPending] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("identity_verifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (onlyPending) q = q.in("status", ["pending", "manual_review"]);
    const { data } = await q;
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }, [onlyPending]);

  useEffect(() => { load(); }, [load]);

  const openDoc = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from("identity-documents").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Não foi possível abrir o documento", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const review = async (row: Row, approve: boolean) => {
    const reason = reasons[row.id] ?? "";
    if (!approve && reason.trim().length < 3) {
      toast({ title: "Informe o motivo da recusa", variant: "destructive" });
      return;
    }
    setWorking(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-review-verification", {
        body: { id: row.id, approve, reason },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: approve ? "Verificação aprovada" : "Verificação recusada" });
      await load();
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Verificações de identidade"
        description="Fila de documentos enviados por corretores e imobiliárias, com o que a IA leu em cada um."
        action={
          <Button variant="outline" size="sm" onClick={() => setOnlyPending((v) => !v)}>
            {onlyPending ? "Ver todas" : "Ver pendentes"}
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma verificação na fila.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {row.claimed_name || "Sem nome"}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      {row.kind === "agency" ? "Imobiliária" : "Corretor"}
                    </span>
                  </CardTitle>
                  <Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>
                    {row.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-1 sm:grid-cols-2">
                  <p><span className="text-muted-foreground">Declarado:</span> {row.claimed_creci || "—"}</p>
                  <p><span className="text-muted-foreground">Confiança da IA:</span> {row.confidence != null ? `${Math.round(row.confidence * 100)}%` : "—"}</p>
                  <p><span className="text-muted-foreground">Enviado em:</span> {new Date(row.created_at).toLocaleString("pt-BR")}</p>
                  <p><span className="text-muted-foreground">Motivo:</span> {row.reason || "—"}</p>
                </div>

                {row.extracted && Object.keys(row.extracted).length > 0 && (
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(row.extracted, null, 2)}
                  </pre>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openDoc(row.professional_doc_path)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Documento profissional
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openDoc(row.personal_doc_path)}>
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Documento pessoal
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Motivo (obrigatório para recusar)"
                    value={reasons[row.id] ?? ""}
                    onChange={(e) => setReasons((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    className="max-w-sm"
                  />
                  <Button size="sm" onClick={() => review(row, true)} disabled={working === row.id}>
                    {working === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => review(row, false)} disabled={working === row.id}>
                    Recusar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminVerificationsTab;
