import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const SupportForm = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: messages, refetch } = useQuery({
    queryKey: ["support-messages", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleSend = async () => {
    if (!user || !subject.trim() || !message.trim()) {
      toast({ title: pt ? "Preencha todos os campos" : "Fill in all fields", variant: "destructive" });
      return;
    }
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      user_id: user.id,
      subject: subject.trim(),
      message: message.trim(),
    });
    if (error) {
      toast({ title: pt ? "Erro ao enviar" : "Error sending", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Mensagem enviada ao suporte!" : "Message sent to support!" });
      setSubject("");
      setMessage("");
      refetch();
    }
    setSending(false);
  };

  const statusLabel: Record<string, string> = pt
    ? { open: "Aberto", replied: "Respondido", closed: "Fechado" }
    : { open: "Open", replied: "Replied", closed: "Closed" };
  const statusVariant: Record<string, "default" | "secondary" | "outline"> = { open: "default", replied: "secondary", closed: "outline" };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {pt ? "Enviar mensagem ao suporte" : "Send a message to support"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-w-lg">
          <Input placeholder={pt ? "Assunto" : "Subject"} value={subject} onChange={e => setSubject(e.target.value)} maxLength={100} />
          <Textarea placeholder={pt ? "Descreva sua dúvida ou problema..." : "Describe your question or issue..."} value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={2000} />
          <Button onClick={handleSend} disabled={sending} className="gap-1">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pt ? "Enviar" : "Send"}
          </Button>
        </CardContent>
      </Card>

      {messages && messages.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{pt ? "Minhas mensagens" : "My messages"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {messages.map((m: any) => (
              <div key={m.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{m.subject}</p>
                  <Badge variant={statusVariant[m.status] ?? "secondary"} className="text-[10px]">{statusLabel[m.status] ?? m.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{m.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString(pt ? "pt-BR" : "en-US")}{" "}
                  {new Date(m.created_at).toLocaleTimeString(pt ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {m.admin_reply && (
                  <div className="mt-2 bg-muted p-2 rounded text-sm">
                    <p className="text-xs font-medium text-primary mb-1">{pt ? "Resposta do suporte:" : "Support reply:"}</p>
                    <p>{m.admin_reply}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SupportForm;
