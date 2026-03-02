"use client";

import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";

interface Props {
    onClose: () => void;
}

type TerrainType = "Flat" | "Hilly";

interface SubmissionData {
    strava_url: string;
    terrain: TerrainType;
    surface: string;
    safety_notes: string;
    longitude?: number;
    latitude?: number;
}

export default function SubmissionForm({ onClose }: Props) {
    const [formData, setFormData] = useState<SubmissionData>({
        strava_url: "",
        terrain: "Flat",
        surface: "",
        safety_notes: "",
        longitude: undefined,
        latitude: undefined,
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
            const res = await fetch("http://localhost:8080/api/segments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                alert("Failed to submit. Check backend is running.");
            }
        } catch (err) {
            console.error(err);
            alert("Error submitting segment.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md text-center border border-emerald-100">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-2">Submitted!</h2>
                <p className="text-neutral-500">
                    Thanks for contributing. Your segment is pending admin approval.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md relative border border-neutral-100">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900 transition-colors"
            >
                <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold text-neutral-900 mb-1">Add a Segment</h2>
            <p className="text-sm text-neutral-500 mb-6">
                Know a great quiet road for intervals? Share it below.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Strava Segment URL
                    </label>
                    <input
                        type="url"
                        required
                        placeholder="https://www.strava.com/segments/12345"
                        className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition-all"
                        value={formData.strava_url}
                        onChange={(e) =>
                            setFormData({ ...formData, strava_url: e.target.value })
                        }
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                            Terrain
                        </label>
                        <select
                            className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-900 outline-none bg-white"
                            value={formData.terrain}
                            onChange={(e) =>
                                setFormData({ ...formData, terrain: e.target.value as TerrainType })
                            }
                        >
                            <option value="Flat">Flat</option>
                            <option value="Hilly">Hilly</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                            Surface Quality
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Smooth Tarmac"
                            className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-900 outline-none"
                            value={formData.surface}
                            onChange={(e) =>
                                setFormData({ ...formData, surface: e.target.value })
                            }
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                            Latitude
                        </label>
                        <input
                            type="number"
                            step="any"
                            required
                            placeholder="e.g. 51.2407"
                            className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-900 outline-none"
                            value={formData.latitude ?? ""}
                            onChange={(e) =>
                                setFormData({ ...formData, latitude: parseFloat(e.target.value) })
                            }
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                            Longitude
                        </label>
                        <input
                            type="number"
                            step="any"
                            required
                            placeholder="e.g. -0.3235"
                            className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-900 outline-none"
                            value={formData.longitude ?? ""}
                            onChange={(e) =>
                                setFormData({ ...formData, longitude: parseFloat(e.target.value) })
                            }
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Safety Notes
                    </label>
                    <textarea
                        required
                        rows={3}
                        placeholder="Watch out for the blind corner at the top..."
                        className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-neutral-900 outline-none resize-none"
                        value={formData.safety_notes}
                        onChange={(e) =>
                            setFormData({ ...formData, safety_notes: e.target.value })
                        }
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 w-full bg-neutral-900 hover:bg-neutral-800 text-white py-3 rounded-lg font-semibold transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
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
