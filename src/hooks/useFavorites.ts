import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const LOCAL_KEY = "abitzo_favorites";

const getLocalFavorites = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
};

const setLocalFavorites = (ids: string[]) => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
};

/**
 * Hook that manages favorites via Supabase (logged in) or localStorage (anonymous).
 * On login, syncs localStorage favorites to Supabase.
 */
export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load favorites
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (user) {
        // Sync local → remote on login
        const localIds = getLocalFavorites();
        if (localIds.length > 0) {
          const inserts = localIds.map((pid) => ({ user_id: user.id, property_id: pid }));
          await supabase.from("favorites").upsert(inserts, { onConflict: "user_id,property_id", ignoreDuplicates: true });
          setLocalFavorites([]);
        }

        const { data } = await supabase
          .from("favorites")
          .select("property_id")
          .eq("user_id", user.id);
        setFavoriteIds(new Set((data ?? []).map((f) => f.property_id)));
      } else {
        setFavoriteIds(new Set(getLocalFavorites()));
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const isFavorited = useCallback(
    (propertyId: string) => favoriteIds.has(propertyId),
    [favoriteIds]
  );

  const toggle = useCallback(
    async (propertyId: string) => {
      const wasFav = favoriteIds.has(propertyId);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(propertyId);
        else next.add(propertyId);
        return next;
      });

      if (user) {
        if (wasFav) {
          await supabase.from("favorites").delete().eq("user_id", user.id).eq("property_id", propertyId);
        } else {
          await supabase.from("favorites").insert({ user_id: user.id, property_id: propertyId });
        }
      } else {
        const local = getLocalFavorites();
        if (wasFav) {
          setLocalFavorites(local.filter((id) => id !== propertyId));
        } else {
          setLocalFavorites([...local, propertyId]);
        }
      }

      return !wasFav;
    },
    [favoriteIds, user]
  );

  return { favoriteIds, isFavorited, toggle, loading };
}
