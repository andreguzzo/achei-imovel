import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Gift, Search, Loader2, Crown, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TIERS, getTierByProductId } from "@/hooks/useAuth";

type SubscribedUser = {
  email: string;
  product_id: string | null;
  subscription_end: string;
  subscription_start: string;
};

const AdminSubscriptionsTab = () => {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ subscribed: boolean; product_id: string | null; subscription_end: string | null } | null>(null);

  const [grantEmail, setGrantEmail] = useState("");
  const [grantTier, setGrantTier] = useState<string>("basic");
  const [grantMonths, setGrantMonths] = useState("1");
  const [granting, setGranting] = useState(false);

  const [paidUsers, setPaidUsers] = useState<SubscribedUser[]>([]);
  const [loadingPaid, setLoadingPaid] = useState(true);

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
      fetchPaidUsers();
    }
    setGranting(false);
  };

  const fetchPaidUsers = async () => {
    setLoadingPaid(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-subscribers");
      if (error) {
        console.error("Error fetching subscribers:", error);
      } else {
        setPaidUsers(data?.subscribers ?? []);
      }
    } catch (err) {
      console.error("Error fetching paid users:", err);
    }
    setLoadingPaid(false);
  };

  useEffect(() => { fetchPaidUsers(); }, []);

  const tierLabel = (productId: string | null) => {
    const t = getTierByProductId(productId);
    if (t === "free") return "Gratuito";
    return TIERS[t].name;
  };

  const tierColor = (productId: string | null) => {
    const t = getTierByProductId(productId);
    switch (t) {
      case "premium": return "bg-amber-500/10 text-amber-700 border-amber-300";
      case "pro": return "bg-violet-500/10 text-violet-700 border-violet-300";
      case "basic": return "bg-blue-500/10 text-blue-700 border-blue-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const isNew = (dateStr?: string) => {
    if (!dateStr) return false;
    const diff = Date.now() - new Date(dateStr).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
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

      {/* Paid users list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" /> Assinantes Ativos
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchPaidUsers} disabled={loadingPaid} className="gap-1">
            <RefreshCw className={`h-4 w-4 ${loadingPaid ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loadingPaid ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : paidUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum assinante ativo encontrado.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">{paidUsers.length} assinante{paidUsers.length !== 1 ? "s" : ""} ativo{paidUsers.length !== 1 ? "s" : ""}</p>
              {paidUsers.map((user, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    isNew(user.subscription_start) ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "bg-card"
                  }`}
                >
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Crown className={`h-4 w-4 ${isNew(user.subscription_start) ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{user.email}</p>
                      {isNew(user.subscription_start) && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary shrink-0">
                          <Sparkles className="h-3 w-3" /> Novo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Desde {new Date(user.subscription_start).toLocaleDateString("pt-BR")} · Expira: {new Date(user.subscription_end).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${tierColor(user.product_id)}`}>
                    {tierLabel(user.product_id)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSubscriptionsTab;
