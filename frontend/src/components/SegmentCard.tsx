import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Ruler, Mountain, Timer, MapPin, TriangleAlert, CheckCircle2, X } from "lucide-react";
import type { Segment } from "@/types";
import { decodePolyline } from "@/utils/polyline";
import {
    fetchMySegmentReportStatus,
    reportSegmentBlocked,
    reportSegmentUnblocked,
} from "@/utils/api";
import { useAuth } from "@/components/AuthContext";
import { useUiFeedback } from "@/components/ui/UiFeedbackProvider";
import { createIntervalProfile, estimateSegmentDurationSeconds, formatDuration } from "@/utils/intervals";
import SegmentElevationProfile, { type ElevationProfilePoint } from "./SegmentElevationProfile";
import LoginRequiredDialog from "@/components/LoginRequiredDialog";

interface Props {
    segment: Segment;
    riderPower?: string;
    riderWeight?: string;
    bikeWeight?: string;
    clickedCoordinate?: [number, number] | null;
    onSegmentBlocked?: (segmentId: string, report: { blocked: boolean }) => void;
    elevationProfile?: ElevationProfilePoint[] | null;
    isElevationProfileLoading?: boolean;
    showElevationProfile?: boolean;
    showReportAction?: boolean;
    onClose?: () => void;
    /** Keep the title row visible while the surrounding panel scrolls. */
    stickyHeader?: boolean;
    compact?: boolean;
}

const REPORT_NOTE_MAX_LENGTH = 500;

function roundToNearestHalfStar(valueOutOf5: number): number {
    const clamped = Math.max(0, Math.min(5, valueOutOf5));
    return Math.round(clamped * 2) / 2;
}

function StarIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M12 2.5 14.94 8.46 21.5 9.41 16.75 14.03 17.88 20.56 12 17.47 6.12 20.56 7.25 14.03 2.5 9.41 9.06 8.46 12 2.5Z" />
        </svg>
    );
}

function StarRow({ colorClassName }: { colorClassName: string }) {
    return (
        <span className={`inline-flex items-center gap-0 ${colorClassName}`}>
            {[0, 1, 2, 3, 4].map((idx) => (
                <StarIcon key={idx} className="h-3.5 w-3.5" />
            ))}
        </span>
    );
}

