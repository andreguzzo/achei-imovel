import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, ShieldCheck, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface EmailVerificationProps {
  email: string;
  verified: boolean;
  onVerified: () => void;
}

const EmailVerification = ({ email, verified, onVerified }: EmailVerificationProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const handleSendCode = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-code", {
        body: { type: "email" },
      });

      if (error) {
        toast({ title: pt ? "Erro ao enviar código" : "Error sending code", variant: "destructive" });
      } else {
        setCodeSent(true);
        if (data?.dev_code) {
          setDevCode(data.dev_code);
        }
        toast({ title: pt ? "Código enviado!" : "Code sent!", description: pt ? "Verifique seu e-mail" : "Check your email" });
      }
    } catch {
      toast({ title: pt ? "Erro" : "Error", variant: "destructive" });
    }
    setSending(false);
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({ title: pt ? "Digite o código de 6 dígitos" : "Enter the 6-digit code", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-code", {
        body: { code, type: "email" },
      });

      if (error || !data?.verified) {
        toast({ title: pt ? "Código inválido ou expirado" : "Invalid or expired code", variant: "destructive" });
      } else {
        toast({ title: pt ? "E-mail verificado!" : "Email verified!" });
        onVerified();
      }
    } catch {
      toast({ title: pt ? "Erro" : "Error", variant: "destructive" });
    }
    setVerifying(false);
  };

  if (verified) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">{email}</p>
            <p className="text-xs text-muted-foreground">{pt ? "E-mail verificado" : "Email verified"}</p>
          </div>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            {pt ? "Verificado" : "Verified"}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" /> {pt ? "Verificação de E-mail" : "Email Verification"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-sm">{email}</p>
          <Badge variant="outline" className="text-yellow-700 border-yellow-300">
            {pt ? "Não verificado" : "Not verified"}
          </Badge>
        </div>

        {!codeSent ? (
          <Button onClick={handleSendCode} disabled={sending} size="sm" className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pt ? "Enviar código de verificação" : "Send verification code"}
          </Button>
        ) : (
          <div className="space-y-3">
            {devCode && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-xs font-medium text-yellow-800">
                  {pt ? "Modo de desenvolvimento — Código:" : "Dev mode — Code:"} <span className="font-mono text-sm">{devCode}</span>
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-32 text-center font-mono text-lg tracking-widest"
              />
              <Button onClick={handleVerify} disabled={verifying || code.length !== 6} size="sm">
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pt ? "Verificar" : "Verify"}
              </Button>
            </div>
            <button onClick={handleSendCode} disabled={sending} className="text-xs text-primary hover:underline">
              {pt ? "Reenviar código" : "Resend code"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailVerification;
