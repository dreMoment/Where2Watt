"use client";

import { useState } from "react";
import { X, Send, Loader2, LogIn, MapPin } from "lucide-react";
import { submitSegment, type SubmissionData } from "@/utils/api";
import type { SegmentRatingValues } from "@/types";
import { useAuth } from "@/components/AuthContext";

interface Props {
    onClose: () => void;
}

type NullableSegmentRatings = {
    [K in keyof SegmentRatingValues]: number | null;
};

const RATING_FIELDS: Array<{ key: keyof SegmentRatingValues; label: string }> = [
    { key: "traffic", label: "Traffic" },
    { key: "steady_gradient", label: "Steady Gradient" },
    { key: "sketchy_left_turns", label: "Sketchy Left Turns" },
    { key: "downhills", label: "Downhills" },
];

function StarIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
            <path d="M12 2.5 14.94 8.46 21.5 9.41 16.75 14.03 17.88 20.56 12 17.47 6.12 20.56 7.25 14.03 2.5 9.41 9.06 8.46 12 2.5Z" />
        </svg>
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
                <span id={`rating-${fieldKey}-label`} className="font-semibold text-neutral-700">
                    {label}
                </span>
            </div>
            <div className="flex items-center gap-0" role="group" aria-labelledby={`rating-${fieldKey}-label`}>
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
                            className="flex h-7 w-7 items-center justify-center rounded-sm transition-colors hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fc4c02]"
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
        </div>
    );
}

export default function SubmissionForm({ onClose }: Props) {
    const { isLoggedIn, login, token } = useAuth();
    const [formData, setFormData] = useState<{
        strava_url: string;
        safety_notes: string;
        ratings: NullableSegmentRatings;
    }>({
        strava_url: "",
        safety_notes: "",
        ratings: {
            traffic: null,
            steady_gradient: null,
            sketchy_left_turns: null,
            downhills: null,
        },
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [alreadyExists, setAlreadyExists] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.strava_url.includes("strava.com/segments/")) {
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
                traffic: formData.ratings.traffic ?? 0,
                steady_gradient: formData.ratings.steady_gradient ?? 0,
                sketchy_left_turns: formData.ratings.sketchy_left_turns ?? 0,
                downhills: formData.ratings.downhills ?? 0,
            },
        };

        setLoading(true);

        try {
            await submitSegment(payload, token);
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error(err);
            if (err instanceof Error && err.message === "Segment already exists") {
                setAlreadyExists(true);
            } else if (err instanceof Error) {
                setFormError(err.message);
            } else {
                setFormError("Error submitting segment. Check backend is running.");
            }
        } finally {
            setLoading(false);
        }
    };

    if (alreadyExists) {
        return (
            <div className="contribution-popup relative bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center border border-blue-100/50 transform transition-all animate-in fade-in zoom-in duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-900 bg-neutral-100/50 hover:bg-neutral-100 p-2 rounded-full transition-all"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-100">
                    <MapPin className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-black text-neutral-900 mb-3 tracking-tight">Already Here!</h2>
                <p className="text-neutral-500 font-medium leading-relaxed">
                    This segment is already in our database - it may be live on the map or currently under review and appearing soon.
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
            <div className="contribution-popup bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center border border-emerald-100/50 transform transition-all animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100 relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping"></div>
                    <Send className="w-10 h-10 relative z-10" />
                </div>
                <h2 className="text-3xl font-black text-neutral-900 mb-3 tracking-tight">Submitted!</h2>
                <p className="text-neutral-500 font-medium leading-relaxed">
                    Thanks for contributing! Your segment is now pending review.
                </p>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="contribution-popup bg-white/95 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl relative border border-white/50 transform transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-900 bg-neutral-100/50 hover:bg-neutral-100 p-2 rounded-full transition-all"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center py-4">
                    <div className="w-20 h-20 bg-orange-50 text-[#fc4c02] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-orange-100">
                        <LogIn className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-neutral-900 mb-2 tracking-tight">Login Required</h2>
                    <p className="text-sm text-neutral-500 font-medium mb-6">
                        You need to log in with Strava to submit segments.
                    </p>
                    <button
                        onClick={login}
                        className="w-full bg-[#fc4c02] hover:bg-[#e34402] text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-orange-500/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                    >
                        <LogIn className="w-5 h-5" />
                        Login with Strava
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="contribution-popup bg-white/95 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl relative border border-white/50 transform transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col">
            <button
                onClick={onClose}
                className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-900 bg-neutral-100/50 hover:bg-neutral-100 p-2 rounded-full transition-all"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="mb-8">
                <h2 className="text-2xl font-black text-neutral-900 mb-2 tracking-tight">Add a Segment</h2>
                <p className="text-sm text-neutral-500 font-medium">
                    Know a great quiet road for intervals? Share it with the community.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0">
                <div className="contribution-popup-form flex flex-1 flex-col gap-5 overflow-y-auto pr-1 min-h-0">
                    <div className="group">
                        <label htmlFor="strava_url" className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 group-focus-within:text-neutral-900 transition-colors">
                            Strava Segment URL
                        </label>
                        <input
                            id="strava_url"
                            type="url"
                            required
                            placeholder="https://www.strava.com/segments/12345"
                            className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition-all text-neutral-900 font-medium placeholder:text-neutral-400 placeholder:font-normal shadow-sm"
                            value={formData.strava_url}
                            onChange={(e) => {
                                setFormError(null);
                                setFormData({ ...formData, strava_url: e.target.value });
                            }}
                        />
                        
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 flex flex-col gap-4">
                        
                        <div className="grid grid-cols-2 gap-4">
                            {RATING_FIELDS.map((field) => {
                                const value = formData.ratings[field.key];
                                return (
                                    <RatingStarsInput
                                        key={field.key}
                                        fieldKey={field.key}
                                        label={field.label}
                                        valueOutOf10={value}
                                        onChange={(nextValue) =>
                                            {
                                                setFormError(null);
                                                setFormData({
                                                    ...formData,
                                                    ratings: {
                                                        ...formData.ratings,
                                                        [field.key]: nextValue,
                                                    },
                                                });
                                            }
                                        }
                                    />
                                );
                            })}
                        </div>
                    </div>
                    <p className="text-[14px] text-neutral-500">Click a star once for full, then click the same star again for a half-star.</p>

                </div>

                <div className="mt-3 shrink-0">
                    {formError ? (
                        <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                            {formError}
                        </div>
                    ) : null}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-neutral-900 hover:bg-neutral-800 text-white py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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
