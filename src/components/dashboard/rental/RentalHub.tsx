import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound, Receipt, ClipboardCheck, QrCode, PieChart } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import RentalContracts from "@/components/dashboard/rental/RentalContracts";
import RentalCharges from "@/components/dashboard/rental/RentalCharges";
import RentalInspections from "@/components/dashboard/rental/RentalInspections";
import RentalBilling from "@/components/dashboard/rental/RentalBilling";
import RentalReports from "@/components/dashboard/rental/RentalReports";

export type RentalTab = "contratos" | "alugueis" | "vistorias" | "cobranca" | "relatorios";

interface Props {
  userId: string;
  initialTab?: RentalTab;
}

const RentalHub = ({ userId, initialTab = "contratos" }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [tab, setTab] = useState<RentalTab>(initialTab);
  const [contractCount, setContractCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("rental_contracts")
        .select("id", { count: "exact", head: true })
        .eq("broker_id", userId);
      if (!cancelled) setContractCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const header = (
    <SectionHeader
      title={pt ? "Locação" : "Rentals"}
      description={
        pt
          ? "Contratos, cobrança mensal, vistorias e relatórios da carteira de aluguéis."
          : "Contracts, monthly charges, inspections and rental reports."
      }
    />
  );

  if (contractCount === null) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (contractCount === 0) {
    const bullets = [
      {
        icon: <KeyRound className="h-4 w-4 text-primary" />,
        title: pt ? "Contratos" : "Contracts",
        text: pt ? "Cadastre inquilino, valores, garantia, reajuste e o cofre de documentos." : "Register tenant, amounts, guarantee, adjustment and the document vault.",
      },
      {
        icon: <Receipt className="h-4 w-4 text-primary" />,
        title: pt ? "Aluguéis do mês" : "Monthly charges",
        text: pt ? "Geração automática das cobranças, baixa de pagamento e repasse ao proprietário." : "Automatic charge generation, payment settlement and owner payout.",
      },
      {
        icon: <ClipboardCheck className="h-4 w-4 text-primary" />,
        title: pt ? "Vistorias" : "Inspections",
        text: pt ? "Registro de entrada e saída com fotos e observações." : "Move-in and move-out records with photos and notes.",
      },
      {
        icon: <QrCode className="h-4 w-4 text-primary" />,
        title: pt ? "Cobrança e recebimento" : "Billing setup",
        text: pt ? "Pix manual agora, ou conecte Asaas/Mercado Pago quando quiser." : "Manual Pix now, or connect Asaas/Mercado Pago whenever you want.",
      },
      {
        icon: <PieChart className="h-4 w-4 text-primary" />,
        title: pt ? "Relatórios" : "Reports",
        text: pt ? "Inadimplência, receita de administração e vencimentos por período." : "Late payments, management revenue and due dates by period.",
      },
    ];

    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {pt
              ? "Você ainda não tem contratos de locação. Ao cadastrar o primeiro, este módulo passa a organizar tudo:"
              : "You have no rental contracts yet. Once you add the first one, this module organizes everything:"}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {bullets.map((b) => (
              <li key={b.title} className="flex gap-3 rounded-lg border border-border p-3">
                <span className="mt-0.5">{b.icon}</span>
                <span>
                  <span className="block text-sm font-medium">{b.title}</span>
                  <span className="block text-xs text-muted-foreground">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <Button className="mt-5" onClick={() => setContractCount(1)}>
            {pt ? "Começar: cadastrar contrato" : "Start: add a contract"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <Tabs value={tab} onValueChange={(v) => setTab(v as RentalTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="contratos">{pt ? "Contratos" : "Contracts"}</TabsTrigger>
          <TabsTrigger value="alugueis">{pt ? "Aluguéis do mês" : "Monthly charges"}</TabsTrigger>
          <TabsTrigger value="vistorias">{pt ? "Vistorias" : "Inspections"}</TabsTrigger>
          <TabsTrigger value="cobranca">{pt ? "Cobrança e recebimento" : "Billing"}</TabsTrigger>
          <TabsTrigger value="relatorios">{pt ? "Relatórios" : "Reports"}</TabsTrigger>
        </TabsList>

        <TabsContent value="contratos" className="mt-6"><RentalContracts userId={userId} /></TabsContent>
        <TabsContent value="alugueis" className="mt-6"><RentalCharges userId={userId} /></TabsContent>
        <TabsContent value="vistorias" className="mt-6"><RentalInspections userId={userId} /></TabsContent>
        <TabsContent value="cobranca" className="mt-6"><RentalBilling userId={userId} /></TabsContent>
        <TabsContent value="relatorios" className="mt-6"><RentalReports userId={userId} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default RentalHub;
