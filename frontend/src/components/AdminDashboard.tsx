"use client";

import { useState, useEffect } from "react";
import { fetchUnapprovedSegments, deleteSegment, approveSegment } from "@/utils/api";
import type { Segment } from "@/types";

function timeAgo(dateString?: string): string {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
}

interface AdminDashboardProps {
    password: string;
    onLogout: () => void;
}

export default function AdminDashboard({ password, onLogout }: AdminDashboardProps) {
    const [segments, setSegments] = useState<Segment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadSegments = async () => {
        try {
            setLoading(true);
            const data = await fetchUnapprovedSegments(password);
            setSegments(data);
            setError("");
        } catch (err: any) {
            setError(err.message || "Failed to load segments");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSegments();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to reject and delete "${name}"?`)) return;

        try {
            await deleteSegment(id, password);
            setSegments((prev) => prev.filter((s) => s.id !== id));
        } catch (err: any) {
            alert(err.message || "Failed to reject segment");
            if (err.message && err.message.toLowerCase().includes("unauthorized")) {
                onLogout();
            }
        }
    };

    const handleApprove = async (id: string, name: string) => {
        try {
            await approveSegment(id, password);
            setSegments((prev) => prev.filter((s) => s.id !== id));
        } catch (err: any) {
            alert(err.message || "Failed to approve segment");
            if (err.message && err.message.toLowerCase().includes("unauthorized")) {
                onLogout();
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Admin Dashboard</h1>
                    </div>
                    <div className="flex gap-4">
                        <a href="/" className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-semibold transition-all border border-gray-700 hover:border-gray-600 shadow-sm">
                            View App
                        </a>
                        <button
                            onClick={onLogout}
                            className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-xl text-sm font-semibold transition-all shadow-sm"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl backdrop-blur-sm">
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
                            <p className="text-sm text-gray-400 mt-1">Review and approve new segments submitted by users</p>
                        </div>
                        <button
                            onClick={loadSegments}
                            className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-gray-700"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-16 flex flex-col items-center justify-center">
                            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-400 font-medium">Loading segments...</p>
                        </div>
                    ) : error ? (
                        <div className="p-16 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4">
                                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <p className="text-red-400 font-medium mb-2">Error loading segments</p>
                            <p className="text-sm text-gray-500">{error}</p>
                        </div>
                    ) : segments.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No segments found</h3>
                            <p className="text-gray-400">There are currently no segments in the database.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                                        <th className="p-5 pl-6">Segment Name</th>
                                        <th className="p-5">Distance</th>
                                        <th className="p-5">Gradient</th>
                                        <th className="p-5">Strava ID</th>
                                        <th className="p-5 pr-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {segments.map((segment) => (
                                        <tr key={segment.id} className="hover:bg-gray-800/50 transition-colors group">
                                            <td className="p-5 pl-6">
                                                <div className="font-medium text-white">{segment.name || "Unnamed Segment"}</div>
                                                <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                                                    <span>ID: {segment.id}</span>
                                                    {segment.created_at && (
                                                        <span className="text-gray-400">Added: {timeAgo(segment.created_at)}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="inline-flex items-center px-2.5 py-1 rounded bg-gray-800 text-blue-400 font-medium text-sm">
                                                    {segment.distance_km} km
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="inline-flex items-center px-2.5 py-1 rounded bg-gray-800 text-emerald-400 font-medium text-sm">
                                                    {segment.gradient_pct}%
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                {segment.strava_id ? (
                                                    <a
                                                        href={`https://www.strava.com/segments/${segment.strava_id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-gray-400 hover:text-orange-400 flex items-center gap-1.5 transition-colors text-sm"
                                                    >
                                                        {segment.strava_id}
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-600 text-sm">N/A</span>
                                                )}
                                            </td>
                                            <td className="p-5 pr-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => segment.id && handleDelete(segment.id, segment.name || segment.strava_id || segment.id || "Unknown Segment")}
                                                        className="inline-flex items-center px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                                                    >
                                                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => segment.id && handleApprove(segment.id, segment.name || segment.strava_id || segment.id || "Unknown Segment")}
                                                        className="inline-flex items-center px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                                                    >
                                                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        Approve
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
