import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Handshake, Inbox, Send, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  partnershipKindLabel,
  memberStatusLabel,
  type MemberRole,
  type MemberStatus,
  type PartnershipKind,
} from "@/lib/partnerships";

interface Props {
  userId: string;
}

interface MemberRow {
  id: string;
  group_id: string;
  property_id: string;
  broker_id: string;
  role: MemberRole;
  status: MemberStatus;
  partnership_type: PartnershipKind | null;
  commission_split: number | null;
  terms: string | null;
  created_at?: string | null;
}

const PropertyPartnerships = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [myRoles, setMyRoles] = useState<Map<string, MemberRole>>(new Map());
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: mine } = await supabase
      .from("property_group_members")
      .select("id, group_id, property_id, broker_id, role, status, partnership_type, commission_split, terms")
      .eq("broker_id", userId);

    const groupIds = Array.from(new Set((mine ?? []).map((m) => m.group_id)));
    const roleMap = new Map<string, MemberRole>();
    (mine ?? []).forEach((m) => roleMap.set(m.group_id, m.role));
    setMyRoles(roleMap);

    if (groupIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: all } = await supabase
      .from("property_group_members")
      .select("id, group_id, property_id, broker_id, role, status, partnership_type, commission_split, terms")
      .in("group_id", groupIds);

    const list = (all ?? []) as MemberRow[];
    setRows(list);

    const propIds = Array.from(new Set(list.map((m) => m.property_id)));
    const brokerIds = Array.from(new Set(list.map((m) => m.broker_id)));
    const [propsRes, profilesRes] = await Promise.all([
      supabase.from("properties").select("id, title").in("id", propIds),
      supabase.from("brokers_public").select("user_id, full_name").in("user_id", brokerIds),
    ]);
    setTitles(new Map((propsRes.data ?? []).map((p) => [p.id, p.title])));
    setNames(new Map((profilesRes.data ?? []).map((p) => [p.user_id, p.full_name ?? "Corretor"])));

    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const respond = async (memberId: string, approve: boolean) => {
    setActing(memberId);
    const { error } = await supabase.rpc("respond_group_membership", {
      _member_id: memberId,
      _approve: approve,
    });
    setActing(null);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: approve
        ? pt ? "Parceria aprovada!" : "Partnership approved!"
        : pt ? "Solicitação recusada." : "Request declined.",
    });
    fetchData();
  };

  const received = rows.filter(
    (r) => r.status === "pending" && r.broker_id !== userId && myRoles.get(r.group_id) === "captador",
  );
  const sent = rows.filter((r) => r.broker_id === userId && r.role === "parceiro");
  const active = rows.filter((r) => r.status === "approved" && r.broker_id !== userId);

  const Row = ({ r, actions }: { r: MemberRow; actions?: boolean }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{titles.get(r.property_id) ?? (pt ? "Imóvel" : "Property")}</p>
        <p className="text-xs text-muted-foreground">
          {names.get(r.broker_id) ?? "Corretor"} · {partnershipKindLabel(r.partnership_type, pt)}
          {r.commission_split != null && ` · ${r.commission_split}%/${100 - r.commission_split}%`}
        </p>
        {r.terms && <p className="mt-1 text-xs text-muted-foreground">{r.terms}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "secondary" : "outline"}>
          {memberStatusLabel(r.status, pt)}
        </Badge>
        {actions && (
          <div className="flex gap-1">
            <Button size="sm" disabled={acting === r.id} onClick={() => respond(r.id, true)}>
              {acting === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (pt ? "Aprovar" : "Approve")}
            </Button>
            <Button size="sm" variant="outline" disabled={acting === r.id} onClick={() => respond(r.id, false)}>
              {pt ? "Recusar" : "Decline"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4" /> {pt ? "Solicitações recebidas" : "Requests received"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {received.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {pt
                ? "Nenhuma solicitação aguardando sua aprovação."
                : "No requests waiting for your approval."}
            </p>
          ) : (
            received.map((r) => <Row key={r.id} r={r} actions />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" /> {pt ? "Solicitações enviadas" : "Requests sent"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {pt ? "Você não solicitou participação em nenhum imóvel." : "You have not requested to join any listing."}
            </p>
          ) : (
            sent.map((r) => <Row key={r.id} r={r} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> {pt ? "Parcerias ativas" : "Active partnerships"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {active.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Handshake className="h-4 w-4" />
              {pt ? "Nenhuma parceria ativa." : "No active partnerships."}
            </p>
          ) : (
            active.map((r) => <Row key={r.id} r={r} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PropertyPartnerships;
