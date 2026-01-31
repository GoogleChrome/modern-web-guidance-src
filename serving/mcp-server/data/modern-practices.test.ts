
import { describe, it, expect } from "vitest";
import { getGuide } from "./modern-practices.ts";

describe("getGuide", () => {
  it("should retrieve full guide when no section is provided", async () => {
    const guide = await getGuide("carousel");
    expect(guide).toBeTruthy();
    expect(guide).toContain("# Modern Carousel");
    expect(guide).toContain("## Key Features");
  });

  it("should return null for non-existent guide", async () => {
    const guide = await getGuide("non-existent-id");
    expect(guide).toBeNull();
  });
});
