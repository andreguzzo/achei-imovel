import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Gift, Search, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TIERS, getTierByProductId } from "@/hooks/useAuth";

const AdminSubscriptionsTab = () => {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ subscribed: boolean; product_id: string | null; subscription_end: string | null } | null>(null);

  // Grant free plan
  const [grantEmail, setGrantEmail] = useState("");
  const [grantTier, setGrantTier] = useState<string>("basic");
  const [grantMonths, setGrantMonths] = useState("1");
  const [granting, setGranting] = useState(false);

  const handleSearch = async () => {
    if (!email.trim()) return;
    setSearching(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("admin-check-user-subscription", {
      body: { email: email.trim() },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setResult(data);
    }
    setSearching(false);
  };

  const handleGrant = async () => {
    if (!grantEmail.trim()) return;
    setGranting(true);
    const { error } = await supabase.functions.invoke("admin-grant-subscription", {
      body: { email: grantEmail.trim(), tier: grantTier, months: parseInt(grantMonths) },
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assinatura bonificada com sucesso!" });
      setGrantEmail("");
    }
    setGranting(false);
  };

  const tierLabel = (productId: string | null) => {
    const t = getTierByProductId(productId);
    if (t === "free") return "Gratuito";
    return TIERS[t].name;
  };

  return (
    <div className="space-y-6">
      {/* Check subscription */}
      <Card>
        <CardHeader><CardTitle className="text-base">Verificar Assinatura</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="E-mail do usuário..." value={email} onChange={e => setEmail(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>
          {result && (
            <div className="text-sm bg-muted p-3 rounded-lg">
              <p><span className="text-muted-foreground">Status:</span> {result.subscribed ? "Ativo" : "Sem assinatura"}</p>
              {result.subscribed && (
                <>
                  <p><span className="text-muted-foreground">Plano:</span> {tierLabel(result.product_id)}</p>
                  <p><span className="text-muted-foreground">Expira em:</span> {result.subscription_end ? new Date(result.subscription_end).toLocaleDateString("pt-BR") : "—"}</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grant free subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Bonificar Assinatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div>
            <Label>E-mail do usuário</Label>
            <Input placeholder="usuario@email.com" value={grantEmail} onChange={e => setGrantEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plano</Label>
              <Select value={grantTier} onValueChange={setGrantTier}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duração (meses)</Label>
              <Input type="number" min="1" max="36" value={grantMonths} onChange={e => setGrantMonths(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleGrant} disabled={granting} className="gap-1">
            {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            Conceder assinatura gratuita
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSubscriptionsTab;
