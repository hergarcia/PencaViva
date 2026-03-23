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
});
