import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AgencyPermission, PermissionMap } from "@/lib/permissions";

export type Agency = {
  id: string;
  name: string;
  cnpj: string | null;
  creci: string | null;
  owner_user_id: string;
};

export type AgencyMember = {
  id: string;
  agency_id: string;
  user_id: string;
  status: string;
  permissions: PermissionMap;
};

/** Loads the agency the signed-in user owns or belongs to, plus the effective permissions. */
export function useAgency(userId?: string) {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [membership, setMembership] = useState<AgencyMember | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);

    const { data: owned } = await supabase
      .from("agencies")
      .select("id, name, cnpj, creci, owner_user_id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (owned) {
      setAgency(owned as Agency);
      setMembership(null);
      setLoading(false);
      return;
    }

    const { data: member } = await supabase
      .from("agency_members")
      .select("id, agency_id, user_id, status, permissions")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (member) {
      setMembership({ ...member, permissions: (member.permissions ?? {}) as PermissionMap } as AgencyMember);
      const { data: ag } = await supabase
        .from("agencies")
        .select("id, name, cnpj, creci, owner_user_id")
        .eq("id", member.agency_id)
        .maybeSingle();
      setAgency((ag as Agency) ?? null);
    } else {
      setAgency(null);
      setMembership(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const isOwner = !!agency && agency.owner_user_id === userId;
  const can = (perm: AgencyPermission) => {
    if (!agency) return true; // solo account: no restrictions
    if (isOwner) return true;
    return membership?.permissions?.[perm] === true;
  };

  return { agency, membership, isOwner, loading, can, refetch: load };
}
