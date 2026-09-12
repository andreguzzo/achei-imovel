import { describe, it, expect } from "vitest";
import { getEmbedUrl } from "@/lib/video";

describe("getEmbedUrl", () => {
  it("converts a standard YouTube watch URL", () => {
    expect(getEmbedUrl("https://www.youtube.com/watch?v=abc123XYZ_-")).toBe(
      "https://www.youtube.com/embed/abc123XYZ_-",
    );
  });

  it("converts a youtu.be short link", () => {
    expect(getEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube.com/embed/abc123");
  });

  it("converts a YouTube Shorts link", () => {
    expect(getEmbedUrl("https://www.youtube.com/shorts/abc123")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
  });

  it("converts a Vimeo link", () => {
    expect(getEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("returns unknown URLs unchanged", () => {
    expect(getEmbedUrl("https://example.com/video.mp4")).toBe("https://example.com/video.mp4");
  });
});
