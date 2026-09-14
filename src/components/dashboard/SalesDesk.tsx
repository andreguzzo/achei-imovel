import { Suspense, lazy, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import SalesInbox from "@/components/dashboard/SalesInbox";

const SalesPipeline = lazy(() => import("@/components/dashboard/SalesPipeline"));

interface Props {
  userId: string;
  defaultTab?: "inbox" | "funnel";
}

const PipelineSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-64 w-full rounded-lg" />
    ))}
  </div>
);

const SalesDesk = ({ userId, defaultTab = "inbox" }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [tab, setTab] = useState<"inbox" | "funnel">(defaultTab);
  const [pipelineKey, setPipelineKey] = useState(0);

  const handleConverted = () => {
    setPipelineKey((k) => k + 1);
    setTab("funnel");
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Atendimentos" : "Client desk"}
        description={
          pt
            ? "Triagem dos contatos recebidos e acompanhamento das negociações em um só lugar."
            : "Triage incoming leads and follow your deals in one place."
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "inbox" | "funnel")}>
        <TabsList>
          <TabsTrigger value="inbox">{pt ? "Caixa de entrada" : "Inbox"}</TabsTrigger>
          <TabsTrigger value="funnel">{pt ? "Funil" : "Pipeline"}</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-6">
          <SalesInbox userId={userId} onConverted={handleConverted} />
        </TabsContent>

        <TabsContent value="funnel" className="mt-6">
          <Suspense fallback={<PipelineSkeleton />}>
            <SalesPipeline key={pipelineKey} userId={userId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesDesk;
