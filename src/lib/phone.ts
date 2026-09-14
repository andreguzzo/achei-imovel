/**
 * Brazilian phone normalization.
 *
 * The country code decision is made ONLY by digit count — never by
 * startsWith("55"), because 55 is also the area code (DDD) of Rio Grande do Sul.
 */

const onlyDigits = (input: string | null | undefined) => (input ?? "").replace(/\D/g, "");

const validDdd = (ddd: string) => {
  const n = Number(ddd);
  return n >= 11 && n <= 99;
};

/**
 * Old 8-digit mobile numbers (subscriber starting with 6-9) gained a leading 9.
 * Landlines (subscriber starting with 2-5) are returned untouched.
 */
export function addNinthDigit(national: string): string {
  if (national.length !== 10) return national;
  const ddd = national.slice(0, 2);
  const subscriber = national.slice(2);
  if (/^[6-9]/.test(subscriber)) return `${ddd}9${subscriber}`;
  return national;
}

/** DDD + 8 digits starting with 2-5 is a landline. */
const isLandlineNational = (national: string) =>
  national.length === 10 && /^[2-5]/.test(national.slice(2));

/**
 * Returns the number in international digits-only format (55 + DDD + subscriber),
 * or null when the input cannot be trusted.
 */
export function normalizeBrPhone(input: string | null | undefined): string | null {
  let digits = onlyDigits(input);
  digits = digits.replace(/^0+/, "");

  const national = (value: string): string | null => {
    if (value.length !== 10 && value.length !== 11) return null;
    if (!validDdd(value.slice(0, 2))) return null;
    if (value.length === 11 && !/^9/.test(value.slice(2))) return null;
    return `55${addNinthDigit(value)}`;
  };

  if (digits.length === 12 || digits.length === 13) {
    if (digits.slice(0, 2) !== "55") return null;
    return national(digits.slice(2));
  }

  if (digits.length === 10 || digits.length === 11) return national(digits);

  // 8 or 9 digits: no DDD — guessing one would message the wrong person.
  return null;
}

/** False for landlines and for anything normalizeBrPhone rejects. */
export function isWhatsAppCapable(input: string | null | undefined): boolean {
  const normalized = normalizeBrPhone(input);
  if (!normalized) return false;
  return !isLandlineNational(normalized.slice(2));
}

/** wa.me URL, or null when the stored number is not usable on WhatsApp. */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message?: string,
): string | null {
  const normalized = normalizeBrPhone(phone);
  if (!normalized || !isWhatsAppCapable(normalized)) return null;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${normalized}${query}`;
}

/** Display format: (27) 99999-9999 */
export function formatBrPhone(input: string | null | undefined): string {
  const digits = onlyDigits(input);
  const national =
    (digits.length === 12 || digits.length === 13) && digits.slice(0, 2) === "55"
      ? digits.slice(2)
      : digits;

  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  if (national.length > 2) return `(${national.slice(0, 2)}) ${national.slice(2)}`;
  return national;
}

/** Progressive mask for phone inputs. */
export const maskBrPhone = (input: string) => formatBrPhone(onlyDigits(input).slice(0, 11));

export { onlyDigits };
