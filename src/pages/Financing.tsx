import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Calculator, TrendingDown } from "lucide-react";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Row = { month: number; payment: number; amort: number; interest: number; balance: number };

function calcSAC(principal: number, monthlyRate: number, months: number): Row[] {
  const amort = principal / months;
  const rows: Row[] = [];
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const interest = balance * monthlyRate;
    const payment = amort + interest;
    balance -= amort;
    rows.push({ month: m, payment, amort, interest, balance: Math.max(balance, 0) });
  }
  return rows;
}

function calcPrice(principal: number, monthlyRate: number, months: number): Row[] {
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  const rows: Row[] = [];
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const interest = balance * monthlyRate;
    const amort = payment - interest;
    balance -= amort;
    rows.push({ month: m, payment, amort, interest, balance: Math.max(balance, 0) });
  }
  return rows;
}

const Financing = () => {
  const { t, locale } = useLanguage();
  const [propertyValue, setPropertyValue] = useState("500000");
  const [downPayment, setDownPayment] = useState("100000");
  const [termYears, setTermYears] = useState("30");
  const [rate, setRate] = useState("9.5");
  const [calculated, setCalculated] = useState(false);

  const principal = Number(propertyValue) - Number(downPayment);
  const months = Number(termYears) * 12;
  const monthlyRate = Number(rate) / 100 / 12;

  const sacRows = useMemo(() => (calculated ? calcSAC(principal, monthlyRate, months) : []), [calculated, principal, monthlyRate, months]);
  const priceRows = useMemo(() => (calculated ? calcPrice(principal, monthlyRate, months) : []), [calculated, principal, monthlyRate, months]);

  const sacTotal = sacRows.reduce((a, r) => a + r.payment, 0);
  const priceTotal = priceRows.reduce((a, r) => a + r.payment, 0);

  // Chart data (every 12 months)
  const chartData = useMemo(() => {
    if (!calculated) return [];
    return sacRows
      .filter((_, i) => i % 12 === 0 || i === sacRows.length - 1)
      .map((s, idx) => {
        const p = priceRows[s.month - 1];
        return {
          month: s.month,
          year: Math.ceil(s.month / 12),
          sac: Math.round(s.payment),
          price: Math.round(p?.payment ?? 0),
        };
      });
  }, [calculated, sacRows, priceRows]);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (principal > 0 && months > 0 && monthlyRate > 0) {
      setCalculated(true);
    }
  };

  return (
    <div className="container py-8 space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center justify-center gap-2">
          <Calculator className="h-8 w-8 text-primary" />
          {t.financing.title}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {locale === "pt-BR" ? "Compare SAC e Price e descubra a melhor opção para você" : "Compare SAC and Price amortization tables"}
        </p>
      </div>

      {/* Form */}
      <Card className="mx-auto max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleCalculate} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{t.financing.propertyValue}</label>
              <Input type="number" value={propertyValue} onChange={(e) => { setPropertyValue(e.target.value); setCalculated(false); }} min="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.financing.downPayment}</label>
              <Input type="number" value={downPayment} onChange={(e) => { setDownPayment(e.target.value); setCalculated(false); }} min="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.financing.term}</label>
              <Input type="number" value={termYears} onChange={(e) => { setTermYears(e.target.value); setCalculated(false); }} min="1" max="35" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t.financing.interestRate}</label>
              <Input type="number" value={rate} onChange={(e) => { setRate(e.target.value); setCalculated(false); }} min="0" step="0.1" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full gap-2" size="lg">
                <TrendingDown className="h-4 w-4" /> {t.financing.calculate}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {calculated && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t.financing.sacSystem} — {t.financing.firstPayment}</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-primary">{formatBRL(sacRows[0]?.payment ?? 0)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t.financing.sacSystem} — {t.financing.lastPayment}</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-primary">{formatBRL(sacRows[sacRows.length - 1]?.payment ?? 0)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t.financing.priceSystem} — {t.financing.monthlyPayment}</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-primary">{formatBRL(priceRows[0]?.payment ?? 0)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{locale === "pt-BR" ? "Economia SAC vs Price" : "SAC Savings vs Price"}</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold text-green-600">{formatBRL(priceTotal - sacTotal)}</p></CardContent>
            </Card>
          </div>

          {/* Total comparison */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-primary/30">
              <CardHeader><CardTitle>{t.financing.sacSystem}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">{t.financing.firstPayment}:</span> <span className="font-medium">{formatBRL(sacRows[0]?.payment ?? 0)}</span></p>
                <p><span className="text-muted-foreground">{t.financing.lastPayment}:</span> <span className="font-medium">{formatBRL(sacRows[sacRows.length - 1]?.payment ?? 0)}</span></p>
                <p><span className="text-muted-foreground">{t.financing.totalPaid}:</span> <span className="font-bold">{formatBRL(sacTotal)}</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t.financing.priceSystem}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">{t.financing.monthlyPayment}:</span> <span className="font-medium">{formatBRL(priceRows[0]?.payment ?? 0)}</span></p>
                <p><span className="text-muted-foreground">{t.financing.totalPaid}:</span> <span className="font-bold">{formatBRL(priceTotal)}</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{locale === "pt-BR" ? "Evolução das Parcelas" : "Payment Evolution"}</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" label={{ value: locale === "pt-BR" ? "Ano" : "Year", position: "insideBottom", offset: -5 }} />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="sac" name="SAC" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="price" name="Price" stroke="hsl(var(--destructive, 0 84% 60%))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{locale === "pt-BR" ? "Tabela Detalhada" : "Detailed Table"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="sac">
                <TabsList>
                  <TabsTrigger value="sac">SAC</TabsTrigger>
                  <TabsTrigger value="price">Price</TabsTrigger>
                </TabsList>
                <TabsContent value="sac" className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="p-2">#</th>
                        <th className="p-2">{locale === "pt-BR" ? "Parcela" : "Payment"}</th>
                        <th className="p-2">{locale === "pt-BR" ? "Amort." : "Amort."}</th>
                        <th className="p-2">{locale === "pt-BR" ? "Juros" : "Interest"}</th>
                        <th className="p-2">{locale === "pt-BR" ? "Saldo" : "Balance"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sacRows.map((r) => (
                        <tr key={r.month} className="border-b">
                          <td className="p-2">{r.month}</td>
                          <td className="p-2">{formatBRL(r.payment)}</td>
                          <td className="p-2">{formatBRL(r.amort)}</td>
                          <td className="p-2">{formatBRL(r.interest)}</td>
                          <td className="p-2">{formatBRL(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>
                <TabsContent value="price" className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="p-2">#</th>
                        <th className="p-2">{locale === "pt-BR" ? "Parcela" : "Payment"}</th>
                        <th className="p-2">{locale === "pt-BR" ? "Amort." : "Amort."}</th>
                        <th className="p-2">{locale === "pt-BR" ? "Juros" : "Interest"}</th>
                        <th className="p-2">{locale === "pt-BR" ? "Saldo" : "Balance"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceRows.map((r) => (
                        <tr key={r.month} className="border-b">
                          <td className="p-2">{r.month}</td>
                          <td className="p-2">{formatBRL(r.payment)}</td>
                          <td className="p-2">{formatBRL(r.amort)}</td>
                          <td className="p-2">{formatBRL(r.interest)}</td>
                          <td className="p-2">{formatBRL(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Financing;
