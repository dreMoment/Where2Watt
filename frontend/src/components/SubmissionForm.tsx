"use client";

import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { submitSegment, type SubmissionData } from "@/utils/api";

interface Props {
    onClose: () => void;
}

export default function SubmissionForm({ onClose }: Props) {
    const [formData, setFormData] = useState<SubmissionData>({
        strava_url: "",
        terrain: "Flat",
        safety_notes: "",
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.strava_url.includes("strava.com/segments/")) {
            alert("Please enter a valid Strava segment URL");
            return;
        }

        setLoading(true);

        try {
            await submitSegment(formData);
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error(err);
            alert("Error submitting segment. Check backend is running.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border border-emerald-100/50 transform transition-all animate-in fade-in zoom-in duration-300">
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

    return (
        <div className="bg-white/95 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl w-full max-w-md relative border border-white/50 transform transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
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

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                        onChange={(e) =>
                            setFormData({ ...formData, strava_url: e.target.value })
                        }
                    />
                </div>

                <div className="group">
                    <label htmlFor="terrain" className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 group-focus-within:text-neutral-900 transition-colors">
                        Terrain
                    </label>
                    <div className="relative">
                        <select
                            id="terrain"
                            className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-neutral-900 outline-none text-neutral-900 font-medium shadow-sm appearance-none cursor-pointer"
                            value={formData.terrain}
                            onChange={(e) =>
                                setFormData({ ...formData, terrain: e.target.value as "Flat" | "Hilly" })
                            }
                        >
                            <option value="Flat">Flat</option>
                            <option value="Hilly">Hilly</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

                <div className="group">
                    <label htmlFor="safety_notes" className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2 group-focus-within:text-neutral-900 transition-colors">
                        Safety Notes
                    </label>
                    <textarea
                        id="safety_notes"
                        rows={3}
                        placeholder="Watch out for the blind corner at the top..."
                        className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-neutral-900 outline-none resize-none text-neutral-900 font-medium placeholder:text-neutral-400 placeholder:font-normal shadow-sm"
                        value={formData.safety_notes}
                        onChange={(e) =>
                            setFormData({ ...formData, safety_notes: e.target.value })
                        }
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="mt-4 w-full bg-neutral-900 hover:bg-neutral-800 text-white py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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
            </form>
        </div>
    );
}
