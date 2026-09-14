import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { TablesInsert } from "@/integrations/supabase/types";
import {
  AUTHORIZATION_OPTIONS,
  authorizationBadgeText,
  authorizationStatus,
  type AuthorizationData,
  type AuthorizationType,
} from "@/lib/saleAuthorization";
import { MaskedCpfInput } from "@/components/MaskedCpf";
import {

  Lock,
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Users,
  ShieldCheck,
} from "lucide-react";

/* ── Types ── */

export interface OwnerEntry {
  name: string;
  cpf: string;
  rg: string;
  nationality: string;
  marital_status: string;
  profession: string;
  phone: string;
  address: string;
  is_spouse: boolean;
}

export const emptyOwner = (): OwnerEntry => ({
  name: "",
  cpf: "",
  rg: "",
  nationality: "Brasileira",
  marital_status: "",
  profession: "",
  phone: "",
  address: "",
  is_spouse: false,
});

interface PrivateInfoCardProps {
  pt: boolean;
  userId: string;
  propertyId?: string;
  owners: OwnerEntry[];
  setOwners: (fn: (prev: OwnerEntry[]) => OwnerEntry[]) => void;
  privateNotes: string;
  setPrivateNotes: (v: string) => void;
  pendingFiles: File[];
  setPendingFiles: (fn: (prev: File[]) => File[]) => void;
  authorization: AuthorizationData;
  setAuthorization: (fn: (prev: AuthorizationData) => AuthorizationData) => void;
  authFile: File | null;
  setAuthFile: (f: File | null) => void;
}

const MARITAL_OPTIONS = [
  { value: "solteiro", pt: "Solteiro(a)", en: "Single" },
  { value: "casado_comunhao_parcial", pt: "Casado(a) – Comunhão parcial", en: "Married – Partial community" },
  { value: "casado_comunhao_universal", pt: "Casado(a) – Comunhão universal", en: "Married – Universal community" },
  { value: "casado_separacao_total", pt: "Casado(a) – Separação total", en: "Married – Total separation" },
  { value: "uniao_estavel", pt: "União estável", en: "Common-law marriage" },
  { value: "divorciado", pt: "Divorciado(a)", en: "Divorced" },
  { value: "viuvo", pt: "Viúvo(a)", en: "Widowed" },
];

/* ── Component ── */

