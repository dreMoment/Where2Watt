import React, { useEffect, useState } from "react";
import type { Segment, SegmentAverageRatings, SegmentRatingValues } from "@/types";
import { deleteMySegmentRating, fetchMySegmentRatingStatus, rateSegment } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";
import { useUiFeedback } from "@/components/ui/UiFeedbackProvider";
import LoginRequiredDialog from "@/components/LoginRequiredDialog";
import {
    DEFAULT_RATING_INPUT,
    RATING_FIELDS,
    getChoiceLabel,
    type NullableSegmentRatings,
} from "@/constants/ratings";

interface CommunityRatingsPanelProps {
    segment: Segment;
    initiallyFolded?: boolean;
    /** Render without its own card chrome, e.g. inside the mobile segment sheet. */
    embedded?: boolean;
    onSegmentRated?: (segmentId: string, rating: { ratings_count: number; average_ratings: SegmentAverageRatings }) => void;
}

function StarIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M12 2.5 14.94 8.46 21.5 9.41 16.75 14.03 17.88 20.56 12 17.47 6.12 20.56 7.25 14.03 2.5 9.41 9.06 8.46 12 2.5Z" />
        </svg>
    );
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
            <div className="flex items-center gap-0" role="group" aria-labelledby={`segment-rating-${fieldKey}-label`}>
                {[1, 2, 3, 4, 5].map((starNumber) => {
                    const starStartOutOf10 = (starNumber - 1) * 2;
                    const fillPercent = valueOutOf10 != null
                        ? Math.max(0, Math.min(100, ((valueOutOf10 - starStartOutOf10) / 2) * 100))
                        : 0;
                    const fullValue = starNumber * 2;
                    const halfValue = fullValue - 1;
                    return (
                        <button
                            key={`${fieldKey}-${starNumber}`}
                            type="button"
                            aria-label={`${label} star ${starNumber}`}
                            onClick={() => onChange(valueOutOf10 === fullValue ? halfValue : fullValue)}
                            className="flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fc4c02]"
                        >
                            <span className="relative inline-block h-7 w-7 text-neutral-200" aria-hidden="true">
                                <StarIcon className="h-7 w-7" />
                                <span
                                    className="absolute inset-y-0 left-0 overflow-hidden text-amber-500"
                                    style={{ width: `${fillPercent}%` }}
                                >
                                    <StarIcon className="h-7 w-7" />
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
            <p className="text-xs text-neutral-600">Tip: tap a star twice for a half step.</p>
        </div>
    );
}

interface RatingChoiceInputProps {
    fieldKey: keyof SegmentRatingValues;
    label: string;
    value: number | null;
    options: Array<{ value: number; label: string }>;
    onChange: (value: number) => void;
}

function RatingChoiceInput({ fieldKey, label, value, options, onChange }: RatingChoiceInputProps) {
    return (
        <div className="flex flex-col gap-2">
            <div className="text-sm">
                <span id={`segment-rating-${fieldKey}-label`} className="font-semibold text-neutral-700">
                    {label}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-labelledby={`segment-rating-${fieldKey}-label`}>
                {options.map((option) => (
                    <button
                        key={`${fieldKey}-${option.value}`}
                        type="button"
                        aria-label={`${label}: ${option.label}`}
                        onClick={() => onChange(option.value)}
                        className={`min-h-11 rounded-lg border px-2 py-2 text-center text-sm font-medium transition-colors ${
                            value === option.value
                                ? "border-[#d03d00] bg-orange-50 text-[#b93600] font-semibold"
                                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function CommunityRatingsPanel({ segment, initiallyFolded = false, embedded = false, onSegmentRated }: CommunityRatingsPanelProps) {
    const { isLoggedIn, token } = useAuth();
    const { confirm, showToast } = useUiFeedback();
    const [showRatingForm, setShowRatingForm] = useState(false);
    const [isRating, setIsRating] = useState(false);
    const [hasRated, setHasRated] = useState(false);
    const [ratingDraft, setRatingDraft] = useState<NullableSegmentRatings>({ ...DEFAULT_RATING_INPUT });
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [isFolded, setIsFolded] = useState(initiallyFolded);

    useEffect(() => {
        setIsFolded(initiallyFolded);
    }, [initiallyFolded, segment.id]);

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
                        setRatingDraft({
                            ...DEFAULT_RATING_INPUT,
                            ...status.rating,
                        });
                    } else {
                        setRatingDraft({ ...DEFAULT_RATING_INPUT });
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
            overall_quality: ratingDraft.overall_quality ?? 0,
            traffic_level: ratingDraft.traffic_level ?? 0,
            road_surface: ratingDraft.road_surface ?? 0,
            gradient_profile: ratingDraft.gradient_profile ?? 0,
            sketchy_left_turns: ratingDraft.sketchy_left_turns ?? 0,
        };
        const isUpdatingExistingRating = hasRated;

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
            showToast(isUpdatingExistingRating ? "Your rating was updated." : "Thanks! Your rating was submitted.", {
                type: "info",
            });
        } catch (err) {
            showToast("Failed to submit rating. Please try again.", { type: "error" });
        } finally {
            setIsRating(false);
        }
    };

    const handleDeleteRating = async () => {
        if (!segment.id || !token) {
            showToast("You need to log in before deleting your rating.", { type: "error" });
            return;
        }

        const shouldDelete = await confirm({
            title: "Delete your rating?",
            description: "This removes your rating from this segment.",
            confirmLabel: "Delete rating",
            cancelLabel: "Keep rating",
            tone: "danger",
        });
        if (!shouldDelete) {
            return;
        }

        try {
            setIsRating(true);
            setFormError(null);
            const result = await deleteMySegmentRating(segment.id, token);
            setHasRated(false);
            setShowRatingForm(false);
            setRatingDraft({ ...DEFAULT_RATING_INPUT });
            onSegmentRated?.(segment.id, {
                ratings_count: result.ratings_count,
                average_ratings: result.average_ratings,
            });
            showToast("Your rating was deleted.", { type: "info" });
        } catch {
            showToast("Failed to delete rating. Please try again.", { type: "error" });
        } finally {
            setIsRating(false);
        }
    };

    const ratingsCount = segment.ratings_count ?? 0;
    const averageRatings = segment.average_ratings;
    const assessmentFields = RATING_FIELDS.filter((field) => field.key !== "overall_quality");

    return (
        <>
        <div className={embedded ? "w-full" : "w-[min(94vw,380px)] rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm"}>
            <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-neutral-600">Community ratings</span>
                    {!embedded && <span className="truncate text-sm font-semibold text-neutral-800">{segment.name}</span>}
                </div>
                <button
                    type="button"
                    onClick={() => setIsFolded((prev) => !prev)}
                    aria-label={isFolded ? "Expand ratings popup" : "Fold ratings popup"}
                    title={isFolded ? "Expand ratings popup" : "Fold ratings popup"}
                    className={`${embedded ? "hidden" : "hidden sm:inline-flex"} shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100`}
                >
                    {isFolded ? "Show" : "Hide"}
                </button>
            </div>
            {!isFolded && (
                <div className="flex flex-col gap-3">
                    {!showRatingForm && ratingsCount > 0 && averageRatings ? (
                        <div data-testid="community-categories-grid" className="grid grid-cols-2 gap-2">
                            {assessmentFields.map((field) => {
                                const value = averageRatings[field.key];
                                return (
                                    <div key={field.key} className="rounded-xl bg-neutral-50 px-2.5 py-2.5 flex min-h-[4.5rem] flex-col items-center justify-center gap-1 text-center">
                                        <span className="text-xs font-semibold text-neutral-600">{field.label}</span>
                                        <span className="text-base font-semibold text-neutral-800">
                                            {typeof value === "number" ? getChoiceLabel(field.key, value) : "No data"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : !showRatingForm ? (
                        <p className="text-sm text-neutral-600">No ratings yet. Be the first to rate this segment.</p>
                    ) : null
                    }

                    {!showRatingForm && (
                        <button
                            onClick={() => {
                                if (!isLoggedIn) {
                                    setShowLoginPrompt(true);
                                    return;
                                }
                                setFormError(null);
                                if (!hasRated) {
                                    setRatingDraft({ ...DEFAULT_RATING_INPUT });
                                }
                                setShowRatingForm((prev) => !prev);
                            }}
                            className="mt-1 w-full rounded-xl bg-neutral-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                        >
                            {hasRated ? "Edit your rating" : "Rate this segment"}
                        </button>
                    )}

                    {showRatingForm && (
                        <div className="mt-1 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 gap-3">
                                {RATING_FIELDS.map((field) => {
                                    const currentValue = ratingDraft[field.key];
                                    const handleChange = (nextValue: number) => {
                                        setFormError(null);
                                        setRatingDraft((prev) => ({
                                            ...prev,
                                            [field.key]: nextValue,
                                        }));
                                    };

                                    if (field.input === "stars") {
                                        return (
                                            <RatingStarsInput
                                                key={field.key}
                                                fieldKey={field.key}
                                                label={field.label}
                                                valueOutOf10={currentValue}
                                                onChange={handleChange}
                                            />
                                        );
                                    }

                                    return (
                                        <RatingChoiceInput
                                            key={field.key}
                                            fieldKey={field.key}
                                            label={field.label}
                                            value={currentValue}
                                            options={field.options || []}
                                            onChange={handleChange}
                                        />
                                    );
                                })}
                            </div>
                            {formError ? (
                                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                    {formError}
                                </div>
                            ) : null}
                            <div className="flex gap-2 mt-1">
                                <button
                                    onClick={handleRate}
                                    disabled={isRating}
                                    className="flex-1 bg-[#d03d00] hover:bg-[#b93600] disabled:bg-orange-300 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
                                >
                                    {isRating ? "Submitting..." : hasRated ? "Update Rating" : "Submit Rating"}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowRatingForm(false);
                                        setFormError(null);
                                    }}
                                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                            {hasRated ? (
                                <button
                                    onClick={handleDeleteRating}
                                    disabled={isRating}
                                    className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-70"
                                >
                                    {isRating ? "Working..." : "Delete My Rating"}
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>
            )}
        </div>
        {showLoginPrompt && (
            <LoginRequiredDialog action="rate segments" onClose={() => setShowLoginPrompt(false)} />
        )}
        </>
    );
}
