import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/dashboard/SectionHeader";

interface DeletionRequest {
  id: string;
  user_id: string;
  email: string | null;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
}

const STATUSES = [
  { value: "pending", label: "Em análise" },
  { value: "processing", label: "Em tratamento" },
  { value: "done", label: "Concluída" },
  { value: "rejected", label: "Recusada" },
];

const statusVariant = (status: string) =>
  status === "done" ? "secondary" : status === "rejected" ? "outline" : "default";

const AdminDeletionRequestsTab = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("deletion_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setRequests((data as DeletionRequest[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const updateStatus = async (req: DeletionRequest, status: string) => {
    setSavingId(req.id);
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("deletion_requests")
      .update({
        status,
        admin_notes: notes[req.id] ?? req.admin_notes,
        processed_by: me.user?.id ?? null,
        processed_at: status === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", req.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Solicitação atualizada" });
    fetchRequests();
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Solicitações de exclusão"
        description="Pedidos de exclusão de conta enviados pelos usuários (LGPD). Registros financeiros e fiscais devem ser retidos pelo prazo legal."
      />

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Trash2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma solicitação de exclusão no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardContent className="space-y-3 py-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{req.email ?? req.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado em {new Date(req.created_at).toLocaleString("pt-BR")}
                      {req.processed_at && ` · tratado em ${new Date(req.processed_at).toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                  <Badge variant={statusVariant(req.status)}>
                    {STATUSES.find((s) => s.value === req.status)?.label ?? req.status}
                  </Badge>
                </div>

                {req.reason && (
                  <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{req.reason}</p>
                )}

                <Textarea
                  rows={2}
                  placeholder="Observações internas sobre o tratamento"
                  value={notes[req.id] ?? req.admin_notes ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                />

                <div className="flex flex-wrap gap-2">
                  {STATUSES.filter((s) => s.value !== req.status).map((s) => (
                    <Button
                      key={s.value}
                      size="sm"
                      variant={s.value === "done" ? "default" : "outline"}
                      disabled={savingId === req.id}
                      onClick={() => updateStatus(req, s.value)}
                    >
                      {savingId === req.id && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Marcar como {s.label.toLowerCase()}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDeletionRequestsTab;
