import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface Props {
  userId: string;
  email: string;
}

interface DeletionRequest {
  id: string;
  status: string;
  reason: string | null;
  created_at: string;
  admin_notes: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Em análise",
  processing: "Em tratamento",
  done: "Concluída",
  rejected: "Recusada",
};

const MyDataCard = ({ userId, email }: Props) => {
  const [exporting, setExporting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<DeletionRequest[]>([]);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from("deletion_requests")
      .select("id, status, reason, created_at, admin_notes")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
  }, [userId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-my-data");
      if (error) throw error;
      const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `abitzo-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exportação concluída", description: "O arquivo JSON foi baixado." });
    } catch (err) {
      toast({
        title: "Erro ao exportar",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
    setExporting(false);
  };

  const handleRequestDeletion = async () => {
    setSubmitting(true);
    const { error } = await supabase.from("deletion_requests").insert({
      user_id: userId,
      email,
      reason: reason.trim() || null,
    });
    setSubmitting(false);
    setConfirmOpen(false);
    if (error) {
      toast({ title: "Erro ao solicitar", description: error.message, variant: "destructive" });
      return;
    }
    setReason("");
    toast({
      title: "Solicitação registrada",
      description: "Nossa equipe vai tratar o pedido e você receberá a confirmação por e-mail.",
    });
    fetchRequests();
  };

  const pending = requests.find((r) => r.status === "pending" || r.status === "processing");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4" /> Meus dados
        </CardTitle>
        <CardDescription>
          Seus direitos como titular de dados pessoais, conforme a LGPD. Leia a{" "}
          <Link to="/privacidade" className="text-primary underline underline-offset-2">Política de Privacidade</Link>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Exportar meus dados</p>
          <p className="text-sm text-muted-foreground">
            Baixe em JSON tudo que guardamos sobre você: conta, perfil, anúncios, clientes, negociações,
            contratos de locação, cobranças, assinaturas e registros de consentimento.
          </p>
          <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar em JSON
          </Button>
        </div>

        <div className="space-y-2 border-t border-border pt-5">
          <p className="text-sm font-medium">Excluir minha conta</p>
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">O que é apagado</p>
            <ul className="mt-1 list-disc pl-5">
              <li>Perfil, fotos, bio e página pública</li>
              <li>Anúncios, imagens e documentos dos imóveis</li>
              <li>Clientes, negociações, contatos recebidos e agenda</li>
              <li>Buscas salvas e favoritos</li>
            </ul>
            <p className="mt-3 font-medium text-foreground">O que precisa ser retido por obrigação legal</p>
            <ul className="mt-1 list-disc pl-5">
              <li>Registros financeiros e fiscais de assinaturas e pagamentos</li>
              <li>Cobranças e repasses de contratos de locação já emitidos</li>
              <li>Registros de consentimento e de acesso, como prova de conformidade</li>
            </ul>
            <p className="mt-2">
              Esses registros ficam guardados pelos prazos legais aplicáveis, em regra 5 anos, com acesso
              restrito, e não são usados para outras finalidades.
            </p>
          </div>

          {pending ? (
            <p className="text-sm text-muted-foreground">
              Você já tem uma solicitação de exclusão em andamento
              {" "}({STATUS_LABEL[pending.status] ?? pending.status}), enviada em{" "}
              {new Date(pending.created_at).toLocaleDateString("pt-BR")}.
            </p>
          ) : (
            <>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Conte o motivo (opcional)"
              />
              <Button variant="destructive" className="gap-2" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" /> Solicitar exclusão da conta
              </Button>
            </>
          )}

          {requests.length > 0 && (
            <div className="space-y-1 pt-2">
              {requests.map((r) => (
                <p key={r.id} className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("pt-BR")} — {STATUS_LABEL[r.status] ?? r.status}
                  {r.admin_notes ? ` · ${r.admin_notes}` : ""}
                </p>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar solicitação de exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua solicitação será analisada pela nossa equipe. Anúncios, clientes e documentos serão
              apagados; registros financeiros e fiscais serão retidos pelo prazo legal. Exporte seus dados
              antes, se quiser guardar uma cópia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRequestDeletion} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar solicitação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default MyDataCard;
