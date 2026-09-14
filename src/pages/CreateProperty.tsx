import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Plus, AlertTriangle, Sparkles } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import BoundaryEditor from "@/components/BoundaryEditor";
import { asBoundary, boundaryCenter, type BoundaryGeometry } from "@/lib/kmlParser";
import PrivateInfoCard, { uploadPrivateDocuments, emptyOwner, type OwnerEntry } from "@/components/PrivateInfoCard";
import { compressImage } from "@/lib/imageCompression";
import { z } from "zod";
import type { Enums, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import {
  PARTNERSHIP_KINDS,
  partnershipKindHint,
  partnershipKindLabel,
  type PartnershipKind,
} from "@/lib/partnerships";

type DupGroup = {
  group_id: string;
  member_count: number;
  primary_broker_id: string;
  primary_broker_name: string;
  exclusive: boolean;
};


const propertySchema = z.object({
  title: z.string().trim().min(5, "Título deve ter pelo menos 5 caracteres").max(200),
  city: z.string().trim().min(2, "Cidade é obrigatória"),
  state: z.string().trim().min(2, "Estado é obrigatório").max(2),
  price: z.number().positive("Preço deve ser positivo"),
});

// --- Sub-components ---

interface BasicInfoProps {
  pt: boolean;
  propertyType: string; setPropertyType: (v: string) => void;
  listingType: string; setListingType: (v: string) => void;
  price: string; setPrice: (v: string) => void;
}

const BasicInfoCard = ({ pt, propertyType, setPropertyType, listingType, setListingType, price, setPrice }: BasicInfoProps) => (
  <Card>
    <CardHeader><CardTitle className="text-base">{pt ? "Informações Básicas" : "Basic Information"}</CardTitle></CardHeader>
    <CardContent className="grid gap-4 sm:grid-cols-3">
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
    </CardContent>
  </Card>
);

interface TitleDescriptionProps {
  pt: boolean;
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  onGenerateAI?: () => void;
  generatingAI?: boolean;
}

const TitleDescriptionCard = ({ pt, title, setTitle, description, setDescription, onGenerateAI, generatingAI }: TitleDescriptionProps) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">{pt ? "Título e Descrição" : "Title & Description"}</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onGenerateAI}
          disabled={generatingAI}
        >
          {generatingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {pt ? "Gerar com IA" : "Generate with AI"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{pt ? "Preencha os campos acima e clique em \"Gerar com IA\" para criar automaticamente." : "Fill the fields above and click \"Generate with AI\" to auto-create."}</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Título do anúncio *" : "Listing title *"}</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pt ? "Ex: Apartamento 3 quartos em Copacabana" : "E.g. 3BR Apartment in Copacabana"} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">{pt ? "Descrição" : "Description"}</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder={pt ? "Descreva o imóvel em detalhes..." : "Describe the property..."} />
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
  features: string[]; setFeatures: (v: string[]) => void;
  legacyFeatures: string[];
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
            <SelectItem value="rented">{pt ? "Alugado" : "Rented"}</SelectItem>
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
  const { user, accountType, verified, maxProperties: accountMaxProperties } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const isEditMode = !!editId;
  // Admins edit any listing through /admin/imovel/:id — no ownership or plan limits
  const adminMode = pathname.startsWith("/admin/imovel");
  const pt = locale === "pt-BR";
  const [submitting, setSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<{ id: string; url: string; position: number }[]>([]);
  const [propertyCount, setPropertyCount] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const maxProperties = adminMode ? Infinity : accountMaxProperties;

  useEffect(() => {
    if (!user || isEditMode) return;
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setPropertyCount(count ?? 0));
  }, [user, isEditMode]);
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
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [boundary, setBoundary] = useState<BoundaryGeometry | null>(null);

  // Private info
  const [owners, setOwners] = useState<OwnerEntry[]>([emptyOwner()]);
  const [privateNotes, setPrivateNotes] = useState("");
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);

  // Status dialog
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusAction, setStatusAction] = useState("active");
  const [soldPrice, setSoldPrice] = useState("");
  const [soldCommission, setSoldCommission] = useState("");
  const [soldByOtherPrice, setSoldByOtherPrice] = useState("");
  const [propertyStatus, setPropertyStatus] = useState<string>("active");

  // Duplicate listing / partnership flow
  const [dupGroup, setDupGroup] = useState<DupGroup | null>(null);
  const [dupChoice, setDupChoice] = useState<"request" | "separate" | null>(null);
  const [dupKind, setDupKind] = useState<PartnershipKind>("sale_partnership");
  const [dupSplit, setDupSplit] = useState("50");
  const [dupTerms, setDupTerms] = useState("");


  // AI generation
  const [generatingAI, setGeneratingAI] = useState(false);

  const handleGenerateAI = async () => {
    if (!city || !propertyType) {
      toast({ title: pt ? "Preencha pelo menos tipo e cidade" : "Fill at least type and city", variant: "destructive" });
      return;
    }
    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-property-description", {
        body: {
          propertyType, listingType, price, area, bedrooms, suites, bathrooms,
          parkingSpots, neighborhood, city, state, features, condoFee, iptu, address,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
      } else {
        if (data?.title) setTitle(data.title);
        if (data?.description) setDescription(data.description);
        toast({ title: pt ? "Título e descrição gerados!" : "Title and description generated!" });
      }
    } catch (e: unknown) {
      toast({ title: pt ? "Erro ao gerar" : "Generation error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
    setGeneratingAI(false);
  };

  // Load existing property data in edit mode
  useEffect(() => {
    if (!editId || !user) return;
    const loadProperty = async () => {
      setEditLoading(true);
      let query = supabase
        .from("properties")
        .select("*, property_images(*)")
        .eq("id", editId);
      if (!adminMode) query = query.eq("user_id", user.id);
      const { data: prop } = await query.single();

      if (!prop) {
        toast({ title: pt ? "Imóvel não encontrado" : "Property not found", variant: "destructive" });
        navigate(adminMode ? "/admin?secao=imoveis" : "/painel");
        return;
      }

      setTitle(prop.title);
      setDescription(prop.description ?? "");
      setPropertyType(prop.property_type);
      setListingType(prop.listing_type);
      setPrice(prop.price?.toString() ?? "");
      setArea(prop.area?.toString() ?? "");
      setBedrooms(prop.bedrooms?.toString() ?? "");
      setSuites(prop.suites?.toString() ?? "");
      setBathrooms(prop.bathrooms?.toString() ?? "");
      setParkingSpots(prop.parking_spots?.toString() ?? "");
      setAddress(prop.address ?? "");
      setNeighborhood(prop.neighborhood ?? "");
      setCity(prop.city);
      setState(prop.state);
      setZipCode(prop.zip_code ?? "");
      setCondoFee(prop.condo_fee?.toString() ?? "");
      setIptu(prop.iptu?.toString() ?? "");
      setFeatures(prop.features?.join(", ") ?? "");
      setVideoUrl(prop.video_url ?? "");
      setLatitude(prop.latitude?.toString() ?? "");
      setLongitude(prop.longitude?.toString() ?? "");
      setBoundary(asBoundary(prop.boundary));
      setPropertyStatus(prop.status);
      setStatusAction(prop.status === "sold" ? "sold" : prop.status);
      setSoldPrice(prop.sold_price?.toString() ?? "");
      setSoldCommission(prop.sold_commission?.toString() ?? "");
      setSoldByOtherPrice(prop.sold_by_other_price?.toString() ?? "");

      // Load existing images
      const imgs = [...(prop.property_images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setExistingImages(imgs.map((img) => ({ id: img.id, url: img.url, position: img.position ?? 0 })));

      // Load private data
      const { data: privateData } = await supabase
        .from("property_private_data")
        .select("*")
        .eq("property_id", editId)
        .maybeSingle();
      
      if (privateData) {
        setPrivateNotes(privateData.notes ?? "");
        const ownersData = privateData.owners as unknown as OwnerEntry[];
        if (ownersData && ownersData.length > 0) {
          setOwners(ownersData);
        } else if (privateData.owner_name) {
          setOwners([{
            name: privateData.owner_name ?? "",
            phone: privateData.owner_phone ?? "",
            cpf: privateData.owner_cpf ?? "",
            address: privateData.owner_address ?? "",
            rg: "",
            nationality: "",
            profession: "",
            marital_status: "",
            is_spouse: false,
          }]);
        }
      }

      setEditLoading(false);
    };
    loadProperty();
  }, [editId, user, adminMode, navigate, pt]);

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

  if (!adminMode && !isEditMode && accountType !== "owner" && !verified) {
    return (
      <div className="container max-w-lg py-20 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">
          {pt ? "Verificação necessária" : "Verification required"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {pt
            ? "Para publicar como corretor ou imobiliária, envie seu CRECI e um documento pessoal para verificação."
            : "To publish as a broker or agency, send your professional licence and a personal document for verification."}
        </p>
        <Button onClick={() => navigate("/painel?secao=verificacao")}>
          {pt ? "Enviar documentos" : "Send documents"}
        </Button>
      </div>
    );
  }

  if (!isEditMode && propertyCount !== null && propertyCount >= maxProperties) {
    return (
      <div className="container max-w-lg py-20 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">
          {pt ? "Limite de imóveis atingido" : "Property limit reached"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {pt
            ? `Você já possui ${propertyCount} imóvel(is) cadastrado(s). Seu plano permite no máximo ${maxProperties}. Assine o plano Corretor para anúncios ilimitados.`
            : `You already have ${propertyCount} properties. Your plan allows ${maxProperties}. Upgrade for unlimited listings.`}
        </p>
        <Button onClick={() => navigate("/planos")}>
          {pt ? "Ver planos" : "View plans"}
        </Button>
      </div>
    );
  }


  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const totalAfter = files.length + imageFiles.length + existingImages.length;
    if (totalAfter > 10) {
      toast({ title: `Máximo 10 fotos (${existingImages.length} existentes)`, variant: "destructive" });
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

  const handleSubmit = async (e?: React.FormEvent, choiceOverride?: "request" | "separate") => {
    e?.preventDefault();
    const choice = choiceOverride ?? dupChoice;
    const parsed = propertySchema.safeParse({ title, city, state, price: Number(price) });
    if (!parsed.success) {
      toast({ title: "Erro", description: parsed.error.errors[0]?.message, variant: "destructive" });
      return;
    }

    // Detect an existing consolidated listing for the same property
    if (!isEditMode && !choice && address.trim() && user) {
      const { data: found } = await supabase.rpc("find_property_group", {
        _address: address,
        _city: city,
        _state: state,
        _property_type: propertyType as "apartment" | "house" | "land" | "commercial",
        _area: area ? Number(area) : undefined,
      });
      const group = (found as DupGroup[] | null)?.[0];
      if (group && group.primary_broker_id !== user.id) {
        setDupGroup(group);
        return;
      }
    }

    setSubmitting(true);


    const isSoldByOther = statusAction === "sold_by_other";
    const finalStatus = isSoldByOther ? "sold" : propertyStatus;

    const propertyData = {
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
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      boundary: boundary as unknown as null,
      status: finalStatus as "active" | "inactive" | "sold" | "rented",
      sold_price: statusAction === "sold" ? Number(soldPrice) : null,
      sold_commission: statusAction === "sold" ? Number(soldCommission) : null,
      sold_by_other_price: isSoldByOther && soldByOtherPrice ? Number(soldByOtherPrice) : null,
    };

    let propId: string;

    if (isEditMode && editId) {
      // Update existing property
      const { error } = await supabase
        .from("properties")
        .update(propertyData as TablesUpdate<"properties">)
        .eq("id", editId);

      if (error) {
        toast({ title: pt ? "Erro ao atualizar" : "Error updating", description: error.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      propId = editId;
    } else {
      // Insert new property
      const { data: prop, error } = await supabase
        .from("properties")
        .insert({ ...propertyData, user_id: user.id } as TablesInsert<"properties">)
        .select()
        .single();

      if (error || !prop) {
        toast({ title: "Erro ao criar anúncio", description: error?.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      propId = prop.id;

      // Consolidated listing handling
      if (choice === "request" && dupGroup) {
        const { error: reqErr } = await supabase.rpc("request_group_membership", {
          _group_id: dupGroup.group_id,
          _property_id: propId,
          _partnership_type: dupKind,
          _commission_split: Number(dupSplit) || undefined,
          _terms: dupTerms || undefined,
        });
        if (reqErr) {
          toast({ title: pt ? "Erro na solicitação de parceria" : "Partnership request failed", description: reqErr.message, variant: "destructive" });
        } else {
          toast({
            title: pt ? "Solicitação enviada ao captador" : "Request sent to the listing broker",
            description: pt
              ? "Seu anúncio ficará visível como parceria após a aprovação."
              : "Your listing appears as a partnership once approved.",
          });
        }
      } else if (choice === "separate") {
        const { error: detErr } = await supabase.rpc("detach_property_group", { _property_id: propId });
        if (detErr) console.warn("detach error", detErr.message);
      }
    }


    // If sold by broker, also close any matching pipeline entries
    if (statusAction === "sold" && soldPrice) {
      await supabase
        .from("sales_pipeline")
        .update({
          stage: "closed_won" as Enums<"pipeline_stage">,
          actual_close_date: new Date().toISOString().split("T")[0],
          commission_value: Number(soldCommission),
        })
        .eq("broker_id", user.id)
        .eq("property_id", propId);
    }

    // Upload new images (compressed)
    if (imageFiles.length > 0) {
      const startPos = existingImages.length;
      for (let i = 0; i < imageFiles.length; i++) {
        const file = await compressImage(imageFiles[i]);
        const ext = file.name.split(".").pop();
        const path = `${propId}/${Date.now()}-${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("property-images")
          .upload(path, file, { upsert: true });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("property-images").getPublicUrl(path);
          await supabase.from("property_images").insert({
            property_id: propId,
            url: urlData.publicUrl,
            position: startPos + i,
          });
        }
      }
    }

    // Save private data (upsert)
    const hasOwnerData = owners.some(o => o.name || o.cpf);
    const hasPrivateData = hasOwnerData || privateNotes;
    if (hasPrivateData) {
      const firstOwner = owners[0] || emptyOwner();
      const privatePayload = {
        property_id: propId,
        owner_name: firstOwner.name || null,
        owner_phone: firstOwner.phone || null,
        owner_cpf: firstOwner.cpf || null,
        owner_address: firstOwner.address || null,
        notes: privateNotes || null,
        owners: JSON.parse(JSON.stringify(owners)),
      };
      
      if (isEditMode) {
        const { data: existing } = await supabase
          .from("property_private_data")
          .select("id")
          .eq("property_id", propId)
          .maybeSingle();
        
        if (existing) {
          await supabase.from("property_private_data").update(privatePayload as TablesUpdate<"property_private_data">).eq("id", existing.id);
        } else {
          await supabase.from("property_private_data").insert(privatePayload as TablesInsert<"property_private_data">);
        }
      } else {
        await supabase.from("property_private_data").insert(privatePayload as TablesInsert<"property_private_data">);
      }
    }

    // Upload private documents
    if (pendingDocs.length > 0) {
      await uploadPrivateDocuments(user.id, propId, pendingDocs);
    }

    toast({ title: isEditMode ? (pt ? "Anúncio atualizado!" : "Listing updated!") : (pt ? "Anúncio criado com sucesso!" : "Listing created!") });
    navigate(adminMode ? "/admin?secao=imoveis" : `/imovel/${propId}`);
    setSubmitting(false);
  };

  const statusLabel: Record<string, string> = pt
    ? { active: "Ativo", sold: "Vendido", rented: "Alugado", inactive: "Fora de negociação" }
    : { active: "Active", sold: "Sold", rented: "Rented", inactive: "Withdrawn" };

  if (editLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="font-display text-2xl font-bold text-foreground mb-6">
        {isEditMode ? (pt ? "Editar Imóvel" : "Edit Property") : (pt ? "Anunciar Imóvel" : "List a Property")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <BasicInfoCard pt={pt} propertyType={propertyType} setPropertyType={setPropertyType} listingType={listingType} setListingType={setListingType} price={price} setPrice={setPrice} />

        <DetailsCard pt={pt} area={area} setArea={setArea} bedrooms={bedrooms} setBedrooms={setBedrooms} suites={suites} setSuites={setSuites} bathrooms={bathrooms} setBathrooms={setBathrooms} parkingSpots={parkingSpots} setParkingSpots={setParkingSpots} condoFee={condoFee} setCondoFee={setCondoFee} iptu={iptu} setIptu={setIptu} features={features} setFeatures={setFeatures} />

        {/* Address */}
        <Card>
          <CardHeader><CardTitle className="text-base">{pt ? "Endereço" : "Address"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">{pt ? "Localização no Mapa" : "Map Location"}</h4>
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                onLatChange={setLatitude}
                onLngChange={setLongitude}
                pt={pt}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">{pt ? "Área do Imóvel" : "Property Area"}</h4>
              <BoundaryEditor
                boundary={boundary}
                onChange={setBoundary}
                center={
                  boundary
                    ? boundaryCenter(boundary)
                    : latitude && longitude
                      ? { lat: Number(latitude), lng: Number(longitude) }
                      : null
                }
                pt={pt}
              />
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
              {imageFiles.length + existingImages.length < 10 && (
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

        {/* Private / Confidential Info */}
        <PrivateInfoCard
          pt={pt}
          userId={user.id}
          owners={owners}
          setOwners={setOwners}
          privateNotes={privateNotes}
          setPrivateNotes={setPrivateNotes}
          pendingFiles={pendingDocs}
          setPendingFiles={setPendingDocs}
        />

        {/* Title & Description with AI - placed last so all info is filled */}
        <TitleDescriptionCard pt={pt} title={title} setTitle={setTitle} description={description} setDescription={setDescription} onGenerateAI={handleGenerateAI} generatingAI={generatingAI} />

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

        {/* Duplicate listing / partnership dialog */}
        <Dialog open={!!dupGroup} onOpenChange={(o) => { if (!o) setDupGroup(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{pt ? "Este imóvel já está anunciado" : "This property is already listed"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {pt
                  ? `O imóvel já foi captado por ${dupGroup?.primary_broker_name ?? "outro corretor"}. Para evitar anúncios duplicados, solicite participação nesta captação.`
                  : `This property was already captured by ${dupGroup?.primary_broker_name ?? "another broker"}. To avoid duplicate listings, request to join it.`}
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">{pt ? "Tipo de parceria" : "Partnership type"}</label>
                <Select value={dupKind} onValueChange={(v) => setDupKind(v as PartnershipKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PARTNERSHIP_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>{partnershipKindLabel(k, pt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{partnershipKindHint(dupKind, pt)}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">{pt ? "Sua comissão (%)" : "Your commission (%)"}</label>
                  <Input type="number" min="0" max="100" value={dupSplit} onChange={(e) => setDupSplit(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">{pt ? "Termos" : "Terms"}</label>
                <Textarea value={dupTerms} onChange={(e) => setDupTerms(e.target.value)} placeholder={pt ? "Descreva os termos da parceria..." : "Describe the partnership terms..."} />
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => { setDupChoice("request"); void handleSubmit(undefined, "request"); setDupGroup(null); }}
                >
                  {pt ? "Solicitar participação" : "Request to join"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDupChoice("separate"); void handleSubmit(undefined, "separate"); setDupGroup(null); }}
                >
                  {pt ? "É outro imóvel, publicar separado" : "Different property, publish separately"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Show existing images in edit mode */}
        {isEditMode && existingImages.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{pt ? "Fotos atuais" : "Current Photos"}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {existingImages.map((img) => (
                  <div key={img.id} className="relative h-24 w-32 overflow-hidden rounded-lg border">
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={async () => {
                        // Extract storage path from public URL
                        const urlParts = img.url.split("/property-images/");
                        if (urlParts.length === 2) {
                          await supabase.storage.from("property-images").remove([urlParts[1]]);
                        }
                        await supabase.from("property_images").delete().eq("id", img.id);
                        setExistingImages((prev) => prev.filter((i) => i.id !== img.id));
                      }}
                      className="absolute right-1 top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          <Upload className="h-4 w-4" />
          {isEditMode ? (pt ? "Salvar Alterações" : "Save Changes") : (pt ? "Publicar Anúncio" : "Publish Listing")}
        </Button>
      </form>
    </div>
  );
};

export default CreateProperty;
