import { ExternalLink, Ruler, Mountain } from "lucide-react";
import type { Segment } from "@/types";

interface Props {
    segment: Segment;
}

export default function SegmentCard({ segment }: Props) {
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
                <p className="text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">
                    Target Times
                </p>
                <div className="flex justify-between text-sm">
                    <div className="flex flex-col items-center">
                        <span className="text-emerald-600 font-medium">{segment.completion_times?.beginner ?? "N/A"}</span>
                        <span className="text-[10px] text-neutral-400">Beg</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-amber-500 font-medium">{segment.completion_times?.intermediate ?? "N/A"}</span>
                        <span className="text-[10px] text-neutral-400">Int</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-rose-600 font-medium">{segment.completion_times?.advanced ?? "N/A"}</span>
                        <span className="text-[10px] text-neutral-400">Adv</span>
                    </div>
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
