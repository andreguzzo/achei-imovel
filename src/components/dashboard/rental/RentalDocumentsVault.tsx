import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Lock, Trash2, Upload } from "lucide-react";

export interface PendingDocument {
  name: string;
  document_type: string;
  file_path: string;
}

interface DocumentRow {
  id: string;
  name: string;
  document_type: string | null;
  file_path: string;
  created_at: string;
}

interface Props {
  userId: string;
  /** Null while the contract has not been created yet — files stay pending. */
  contractId: string | null;
  pending: PendingDocument[];
  onPendingChange: (docs: PendingDocument[]) => void;
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const MAX_BYTES = 15 * 1024 * 1024;

const RentalDocumentsVault = ({ userId, contractId, pending, onPendingChange }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const inputRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [type, setType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (!contractId) { setDocs([]); return; }
    const { data } = await supabase
      .from("rental_documents")
      .select("id, name, document_type, file_path, created_at")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
  }, [contractId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const added: PendingDocument[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(pt ? `${file.name} passa de 15 MB.` : `${file.name} is larger than 15 MB.`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${userId}/locacao/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("property-documents").upload(path, file);
      if (error) {
        toast.error(pt ? `Falha ao enviar ${file.name}.` : `Failed to upload ${file.name}.`);
        continue;
      }
      const doc: PendingDocument = { name: file.name, document_type: type.trim(), file_path: path };
      if (contractId) {
        const { error: insertError } = await supabase.from("rental_documents").insert({
          contract_id: contractId,
          broker_id: userId,
          name: doc.name,
          document_type: doc.document_type || null,
          file_path: doc.file_path,
        });
        if (insertError) {
          toast.error(pt ? `Falha ao salvar ${file.name}.` : `Failed to save ${file.name}.`);
          continue;
        }
      } else {
        added.push(doc);
      }
    }

    if (added.length) onPendingChange([...pending, ...added]);
    setUploading(false);
    setType("");
    if (inputRef.current) inputRef.current.value = "";
    if (contractId) fetchDocs();
    toast.success(pt ? "Documentos guardados no cofre." : "Documents stored in the vault.");
  };

  const open = async (path: string) => {
    setOpening(path);
    const { data, error } = await supabase.storage
      .from("property-documents")
      .createSignedUrl(path, 60 * 10);
    setOpening(null);
    if (error || !data?.signedUrl) {
      toast.error(pt ? "Não foi possível abrir o documento." : "Could not open the document.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const removeSaved = async (doc: DocumentRow) => {
    const { error } = await supabase.from("rental_documents").delete().eq("id", doc.id);
    if (error) {
      toast.error(pt ? "Não foi possível excluir." : "Could not delete.");
      return;
    }
    await supabase.storage.from("property-documents").remove([doc.file_path]);
    fetchDocs();
  };

  const removePending = async (path: string) => {
    await supabase.storage.from("property-documents").remove([path]);
    onPendingChange(pending.filter((p) => p.file_path !== path));
  };

  const rows = contractId
    ? docs.map((d) => ({ key: d.id, name: d.name, type: d.document_type, path: d.file_path, saved: true }))
    : pending.map((p) => ({ key: p.file_path, name: p.name, type: p.document_type, path: p.file_path, saved: false }));

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <p className="font-medium text-foreground">{pt ? "Cofre de documentos" : "Document vault"}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {pt
          ? "Guarde o contrato assinado, documentos do inquilino e do proprietário em PDF ou imagem. Área protegida: só você tem acesso."
          : "Store the signed contract, tenant and owner documents as PDF or image. Private area: only you can access it."}
      </p>

      <div className="mt-3">
        <Label className="text-xs">{pt ? "Tipo (opcional)" : "Type (optional)"}</Label>
        <Input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder={pt ? "Ex.: contrato assinado, RG, comprovante" : "e.g. signed contract, ID, receipt"}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!uploading) handleFiles(e.dataTransfer.files); }}
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-sm font-medium transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
        } ${uploading ? "pointer-events-none opacity-60" : ""}`}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
        <span>
          {pt ? "Arraste os arquivos aqui ou clique para escolher" : "Drag files here or click to choose"}
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {pt ? "PDF, JPG ou PNG até 15 MB" : "PDF, JPG or PNG up to 15 MB"}
        </span>
      </div>

      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-2 rounded-lg bg-background px-3 py-2">
              <button
                type="button"
                onClick={() => open(r.path)}
                className="flex min-w-0 items-center gap-2 text-left text-sm hover:text-primary"
              >
                {opening === r.path
                  ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="truncate">{r.name}</span>
                {r.type && <span className="shrink-0 text-xs text-muted-foreground">· {r.type}</span>}
              </button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => (r.saved ? removeSaved(docs.find((d) => d.id === r.key)!) : removePending(r.path))}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!contractId && rows.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {pt ? "Os arquivos serão vinculados ao contrato quando você salvar." : "Files will be linked to the contract once you save."}
        </p>
      )}
    </div>
  );
};

export default RentalDocumentsVault;
