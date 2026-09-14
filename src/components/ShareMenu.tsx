import { useState } from "react";
import { Share2, MessageCircle, Link2, Check, Share } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ShareMenuProps {
  /** Canonical URL of the listing (never window.location.href). */
  url: string;
  /** Title used by the native share sheet. */
  title: string;
  /** Full pre-filled WhatsApp message (title, ref code, price, canonical URL). */
  whatsappMessage: string;
  pt: boolean;
  className?: string;
  iconClassName?: string;
}

/** Legacy copy fallback: temporary input + execCommand. Returns whether it worked. */
const legacyCopy = (text: string): boolean => {
  const input = document.createElement("input");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  input.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(input);
  return ok;
};

export function ShareMenu({ url, title, whatsappMessage, pt, className, iconClassName }: ShareMenuProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copyLink = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        ok = true;
      } else {
        ok = legacyCopy(url);
      }
    } catch {
      ok = legacyCopy(url);
    }
    if (ok) {
      setCopied(true);
      toast({ title: pt ? "Link copiado!" : "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Copy really failed: show the URL in a selectable field for manual copy.
      setManualUrl(url);
    }
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title, text: whatsappMessage, url });
    } catch (err) {
      // User cancelled the share sheet: not an error, stay silent.
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Real failure: fall back to copying the link.
      await copyLink();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={className ?? "h-9 w-9"}
            aria-label={pt ? "Compartilhar" : "Share"}
          >
            {copied ? (
              <Check className={`h-5 w-5 text-primary ${iconClassName ?? ""}`} />
            ) : (
              <Share2 className={`h-5 w-5 ${iconClassName ?? ""}`} />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              {pt ? "Compartilhar no WhatsApp" : "Share on WhatsApp"}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyLink()} className="gap-2">
            <Link2 className="h-4 w-4" />
            {pt ? "Copiar link" : "Copy link"}
          </DropdownMenuItem>
          {canNativeShare && (
            <DropdownMenuItem onSelect={() => void shareNative()} className="gap-2">
              <Share className="h-4 w-4" />
              {pt ? "Compartilhar..." : "Share..."}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={manualUrl !== null} onOpenChange={(o) => !o && setManualUrl(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pt ? "Copie o link manualmente" : "Copy the link manually"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pt
              ? "Não foi possível copiar automaticamente. Selecione o endereço abaixo e copie."
              : "We couldn't copy automatically. Select the address below and copy it."}
          </p>
          <Input
            readOnly
            value={manualUrl ?? ""}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Builds the standard WhatsApp share message for a listing. */
export function buildPropertyShareText(opts: {
  title: string;
  referenceCode?: string | null;
  priceText: string;
  url: string;
  pt: boolean;
}) {
  const { title, referenceCode, priceText, url, pt } = opts;
  const lines = [
    `*${title}*`,
    referenceCode ? `${pt ? "Cód." : "Ref."} ${referenceCode}` : null,
    priceText,
    "",
    url,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}
