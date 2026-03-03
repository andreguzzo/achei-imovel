import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Lock,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

interface PrivateDoc {
  id: string;
  name: string;
  document_type: string;
  file_url: string;
}

interface PrivateInfoCardProps {
  pt: boolean;
  userId: string;
  propertyId?: string; // undefined during creation — docs saved after property is created
  ownerName: string;
  setOwnerName: (v: string) => void;
  ownerPhone: string;
  setOwnerPhone: (v: string) => void;
  ownerCpf: string;
  setOwnerCpf: (v: string) => void;
  ownerAddress: string;
  setOwnerAddress: (v: string) => void;
  privateNotes: string;
  setPrivateNotes: (v: string) => void;
  pendingFiles: File[];
  setPendingFiles: (fn: (prev: File[]) => File[]) => void;
}

const DOC_TYPES: Record<string, { label_pt: string; label_en: string }> = {
  escritura: { label_pt: "Escritura", label_en: "Deed" },
  matricula: { label_pt: "Matrícula", label_en: "Registration" },
  documento_proprietario: { label_pt: "Documento do Proprietário", label_en: "Owner ID" },
  contrato: { label_pt: "Contrato", label_en: "Contract" },
  planta: { label_pt: "Planta / Projeto", label_en: "Floor Plan" },
  other: { label_pt: "Outro", label_en: "Other" },
};

const PrivateInfoCard = ({
  pt,
  userId,
  propertyId,
  ownerName,
  setOwnerName,
  ownerPhone,
  setOwnerPhone,
  ownerCpf,
  setOwnerCpf,
  ownerAddress,
  setOwnerAddress,
  privateNotes,
  setPrivateNotes,
  pendingFiles,
  setPendingFiles,
}: PrivateInfoCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      const ok =
        ["pdf", "jpg", "jpeg", "png", "webp"].includes(ext ?? "") &&
        f.size <= 20 * 1024 * 1024;
      if (!ok) {
        toast({
          title: pt ? "Arquivo inválido" : "Invalid file",
          description: pt
            ? `${f.name} — Somente PDF ou imagens até 20MB`
            : `${f.name} — Only PDF or images up to 20MB`,
          variant: "destructive",
        });
      }
      return ok;
    });
    setPendingFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
    return <ImageIcon className="h-4 w-4 text-blue-500" />;
  };

  return (
    <Card className="border-amber-200/50 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-950/10">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600" />
            {pt ? "Informações Confidenciais" : "Confidential Information"}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pt
            ? "Dados privados — visíveis apenas para você. Não aparecem no anúncio público."
            : "Private data — visible only to you. Not shown on the public listing."}
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5">
          {/* Owner info */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              {pt ? "Dados do Proprietário" : "Owner Information"}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {pt ? "Nome" : "Name"}
                </label>
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder={pt ? "Nome completo" : "Full name"}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {pt ? "Telefone" : "Phone"}
                </label>
                <Input
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">CPF</label>
                <Input
                  value={ownerCpf}
                  onChange={(e) => setOwnerCpf(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {pt ? "Endereço" : "Address"}
                </label>
                <Input
                  value={ownerAddress}
                  onChange={(e) => setOwnerAddress(e.target.value)}
                  placeholder={pt ? "Endereço do proprietário" : "Owner address"}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              {pt ? "Observações Gerais" : "General Notes"}
            </label>
            <Textarea
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
              rows={3}
              placeholder={
                pt
                  ? "Anotações internas, lembretes, detalhes da negociação..."
                  : "Internal notes, reminders, deal details..."
              }
            />
          </div>

          {/* Document vault */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              {pt ? "Cofre de Documentos" : "Document Vault"}
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              {pt
                ? "Escritura, documentos do proprietário, contratos, plantas. PDF ou imagens até 20MB."
                : "Deeds, owner documents, contracts, floor plans. PDF or images up to 20MB."}
            </p>

            {/* Pending files list */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2 mb-3">
                {pendingFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    {getFileIcon(f.name)}
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(f.size / 1024).toFixed(0)}KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(i)}
                      className="rounded-full p-0.5 hover:bg-destructive/10"
                    >
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 px-4 py-2.5 text-sm font-medium hover:border-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={handleFileAdd}
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
              {pt ? "Adicionar documentos" : "Add documents"}
            </label>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default PrivateInfoCard;

// Helper: upload pending docs after property creation
export async function uploadPrivateDocuments(
  userId: string,
  propertyId: string,
  files: File[]
): Promise<void> {
  for (const file of files) {
    const ext = file.name.split(".").pop();
    const ts = Date.now();
    const path = `${userId}/${propertyId}/${ts}_${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from("property-documents")
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      console.error("Doc upload error:", uploadErr.message);
      continue;
    }

    // Get signed URL (private bucket)
    const { data: signedData } = await supabase.storage
      .from("property-documents")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10); // 10 years

    const url = signedData?.signedUrl ?? path;

    const docType = guessDocType(file.name);

    await supabase.from("property_documents").insert({
      property_id: propertyId,
      user_id: userId,
      name: file.name,
      document_type: docType,
      file_url: url,
    } as any);
  }
}

function guessDocType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("escritura")) return "escritura";
  if (lower.includes("matricula") || lower.includes("matrícula")) return "matricula";
  if (lower.includes("contrato")) return "contrato";
  if (lower.includes("planta") || lower.includes("projeto")) return "planta";
  if (lower.includes("cpf") || lower.includes("rg") || lower.includes("documento"))
    return "documento_proprietario";
  return "other";
}
