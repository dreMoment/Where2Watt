"use client";

import { useState } from "react";
import { Send, Loader2, LogIn, MapPin, Info, ChevronLeft, ChevronDown, Search, Star, Eye } from "lucide-react";
import { fetchStarredStravaSegments, fetchStravaSegmentPreview, submitSegment, type SegmentSubmitResponse, type StarredStravaSegment, type SubmissionData } from "@/utils/api";
import type { Segment, SegmentRatingValues } from "@/types";
import { useAuth } from "@/components/AuthContext";
import DialogCloseButton from "@/components/ui/DialogCloseButton";
import StravaConnectButton from "@/components/StravaConnectButton";
import { DEFAULT_RATING_INPUT, RATING_FIELDS, type NullableSegmentRatings } from "@/constants/ratings";
import AdminSegmentPreviewModal from "@/components/AdminSegmentPreviewModal";

interface Props {
    onClose: () => void;
    onExistingSegmentRated?: (segmentId?: string) => Promise<void>;
}

const STRAVA_SEGMENT_OR_EFFORT_URL_PATTERN =
    /^https?:\/\/(?:www\.)?strava\.com\/(?:segments\/\d+|activities\/\d+\/segments\/\d+)(?:[/?#].*)?$/i;
const SAFETY_NOTES_MAX_LENGTH = 1_000;

function StarIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M12 2.5 14.94 8.46 21.5 9.41 16.75 14.03 17.88 20.56 12 17.47 6.12 20.56 7.25 14.03 2.5 9.41 9.06 8.46 12 2.5Z" />
        </svg>
    );
}

function StravaMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="currentColor" d="M10.3 2 4.8 13h3.3l2.2-4.4 2.2 4.4h3.3L10.3 2Z" />
            <path fill="currentColor" d="m15.8 13-1.65 3.3L12.5 13H10l4.15 8.3L18.3 13h-2.5Z" />
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
                <span id={`rating-${fieldKey}-label`} className="font-semibold text-neutral-700">
                    {label}
                </span>
            </div>
            <div className="flex items-center gap-0" role="group" aria-labelledby={`rating-${fieldKey}-label`}>
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
            <p className="text-[11px] text-neutral-500">Tip: click a star, then click it again to make it a half step.</p>
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
                <span id={`rating-${fieldKey}-label`} className="font-semibold text-neutral-700">
                    {label}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={`rating-${fieldKey}-label`}>
                {options.map((option) => (
                    <button
                        key={`${fieldKey}-${option.value}`}
                        type="button"
                        aria-label={`${label}: ${option.label}`}
                        onClick={() => onChange(option.value)}
                        className={`min-h-10 rounded-lg border px-2 py-2.5 text-center text-[13px] font-medium leading-tight transition-colors sm:text-xs ${
                            value === option.value
                                ? "border-[#d03d00] bg-orange-50 text-[#b93600] font-semibold"
                                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function SubmissionForm({ onClose, onExistingSegmentRated }: Props) {
    const { isLoggedIn, login, token } = useAuth();
    const overallRatingField = RATING_FIELDS.find((field) => field.key === "overall_quality");
    const detailRatingFields = RATING_FIELDS.filter((field) => field.key !== "overall_quality");
    const [formData, setFormData] = useState<{
        strava_url: string;
        safety_notes: string;
        ratings: NullableSegmentRatings;
    }>({
        strava_url: "",
        safety_notes: "",
        ratings: { ...DEFAULT_RATING_INPUT },
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [existingSubmission, setExistingSubmission] = useState<SegmentSubmitResponse | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [showSafetyNotes, setShowSafetyNotes] = useState(false);
    const [showStarredSegments, setShowStarredSegments] = useState(false);
    const [starredSegments, setStarredSegments] = useState<StarredStravaSegment[]>([]);
    const [starredLoading, setStarredLoading] = useState(false);
    const [starredError, setStarredError] = useState<string | null>(null);
    const [starredSearch, setStarredSearch] = useState("");
    const [previewSegment, setPreviewSegment] = useState<Segment | null>(null);
    const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const openStarredSegments = async () => {
        setShowStarredSegments(true);
        if (!token || starredSegments.length > 0) return;
        setStarredLoading(true);
        setStarredError(null);
        try {
            setStarredSegments(await fetchStarredStravaSegments(token));
        } catch (error) {
            setStarredError(error instanceof Error ? error.message : "Could not load your starred Strava segments.");
        } finally {
            setStarredLoading(false);
        }
    };

    const selectStarredSegment = (segment: StarredStravaSegment) => {
        setFormData({ ...formData, strava_url: `https://www.strava.com/segments/${segment.id}` });
        setFormError(null);
        setShowStarredSegments(false);
    };

    const previewStarredSegment = async (segment: StarredStravaSegment) => {
        if (!token) return;
        setPreviewLoadingId(segment.id);
        setPreviewError(null);
        try {
            setPreviewSegment(await fetchStravaSegmentPreview(segment.id, token));
        } catch (error) {
            setPreviewError(error instanceof Error ? error.message : "Could not load segment preview.");
        } finally {
            setPreviewLoadingId(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!STRAVA_SEGMENT_OR_EFFORT_URL_PATTERN.test(formData.strava_url.trim())) {
            setFormError("Please enter a valid Strava segment URL.");
            return;
        }

        if (!token) {
            setFormError("You must be logged in to submit a segment.");
            return;
        }

        const hasMissingRatings = RATING_FIELDS.some(({ key }) => formData.ratings[key] == null);
        if (hasMissingRatings) {
            setFormError("Please rate all required fields before submitting.");
            return;
        }

        setFormError(null);

        const payload: SubmissionData = {
            ...formData,
            ratings: {
                overall_quality: formData.ratings.overall_quality ?? 0,
                traffic_level: formData.ratings.traffic_level ?? 0,
                road_surface: formData.ratings.road_surface ?? 0,
                gradient_profile: formData.ratings.gradient_profile ?? 0,
                sketchy_left_turns: formData.ratings.sketchy_left_turns ?? 0,
            },
        };

        setLoading(true);

        try {
            const result = await submitSegment(payload, token);
            if (result.status === "existing") {
                if (onExistingSegmentRated) {
                    try {
                        await onExistingSegmentRated(result.id);
                    } catch (reloadError) {
                        console.error("Failed to refresh segment list after duplicate submission:", reloadError);
                    }
                }
                setExistingSubmission(result);
            } else {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                }, 2000);
            }
        } catch (err) {
            console.error(err);
            if (err instanceof Error) {
                setFormError(err.message);
            } else {
                setFormError("Error submitting segment. Check backend is running.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (existingSubmission) {
        const reasonMessage = existingSubmission.duplicate_reason === "under_review"
            ? "This segment is already in our database and is still under review."
            : existingSubmission.duplicate_reason === "similar_segment"
                ? "A very similar segment is already present in our database."
                : "This segment is already in our database.";
        return (
            <div className="contribution-popup relative rounded-2xl border border-blue-100/50 bg-white/90 p-5 text-center shadow-2xl backdrop-blur-xl transition-all animate-in fade-in zoom-in duration-300 sm:rounded-3xl sm:p-8">
                <DialogCloseButton onClick={onClose} />
                <div className="w-20 h-20 bg-neutral-100 text-neutral-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-neutral-200">
                    <MapPin className="w-10 h-10" />
                </div>
                <h2 id="submission-dialog-title" className="text-3xl font-bold text-neutral-900 mb-3 tracking-tight">Already Here!</h2>
                <p className="text-neutral-500 font-medium leading-relaxed">
                    {reasonMessage} Your rating has still been added.
                </p>
                <button
                    onClick={onClose}
                    className="mt-6 w-full bg-neutral-900 hover:bg-neutral-800 text-white py-3.5 rounded-xl font-bold transition-all shadow-md"
                >
                    Got it
                </button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="contribution-popup rounded-2xl bg-white p-5 text-center shadow-2xl transition-all animate-in fade-in zoom-in duration-300 sm:rounded-3xl sm:p-8">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100 relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping"></div>
                    <Send className="w-10 h-10 relative z-10" />
                </div>
                <h2 id="submission-dialog-title" className="text-3xl font-bold text-neutral-900 mb-3 tracking-tight">Submitted!</h2>
                <p className="text-neutral-500 font-medium leading-relaxed">
                    Thanks for contributing! Your segment is now pending review.
                </p>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="contribution-popup relative rounded-2xl bg-white p-5 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 sm:rounded-3xl sm:p-8">
                <DialogCloseButton onClick={onClose} />

                <div className="text-center py-4">
                    <div className="w-20 h-20 bg-orange-50 text-[#d03d00] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-orange-100">
                        <LogIn className="w-10 h-10" />
                    </div>
                    <h2 id="submission-dialog-title" className="text-2xl font-bold text-neutral-900 mb-2 tracking-tight">Login Required</h2>
                    <p className="text-sm text-neutral-500 font-medium mb-6">
                        You need to log in with Strava to submit segments.
                    </p>
                    <StravaConnectButton onClick={login} className="w-full" imageClassName="w-[260px]" />
                </div>
            </div>
        );
    }

    if (showStarredSegments) {
        const query = starredSearch.trim().toLocaleLowerCase();
        const filteredSegments = query
            ? starredSegments.filter((segment) => segment.name.toLocaleLowerCase().includes(query))
            : starredSegments;

        return (<>
            <div className="contribution-popup relative flex min-h-0 flex-col rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8">
                <DialogCloseButton onClick={onClose} />
                <button type="button" onClick={() => setShowStarredSegments(false)} className="mb-4 flex w-fit items-center gap-1 text-sm font-bold text-neutral-600 hover:text-neutral-900">
                    <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <div className="mb-4 pr-8">
                    <h2 id="submission-dialog-title" className="text-2xl font-bold tracking-tight text-neutral-900">Your starred segments</h2>
                    <p className="mt-1 text-sm font-medium text-neutral-500">Choose a Strava segment to add. New additions appear first.</p>
                </div>
                {!starredLoading && !starredError && starredSegments.length > 0 ? (
                    <label className="relative mb-3 block">
                        <span className="sr-only">Search starred segments</span>
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                        <input value={starredSearch} onChange={(event) => setStarredSearch(event.target.value)} placeholder="Search segments" className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-10 pr-4 text-sm text-black placeholder:text-neutral-400 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900" />
                    </label>
                ) : null}
                {previewError ? <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{previewError}</div> : null}
                <div className="contribution-popup-form min-h-0 flex-1 overflow-y-auto">
                    {starredLoading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm font-medium text-neutral-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading starred segments…</div>
                    ) : starredError ? (
                        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{starredError}</div>
                    ) : starredSegments.length === 0 ? (
                        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center"><Star className="mx-auto mb-2 h-7 w-7 text-neutral-300" /><p className="font-bold text-neutral-800">No starred segments yet</p><p className="mt-1 text-sm text-neutral-500">Star segments in Strava, then come back here.</p></div>
                    ) : filteredSegments.length === 0 ? (
                        <p className="py-8 text-center text-sm font-medium text-neutral-500">No segments match your search.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredSegments.map((segment) => (
                                <div key={segment.id} className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 text-left transition hover:border-[#fc4c02] hover:bg-orange-50">
                                    <span className="min-w-0"><span className="block truncate text-sm font-bold text-neutral-900">{segment.name}</span><span className="mt-1 block text-xs font-medium text-neutral-500">{segment.distance_km != null ? `${segment.distance_km.toFixed(2)} km` : "Distance unavailable"} · {segment.elevation_m != null ? `${segment.elevation_m} m elevation` : "Elevation unavailable"}</span></span>
                                    <span className="flex shrink-0 gap-2">
                                        <button type="button" aria-label={`Preview ${segment.name}`} onClick={() => previewStarredSegment(segment)} disabled={previewLoadingId === segment.id} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-60">
                                            {previewLoadingId === segment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Preview
                                        </button>
                                        <button type="button" aria-label={`Select ${segment.name}`} onClick={() => selectStarredSegment(segment)} className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-700">Select</button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <AdminSegmentPreviewModal segment={previewSegment} onClose={() => setPreviewSegment(null)} />
        </>);
    }

    return (
        <div className="contribution-popup relative flex flex-col rounded-2xl bg-white p-5 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 sm:rounded-3xl sm:p-8">
            <DialogCloseButton onClick={onClose} />

            <div className="mb-6 pr-8 sm:mb-8 sm:pr-10">
                <h2 id="submission-dialog-title" className="text-2xl font-bold text-neutral-900 mb-2 tracking-tight">Add a Segment</h2>
                <p className="text-sm leading-relaxed text-neutral-500 font-medium">
                    Know a great quiet road for intervals? Share it with the community.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0">
                <div className="contribution-popup-form flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5 sm:gap-2 sm:pr-1">
                    <div className="group">
                        <label htmlFor="strava_url" className="block text-xs font-bold text-neutral-600 uppercase tracking-widest mb-2 group-focus-within:text-neutral-900 transition-colors">
                            Strava Segment URL
                        </label>
                        <div className="flex items-stretch gap-2">
                            <input
                                id="strava_url"
                                type="url"
                                required
                                placeholder="https://www.strava.com/segments/12345"
                                className="min-w-0 flex-1 px-4 py-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition-all text-neutral-900 font-medium placeholder:text-neutral-400 placeholder:font-normal shadow-sm"
                                value={formData.strava_url}
                                onChange={(e) => {
                                    setFormError(null);
                                    setFormData({ ...formData, strava_url: e.target.value });
                                }}
                            />
                            <button
                                type="button"
                                onClick={openStarredSegments}
                                aria-label="Choose from your starred Strava segments"
                                title="Choose from your starred Strava segments"
                                className="flex w-12 shrink-0 items-center justify-center rounded-xl border border-[#fc4c02]/30 bg-orange-50 text-[#b93600] shadow-sm transition hover:border-[#fc4c02] hover:bg-orange-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fc4c02]"
                            >
                                <StravaMark className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="mt-2 flex items-start gap-1.5 text-neutral-500">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <p className="text-xs leading-relaxed">
                                Segment URLs and activity segment-effort URLs are supported. Submit only uninterrupted roads (no traffic lights or major intersections).
                            </p>
                        </div>

                    </div>

                    <div className="group">
                        <button
                            type="button"
                            aria-expanded={showSafetyNotes}
                            aria-controls="safety-notes-field"
                            onClick={() => setShowSafetyNotes((visible) => !visible)}
                            className="flex items-center gap-1.5 rounded-md py-1 text-sm font-semibold text-neutral-500 transition-colors hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                        >
                            <ChevronDown
                                className={`h-4 w-4 transition-transform ${showSafetyNotes ? "rotate-180" : ""}`}
                                aria-hidden="true"
                            />
                            Add safety notes <span className="font-normal text-neutral-400">(optional)</span>
                        </button>
                        {showSafetyNotes ? (
                            <div id="safety-notes-field" className="mt-2">
                                <label htmlFor="safety_notes" className="sr-only">Safety notes (optional)</label>
                                <textarea
                                    id="safety_notes"
                                    maxLength={SAFETY_NOTES_MAX_LENGTH}
                                    rows={2}
                                    autoFocus
                                    placeholder="Traffic, surface, intersections, or other hazards"
                                    className="w-full resize-y rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm font-medium text-neutral-900 shadow-sm outline-none transition-all placeholder:font-normal placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-2 focus:ring-neutral-900"
                                    value={formData.safety_notes}
                                    onChange={(event) => {
                                        setFormError(null);
                                        const safetyNotes = event.target.value;
                                        setFormData((previous) => ({ ...previous, safety_notes: safetyNotes }));
                                    }}
                                />
                                <p className="mt-1 text-right text-[11px] text-neutral-400">
                                    {formData.safety_notes.length}/{SAFETY_NOTES_MAX_LENGTH}
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-3">
                        {overallRatingField ? (
                            <div className="rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-3">
                                <RatingStarsInput
                                    fieldKey={overallRatingField.key}
                                    label={overallRatingField.label}
                                    valueOutOf10={formData.ratings[overallRatingField.key]}
                                    onChange={(nextValue) => {
                                        setFormError(null);
                                        setFormData({
                                            ...formData,
                                            ratings: {
                                                ...formData.ratings,
                                                [overallRatingField.key]: nextValue,
                                            },
                                        });
                                    }}
                                />
                            </div>
                        ) : null}

                        <div className="rounded-lg border border-neutral-200 bg-white p-3.5 sm:p-3">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {detailRatingFields.map((field) => {
                                const value = formData.ratings[field.key];
                                const handleChange = (nextValue: number) => {
                                    setFormError(null);
                                    setFormData({
                                        ...formData,
                                        ratings: {
                                            ...formData.ratings,
                                            [field.key]: nextValue,
                                        },
                                    });
                                };

                                if (field.input === "stars") {
                                    return (
                                        <RatingStarsInput
                                            key={field.key}
                                            fieldKey={field.key}
                                            label={field.label}
                                            valueOutOf10={value}
                                            onChange={handleChange}
                                        />
                                    );
                                }

                                return (
                                    <RatingChoiceInput
                                        key={field.key}
                                        fieldKey={field.key}
                                        label={field.label}
                                        value={value}
                                        options={field.options || []}
                                        onChange={handleChange}
                                    />
                                );
                                })}
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-neutral-500">Select one option for each rating category.</p>

                </div>

                <div className="mt-3 shrink-0 pb-[max(env(safe-area-inset-bottom),0px)]">
                    {formError ? (
                        <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                            {formError}
                        </div>
                    ) : null}
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3.5 font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-neutral-800 hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 sm:py-4"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            "Submit Segment"
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
