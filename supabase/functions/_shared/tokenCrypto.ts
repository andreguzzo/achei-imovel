/**
 * AES-GCM encryption for third-party access tokens (Instagram/Facebook).
 * Tokens are never stored in plain text: social_accounts.access_token_encrypted
 * holds base64(iv || ciphertext).
 *
 * Requires the SOCIAL_TOKEN_ENCRYPTION_KEY secret (32-byte key, base64 or hex).
 */

const decodeKey = (raw: string): Uint8Array => {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
    return bytes;
  }
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (bytes.length !== 32) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  return bytes;
};

const getKey = async (): Promise<CryptoKey> => {
  const raw = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");
  return await crypto.subtle.importKey("raw", decodeKey(raw), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
};

export const encryptToken = async (plaintext: string): Promise<string> => {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return btoa(String.fromCharCode(...combined));
};

export const decryptToken = async (stored: string): Promise<string> => {
  const key = await getKey();
  const bin = atob(stored);
  const combined = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) combined[i] = bin.charCodeAt(i);
  const iv = combined.slice(0, 12);
  const cipher = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
};
