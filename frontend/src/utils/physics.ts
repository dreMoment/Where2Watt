/**
 * Calculates a cyclist's steady-state velocity using the Newton-Raphson method.
 */
export function calculateVelocity(power: number, gradient: number, riderWeight: number): number {
    const bikeWeight = 9;
    const m = riderWeight + bikeWeight;
    const g = 9.81;
    const Crr = 0.004;
    const rho = 1.225;
    const CdA = 0.32;
    const eta = 0.97;

    const A = 0.5 * rho * CdA;
    const B = m * g * (gradient + Crr);
    const C = power * eta;

    let v = 5;
    const tolerance = 0.001;
    const maxIterations = 20;

    for (let i = 0; i < maxIterations; i++) {
        const f_v = (A * Math.pow(v, 3)) + (B * v) - C;
        const f_prime_v = (3 * A * Math.pow(v, 2)) + B;
        const next_v = v - (f_v / f_prime_v);

        if (Math.abs(next_v - v) < tolerance) {
            return next_v;
        }
        v = next_v;
    }

    return v;
}
