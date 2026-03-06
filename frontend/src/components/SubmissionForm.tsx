"use client";

import { useState } from "react";
import { X, Send, Loader2, LogIn, MapPin } from "lucide-react";
import { submitSegment, type SubmissionData } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";
import { useUiFeedback } from "@/components/ui/UiFeedbackProvider";

interface Props {
    onClose: () => void;
}

export default function SubmissionForm({ onClose }: Props) {
    const { isLoggedIn, login, token } = useAuth();
    const { showToast } = useUiFeedback();
    const [formData, setFormData] = useState<SubmissionData>({
        strava_url: "",
        safety_notes: "",
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [alreadyExists, setAlreadyExists] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.strava_url.includes("strava.com/segments/")) {
            showToast("Please enter a valid Strava segment URL", { type: "error" });
            return;
        }

        if (!token) {
            showToast("You must be logged in to submit a segment.", { type: "error" });
            return;
        }

        setLoading(true);

        try {
            await submitSegment(formData, token);
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            console.error(err);
            if (err instanceof Error && err.message === "Segment already exists") {
                setAlreadyExists(true);
            } else if (err instanceof Error) {
                showToast(err.message, { type: "error" });
            } else {
                showToast("Error submitting segment. Check backend is running.", { type: "error" });
            }
        } finally {
            setLoading(false);
        }
    };

    if (alreadyExists) {
        return (
            <div className="relative bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border border-blue-100/50 transform transition-all animate-in fade-in zoom-in duration-300">
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
                    This segment is already in our database — it may be live on the map or currently under review and appearing soon.
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

    // Not logged in — show login prompt
    if (!isLoggedIn) {
        return (
            <div className="bg-white/95 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl w-full max-w-md relative border border-white/50 transform transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
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
