import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Convite para equipe | Abitzo";
  }, []);

  const accept = async () => {
    if (!token) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("agency-accept-invite", { body: { token } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDone(data?.agency_name ?? "");
      toast({ title: "Convite aceito", description: "Você já faz parte da equipe." });
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container flex max-w-lg flex-col py-16">
      <Card>
        <CardHeader className="text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-primary" />
          <CardTitle>Convite para equipe</CardTitle>
          <CardDescription>
            {done !== null
              ? `Pronto! Você agora faz parte de ${done || "da imobiliária"}.`
              : "Aceite o convite para acessar o painel da imobiliária com as permissões definidas pelo responsável."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {done !== null ? (
            <Button onClick={() => navigate("/painel")}>Ir para o painel</Button>
          ) : !user ? (
            <>
              <p className="text-center text-sm text-muted-foreground">
                Entre ou crie sua conta com o e-mail que recebeu o convite.
              </p>
              <Button onClick={() => navigate("/login", { state: { from: `/convite/${token}` } })}>Entrar</Button>
              <Button variant="outline" onClick={() => navigate("/cadastro")}>Criar conta</Button>
            </>
          ) : (
            <Button onClick={accept} disabled={working}>
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aceitar convite
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
