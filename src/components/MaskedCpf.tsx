import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

/** Keeps the first 3 and last 2 digits, masking everything in between. */
export const maskCpf = (value?: string | null): string => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "•".repeat(digits.length);
  return `${digits.slice(0, 3)}.${"•".repeat(digits.length - 5)}-${digits.slice(-2)}`;
};

const logReveal = async (recordType: string, recordId: string | null | undefined, fieldName: string) => {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("sensitive_access_log").insert({
      actor_id: data.user.id,
      record_type: recordType,
      record_id: recordId ?? null,
      field_name: fieldName,
    });
  } catch (err) {
    console.error("sensitive access log failed", err);
  }
};

interface MaskedCpfProps {
  value?: string | null;
  recordType: string;
  recordId?: string | null;
  fieldName?: string;
  className?: string;
}

/** Read-only masked CPF with a reveal button that records the access. */
export const MaskedCpf = ({ value, recordType, recordId, fieldName = "cpf", className }: MaskedCpfProps) => {
  const [revealed, setRevealed] = useState(false);

  if (!value) return <span className="text-muted-foreground">—</span>;

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span className="font-mono text-sm">{revealed ? value : maskCpf(value)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        title={revealed ? "Ocultar" : "Revelar (o acesso é registrado)"}
        onClick={async () => {
          if (!revealed) await logReveal(recordType, recordId, fieldName);
          setRevealed((r) => !r);
        }}
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </span>
  );
};

interface MaskedCpfInputProps {
  value: string;
  onChange: (value: string) => void;
  recordType: string;
  recordId?: string | null;
  fieldName?: string;
  placeholder?: string;
}

/**
 * CPF field that stays masked until the user reveals it. Revealing is logged,
 * and editing is only possible while revealed.
 */
export const MaskedCpfInput = ({
  value,
  onChange,
  recordType,
  recordId,
  fieldName = "cpf",
  placeholder,
}: MaskedCpfInputProps) => {
  const [revealed, setRevealed] = useState(!value);

  return (
    <div className="flex items-center gap-1">
      {revealed ? (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <Input value={maskCpf(value)} readOnly className="bg-muted font-mono" />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground"
        title={revealed ? "Ocultar" : "Revelar (o acesso é registrado)"}
        onClick={async () => {
          if (!revealed) await logReveal(recordType, recordId, fieldName);
          setRevealed((r) => !r);
        }}
      >
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
};
