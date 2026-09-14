import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { BadgeCheck, Clock, FileUp, Loader2, ShieldAlert, X, XCircle } from "lucide-react";

type Verification = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  confidence: number | null;
  created_at: string;
};

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 15 * 1024 * 1024;

const statusMeta: Record<string, { label: string; icon: typeof BadgeCheck; className: string }> = {
  approved: { label: "Aprovado", icon: BadgeCheck, className: "bg-primary/10 text-primary" },
  pending: { label: "Em análise", icon: Clock, className: "bg-muted text-muted-foreground" },
  manual_review: { label: "Em revisão manual", icon: ShieldAlert, className: "bg-accent/20 text-accent-foreground" },
  rejected: { label: "Recusado", icon: XCircle, className: "bg-destructive/10 text-destructive" },
  unverified: { label: "Não verificado", icon: ShieldAlert, className: "bg-muted text-muted-foreground" },
};

const DropZone = ({
  label, file, onFile, disabled,
}: { label: string; file: File | null; onFile: (f: File | null) => void; disabled?: boolean }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const pick = (f: File | null) => {
    if (!f) return onFile(null);
    if (!ACCEPT.includes(f.type)) {
      toast({ title: "Formato não aceito", description: "Envie JPG, PNG ou PDF.", variant: "destructive" });
      return;
    }
    if (f.size > MAX_SIZE) {
      toast({ title: "Arquivo muito grande", description: "O limite é 15 MB.", variant: "destructive" });
      return;
    }
    onFile(f);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); }
        }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) pick(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-5 text-center text-sm transition-colors ${
          over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <FileUp className="h-5 w-5 text-muted-foreground" />
        {file ? (
          <span className="flex items-center gap-2 font-medium">
            {file.name}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onFile(null); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </span>
        ) : (
          <>
            <span>Arraste o arquivo aqui ou clique para escolher</span>
            <span className="text-xs text-muted-foreground">JPG, PNG ou PDF até 15 MB</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
};

const IdentityVerification = ({ userId }: { userId: string }) => {
  const { accountType, verificationStatus, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [creci, setCreci] = useState("");
  const [professional, setProfessional] = useState<File | null>(null);
  const [personal, setPersonal] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Verification[]>([]);

  const isAgency = accountType === "agency";

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("identity_verifications")
      .select("id, kind, status, reason, confidence, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    setHistory((data ?? []) as Verification[]);
  }, [userId]);

  useEffect(() => {
    loadHistory();
    supabase.from("profiles").select("full_name, creci").eq("user_id", userId).maybeSingle().then(({ data }) => {
      if (data?.full_name) setFullName(data.full_name);
      if (data?.creci) setCreci(data.creci);
    });
  }, [loadHistory, userId]);

  const upload = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("identity-documents").upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    return path;
  };

  const submit = async () => {
    if (!professional || !personal) {
      toast({ title: "Envie os dois documentos", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const [professionalPath, personalPath] = await Promise.all([
        upload(professional, "profissional"),
        upload(personal, "pessoal"),
      ]);

      const { data, error } = await supabase.functions.invoke("verify-identity", {
        body: {
          professionalPath,
          personalPath,
          kind: isAgency ? "agency" : "creci",
          fullName,
          creci,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const status = data?.status as string;
      toast({
        title:
          status === "approved" ? "Verificação aprovada!"
          : status === "rejected" ? "Documentos recusados"
          : "Enviado para revisão",
        description: data?.reason ?? "",
        variant: status === "rejected" ? "destructive" : "default",
      });
      setProfessional(null);
      setPersonal(null);
      await Promise.all([loadHistory(), refreshProfile()]);
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const meta = statusMeta[verificationStatus] ?? statusMeta.unverified;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Verificação de identidade</CardTitle>
              <CardDescription>
                {isAgency
                  ? "Envie o CNPJ/CRECI jurídico e o documento do responsável para liberar o painel de equipe."
                  : "Envie seu CRECI e um documento pessoal para receber o selo de corretor verificado."}
              </CardDescription>
            </div>
            <Badge className={meta.className}>
              <meta.icon className="mr-1 h-3.5 w-3.5" />
              {meta.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="verif-name">Nome completo</Label>
              <Input id="verif-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verif-creci">{isAgency ? "CNPJ ou CRECI jurídico" : "Número do CRECI"}</Label>
              <Input id="verif-creci" value={creci} onChange={(e) => setCreci(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DropZone
              label={isAgency ? "CNPJ / CRECI jurídico" : "Carteira do CRECI"}
              file={professional}
              onFile={setProfessional}
              disabled={submitting}
            />
            <DropZone
              label="Documento pessoal (RG ou CNH)"
              file={personal}
              onFile={setPersonal}
              disabled={submitting}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Seus documentos ficam em armazenamento privado, visíveis apenas para você e para a nossa equipe de análise.
            Fotos nítidas em JPG ou PNG são analisadas na hora; PDFs vão para revisão manual.
          </p>

          <Button onClick={submit} disabled={submitting || !professional || !personal}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar para verificação
          </Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de envios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.map((h) => {
              const hm = statusMeta[h.status] ?? statusMeta.pending;
              return (
                <div key={h.id} className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{new Date(h.created_at).toLocaleString("pt-BR")}</p>
                    {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
                  </div>
                  <Badge className={hm.className}>{hm.label}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IdentityVerification;
