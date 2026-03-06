import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ContactFormProps {
  propertyId: string;
}

const ContactForm = ({ propertyId }: ContactFormProps) => {
  const { locale } = useLanguage();
  const { user } = useAuth();
  const pt = locale === "pt-BR";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-contact", {
        body: {
          property_id: propertyId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          message: message.trim() || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSent(true);
      toast({ title: pt ? "Mensagem enviada!" : "Message sent!" });
    } catch (err: any) {
      toast({ title: pt ? "Erro ao enviar" : "Error sending", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  if (sent) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Send className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-2 font-medium">{pt ? "Mensagem enviada com sucesso!" : "Message sent successfully!"}</p>
          <p className="text-sm text-muted-foreground">{pt ? "O corretor entrará em contato." : "The broker will get back to you."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{pt ? "Enviar mensagem" : "Send message"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={pt ? "Seu nome *" : "Your name *"} required />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" required />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={pt ? "Telefone (opcional)" : "Phone (optional)"} />
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={pt ? "Sua mensagem..." : "Your message..."} rows={3} />
          <Button type="submit" className="w-full gap-2" disabled={sending}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" />
            {pt ? "Enviar mensagem" : "Send message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ContactForm;
