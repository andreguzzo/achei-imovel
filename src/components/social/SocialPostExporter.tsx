import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Download, Copy, Sparkles, Share2, Instagram, Facebook, Images, Square } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { renderSocialPost, downloadBlob, type RenderedSlide, type SocialFormat } from "@/lib/socialPostRenderer";

export interface SocialPostProperty {
  id: string;
  title: string;
  price: number;
  listing_type: string;
  property_type?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking_spots?: number | null;
  area?: number | null;
  description?: string | null;
  images: string[];
}

interface Props {
  property: SocialPostProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broker: { name: string; creci?: string | null; phone?: string | null };
}

const SocialPostExporter = ({ property, open, onOpenChange, broker }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  const [format, setFormat] = useState<SocialFormat>("square");
  const [slides, setSlides] = useState<RenderedSlide[]>([]);
  const [rendering, setRendering] = useState(false);
  const [caption, setCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);

  const canCarousel = (property?.images.length ?? 0) > 1;

  useEffect(() => {
    if (!open) {
      setSlides([]);
      setCaption("");
      setFormat("square");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !property) return;
    let cancelled = false;
    setRendering(true);
    renderSocialPost({
      format,
      images: property.images,
      locale: pt ? "pt-BR" : "en",
      property: {
        title: property.title,
        price: property.price,
        listingType: property.listing_type,
        city: property.city,
        state: property.state,
        neighborhood: property.neighborhood,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        parkingSpots: property.parking_spots,
        area: property.area,
      },
      broker,
    })
      .then((result) => {
        if (!cancelled) setSlides(result);
      })
      .catch((e) => {
        if (cancelled) return;
        setSlides([]);
        toast({
          title: pt ? "Não foi possível gerar as imagens" : "Could not generate images",
          description: e instanceof Error && e.message === "no-images"
            ? (pt ? "Este imóvel não possui fotos." : "This property has no photos.")
            : undefined,
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, property?.id, format, pt, broker.name, broker.creci, broker.phone]);

  const generateCaption = async () => {
    if (!property) return;
    setCaptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-social-caption", {
        body: {
          title: property.title,
          price: property.price,
          listingType: property.listing_type,
          propertyType: property.property_type,
          city: property.city,
          state: property.state,
          neighborhood: property.neighborhood,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          parkingSpots: property.parking_spots,
          area: property.area,
          description: property.description,
          brokerName: broker.name,
          phone: broker.phone,
          locale: pt ? "pt-BR" : "en",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCaption(String(data?.caption ?? ""));
    } catch (e) {
      toast({
        title: pt ? "Erro ao gerar legenda" : "Error generating caption",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCaptionLoading(false);
    }
  };

  const copyCaption = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      toast({ title: pt ? "Legenda copiada!" : "Caption copied!" });
    } catch {
      toast({ title: pt ? "Não foi possível copiar" : "Could not copy", variant: "destructive" });
    }
  };

  const slug = useMemo(
    () => (property?.title ?? "post").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40),
    [property?.title],
  );

  const logExport = async () => {
    if (!property) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    await supabase.from("social_post_exports").insert({
      property_id: property.id,
      broker_id: uid,
      format,
      caption: caption || null,
    });
  };

  const downloadAll = async () => {
    slides.forEach((s, i) => downloadBlob(s.blob, `${slug}-${format}-${i + 1}.jpg`));
    void logExport();
  };

  const share = async () => {
    if (!slides.length) return;
    const files = slides.map((s, i) => new File([s.blob], `${slug}-${i + 1}.jpg`, { type: "image/jpeg" }));
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files, text: caption || undefined, title: property?.title });
        void logExport();
        return;
      } catch {
        return;
      }
    }
    toast({
      title: pt ? "Compartilhamento não suportado" : "Sharing not supported",
      description: pt ? "Baixe as imagens e publique pelo app da rede social." : "Download the images and post from the social app.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" /> <Facebook className="h-5 w-5" />
            {pt ? "Exportar post para redes sociais" : "Export post for social media"}
          </DialogTitle>
          <DialogDescription>
            {pt
              ? "Gere as imagens prontas e a legenda para publicar no Instagram e Facebook."
              : "Generate ready-to-post images and caption for Instagram and Facebook."}
          </DialogDescription>
        </DialogHeader>

        {/* Format */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={format === "square" ? "default" : "outline"} onClick={() => setFormat("square")} className="gap-1.5">
            <Square className="h-4 w-4" /> {pt ? "Imagem única (1:1)" : "Single image (1:1)"}
          </Button>
          <Button
            size="sm"
            variant={format === "carousel" ? "default" : "outline"}
            onClick={() => setFormat("carousel")}
            disabled={!canCarousel}
            className="gap-1.5"
          >
            <Images className="h-4 w-4" /> {pt ? "Carrossel (4:5)" : "Carousel (4:5)"}
          </Button>
          {format === "carousel" && slides.length > 0 && (
            <Badge variant="secondary" className="self-center">
              {slides.length} {pt ? "imagens" : "images"}
            </Badge>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-lg border bg-muted/30 p-3">
          {rendering ? (
            <div className="flex h-56 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : slides.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              {pt ? "Sem imagens para gerar o post." : "No images available for this post."}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {slides.map((s) => (
                <img
                  key={s.index}
                  src={s.dataUrl}
                  alt={`slide ${s.index + 1}`}
                  className="h-64 w-auto shrink-0 rounded-md border"
                />
              ))}
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{pt ? "Legenda" : "Caption"}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={generateCaption} disabled={captionLoading} className="gap-1.5">
                {captionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {caption ? (pt ? "Gerar outra" : "Regenerate") : (pt ? "Gerar com IA" : "Generate with AI")}
              </Button>
              <Button size="sm" variant="ghost" onClick={copyCaption} disabled={!caption} className="gap-1.5">
                <Copy className="h-4 w-4" /> {pt ? "Copiar" : "Copy"}
              </Button>
            </div>
          </div>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={7}
            placeholder={pt ? "Escreva ou gere a legenda do post..." : "Write or generate the post caption..."}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadAll} disabled={!slides.length} className="gap-1.5">
            <Download className="h-4 w-4" />
            {pt ? (slides.length > 1 ? "Baixar imagens" : "Baixar imagem") : slides.length > 1 ? "Download images" : "Download image"}
          </Button>
          <Button variant="outline" onClick={share} disabled={!slides.length} className="gap-1.5">
            <Share2 className="h-4 w-4" /> {pt ? "Compartilhar" : "Share"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {pt
            ? "Publicação automática no Instagram/Facebook estará disponível em breve, após a aprovação do aplicativo pela Meta."
            : "Automatic publishing to Instagram/Facebook will be available soon, after Meta app approval."}
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default SocialPostExporter;