const PrivateInfoCard = ({
  pt,
  userId,
  propertyId,
  owners,
  setOwners,
  privateNotes,
  setPrivateNotes,
  pendingFiles,
  setPendingFiles,
  authorization,
  setAuthorization,
  authFile,
  setAuthFile,
}: PrivateInfoCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const authInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const updateAuth = (field: keyof AuthorizationData, value: string) =>
    setAuthorization((prev) => ({ ...prev, [field]: value }));

  const authStatus = authorizationStatus(authorization.authorization_end || null);
  const authBadge = authorizationBadgeText(authStatus.status, authStatus.days, pt);

  const handleAuthFile = (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "jpg", "jpeg", "png", "webp"].includes(ext ?? "") || file.size > 20 * 1024 * 1024) {
      toast({
        title: pt ? "Arquivo inválido" : "Invalid file",
        description: pt ? "Somente PDF ou imagens até 20MB" : "Only PDF or images up to 20MB",
        variant: "destructive",
      });
      return;
    }
    setAuthFile(file);
    if (authInputRef.current) authInputRef.current.value = "";
  };

  /* ── Owner helpers ── */
  const updateOwner = (idx: number, field: keyof OwnerEntry, value: string | boolean) => {
    setOwners((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));
  };

  const addOwner = (isSp = false) => {
    setOwners((prev) => [...prev, { ...emptyOwner(), is_spouse: isSp }]);
  };

  const removeOwner = (idx: number) => {
    setOwners((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── File helpers ── */
  const addFiles = (files: File[]) => {
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

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const removePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const getFileIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
    return <ImageIcon className="h-4 w-4 text-blue-500" />;
  };

  /* ── Married status needs spouse ── */
  const isMarried = (status: string) =>
    status.startsWith("casado") || status === "uniao_estavel";

  /* ── Render single owner form ── */
  const renderOwnerForm = (owner: OwnerEntry, idx: number) => {
    const label = owner.is_spouse
      ? pt ? "Cônjuge / Companheiro(a)" : "Spouse / Partner"
      : `${pt ? "Proprietário" : "Owner"} ${idx + 1 - owners.slice(0, idx).filter(o => o.is_spouse).length}`;

    return (
      <div key={idx} className="rounded-lg border bg-background p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            {label}
          </h5>
          {(idx > 0) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => removeOwner(idx)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {pt ? "Remover" : "Remove"}
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">
              {pt ? "Nome completo" : "Full name"}
            </label>
            <Input
              value={owner.name}
              onChange={(e) => updateOwner(idx, "name", e.target.value)}
              placeholder={pt ? "Nome completo" : "Full name"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">CPF</label>
            <MaskedCpfInput
              value={owner.cpf}
              onChange={(v) => updateOwner(idx, "cpf", v)}
              recordType="property_private_data"
              recordId={propertyId ?? null}
              fieldName="owner_cpf"
              placeholder="000.000.000-00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">RG</label>
            <Input
              value={owner.rg}
              onChange={(e) => updateOwner(idx, "rg", e.target.value)}
              placeholder={pt ? "Número do RG" : "ID number"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              {pt ? "Nacionalidade" : "Nationality"}
            </label>
            <Input
              value={owner.nationality}
              onChange={(e) => updateOwner(idx, "nationality", e.target.value)}
              placeholder="Brasileira"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              {pt ? "Estado civil" : "Marital status"}
            </label>
            <Select
              value={owner.marital_status}
              onValueChange={(v) => updateOwner(idx, "marital_status", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={pt ? "Selecione" : "Select"} />
              </SelectTrigger>
              <SelectContent>
                {MARITAL_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {pt ? m.pt : m.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              {pt ? "Profissão" : "Profession"}
            </label>
            <Input
              value={owner.profession}
              onChange={(e) => updateOwner(idx, "profession", e.target.value)}
              placeholder={pt ? "Ex: Engenheiro(a)" : "E.g. Engineer"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              {pt ? "Telefone" : "Phone"}
            </label>
            <Input
              value={owner.phone}
              onChange={(e) => updateOwner(idx, "phone", maskBrPhone(e.target.value))}
              placeholder="(27) 99999-8888"
            />
            {owner.phone.trim() && !normalizeBrPhone(owner.phone) && (
              <p className="mt-1 text-xs text-destructive">
                {pt ? "Informe DDD + número, ex: (27) 99999-8888." : "Enter area code + number, e.g. (27) 99999-8888."}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              {pt ? "Endereço" : "Address"}
            </label>
            <Input
              value={owner.address}
              onChange={(e) => updateOwner(idx, "address", e.target.value)}
              placeholder={pt ? "Endereço completo" : "Full address"}
            />
          </div>
        </div>

        {/* Show "add spouse" hint if married and no spouse exists for this owner */}
        {!owner.is_spouse && isMarried(owner.marital_status) && (
          <div className="pt-1">
            {!owners.some((o, j) => o.is_spouse && j === idx + 1) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setOwners((prev) => {
                    const copy = [...prev];
                    copy.splice(idx + 1, 0, { ...emptyOwner(), is_spouse: true });
                    return copy;
                  });
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                {pt ? "Adicionar cônjuge / companheiro(a)" : "Add spouse / partner"}
              </Button>
            )}
          </div>
        )}
      </div>
    );
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
          {/* Owners section */}
          <div>
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {pt ? "Proprietários e Qualificação Civil" : "Owners & Civil Qualification"}
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              {pt
                ? "Dados necessários para contratos. Adicione cônjuges/companheiros quando aplicável."
                : "Data required for contracts. Add spouses/partners when applicable."}
            </p>

            <div className="space-y-3">
              {owners.map((owner, idx) => renderOwnerForm(owner, idx))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => addOwner(false)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {pt ? "Adicionar outro proprietário" : "Add another owner"}
            </Button>
          </div>

          {/* Sale authorization */}
          <div>
            <h4 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              {pt ? "Autorização de Venda" : "Sale Authorization"}
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              {pt
                ? "Registre o tipo de autorização, a vigência e a comissão combinada com o proprietário."
                : "Record the authorization type, its term and the commission agreed with the owner."}
            </p>

            {authBadge && (
              <div
                className={`mb-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                  authStatus.status === "expired"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-amber-300 bg-amber-100/60 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                }`}
              >
                {authBadge}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium">
                  {pt ? "Tipo de autorização" : "Authorization type"}
                </label>
                <Select
                  value={authorization.authorization_type}
                  onValueChange={(v) => updateAuth("authorization_type", v as AuthorizationType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={pt ? "Selecione" : "Select"} />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTHORIZATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {pt ? o.pt : o.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">
                  {pt ? "Início da autorização" : "Authorization start"}
                </label>
                <Input
                  type="date"
                  value={authorization.authorization_start}
                  onChange={(e) => updateAuth("authorization_start", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {pt ? "Fim da autorização" : "Authorization end"}
                </label>
                <Input
                  type="date"
                  value={authorization.authorization_end}
                  onChange={(e) => updateAuth("authorization_end", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {pt ? "Comissão combinada (%)" : "Agreed commission (%)"}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={authorization.commission_percent}
                  onChange={(e) => updateAuth("commission_percent", e.target.value)}
                  placeholder="6"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  {pt ? "E-mail do proprietário" : "Owner e-mail"}
                </label>
                <Input
                  type="email"
                  value={authorization.owner_email}
                  onChange={(e) => updateAuth("owner_email", e.target.value)}
                  placeholder="proprietario@email.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium">
                  {pt ? "Observações sobre o proprietário" : "Owner notes"}
                </label>
                <Textarea
                  rows={2}
                  value={authorization.owner_notes}
                  onChange={(e) => updateAuth("owner_notes", e.target.value)}
                  placeholder={
                    pt
                      ? "Preferências de contato, condições combinadas, restrições de visita..."
                      : "Contact preferences, agreed terms, visit restrictions..."
                  }
                />
              </div>
            </div>

            {/* Signed authorization document */}
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium">
                {pt ? "Documento assinado" : "Signed document"}
              </label>

              {authFile ? (
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                  {getFileIcon(authFile.name)}
                  <span className="flex-1 truncate">{authFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(authFile.size / 1024).toFixed(0)}KB
                  </span>
                  <button
                    type="button"
                    onClick={() => setAuthFile(null)}
                    className="rounded-full p-0.5 hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ) : authorization.authorization_file_path ? (
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-red-500" />
                  <span className="flex-1 truncate">
                    {authorization.authorization_file_path.split("/").pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateAuth("authorization_file_path", "")}
                    className="rounded-full p-0.5 hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ) : (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleAuthFile(e.dataTransfer.files?.[0]);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/30 px-4 py-5 text-sm font-medium transition-colors hover:border-primary/50"
                >
                  <input
                    ref={authInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => handleAuthFile(e.target.files?.[0])}
                  />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {pt
                      ? "Arraste a autorização assinada ou clique para escolher"
                      : "Drag the signed authorization or click to choose"}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {pt ? "PDF ou imagem até 20MB" : "PDF or image up to 20MB"}
                  </span>
                </label>
              )}
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

            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-sm font-medium transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={handleFileAdd}
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span>
                {pt ? "Arraste os documentos aqui ou clique para escolher" : "Drag documents here or click to choose"}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {pt ? "PDF ou imagens até 20MB" : "PDF or images up to 20MB"}
              </span>
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

    // Store the storage path (not a signed URL) so we can generate URLs on demand
    const docType = guessDocType(file.name);

    await supabase.from("property_documents").insert({
      property_id: propertyId,
      user_id: userId,
      name: file.name,
      document_type: docType,
      file_url: path,
    } satisfies TablesInsert<"property_documents">);
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

/** Uploads the signed sale authorization to the private bucket, returning its path. */
export async function uploadAuthorizationFile(
  userId: string,
  propertyId: string,
  file: File
): Promise<string | null> {
  const path = `${userId}/${propertyId}/autorizacao_${Date.now()}_${file.name}`;
  const { error } = await supabase.storage
    .from("property-documents")
    .upload(path, file, { upsert: false });
  if (error) {
    console.error("Authorization upload error:", error.message);
    return null;
  }
  return path;
}
