import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getMaxProperties } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Plus, AlertTriangle } from "lucide-react";
import { z } from "zod";

const propertySchema = z.object({
  title: z.string().trim().min(5, "Título deve ter pelo menos 5 caracteres").max(200),
  city: z.string().trim().min(2, "Cidade é obrigatória"),
  state: z.string().trim().min(2, "Estado é obrigatório").max(2),
  price: z.number().positive("Preço deve ser positivo"),
});

// --- Sub-components ---

interface BasicInfoProps {
  pt: boolean;
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  propertyType: string; setPropertyType: (v: string) => void;
  listingType: string; setListingType: (v: string) => void;
  price: string; setPrice: (v: string) => void;
}

const BasicInfoCard = ({ pt, title, setTitle, description, setDescription, propertyType, setPropertyType, listingType, setListingType, price, setPrice }: BasicInfoProps) => (
  <Card>
    <CardHeader><CardTitle className="text-base">{pt ? "Informações Básicas" : "Basic Information"}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Título do anúncio *" : "Listing title *"}</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pt ? "Ex: Apartamento 3 quartos em Copacabana" : "E.g. 3BR Apartment in Copacabana"} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Descrição" : "Description"}</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={pt ? "Descreva o imóvel em detalhes..." : "Describe the property..."} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">{pt ? "Tipo" : "Type"}</label>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apartment">{pt ? "Apartamento" : "Apartment"}</SelectItem>
              <SelectItem value="house">{pt ? "Casa" : "House"}</SelectItem>
              <SelectItem value="land">{pt ? "Terreno" : "Land"}</SelectItem>
              <SelectItem value="commercial">{pt ? "Comercial" : "Commercial"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{pt ? "Modalidade" : "Listing type"}</label>
          <Select value={listingType} onValueChange={setListingType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sale">{pt ? "Venda" : "Sale"}</SelectItem>
              <SelectItem value="rent">{pt ? "Aluguel" : "Rent"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{pt ? "Preço (R$) *" : "Price (R$) *"}</label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min="0" required />
        </div>
      </div>
    </CardContent>
  </Card>
);

interface DetailsProps {
  pt: boolean;
  area: string; setArea: (v: string) => void;
  bedrooms: string; setBedrooms: (v: string) => void;
  suites: string; setSuites: (v: string) => void;
  bathrooms: string; setBathrooms: (v: string) => void;
  parkingSpots: string; setParkingSpots: (v: string) => void;
  condoFee: string; setCondoFee: (v: string) => void;
  iptu: string; setIptu: (v: string) => void;
  features: string; setFeatures: (v: string) => void;
}

const DetailsCard = ({ pt, area, setArea, bedrooms, setBedrooms, suites, setSuites, bathrooms, setBathrooms, parkingSpots, setParkingSpots, condoFee, setCondoFee, iptu, setIptu, features, setFeatures }: DetailsProps) => (
  <Card>
    <CardHeader><CardTitle className="text-base">{pt ? "Detalhes" : "Details"}</CardTitle></CardHeader>
    <CardContent className="grid gap-4 sm:grid-cols-5">
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Área (m²)" : "Area (m²)"}</label>
        <Input type="number" value={area} onChange={(e) => setArea(e.target.value)} min="0" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Quartos" : "Bedrooms"}</label>
        <Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} min="0" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Suítes" : "Suites"}</label>
        <Input type="number" value={suites} onChange={(e) => setSuites(e.target.value)} min="0" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Banheiros" : "Bathrooms"}</label>
        <Input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} min="0" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Vagas" : "Parking"}</label>
        <Input type="number" value={parkingSpots} onChange={(e) => setParkingSpots(e.target.value)} min="0" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium">{pt ? "Condomínio (R$)" : "Condo fee (R$)"}</label>
        <Input type="number" value={condoFee} onChange={(e) => setCondoFee(e.target.value)} min="0" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium">IPTU (R$)</label>
        <Input type="number" value={iptu} onChange={(e) => setIptu(e.target.value)} min="0" />
      </div>
      <div className="sm:col-span-5">
        <label className="mb-1 block text-sm font-medium">{pt ? "Características (separadas por vírgula)" : "Features (comma-separated)"}</label>
        <Input value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={pt ? "Piscina, churrasqueira, academia..." : "Pool, BBQ, gym..."} />
      </div>
    </CardContent>
  </Card>
);

