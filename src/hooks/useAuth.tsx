import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Stripe tier mapping
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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tier: TierKey;
  subscriptionEnd: string | null;
  checkingSubscription: boolean;
  refreshSubscription: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
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

  const refreshSubscription = useCallback(async () => {
    try {
      setCheckingSubscription(true);
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("Error checking subscription:", error);
        return;
      }
      if (data?.subscribed) {
        setTier(getTierByProductId(data.product_id));
        setSubscriptionEnd(data.subscription_end);
      } else {
        setTier("free");
        setSubscriptionEnd(null);
      }
    } catch (err) {
      console.error("Error checking subscription:", err);
    } finally {
      setCheckingSubscription(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => refreshSubscription(), 0);
      } else {
        setTier("free");
        setSubscriptionEnd(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        refreshSubscription();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshSubscription]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
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
    <AuthContext.Provider value={{ user, session, loading, tier, subscriptionEnd, checkingSubscription, refreshSubscription, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
