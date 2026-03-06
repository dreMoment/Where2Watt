import React, { useEffect, useState, useMemo } from "react";
import { ExternalLink, Ruler, Mountain, Timer, MapPin, Flag } from "lucide-react";
import type { Segment } from "@/types";
import { decodePolyline } from "@/utils/polyline";
import { fetchMySegmentReportStatus, reportSegmentBlocked, reportSegmentUnblocked } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";
import { useUiFeedback } from "@/components/ui/UiFeedbackProvider";
import { createIntervalProfile, estimateSegmentDurationSeconds, formatDuration } from "@/utils/intervals";

interface Props {
    segment: Segment;
    riderPower?: string;
    riderWeight?: string;
    bikeWeight?: string;
    clickedCoordinate?: [number, number] | null;
    onSegmentBlocked?: (segmentId: string, report: { blocked: boolean }) => void;
}

const REPORT_NOTE_MAX_LENGTH = 500;

export default function SegmentCard({ segment, riderPower = "250", riderWeight = "75", bikeWeight = "9", clickedCoordinate = null, onSegmentBlocked }: Props) {
    const { isLoggedIn, token, login } = useAuth();
    const { showToast } = useUiFeedback();
    const profile = useMemo(
        () => createIntervalProfile(riderPower, riderWeight, bikeWeight),
        [riderPower, riderWeight, bikeWeight]
    );

    const estimatedTime = useMemo(() => {
        if (!profile) return null;
        return estimateSegmentDurationSeconds(segment, profile);
    }, [profile, segment]);

    const [showStreetView, setShowStreetView] = useState(false);

    const startCoordinates = useMemo(() => {
        if (!segment.polyline) return null;
        const coords = decodePolyline(segment.polyline);
        if (coords.length === 0) return null;
        return coords[0]; // [longitude, latitude]
    }, [segment.polyline]);

    const effectiveCoordinates = clickedCoordinate || startCoordinates;

    const [showReportForm, setShowReportForm] = useState(false);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [reportNote, setReportNote] = useState("");
    const [isReporting, setIsReporting] = useState(false);
    const [hasReportedCurrentState, setHasReportedCurrentState] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function loadReportStatus() {
            if (!isLoggedIn || !token || !segment.id) {
                setHasReportedCurrentState(false);
                return;
            }
            try {
                const status = await fetchMySegmentReportStatus(segment.id, token);
                if (!cancelled) {
                    setHasReportedCurrentState(status.has_reported);
                }
            } catch {
                if (!cancelled) {
                    setHasReportedCurrentState(false);
                }
            }
        }
        loadReportStatus();
        return () => {
            cancelled = true;
        };
    }, [isLoggedIn, token, segment.id, segment.blocked]);

    const handleReport = async () => {
        if (!segment.id) return;
        try {
            setIsReporting(true);
            const note = reportNote.trim() || undefined;
            const report = segment.blocked
                ? await reportSegmentUnblocked(segment.id, token!, note)
                : await reportSegmentBlocked(segment.id, token!, note);
            onSegmentBlocked?.(segment.id, {
                blocked: report.blocked,
            });
            setHasReportedCurrentState(true);
            setShowReportForm(false);
            setReportNote("");
            showToast(
                    "Thanks! Your report has been submitted and will be reviewed shortly.",
                { type: "info" }
            );
        } catch {
            showToast("Failed to report segment. Please try again.", { type: "error" });
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
                    </div>
                </div>
            )}
            <div className="flex items-start justify-between border-b border-neutral-100/80 pb-3">
                <h3 className="font-bold text-lg text-neutral-800 leading-tight pr-2">
                    {segment.name}
                </h3>
                <button
                    onClick={() => {
                        if (isLoggedIn) {
                            if (hasReportedCurrentState) {
                                showToast(
                                    segment.blocked
                                        ? "You already reported this segment as unblocked."
                                        : "You already reported this segment as blocked.",
                                    { type: "info" }
                                );
                                return;
                            }
                            setShowReportForm(!showReportForm);
                        } else {
                            setShowLoginPrompt(true);
                        }
                    }}
                    title={segment.blocked ? "Report as unblocked/free" : "Report as blocked"}
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                        hasReportedCurrentState
                            ? segment.blocked
                                ? "text-white bg-green-500 hover:bg-green-600"
                                : "text-white bg-red-500 hover:bg-red-600"
                            : segment.blocked
                                ? "text-white bg-green-500 hover:bg-green-600"
                                : "text-neutral-400 hover:text-red-500 hover:bg-red-50"
                    }`}
                >
                    <Flag className={`w-4 h-4 ${hasReportedCurrentState || segment.blocked ? "fill-current" : ""}`} />
                </button>
            </div>

            {showLoginPrompt && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-1">
                        <span className="text-blue-800 font-semibold text-xs">Login Required</span>
                        <p className="text-blue-700 text-[11px] leading-relaxed">
                            You need to log in with Strava to report blocked or free segments and help the community.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => login()}
                            className="flex-1 bg-[#fc4c02] hover:bg-[#e34402] text-white py-1.5 rounded-lg font-semibold text-xs transition-colors"
                        >
                            Log in with Strava
                        </button>
                        <button
                            onClick={() => setShowLoginPrompt(false)}
                            className="flex-1 bg-white border border-blue-200 hover:bg-blue-100 text-blue-600 py-1.5 rounded-lg font-semibold text-xs transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showReportForm && (
                <div className={`rounded-xl px-3.5 py-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
                    segment.blocked
                        ? "bg-green-50 border border-green-200"
                        : "bg-red-50 border border-red-200"
                }`}>
                    <span className={`font-semibold text-xs ${segment.blocked ? "text-green-800" : "text-red-800"}`}>
                        {segment.blocked ? "Report this segment as unblocked" : "Report this segment as blocked"}
                    </span>
                    <textarea
                        value={reportNote}
                        onChange={(e) => setReportNote(e.target.value)}
                        maxLength={REPORT_NOTE_MAX_LENGTH}
                        className={`w-full bg-white rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-1 min-h-16 resize-y ${
                            segment.blocked
                                ? "border border-green-300 focus:ring-green-500"
                                : "border border-red-300 focus:ring-red-500"
                        }`}
                        placeholder={segment.blocked ? "Optional note for review..." : "Optional note (e.g. expected duration or unusual block)..."}
                    />
                    <div className={`text-[11px] text-right ${segment.blocked ? "text-green-700" : "text-red-700"}`}>
                        {reportNote.length}/{REPORT_NOTE_MAX_LENGTH}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleReport}
                            disabled={isReporting}
                            className={`flex-1 text-white py-1.5 rounded-lg font-semibold text-xs transition-colors ${
                                segment.blocked
                                    ? "bg-green-500 hover:bg-green-600 disabled:bg-green-300"
                                    : "bg-red-500 hover:bg-red-600 disabled:bg-red-300"
                            }`}
                        >
                            {isReporting ? "Reporting..." : "Confirm Report"}
                        </button>
                        <button
                            onClick={() => { setShowReportForm(false); setReportNote(""); }}
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
                        {formatDuration(estimatedTime)}
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
