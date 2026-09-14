import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageCircle, Reply, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionHeader } from "@/components/dashboard/SectionHeader";

interface SupportMessage {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  profile?: { full_name: string | null; creci: string | null };
}

const AdminSupportTab = () => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<SupportMessage | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    const { data: msgs } = await supabase
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (msgs && msgs.length > 0) {
      // Fetch profiles for user names
      const userIds = [...new Set(msgs.map((m) => m.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, creci")
        .in("user_id", userIds);

      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
      setMessages(msgs.map((m) => ({ ...m, profile: profileMap.get(m.user_id) })));
    } else {
      setMessages([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMessages(); }, []);

  const filtered = messages.filter(m => statusFilter === "all" || m.status === statusFilter);

  const handleReply = async () => {
    if (!selected || !reply.trim()) return;
    setReplying(true);
    const { error } = await supabase
      .from("support_messages")
      .update({ admin_reply: reply.trim(), status: "replied", replied_at: new Date().toISOString() })
      .eq("id", selected.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Resposta enviada!" });
      setSelected(null);
      setReply("");
      fetchMessages();
    }
    setReplying(false);
  };

  const handleClose = async (id: string) => {
    await supabase.from("support_messages").update({ status: "closed" }).eq("id", id);
    fetchMessages();
    toast({ title: "Chamado fechado" });
  };

  const statusLabel: Record<string, string> = { open: "Aberto", replied: "Respondido", closed: "Fechado" };
  const statusVariant: Record<string, "default" | "secondary" | "outline"> = { open: "default", replied: "secondary", closed: "outline" };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Suporte"
        description="Chamados abertos pelos corretores e histórico de respostas."
        count={filtered.length}
      />
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="replied">Respondidos</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{filtered.length} mensagens</p>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma mensagem de suporte</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{m.subject}</p>
                    <Badge variant={statusVariant[m.status]} className="text-[10px]">{statusLabel[m.status]}</Badge>
                  </div>
                  <div className="flex gap-1">
                    {m.status !== "closed" && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setSelected(m); setReply(m.admin_reply ?? ""); }}>
                        <Reply className="h-3 w-3" /> Responder
                      </Button>
                    )}
                    {m.status !== "closed" && (
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleClose(m.id)}>Fechar</Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.profile?.full_name ?? "Usuário"} {m.profile?.creci ? `(CRECI: ${m.profile.creci})` : ""} · {new Date(m.created_at).toLocaleDateString("pt-BR")} {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{m.message}</p>
                {m.admin_reply && (
                  <div className="mt-2 bg-muted p-2 rounded text-sm">
                    <p className="text-xs font-medium text-primary mb-1">Sua resposta:</p>
                    <p>{m.admin_reply}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Responder Chamado</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="bg-muted p-3 rounded text-sm space-y-1">
                <p className="font-medium">{selected.subject}</p>
                <p className="text-muted-foreground">{selected.message}</p>
                <p className="text-xs text-muted-foreground">{selected.profile?.full_name} · {new Date(selected.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <Textarea placeholder="Sua resposta..." value={reply} onChange={e => setReply(e.target.value)} rows={4} />
              <Button onClick={handleReply} disabled={replying} className="gap-1">
                {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
                Enviar resposta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupportTab;
