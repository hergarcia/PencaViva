import { colors } from "@lib/constants";

describe("colors", () => {
  it("exports success and danger colors", () => {
    expect(colors.success).toBe("#00C48C");
    expect(colors.danger).toBe("#FF4D6A");
  });

  it("exports RGB companions for animation rgba() templates", () => {
    expect(colors.successRgb).toBe("0, 196, 140");
    expect(colors.dangerRgb).toBe("255, 77, 106");
  });

  it("exports prediction result colors", () => {
    expect(colors.exact).toBe("#FFB800");
    expect(colors.wrong).toBe("#6B6B80");
  });

  it("exports match status colors", () => {
    expect(colors.live).toBe("#FF4444");
  });

  it("exports liveRgb for rgba() usage in animations", () => {
    expect(colors.liveRgb).toBe("255, 68, 68");
  });

  it("exports card tokens", () => {
    expect(colors.cardRadius).toBe(16);
    expect(colors.cardPadding).toBe(16);
    expect(colors.cardBorderWidth).toBe(1);
  });
});
