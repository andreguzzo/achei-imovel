import { describe, expect, it } from "vitest";
import {
  buildWhatsAppUrl,
  formatBrPhone,
  isWhatsAppCapable,
  normalizeBrPhone,
} from "@/lib/phone";

describe("normalizeBrPhone", () => {
  it("keeps DDD 55 (Rio Grande do Sul) numbers with 11 digits", () => {
    expect(normalizeBrPhone("55999998888")).toBe("5555999998888");
  });

  it("accepts a number already in international format (13 digits)", () => {
    expect(normalizeBrPhone("5527999998888")).toBe("5527999998888");
  });

  it("adds the ninth digit to old 10-digit mobiles", () => {
    expect(normalizeBrPhone("2788887777")).toBe("5527988887777");
  });

  it("normalizes a landline but does not treat it as WhatsApp", () => {
    expect(normalizeBrPhone("2733334444")).toBe("552733334444");
    expect(isWhatsAppCapable("2733334444")).toBe(false);
    expect(buildWhatsAppUrl("2733334444", "oi")).toBeNull();
  });

  it("handles masked input", () => {
    expect(normalizeBrPhone("(27) 99999-8888")).toBe("5527999998888");
  });

  it("handles +55 prefixed input", () => {
    expect(normalizeBrPhone("+55 (27) 99999-8888")).toBe("5527999998888");
  });

  it("rejects short numbers without DDD", () => {
    expect(normalizeBrPhone("99998888")).toBeNull();
    expect(normalizeBrPhone("999998888")).toBeNull();
  });

  it("rejects empty strings and nullish input", () => {
    expect(normalizeBrPhone("")).toBeNull();
    expect(normalizeBrPhone(null)).toBeNull();
    expect(normalizeBrPhone(undefined)).toBeNull();
  });

  it("rejects invalid DDDs", () => {
    expect(normalizeBrPhone("01999998888")).toBeNull();
  });
});

describe("buildWhatsAppUrl", () => {
  it("encodes the message", () => {
    expect(buildWhatsAppUrl("(27) 99999-8888", "Olá!")).toBe(
      "https://wa.me/5527999998888?text=Ol%C3%A1!",
    );
  });

  it("returns null instead of a broken URL", () => {
    expect(buildWhatsAppUrl("123", "oi")).toBeNull();
  });
});

describe("formatBrPhone", () => {
  it("formats mobile and landline numbers", () => {
    expect(formatBrPhone("5527999998888")).toBe("(27) 99999-8888");
    expect(formatBrPhone("2733334444")).toBe("(27) 3333-4444");
  });
});
