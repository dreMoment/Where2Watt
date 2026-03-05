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
});