function StarPreview({ valueOutOf5, label }: { valueOutOf5: number; label: string }) {
    const roundedStarsOutOf5 = roundToNearestHalfStar(valueOutOf5);
    const widthPercent = (roundedStarsOutOf5 / 5) * 100;

    return (
        <span
            className="inline-flex items-center leading-none"
            role="img"
            aria-label={`${label}: ${roundedStarsOutOf5} out of 5 stars`}
        >
            <span className="relative inline-block align-middle leading-none" aria-hidden="true">
                <StarRow colorClassName="text-neutral-200" />
                <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${widthPercent}%` }}>
                    <StarRow colorClassName="text-amber-500" />
                </span>
            </span>
        </span>
    );
}

export default function SegmentCard({
    segment,
    riderPower = "250",
    riderWeight = "75",
    bikeWeight = "9",
    clickedCoordinate = null,
    onSegmentBlocked,
    elevationProfile = null,
    isElevationProfileLoading = false,
    showElevationProfile = true,
    showReportAction = true,
    onClose,
    stickyHeader = false,
    compact = false,
}: Props) {
    const { isLoggedIn, token } = useAuth();
    const { showToast } = useUiFeedback();
    const profile = useMemo(
        () => createIntervalProfile(riderPower, riderWeight, bikeWeight),
        [riderPower, riderWeight, bikeWeight]
    );

    const estimatedTime = useMemo(() => {
        if (!profile) return null;
        return estimateSegmentDurationSeconds(segment, profile);
    }, [profile, segment]);

    const ratingsCount = segment.ratings_count ?? 0;
    const overallQualityAverage = segment.average_ratings?.overall_quality;

    const [showStreetView, setShowStreetView] = useState(false);

    const startCoordinates = useMemo(() => {
        if (!segment.polyline) return null;
        const coords = decodePolyline(segment.polyline);
        if (coords.length === 0) return null;
        return coords[0];
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
            if (!showReportAction || !isLoggedIn || !token || !segment.id) {
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
    }, [showReportAction, isLoggedIn, token, segment.id, segment.blocked]);

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
        <div className={`flex min-w-[280px] flex-col ${compact ? "gap-2.5" : "gap-4"}`}>
            <div className={`flex items-start justify-between gap-2 border-b border-neutral-100 ${compact ? "pb-2" : "pb-3"} ${stickyHeader ? "sticky top-0 z-10 bg-white pt-1 shadow-[0_0_0_1.25rem_#fff] [clip-path:inset(-1.25rem_-1.25rem_0_-1.25rem)]" : ""}`}>
                <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-lg text-neutral-800 leading-tight">
                        {segment.name}
                    </h3>
                    {ratingsCount > 0 && typeof overallQualityAverage === "number" ? (
                        <div className="mt-1 flex items-center gap-2 leading-none">
                            <StarPreview valueOutOf5={overallQualityAverage / 2} label="Overall Quality" />
                            <span className="text-xs leading-none text-neutral-600 whitespace-nowrap">
                                from {ratingsCount} {ratingsCount === 1 ? "rating" : "ratings"}
                            </span>
                        </div>
                    ) : (
                        <p className="mt-1 text-xs text-neutral-600">Overall quality: no ratings yet</p>
                    )}
                </div>
                <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-1">
                    {showReportAction && <button
                        onClick={() => {
                            if (isLoggedIn) {
                                if (hasReportedCurrentState) {
                                    showToast(
                                        segment.blocked
                                            ? "You already reported this road as reopened."
                                            : "You already reported this road as closed.",
                                        { type: "info" }
                                    );
                                    return;
                                }
                                setShowReportForm(!showReportForm);
                            } else {
                                setShowLoginPrompt(true);
                            }
                        }}
                        title={segment.blocked ? "Report road as reopened" : "Report road closure"}
                        aria-label={segment.blocked ? "Report road as reopened" : "Report road closure"}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                            hasReportedCurrentState
                                ? segment.blocked
                                    ? "text-white bg-green-700 hover:bg-green-800"
                                    : "text-white bg-red-600 hover:bg-red-700"
                                : segment.blocked
                                    ? "text-white bg-green-700 hover:bg-green-800"
                                    : "bg-neutral-100 text-neutral-700 hover:text-red-700 hover:bg-red-50"
                        }`}
                    >
                        {segment.blocked ? (
                            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                        ) : (
                            <TriangleAlert className="w-5 h-5" aria-hidden="true" />
                        )}
                    </button>}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close segment details"
                            title="Close"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {segment.blocked && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                        <span className="text-red-700 font-semibold text-sm">Road reported closed</span>
                        {segment.block_message && segment.block_message.trim().length > 0 && (
                            <span className="text-red-700 text-xs leading-relaxed">{segment.block_message}</span>
                        )}
                    </div>
                </div>
            )}
            {showReportAction && showLoginPrompt && (
                <LoginRequiredDialog action="report road closures" onClose={() => setShowLoginPrompt(false)} />
            )}

            {showReportAction && showReportForm && (
                <div className={`rounded-xl px-3.5 py-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
                    segment.blocked
                        ? "bg-green-50 border border-green-200"
                        : "bg-red-50 border border-red-200"
                }`}>
                    <span className={`font-semibold text-xs ${segment.blocked ? "text-green-800" : "text-red-800"}`}>
                        {segment.blocked ? "Report road as reopened" : "Report road closure"}
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
                        placeholder={segment.blocked ? "Optional note for review..." : "Optional note (e.g. roadworks, expected duration)..."}
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

            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5 items-center justify-center p-2.5 rounded-xl bg-neutral-50">
                    <Ruler className="w-5 h-5 text-neutral-500 mb-1" aria-hidden="true" />
                    <span className="text-base font-semibold text-neutral-800">{segment.distance_km ?? 0} km</span>
                    <span className="text-xs text-neutral-600">Distance</span>
                </div>
                <div className="flex flex-col gap-0.5 items-center justify-center p-2.5 rounded-xl bg-neutral-50">
                    <Mountain className="w-5 h-5 text-neutral-500 mb-1" aria-hidden="true" />
                    <span className="text-base font-semibold text-neutral-800">{segment.gradient_pct ?? 0}%</span>
                    <span className="text-xs text-neutral-600">Avg. gradient</span>
                </div>
            </div>

            {segment.safety_notes ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Safety notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-amber-900">{segment.safety_notes}</p>
                </div>
            ) : null}

            {showElevationProfile ? (
                <SegmentElevationProfile
                    points={elevationProfile}
                    isLoading={isElevationProfileLoading}
                    elevationGainM={Math.max(0, (segment.distance_km ?? 0) * (segment.gradient_pct ?? 0) * 10)}
                    title={segment.name}
                />
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3">
                <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-neutral-600" aria-hidden="true" />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-neutral-800">Estimated time</span>
                        <span className="text-xs text-neutral-600">Based on your rider profile</span>
                    </div>
                </div>
                <span className="text-xl font-black tracking-tight text-neutral-900 tabular-nums">
                    {formatDuration(estimatedTime)}
                </span>
            </div>

            {effectiveCoordinates && (
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => setShowStreetView(!showStreetView)}
                        aria-expanded={showStreetView}
                        className="flex items-center justify-center gap-2 w-full border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                    >
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                        {showStreetView
                            ? "Hide Street View"
                            : (clickedCoordinate ? "Street View here" : "Street View at start")}
                    </button>

                    {showStreetView && (
                        <div className="w-full bg-neutral-100 rounded-xl overflow-hidden shadow-inner border border-neutral-200 border-t-0 p-1 h-48 relative">
                            <div className="w-full h-full overflow-hidden rounded-lg">
                                <iframe
                                    title={`Google Street View for ${segment.name}`}
                                    style={{
                                        border: 0,
                                        width: "150%",
                                        height: "150%",
                                        transform: "scale(0.6666)",
                                        transformOrigin: "top left"
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
                className="group relative overflow-hidden flex items-center justify-center gap-2 w-full border border-[#d03d00] bg-white text-[#b93600] hover:bg-orange-50 py-3 rounded-xl font-semibold text-sm transition-colors active:scale-[0.98]"
            >
                <span className="relative z-10 flex items-center gap-2">
                    View on Strava
                    <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
            </a>
        </div>
    );
}
