import React, { useState, useEffect, useMemo } from "react";
import { ExternalLink, Ruler, Mountain, Timer } from "lucide-react";
import type { Segment } from "@/types";

interface Props {
    segment: Segment;
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return "--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Calculates a cyclist's steady-state velocity using the Newton-Raphson method.
 */
function calculateVelocity(power: number, gradient: number, riderWeight: number): number {
    const bikeWeight = 8;
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
        let f_v = (A * Math.pow(v, 3)) + (B * v) - C;
        let f_prime_v = (3 * A * Math.pow(v, 2)) + B;
        let next_v = v - (f_v / f_prime_v);

        if (Math.abs(next_v - v) < tolerance) {
            return next_v;
        }
        v = next_v;
    }

    return v;
}

export default function SegmentCard({ segment }: Props) {
    const [powerStr, setPowerStr] = useState("250");
    const [weightStr, setWeightStr] = useState("75");

    useEffect(() => {
        const p = localStorage.getItem("plannedPower");
        const w = localStorage.getItem("riderWeight");
        if (p) setPowerStr(p);
        if (w) setWeightStr(w);
    }, []);

    const handlePowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPowerStr(e.target.value);
        localStorage.setItem("plannedPower", e.target.value);
    };

    const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setWeightStr(e.target.value);
        localStorage.setItem("riderWeight", e.target.value);
    };

    const power = parseFloat(powerStr);
    const weight = parseFloat(weightStr);

    const estimatedTime = useMemo(() => {
        if (!power || !weight || !segment.distance_km) return null;
        const gradientDecimal = (segment.gradient_pct ?? 0) / 100;
        const velocity = calculateVelocity(power, gradientDecimal, weight);
        if (velocity <= 0) return null;

        const distanceMeters = segment.distance_km * 1000;
        return distanceMeters / velocity;
    }, [power, weight, segment.distance_km, segment.gradient_pct]);

    return (
        <div className="flex flex-col gap-3 min-w-[250px] font-sans">
            <div className="flex items-start justify-between border-b border-neutral-200 pb-2">
                <h3 className="font-bold text-lg text-neutral-900 leading-tight">
                    {segment.name}
                </h3>
                <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${segment.terrain === "Hilly"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                        }`}
                >
                    {segment.terrain}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm text-neutral-600">
                <div className="flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-neutral-400" />
                    <span>{segment.distance_km ?? 0} km</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Mountain className="w-4 h-4 text-neutral-400" />
                    <span>{segment.gradient_pct ?? 0}% avg</span>
                </div>
            </div>

            <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 mt-1">
                <div className="flex items-center gap-1.5 mb-2">
                    <Timer className="w-3.5 h-3.5 text-neutral-500" />
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Effort Estimator
                    </p>
                </div>

                <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                        <label className="text-[10px] font-medium text-neutral-500 block mb-1">Power (W)</label>
                        <input
                            type="number"
                            min="0"
                            value={powerStr}
                            onChange={handlePowerChange}
                            className="w-full text-sm p-1.5 border border-neutral-200 rounded-md focus:outline-none focus:border-[#fc4c02] focus:ring-1 focus:ring-[#fc4c02] transition-shadow bg-white"
                            placeholder="e.g. 250"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-medium text-neutral-500 block mb-1">Weight (kg)</label>
                        <input
                            type="number"
                            min="0"
                            value={weightStr}
                            onChange={handleWeightChange}
                            className="w-full text-sm p-1.5 border border-neutral-200 rounded-md focus:outline-none focus:border-[#fc4c02] focus:ring-1 focus:ring-[#fc4c02] transition-shadow bg-white"
                            placeholder="e.g. 75"
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center text-sm pt-2 border-t border-neutral-200/60">
                    <span className="text-neutral-600 font-medium text-xs">Estimated Time:</span>
                    <span className="text-[#fc4c02] font-semibold text-base">
                        {estimatedTime ? formatTime(estimatedTime) : "--:--"}
                    </span>
                </div>
            </div>

            <a
                href={segment.strava_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center justify-center gap-1.5 w-full bg-[#fc4c02] hover:bg-[#e34402] text-white py-2 rounded-lg font-medium text-sm transition-colors"
            >
                View on Strava
                <ExternalLink className="w-4 h-4" />
            </a>
        </div>
    );
}
