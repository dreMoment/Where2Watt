import React, { useMemo } from "react";
import { ExternalLink, Ruler, Mountain, Timer } from "lucide-react";
import type { Segment } from "@/types";
import { calculateVelocity } from "@/utils/physics";

interface Props {
    segment: Segment;
    riderPower?: string;
    riderWeight?: string;
    bikeWeight?: string;
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

export default function SegmentCard({ segment, riderPower = "250", riderWeight = "75", bikeWeight = "9" }: Props) {
    const power = parseFloat(riderPower);
    const weight = parseFloat(riderWeight);
    const bWeight = parseFloat(bikeWeight);

    const estimatedTime = useMemo(() => {
        if (!power || !weight || !segment.distance_km) return null;
        const gradientDecimal = (segment.gradient_pct ?? 0) / 100;
        const velocity = calculateVelocity(power, gradientDecimal, weight, bWeight);
        if (velocity <= 0) return null;

        const distanceMeters = segment.distance_km * 1000;
        return distanceMeters / velocity;
    }, [power, weight, segment.distance_km, segment.gradient_pct]);

    return (
        <div className="flex flex-col gap-4 min-w-[280px] font-sans">
            <div className="flex items-start justify-between border-b border-neutral-100/80 pb-3">
                <h3 className="font-bold text-lg text-neutral-800 leading-tight pr-2">
                    {segment.name}
                </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 divide-x divide-neutral-100">
                <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-neutral-50/50">
                    <Ruler className="w-5 h-5 text-neutral-400 mb-1" />
                    <span className="text-sm font-semibold text-neutral-700">{segment.distance_km ?? 0}</span>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-medium">Kilometers</span>
                </div>
                <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-neutral-50/50">
                    <Mountain className="w-5 h-5 text-neutral-400 mb-1" />
                    <span className="text-sm font-semibold text-neutral-700">{segment.gradient_pct ?? 0}%</span>
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-medium">Avg Gradient</span>
                </div>
            </div>

            <div className="bg-gradient-to-br from-neutral-50 to-neutral-100/50 p-3.5 rounded-xl border border-neutral-200/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] mt-3">
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="bg-white p-1 rounded-md shadow-sm">
                        <Timer className="w-3.5 h-3.5 text-neutral-600" />
                    </div>
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-wide">
                        Effort Estimator (based on profile)
                    </p>
                </div>

                <div className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 font-semibold text-xs uppercase tracking-wide">Estimated Time</span>
                    <span className="text-[#fc4c02] font-black text-lg tracking-tight">
                        {estimatedTime ? formatTime(estimatedTime) : "--:--"}
                    </span>
                </div>
            </div>

            <a
                href={segment.strava_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 group relative overflow-hidden flex items-center justify-center gap-2 w-full bg-[#fc4c02] hover:bg-[#e34402] text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
                <span className="relative z-10 flex items-center gap-2">
                    View on Strava
                    <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
            </a>
        </div>
    );
}
