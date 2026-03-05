import React, { useState, useMemo } from "react";
import { ExternalLink, Ruler, Mountain, Timer, MapPin, Flag } from "lucide-react";
import type { Segment } from "@/types";
import { calculateVelocity } from "@/utils/physics";
import { decodePolyline } from "@/utils/polyline";
import { reportSegmentBlocked } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";

interface Props {
    segment: Segment;
    riderPower?: string;
    riderWeight?: string;
    bikeWeight?: string;
    clickedCoordinate?: [number, number] | null;
    onSegmentBlocked?: (segmentId: string, blockedUntil?: string) => void;
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

export default function SegmentCard({ segment, riderPower = "250", riderWeight = "75", bikeWeight = "9", clickedCoordinate = null, onSegmentBlocked }: Props) {
    const { isLoggedIn, token } = useAuth();
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
    }, [power, weight, bWeight, segment.distance_km, segment.gradient_pct]);

    const [showStreetView, setShowStreetView] = useState(false);

    const startCoordinates = useMemo(() => {
        if (!segment.polyline) return null;
        const coords = decodePolyline(segment.polyline);
        if (coords.length === 0) return null;
        return coords[0]; // [longitude, latitude]
    }, [segment.polyline]);

    const effectiveCoordinates = clickedCoordinate || startCoordinates;

    const [showReportForm, setShowReportForm] = useState(false);
    const [reportUntilDate, setReportUntilDate] = useState("");
    const [isReporting, setIsReporting] = useState(false);

    const handleReport = async () => {
        if (!segment.id) return;
        try {
            setIsReporting(true);
            const blockedUntil = reportUntilDate ? new Date(reportUntilDate).toISOString() : undefined;
            await reportSegmentBlocked(segment.id, token!, blockedUntil);
            onSegmentBlocked?.(segment.id, blockedUntil);
            setShowReportForm(false);
            setReportUntilDate("");
        } catch {
            alert("Failed to report segment. Please try again.");
        } finally {
            setIsReporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 min-w-[280px] font-sans">
            {segment.blocked && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                    <span className="text-red-500 text-base leading-none mt-0.5">⚠️</span>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-red-700 font-semibold text-sm">This segment is currently blocked</span>
                        {segment.blocked_until && (
                            <span className="text-red-500 text-xs">
                                Until {new Date(segment.blocked_until).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            )}
            <div className="flex items-start justify-between border-b border-neutral-100/80 pb-3">
                <h3 className="font-bold text-lg text-neutral-800 leading-tight pr-2">
                    {segment.name}
                </h3>
                {!segment.blocked && isLoggedIn && (
                    <button
                        onClick={() => setShowReportForm(!showReportForm)}
                        title="Report as blocked"
                        className="shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <Flag className="w-4 h-4" />
                    </button>
                )}
            </div>

            {showReportForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <span className="text-amber-800 font-semibold text-xs">Report this segment as blocked</span>
                    <input
                        type="date"
                        value={reportUntilDate}
                        onChange={(e) => setReportUntilDate(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="Blocked until (optional)"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleReport}
                            disabled={isReporting}
                            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white py-1.5 rounded-lg font-semibold text-xs transition-colors"
                        >
                            {isReporting ? "Reporting..." : "Confirm Report"}
                        </button>
                        <button
                            onClick={() => { setShowReportForm(false); setReportUntilDate(""); }}
                            className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 py-1.5 rounded-lg font-semibold text-xs transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

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

            {effectiveCoordinates && (
                <div className="mt-1 flex flex-col gap-2">
                    <button
                        onClick={() => setShowStreetView(!showStreetView)}
                        className="flex items-center justify-center gap-2 w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-2 rounded-xl font-medium text-sm transition-colors"
                    >
                        <MapPin className="w-4 h-4" />
                        {showStreetView
                            ? "Hide Street View"
                            : (clickedCoordinate ? "Show Street View at Click" : "Show Start Street View")}
                    </button>

                    {showStreetView && (
                        <div className="w-full bg-neutral-100 rounded-xl overflow-hidden shadow-inner border border-neutral-200 border-t-0 p-1 h-48 relative">
                            <div className="w-full h-full overflow-hidden rounded-lg">
                                <iframe
                                    style={{
                                        border: 0,
                                        width: '150%',
                                        height: '150%',
                                        transform: 'scale(0.6666)',
                                        transformOrigin: 'top left'
                                    }}
                                    loading="lazy"
                                    allowFullScreen
                                    src={`https://maps.google.com/maps?q=&layer=c&cbll=${effectiveCoordinates[1]},${effectiveCoordinates[0]}&cbp=11,0,0,0,0&output=svembed`}
                                ></iframe>
                            </div>
                        </div>
                    )}
                </div>
            )}

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
