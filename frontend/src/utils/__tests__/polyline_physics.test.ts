import { calculateVelocity } from "@/utils/physics";
import { decodePolyline } from "@/utils/polyline";

describe("polyline and physics utils", () => {
  it("decodes polyline into lng/lat pairs", () => {
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points).toHaveLength(3);
    expect(points[0][0]).toBeCloseTo(-120.2, 4);
    expect(points[0][1]).toBeCloseTo(38.5, 4);
  });

  it("calculates positive velocity for realistic cycling inputs", () => {
    const v = calculateVelocity(280, 0.04, 72, 8);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(30);
  });

  it("returns a positive, plausible velocity on descents", () => {
    for (const power of [150, 250, 350]) {
      const flat = calculateVelocity(power, 0, 75, 9);
      for (const gradient of [-0.02, -0.03, -0.05, -0.08]) {
        const v = calculateVelocity(power, gradient, 75, 9);
        expect(v).toBeGreaterThan(flat);
        expect(v).toBeLessThan(30);
      }
    }
  });

  it("solves the power balance equation", () => {
    const v = calculateVelocity(300, 0.06, 70, 8);
    const powerAtWheel = 0.5 * 1.225 * 0.32 * v ** 3 + 78 * 9.81 * (0.06 + 0.004) * v;
    expect(powerAtWheel).toBeCloseTo(300 * 0.97, 1);
  });
});
