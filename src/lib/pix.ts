/**
 * Pix "copia e cola" (BR Code / EMV-QR) generator.
 * Works with any Pix key the broker already has at their own bank — no payment
 * provider account is required. When a provider account is configured later,
 * dynamic charges (boleto + Pix with automatic reconciliation) can replace this.
 */

const tag = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, "0")}${value}`;

const crc16 = (payload: string) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const sanitize = (value: string, max: number) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();

export interface PixPayloadInput {
  key: string;
  beneficiaryName: string;
  beneficiaryCity: string;
  amount?: number;
  reference?: string;
}

export const buildPixPayload = ({
  key,
  beneficiaryName,
  beneficiaryCity,
  amount,
  reference,
}: PixPayloadInput) => {
  const merchant = tag("00", "BR.GOV.BCB.PIX") + tag("01", key.trim());
  const txid = sanitize((reference ?? "").replace(/[^A-Za-z0-9]/g, ""), 25) || "***";

  let payload =
    tag("00", "01") +
    tag("26", merchant) +
    tag("52", "0000") +
    tag("53", "986") +
    (amount && amount > 0 ? tag("54", amount.toFixed(2)) : "") +
    tag("58", "BR") +
    tag("59", sanitize(beneficiaryName, 25) || "RECEBEDOR") +
    tag("60", sanitize(beneficiaryCity, 15) || "SAO PAULO") +
    tag("62", tag("05", txid));

  payload += "6304";
  return payload + crc16(payload);
};

export const pixKeyTypeLabel = (type: string | null, pt: boolean) =>
  ({
    cpf: "CPF",
    cnpj: "CNPJ",
    email: pt ? "E-mail" : "E-mail",
    phone: pt ? "Telefone" : "Phone",
    random: pt ? "Chave aleatória" : "Random key",
  }[type ?? ""] ?? (pt ? "Chave Pix" : "Pix key"));

export const providerLabel = (provider: string, pt: boolean) =>
  ({
    manual: pt ? "Pix da minha conta (manual)" : "My own Pix key (manual)",
    mercadopago: "Mercado Pago",
    asaas: "Asaas",
    pagarme: "Pagar.me",
  }[provider] ?? provider);