interface StatusDialogProps {
  pt: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  statusAction: string;
  setStatusAction: (v: string) => void;
  soldPrice: string;
  setSoldPrice: (v: string) => void;
  soldCommission: string;
  setSoldCommission: (v: string) => void;
  soldByOtherPrice: string;
  setSoldByOtherPrice: (v: string) => void;
  onConfirm: () => void;
}

const StatusChangeDialog = ({ pt, open, onOpenChange, statusAction, setStatusAction, soldPrice, setSoldPrice, soldCommission, setSoldCommission, soldByOtherPrice, setSoldByOtherPrice, onConfirm }: StatusDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{pt ? "Status do Imóvel" : "Property Status"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <Select value={statusAction} onValueChange={setStatusAction}>
          <SelectTrigger><SelectValue placeholder={pt ? "Selecione o status" : "Select status"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{pt ? "Ativo (disponível)" : "Active (available)"}</SelectItem>
            <SelectItem value="sold">{pt ? "Vendido (por mim)" : "Sold (by me)"}</SelectItem>
            <SelectItem value="inactive">{pt ? "Fora de negociação" : "Withdrawn"}</SelectItem>
            <SelectItem value="sold_by_other">{pt ? "Vendido por outro corretor" : "Sold by another broker"}</SelectItem>
          </SelectContent>
        </Select>

        {statusAction === "sold" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">{pt ? "Valor de venda (R$) *" : "Sale price (R$) *"}</label>
              <Input type="number" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} min="0" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{pt ? "Comissão recebida (R$) *" : "Commission received (R$) *"}</label>
              <Input type="number" value={soldCommission} onChange={(e) => setSoldCommission(e.target.value)} min="0" required />
            </div>
          </>
        )}

        {statusAction === "sold_by_other" && (
          <div>
            <label className="mb-1 block text-sm font-medium">{pt ? "Valor de venda informado (R$)" : "Reported sale price (R$)"}</label>
            <Input type="number" value={soldByOtherPrice} onChange={(e) => setSoldByOtherPrice(e.target.value)} min="0" />
            <p className="mt-1 text-xs text-muted-foreground">{pt ? "Este valor será usado como referência de mercado." : "This value will be used as market reference."}</p>
          </div>
        )}

        {statusAction === "inactive" && (
          <p className="text-sm text-muted-foreground">
            {pt ? "O imóvel será retirado das buscas e não aparecerá mais como oferta no site." : "The property will be removed from searches and won't appear as a listing on the site."}
          </p>
        )}

        <Button onClick={onConfirm} className="w-full" disabled={!statusAction}>
          {pt ? "Confirmar" : "Confirm"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

// --- Main component ---

const CreateProperty = () => {
  const { user, tier } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const pt = locale === "pt-BR";
  const [submitting, setSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [propertyCount, setPropertyCount] = useState<number | null>(null);
  const maxProperties = getMaxProperties(tier);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setPropertyCount(count ?? 0));
  }, [user]);
  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState("apartment");
  const [listingType, setListingType] = useState("sale");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [suites, setSuites] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [parkingSpots, setParkingSpots] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [condoFee, setCondoFee] = useState("");
  const [iptu, setIptu] = useState("");
  const [features, setFeatures] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  // Status dialog
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusAction, setStatusAction] = useState("active");
  const [soldPrice, setSoldPrice] = useState("");
  const [soldCommission, setSoldCommission] = useState("");
  const [soldByOtherPrice, setSoldByOtherPrice] = useState("");
  const [propertyStatus, setPropertyStatus] = useState<string>("active");

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg font-medium">{pt ? "Faça login para anunciar" : "Sign in to list a property"}</p>
        <Button className="mt-4" onClick={() => navigate("/login")}>
          {pt ? "Entrar" : "Sign In"}
        </Button>
      </div>
    );
  }

  if (propertyCount !== null && propertyCount >= maxProperties) {
    return (
      <div className="container max-w-lg py-20 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">
          {pt ? "Limite de imóveis atingido" : "Property limit reached"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {pt
            ? `Você já possui ${propertyCount} imóveis cadastrados. Seu plano permite no máximo ${maxProperties}. Faça upgrade para cadastrar mais.`
            : `You already have ${propertyCount} properties. Your plan allows ${maxProperties}. Upgrade to add more.`}
        </p>
        <Button onClick={() => navigate("/planos")}>
          {pt ? "Ver planos" : "View plans"}
        </Button>
      </div>
    );
  }

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length + imageFiles.length > 10) {
      toast({ title: "Máximo 10 fotos", variant: "destructive" });
      return;
    }
    setImageFiles((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeImage = (idx: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStatusConfirm = () => {
    if (statusAction === "sold" && (!soldPrice || !soldCommission)) {
      toast({ title: pt ? "Informe o valor e a comissão" : "Enter sale value and commission", variant: "destructive" });
      return;
    }
    setPropertyStatus(statusAction === "sold_by_other" ? "sold" : statusAction);
    setShowStatusDialog(false);
    const labels: Record<string, string> = pt
      ? { active: "Ativo", sold: "Vendido", inactive: "Fora de negociação", sold_by_other: "Vendido por outro corretor" }
      : { active: "Active", sold: "Sold", inactive: "Withdrawn", sold_by_other: "Sold by another broker" };
    toast({ title: `Status: ${labels[statusAction]}` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = propertySchema.safeParse({ title, city, state, price: Number(price) });
    if (!parsed.success) {
      toast({ title: "Erro", description: parsed.error.errors[0]?.message, variant: "destructive" });
      return;
    }

    setSubmitting(true);

    const isSoldByOther = statusAction === "sold_by_other";
    const finalStatus = isSoldByOther ? "sold" : propertyStatus;

    const { data: prop, error } = await supabase
      .from("properties")
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        property_type: propertyType as "apartment" | "house" | "land" | "commercial",
        listing_type: listingType as "sale" | "rent",
        price: Number(price),
        area: area ? Number(area) : null,
        bedrooms: bedrooms ? Number(bedrooms) : 0,
        suites: suites ? Number(suites) : 0,
        bathrooms: bathrooms ? Number(bathrooms) : 0,
        parking_spots: parkingSpots ? Number(parkingSpots) : 0,
        address: address || null,
        neighborhood: neighborhood || null,
        city,
        state,
        zip_code: zipCode || null,
        condo_fee: condoFee ? Number(condoFee) : null,
        iptu: iptu ? Number(iptu) : null,
        features: features ? features.split(",").map((f) => f.trim()).filter(Boolean) : [],
        video_url: videoUrl || null,
        status: finalStatus as "active" | "inactive" | "sold" | "rented",
        sold_price: statusAction === "sold" ? Number(soldPrice) : isSoldByOther ? null : null,
        sold_commission: statusAction === "sold" ? Number(soldCommission) : null,
        sold_by_other_price: isSoldByOther && soldByOtherPrice ? Number(soldByOtherPrice) : null,
      } as any)
      .select()
      .single();

    if (error || !prop) {
      toast({ title: "Erro ao criar anúncio", description: error?.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // If sold by broker, also close any matching pipeline entries to avoid duplicity
    if (statusAction === "sold" && soldPrice) {
      await supabase
        .from("sales_pipeline")
        .update({
          stage: "closed_won" as any,
          actual_close_date: new Date().toISOString().split("T")[0],
          commission_value: Number(soldCommission),
        })
        .eq("broker_id", user.id)
        .eq("property_id", prop.id);
    }

    // Upload images
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const ext = file.name.split(".").pop();
      const path = `${prop.id}/${i}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("property-images")
        .upload(path, file, { upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("property-images").getPublicUrl(path);
        await supabase.from("property_images").insert({
          property_id: prop.id,
          url: urlData.publicUrl,
          position: i,
        });
      }
    }

    toast({ title: pt ? "Anúncio criado com sucesso!" : "Listing created!" });
    navigate(`/imovel/${prop.id}`);
    setSubmitting(false);
  };

  const statusLabel: Record<string, string> = pt
    ? { active: "Ativo", sold: "Vendido", inactive: "Fora de negociação" }
    : { active: "Active", sold: "Sold", inactive: "Withdrawn" };

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="font-display text-2xl font-bold text-foreground mb-6">
        {pt ? "Anunciar Imóvel" : "List a Property"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <BasicInfoCard pt={pt} title={title} setTitle={setTitle} description={description} setDescription={setDescription} propertyType={propertyType} setPropertyType={setPropertyType} listingType={listingType} setListingType={setListingType} price={price} setPrice={setPrice} />

        <DetailsCard pt={pt} area={area} setArea={setArea} bedrooms={bedrooms} setBedrooms={setBedrooms} suites={suites} setSuites={setSuites} bathrooms={bathrooms} setBathrooms={setBathrooms} parkingSpots={parkingSpots} setParkingSpots={setParkingSpots} condoFee={condoFee} setCondoFee={setCondoFee} iptu={iptu} setIptu={setIptu} features={features} setFeatures={setFeatures} />

        {/* Address */}
        <Card>
          <CardHeader><CardTitle className="text-base">{pt ? "Endereço" : "Address"}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">{pt ? "Endereço" : "Address"}</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={pt ? "Rua, número" : "Street, number"} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{pt ? "Bairro" : "Neighborhood"}</label>
              <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{pt ? "Cidade *" : "City *"}</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{pt ? "Estado (UF) *" : "State *"}</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="SP" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">CEP</label>
              <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="00000-000" />
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader><CardTitle className="text-base">{pt ? "Fotos" : "Photos"}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative h-24 w-32 overflow-hidden rounded-lg border">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {imageFiles.length < 10 && (
                <label className="flex h-24 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
                  <div className="text-center">
                    <Plus className="mx-auto h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{pt ? "Adicionar" : "Add"}</span>
                  </div>
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{pt ? "Máximo 10 fotos. Formatos: JPG, PNG, WebP." : "Max 10 photos. Formats: JPG, PNG, WebP."}</p>
          </CardContent>
        </Card>

        {/* Video */}
        <Card>
          <CardHeader><CardTitle className="text-base">{pt ? "Vídeo" : "Video"}</CardTitle></CardHeader>
          <CardContent>
            <label className="mb-1 block text-sm font-medium">{pt ? "Link do vídeo (YouTube ou Vimeo)" : "Video link (YouTube or Vimeo)"}</label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            <p className="mt-1 text-xs text-muted-foreground">{pt ? "Opcional. Cole o link do YouTube ou Vimeo." : "Optional. Paste a YouTube or Vimeo link."}</p>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader><CardTitle className="text-base">{pt ? "Status do Imóvel" : "Property Status"}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{pt ? "Status atual:" : "Current status:"} <span className="text-primary">{statusLabel[propertyStatus] ?? propertyStatus}</span></p>
                {statusAction === "sold" && soldPrice && (
                  <p className="text-xs text-muted-foreground mt-1">{pt ? "Valor:" : "Value:"} R$ {Number(soldPrice).toLocaleString("pt-BR")} | {pt ? "Comissão:" : "Commission:"} R$ {Number(soldCommission).toLocaleString("pt-BR")}</p>
                )}
                {statusAction === "sold_by_other" && soldByOtherPrice && (
                  <p className="text-xs text-muted-foreground mt-1">{pt ? "Valor informado:" : "Reported value:"} R$ {Number(soldByOtherPrice).toLocaleString("pt-BR")}</p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowStatusDialog(true)}>
                {pt ? "Alterar Status" : "Change Status"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <StatusChangeDialog
          pt={pt}
          open={showStatusDialog}
          onOpenChange={setShowStatusDialog}
          statusAction={statusAction}
          setStatusAction={setStatusAction}
          soldPrice={soldPrice}
          setSoldPrice={setSoldPrice}
          soldCommission={soldCommission}
          setSoldCommission={setSoldCommission}
          soldByOtherPrice={soldByOtherPrice}
          setSoldByOtherPrice={setSoldByOtherPrice}
          onConfirm={handleStatusConfirm}
        />

        <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          <Upload className="h-4 w-4" />
          {pt ? "Publicar Anúncio" : "Publish Listing"}
        </Button>
      </form>
    </div>
  );
};

export default CreateProperty;
