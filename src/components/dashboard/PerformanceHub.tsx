import { Suspense, lazy, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/i18n/LanguageContext";
import { SectionHeader } from "@/components/dashboard/SectionHeader";

const BrokerAnalytics = lazy(() => import("@/components/dashboard/BrokerAnalytics"));
const DashboardFinance = lazy(() => import("@/components/dashboard/DashboardFinance"));

export type PerformanceTab = "vendas" | "financeiro";

const ChartSkeleton = () => (
  <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
    <Skeleton className="h-72 w-full rounded-lg" />
  </div>
);

const PerformanceHub = ({ userId, initialTab = "vendas" }: { userId: string; initialTab?: PerformanceTab }) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [tab, setTab] = useState<PerformanceTab>(initialTab);

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Desempenho" : "Performance"}
        description={
          pt
            ? "Relatórios de venda e consolidação financeira das suas comissões e receitas."
            : "Sales reports and a financial view of your commissions and revenue."
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as PerformanceTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="vendas">{pt ? "Relatórios de venda" : "Sales reports"}</TabsTrigger>
          <TabsTrigger value="financeiro">{pt ? "Financeiro" : "Finance"}</TabsTrigger>
        </TabsList>
        <TabsContent value="vendas" className="mt-6">
          <Suspense fallback={<ChartSkeleton />}>
            <BrokerAnalytics userId={userId} />
          </Suspense>
        </TabsContent>
        <TabsContent value="financeiro" className="mt-6">
          <Suspense fallback={<ChartSkeleton />}>
            <DashboardFinance userId={userId} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceHub;
