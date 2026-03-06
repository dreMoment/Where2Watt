import React, { useEffect, useState } from "react";
import type { Segment, SegmentAverageRatings, SegmentRatingValues } from "@/types";
import { fetchMySegmentRatingStatus, rateSegment } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";
import { useUiFeedback } from "@/components/ui/UiFeedbackProvider";

interface CommunityRatingsPanelProps {
    segment: Segment;
    onSegmentRated?: (segmentId: string, rating: { ratings_count: number; average_ratings: SegmentAverageRatings }) => void;
}

const RATING_FIELDS: Array<{ key: keyof SegmentRatingValues; label: string }> = [
    { key: "traffic", label: "Traffic" },
    { key: "steady_gradient", label: "Steady Gradient" },
    { key: "sketchy_left_turns", label: "Sketchy Left Turns" },
    { key: "downhills", label: "Downhills" },
];

type NullableSegmentRatings = {
    [K in keyof SegmentRatingValues]: number | null;
};

const DEFAULT_RATING_INPUT: NullableSegmentRatings = {
    traffic: null,
    steady_gradient: null,
    sketchy_left_turns: null,
    downhills: null,
};

function roundToNearestHalfStar(valueOutOf10: number): number {
    const clamped = Math.max(0, Math.min(10, valueOutOf10));
    const starsOutOf5 = clamped / 2;
    return Math.round(starsOutOf5 * 2) / 2;
}

function StarPreview({ valueOutOf10, label, fillTestId }: { valueOutOf10: number; label: string; fillTestId?: string }) {
    const roundedStarsOutOf5 = roundToNearestHalfStar(valueOutOf10);
    const widthPercent = (roundedStarsOutOf5 / 5) * 100;
    return (
        <span aria-label={`${label} average stars`}>
            <span className="relative inline-block text-sm leading-none text-neutral-200" aria-hidden="true">
                <span>★★★★★</span>
                <span
                    className="absolute left-0 top-0 overflow-hidden text-amber-500"
                    style={{ width: `${widthPercent}%` }}
                    data-testid={fillTestId}
                >
                    ★★★★★
                </span>
            </span>
        </span>
    );
}

function getStarFillPercent(valueOutOf10: number | null, starNumber: number): number {
    if (valueOutOf10 == null) return 0;
    const fullValue = starNumber * 2;
    if (valueOutOf10 >= fullValue) return 100;
    if (valueOutOf10 === fullValue - 1) return 50;
    return 0;
}

interface RatingStarsInputProps {
    fieldKey: keyof SegmentRatingValues;
    label: string;
    valueOutOf10: number | null;
    onChange: (valueOutOf10: number) => void;
}

