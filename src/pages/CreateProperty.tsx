import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Plus } from "lucide-react";
import { z } from "zod";

const propertySchema = z.object({
  title: z.string().trim().min(5, "Título deve ter pelo menos 5 caracteres").max(200),
  city: z.string().trim().min(2, "Cidade é obrigatória"),
  state: z.string().trim().min(2, "Estado é obrigatório").max(2),
  price: z.number().positive("Preço deve ser positivo"),
});

const CreateProperty = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState<string>("apartment");
  const [listingType, setListingType] = useState<string>("sale");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
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

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg font-medium">{locale === "pt-BR" ? "Faça login para anunciar" : "Sign in to list a property"}</p>
        <Button className="mt-4" onClick={() => navigate("/login")}>
          {locale === "pt-BR" ? "Entrar" : "Sign In"}
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = propertySchema.safeParse({
      title,
      city,
      state,
      price: Number(price),
    });
    if (!parsed.success) {
      toast({ title: "Erro", description: parsed.error.errors[0]?.message, variant: "destructive" });
      return;
    }

    setSubmitting(true);

    // Insert property
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
      })
      .select()
      .single();

    if (error || !prop) {
      toast({ title: "Erro ao criar anúncio", description: error?.message, variant: "destructive" });
      setSubmitting(false);
      return;
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

    toast({ title: locale === "pt-BR" ? "Anúncio criado com sucesso!" : "Listing created!" });
    navigate(`/imovel/${prop.id}`);
    setSubmitting(false);
  };

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="font-display text-2xl font-bold text-foreground mb-6">
        {locale === "pt-BR" ? "Anunciar Imóvel" : "List a Property"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle className="text-base">{locale === "pt-BR" ? "Informações Básicas" : "Basic Information"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Título do anúncio *" : "Listing title *"}</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={locale === "pt-BR" ? "Ex: Apartamento 3 quartos em Copacabana" : "E.g. 3BR Apartment in Copacabana"} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Descrição" : "Description"}</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={locale === "pt-BR" ? "Descreva o imóvel em detalhes..." : "Describe the property..."} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Tipo" : "Type"}</label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">{locale === "pt-BR" ? "Apartamento" : "Apartment"}</SelectItem>
                    <SelectItem value="house">{locale === "pt-BR" ? "Casa" : "House"}</SelectItem>
                    <SelectItem value="land">{locale === "pt-BR" ? "Terreno" : "Land"}</SelectItem>
                    <SelectItem value="commercial">{locale === "pt-BR" ? "Comercial" : "Commercial"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Modalidade" : "Listing type"}</label>
                <Select value={listingType} onValueChange={setListingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">{locale === "pt-BR" ? "Venda" : "Sale"}</SelectItem>
                    <SelectItem value="rent">{locale === "pt-BR" ? "Aluguel" : "Rent"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Preço (R$) *" : "Price (R$) *"}</label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min="0" required />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">{locale === "pt-BR" ? "Detalhes" : "Details"}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Área (m²)" : "Area (m²)"}</label>
              <Input type="number" value={area} onChange={(e) => setArea(e.target.value)} min="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Quartos" : "Bedrooms"}</label>
              <Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} min="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Banheiros" : "Bathrooms"}</label>
              <Input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} min="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Vagas" : "Parking"}</label>
              <Input type="number" value={parkingSpots} onChange={(e) => setParkingSpots(e.target.value)} min="0" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Condomínio (R$)" : "Condo fee (R$)"}</label>
              <Input type="number" value={condoFee} onChange={(e) => setCondoFee(e.target.value)} min="0" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">IPTU (R$)</label>
              <Input type="number" value={iptu} onChange={(e) => setIptu(e.target.value)} min="0" />
            </div>
            <div className="sm:col-span-4">
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Características (separadas por vírgula)" : "Features (comma-separated)"}</label>
              <Input value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={locale === "pt-BR" ? "Piscina, churrasqueira, academia..." : "Pool, BBQ, gym..."} />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader><CardTitle className="text-base">{locale === "pt-BR" ? "Endereço" : "Address"}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Endereço" : "Address"}</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={locale === "pt-BR" ? "Rua, número" : "Street, number"} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Bairro" : "Neighborhood"}</label>
              <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Cidade *" : "City *"}</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{locale === "pt-BR" ? "Estado (UF) *" : "State *"}</label>
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
          <CardHeader><CardTitle className="text-base">{locale === "pt-BR" ? "Fotos" : "Photos"}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {imagePreviews.map((src, i) => (
                <div key={i} className="relative h-24 w-32 overflow-hidden rounded-lg border">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {imageFiles.length < 10 && (
                <label className="flex h-24 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
                  <div className="text-center">
                    <Plus className="mx-auto h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{locale === "pt-BR" ? "Adicionar" : "Add"}</span>
                  </div>
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{locale === "pt-BR" ? "Máximo 10 fotos. Formatos: JPG, PNG, WebP." : "Max 10 photos. Formats: JPG, PNG, WebP."}</p>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          <Upload className="h-4 w-4" />
          {locale === "pt-BR" ? "Publicar Anúncio" : "Publish Listing"}
        </Button>
      </form>
    </div>
  );
};

export default CreateProperty;
