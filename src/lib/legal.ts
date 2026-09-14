import { supabase } from "@/integrations/supabase/client";

/**
 * Versions of the legal documents. Bump these whenever the text of
 * /termos or /privacidade changes, so the consent log stays auditable.
 */
export const TERMS_VERSION = "2026-09-14";
export const PRIVACY_VERSION = "2026-09-14";

export const CONTROLLER = {
  name: "Abitzo",
  email: "privacidade@abitzo.com.br",
};

const VISITOR_KEY = "abitzo_visitor_id";

export const getVisitorId = (): string => {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
};

export type ConsentType = "signup_terms" | "signup_privacy" | "contact_form";

interface ConsentInput {
  consent_type: ConsentType;
  document_version: string;
}

/**
 * Records explicit consent. IP and user agent are captured server-side.
 * Never blocks the user flow: failures are logged only.
 */
export const logConsent = async (
  consents: ConsentInput[],
  context: Record<string, unknown> = {},
): Promise<void> => {
  try {
    await supabase.functions.invoke("log-consent", {
      body: {
        consents,
        visitor_id: getVisitorId(),
        user_agent: navigator.userAgent,
        context,
      },
    });
  } catch (err) {
    console.error("consent log failed", err);
  }
};

export const acceptanceConsents = (): ConsentInput[] => [
  { consent_type: "signup_terms", document_version: TERMS_VERSION },
  { consent_type: "signup_privacy", document_version: PRIVACY_VERSION },
];