function RatingStarsInput({ fieldKey, label, valueOutOf10, onChange }: RatingStarsInputProps) {
    return (
        <div className="flex flex-col gap-2">
            <div className="text-sm">
                <span id={`segment-rating-${fieldKey}-label`} className="font-semibold text-neutral-700">
                    {label}
                </span>
            </div>
            <div className="flex items-center gap-1" role="group" aria-labelledby={`segment-rating-${fieldKey}-label`}>
                {[1, 2, 3, 4, 5].map((starNumber) => {
                    const fullValue = starNumber * 2;
                    const fillPercent = getStarFillPercent(valueOutOf10, starNumber);
                    return (
                        <button
                            key={`${fieldKey}-${starNumber}`}
                            type="button"
                            aria-label={`${label} star ${starNumber}`}
                            onClick={() => {
                                const nextValue = valueOutOf10 === fullValue ? fullValue - 1 : fullValue;
                                onChange(nextValue);
                            }}
                            className="rounded p-0.5 transition-colors hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fc4c02]"
                        >
                            <span className="relative inline-block text-lg leading-none text-neutral-200" aria-hidden="true">
                                <span>★</span>
                                <span
                                    className="absolute left-0 top-0 overflow-hidden text-amber-500"
                                    style={{ width: `${fillPercent}%` }}
                                >
                                    ★
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function CommunityRatingsPanel({ segment, onSegmentRated }: CommunityRatingsPanelProps) {
    const { isLoggedIn, token, login } = useAuth();
    const { showToast } = useUiFeedback();
    const [showRatingForm, setShowRatingForm] = useState(false);
    const [isRating, setIsRating] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [ratingDraft, setRatingDraft] = useState<NullableSegmentRatings>(DEFAULT_RATING_INPUT);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function loadRatingStatus() {
            if (!isLoggedIn || !token || !segment.id) {
                setHasRated(false);
                setShowRatingForm(false);
                return;
            }
            try {
                const status = await fetchMySegmentRatingStatus(segment.id, token);
                if (!cancelled) {
                    setHasRated(status.has_rated);
                    if (status.rating) {
                        setRatingDraft(status.rating);
                    } else {
                        setRatingDraft(DEFAULT_RATING_INPUT);
                    }
                }
            } catch {
                if (!cancelled) setHasRated(false);
            }
        }
        loadRatingStatus();
        return () => {
            cancelled = true;
        };
    }, [isLoggedIn, token, segment.id, segment.ratings_count]);

    const handleRate = async () => {
        if (!segment.id || !token) {
            showToast("You need to log in before rating segments.", { type: "error" });
            return;
        }

        const hasMissingRatings = RATING_FIELDS.some(({ key }) => ratingDraft[key] == null);
        if (hasMissingRatings) {
            setFormError("Please rate all required fields before submitting.");
            return;
        }

        const payload: SegmentRatingValues = {
            traffic: ratingDraft.traffic ?? 0,
            steady_gradient: ratingDraft.steady_gradient ?? 0,
            sketchy_left_turns: ratingDraft.sketchy_left_turns ?? 0,
            downhills: ratingDraft.downhills ?? 0,
        };

        try {
            setIsRating(true);
            setFormError(null);
            const result = await rateSegment(segment.id, token, payload);
            setHasRated(true);
            setShowRatingForm(false);
            onSegmentRated?.(segment.id, {
                ratings_count: result.ratings_count,
                average_ratings: result.average_ratings,
            });
            showToast("Thanks! Your rating was submitted.", { type: "info" });
        } catch (err) {
            if (err instanceof Error && err.message.includes("already rated")) {
                setHasRated(true);
                setShowRatingForm(false);
                showToast("You have already rated this segment.", { type: "info" });
                return;
            }
            showToast("Failed to submit rating. Please try again.", { type: "error" });
        } finally {
            setIsRating(false);
        }
    };

    const ratingsCount = segment.ratings_count ?? 0;
    const averageRatings = segment.average_ratings;

    return (
        <div className="w-[min(92vw,340px)] rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
            <div className="mb-2 flex flex-col gap-0.5">
                <span className="text-xs font-bold uppercase tracking-wide text-neutral-600">Community Ratings</span>
                <span className="truncate text-sm font-semibold text-neutral-800">{segment.name}</span>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Scores</span>
                    <span className="text-[11px] font-semibold text-neutral-500">{ratingsCount} {ratingsCount === 1 ? "rating" : "ratings"}</span>
                </div>
                {!showRatingForm && ratingsCount > 0 && averageRatings ? (
                    <div className="grid grid-cols-2 gap-3">
                        {RATING_FIELDS.map((field) => {
                            const value = averageRatings[field.key];
                            return (
                                <div key={field.key} className="rounded-lg border border-neutral-200 bg-white/80 px-2.5 py-2 flex flex-col gap-1.5">
                                    <span className="text-[11px] font-semibold text-neutral-600">{field.label}</span>
                                    <StarPreview
                                        valueOutOf10={typeof value === "number" ? value : 0}
                                        label={field.label}
                                        fillTestId={`average-stars-fill-${field.key}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : !showRatingForm ? (
                    <p className="text-xs text-neutral-500">No ratings yet. Be the first to rate this segment.</p>
                ) : null
                }

                <button
                    onClick={() => {
                        if (!isLoggedIn) {
                            setShowLoginPrompt(true);
                            return;
                        }
                        if (hasRated) {
                            showToast("You have already rated this segment.", { type: "info" });
                            return;
                        }
                        setFormError(null);
                        setRatingDraft(DEFAULT_RATING_INPUT);
                        setShowRatingForm((prev) => !prev);
                    }}
                    className={`mt-1 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        hasRated
                            ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                            : "bg-neutral-900 text-white hover:bg-neutral-800"
                    }`}
                    disabled={hasRated}
                >
                    {hasRated ? "Already rated" : "Rate this segment"}
                </button>

                {showLoginPrompt && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
                        <p className="text-[11px] text-blue-800 mb-2">You need to log in with Strava to rate segments.</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => login()}
                                className="flex-1 bg-[#fc4c02] hover:bg-[#e34402] text-white py-1.5 rounded-lg font-semibold text-xs transition-colors"
                            >
                                Log in
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

                {showRatingForm && !hasRated && (
                    <div className="mt-1 rounded-lg border border-neutral-200 bg-white p-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-3">
                            {RATING_FIELDS.map((field) => (
                                <RatingStarsInput
                                    key={field.key}
                                    fieldKey={field.key}
                                    label={field.label}
                                    valueOutOf10={ratingDraft[field.key]}
                                    onChange={(nextValue) =>
                                        {
                                        setFormError(null);
                                        setRatingDraft((prev) => ({
                                            ...prev,
                                            [field.key]: nextValue,
                                        }));
                                        }
                                    }
                                />
                            ))}
                        </div>
                        <p className="text-[10px] text-neutral-500">Click a star once for full, click it again for half.</p>
                        {formError ? (
                            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-700">
                                {formError}
                            </div>
                        ) : null}
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={handleRate}
                                disabled={isRating}
                                className="flex-1 bg-[#fc4c02] hover:bg-[#e34402] disabled:bg-orange-300 text-white py-1.5 rounded-lg font-semibold text-xs transition-colors"
                            >
                                {isRating ? "Submitting..." : "Submit Rating"}
                            </button>
                            <button
                                onClick={() => {
                                    setShowRatingForm(false);
                                    setFormError(null);
                                }}
                                className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 py-1.5 rounded-lg font-semibold text-xs transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
