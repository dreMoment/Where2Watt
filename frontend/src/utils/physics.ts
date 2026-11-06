/**
 * Calculates a cyclist's steady-state velocity (m/s) by solving
 * A·v³ + B·v = C for its single positive root with Newton-Raphson.
 *
 * f(v) = A·v³ + B·v − C is convex for v > 0 and negative at v = 0, so starting
 * to the right of the root (where f > 0) converges monotonically, including on
 * descents where B < 0.
 */
export function calculateVelocity(power: number, gradient: number, riderWeight: number, bikeWeight: number = 9): number {
    const m = riderWeight + bikeWeight;
    const g = 9.81;
    const Crr = 0.004;
    const rho = 1.225;
    const CdA = 0.32;
    const eta = 0.97;

    const A = 0.5 * rho * CdA;
    const B = m * g * (gradient + Crr);
    const C = power * eta;
    const f = (v: number) => A * v ** 3 + B * v - C;

    let v = 30;
    while (f(v) <= 0) v *= 2;

    const tolerance = 0.0001;
    for (let i = 0; i < 50; i++) {
        const next_v = v - f(v) / (3 * A * v ** 2 + B);
        if (Math.abs(next_v - v) < tolerance) {
            return next_v;
        }
        v = next_v;
    }

    return v;
}
