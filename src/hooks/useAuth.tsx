import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Legacy Stripe tier mapping (old plans, kept for existing subscribers)
export const TIERS = {
  basic: {
    price_id: "price_1T6wzyRZflpUnPI8eHlq6pUi",
    product_id: "prod_U57EjwvR20lpGK",
    name: "Básico",
    maxProperties: 10,
    priceLabel: "R$ 49,90/mês",
  },
  pro: {
    price_id: "price_1T6x0FRZflpUnPI81C5BzNFT",
    product_id: "prod_U57EjdIuFxyNGv",
    name: "Pro",
    maxProperties: 50,
    priceLabel: "R$ 99,90/mês",
  },
  premium: {
    price_id: "price_1T6x0VRZflpUnPI816Ekf7tf",
    product_id: "prod_U57EV6GbFjgqCP",
    name: "Premium",
    maxProperties: Infinity,
    priceLabel: "R$ 199,90/mês",
  },
} as const;

export type TierKey = keyof typeof TIERS | "free";
export type AccountType = "owner" | "broker" | "agency";
export type VerificationStatus = "unverified" | "pending" | "manual_review" | "approved" | "rejected";

export function getTierByProductId(productId: string | null): TierKey {
  if (!productId) return "free";
  for (const [key, tier] of Object.entries(TIERS)) {
    if (tier.product_id === productId) return key as TierKey;
  }
  return "free";
}

export function getMaxProperties(tier: TierKey): number {
  if (tier === "free") return 3;
  return TIERS[tier].maxProperties;
}

/** Paid professional plans sold today. */
export const PRO_PLAN_SLUGS = ["corretor", "imobiliaria"] as const;

/** Listing limit by account type: owners publish a single property, professionals are unlimited. */
export function getAccountMaxProperties(accountType: AccountType, tier: TierKey): number {
  if (accountType === "owner") return tier === "free" ? 1 : getMaxProperties(tier);
  return Infinity;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tier: TierKey;
  subscriptionEnd: string | null;
  checkingSubscription: boolean;
  planSlug: string | null;
  subscribed: boolean;
  accountType: AccountType;
  verificationStatus: VerificationStatus;
  verified: boolean;
  maxProperties: number;
  refreshSubscription: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, accountType?: AccountType) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<TierKey>("free");
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("owner");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [verified, setVerified] = useState(false);
  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  const refreshSubscription = useCallback(async () => {
    try {
      setCheckingSubscription(true);
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("Error checking subscription:", error);
        return;
      }
      if (data?.subscribed) {
        setSubscribed(true);
        setPlanSlug((data.plan_slug as string) ?? null);
        setTier(getTierByProductId(data.product_id));
        setSubscriptionEnd(data.subscription_end);
      } else {
        setSubscribed(false);
        setPlanSlug(null);
        setTier("free");
        setSubscriptionEnd(null);
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
    } finally {
      setCheckingSubscription(false);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("account_type, verification_status, verified_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return;
    setAccountType((data.account_type as AccountType) ?? "owner");
    setVerificationStatus((data.verification_status as VerificationStatus) ?? "unverified");
    setVerified(!!data.verified_at);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) await loadProfile(data.session.user.id);
  }, [loadProfile]);

  useEffect(() => {
    let initialSessionHandled = false;

    const handleSession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      if (nextSession?.user) {
        const userId = nextSession.user.id;
        setTimeout(() => {
          refreshSubscription();
          loadProfile(userId);
        }, 0);
      } else {
        setTier("free");
        setSubscriptionEnd(null);
        setAccountType("owner");
        setVerificationStatus("unverified");
        setVerified(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      initialSessionHandled = true;
      handleSession(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!initialSessionHandled) handleSession(current);
    });

    const interval = setInterval(() => {
      supabase.auth.getSession().then(({ data: { session: current } }) => {
        if (current?.user) refreshSubscription();
      });
    }, 60_000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [refreshSubscription, loadProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName: string, type: AccountType = "owner") => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, account_type: type },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        tier,
        subscriptionEnd,
        checkingSubscription,
        accountType,
        verificationStatus,
        verified,
        maxProperties: getAccountMaxProperties(accountType, tier),
        refreshSubscription,
        refreshProfile,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
