import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface ImageWithFallbackProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Accessible label used in the fallback when the image fails to load */
  fallbackLabel?: string;
}

/**
 * <img> with lazy loading by default and a visual fallback when the image
 * fails to load, preventing broken-image icons and layout shift.
 */
const ImageWithFallback = ({
  fallbackLabel,
  loading = "lazy",
  decoding = "async",
  className,
  alt = "",
  onError,
  ...rest
}: ImageWithFallbackProps) => {
  const [failed, setFailed] = useState(false);
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  if (failed) {
    return (
      <div
        role="img"
        aria-label={fallbackLabel ?? alt ?? (pt ? "Imagem indisponível" : "Image unavailable")}
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}
      >
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }

  return (
    <img
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={className}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
};

export default ImageWithFallback;
