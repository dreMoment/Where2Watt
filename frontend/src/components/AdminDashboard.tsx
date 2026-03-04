"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchUnapprovedSegments, fetchAllSegments, deleteSegment, approveSegment, blockSegment, unblockSegment } from "@/utils/api";
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

type Tab = "pending" | "all";

interface AdminDashboardProps {
    password: string;
    onLogout: () => void;
}

export default function AdminDashboard({ password, onLogout }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState<Tab>("pending");

    // Pending tab state
    const [pendingSegments, setPendingSegments] = useState<Segment[]>([]);
    const [pendingLoading, setPendingLoading] = useState(true);
    const [pendingError, setPendingError] = useState("");

    // All segments tab state
    const [allSegments, setAllSegments] = useState<Segment[]>([]);
    const [allLoading, setAllLoading] = useState(false);
    const [allError, setAllError] = useState("");
    const [allLoaded, setAllLoaded] = useState(false);

    const loadPendingSegments = useCallback(async () => {
        try {
            setPendingLoading(true);
            const data = await fetchUnapprovedSegments(password);
            setPendingSegments(data);
            setPendingError("");
        } catch (err: any) {
            setPendingError(err.message || "Failed to load segments");
        } finally {
            setPendingLoading(false);
        }
    }, [password]);

    const loadAllSegments = useCallback(async () => {
        try {
            setAllLoading(true);
            const data = await fetchAllSegments(password);
            setAllSegments(data);
            setAllError("");
            setAllLoaded(true);
        } catch (err: any) {
            setAllError(err.message || "Failed to load segments");
        } finally {
            setAllLoading(false);
        }
    }, [password]);

    useEffect(() => {
        loadPendingSegments();
    }, [loadPendingSegments]);

    useEffect(() => {
        if (activeTab === "all" && !allLoaded) {
            loadAllSegments();
        }
    }, [activeTab, allLoaded, loadAllSegments]);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;

        try {
            await deleteSegment(id, password);
            setPendingSegments((prev) => prev.filter((s) => s.id !== id));
            setAllSegments((prev) => prev.filter((s) => s.id !== id));
        } catch (err: any) {
            alert(err.message || "Failed to delete segment");
            if (err.message && err.message.toLowerCase().includes("unauthorized")) {
                onLogout();
            }
        }
    };

    const handleApprove = async (id: string, name: string) => {
        try {
            await approveSegment(id, password);
            setPendingSegments((prev) => prev.filter((s) => s.id !== id));
            setAllSegments((prev) =>
                prev.map((s) => (s.id === id ? { ...s, approved: true } : s))
            );
        } catch (err: any) {
            alert(err.message || "Failed to approve segment");
            if (err.message && err.message.toLowerCase().includes("unauthorized")) {
                onLogout();
            }
        }
    };

    const handleRefresh = () => {
        if (activeTab === "pending") {
            loadPendingSegments();
        } else {
            loadAllSegments();
        }
    };

    const currentLoading = activeTab === "pending" ? pendingLoading : allLoading;
    const currentError = activeTab === "pending" ? pendingError : allError;
    const currentSegments = activeTab === "pending" ? pendingSegments : allSegments;

    // Quick Add state
    const [quickAddUrl, setQuickAddUrl] = useState("");
    const [isQuickAdding, setIsQuickAdding] = useState(false);
    const [quickAddMessage, setQuickAddMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    // Block segment state
    const [blockingSegmentId, setBlockingSegmentId] = useState<string | null>(null);
    const [blockUntilDate, setBlockUntilDate] = useState("");

    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickAddUrl.trim()) return;

        try {
            setIsQuickAdding(true);
            setQuickAddMessage(null);
            const newSegment = await import("@/utils/api").then(m => m.quickAddSegment(quickAddUrl, password));

            setQuickAddMessage({ text: `Successfully added and approved "${newSegment.name}"`, type: "success" });
            setQuickAddUrl("");

            // Refresh lists
            loadPendingSegments();
            loadAllSegments();
        } catch (err: any) {
            setQuickAddMessage({ text: err.message || "Failed to add segment", type: "error" });
        } finally {
            setIsQuickAdding(false);
        }
    };

    const handleBlock = async (id: string) => {
        try {
            const blockedUntil = blockUntilDate ? new Date(blockUntilDate).toISOString() : undefined;
            await blockSegment(id, password, blockedUntil);
            const updateSegment = (s: Segment) =>
                s.id === id ? { ...s, blocked: true, blocked_until: blockedUntil || undefined } : s;
            setPendingSegments((prev) => prev.map(updateSegment));
            setAllSegments((prev) => prev.map(updateSegment));
            setBlockingSegmentId(null);
            setBlockUntilDate("");
        } catch (err: any) {
            alert(err.message || "Failed to block segment");
        }
    };

    const handleUnblock = async (id: string) => {
        try {
            await unblockSegment(id, password);
            const updateSegment = (s: Segment) =>
                s.id === id ? { ...s, blocked: false, blocked_until: undefined } : s;
            setPendingSegments((prev) => prev.map(updateSegment));
            setAllSegments((prev) => prev.map(updateSegment));
        } catch (err: any) {
            alert(err.message || "Failed to unblock segment");
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
                {/* Quick Add Section */}
                <div className="mb-8 bg-gray-900/50 rounded-2xl border border-gray-800 p-6 shadow-xl backdrop-blur-sm">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>
                        Strava Quick Add
                    </h2>
                    <form onSubmit={handleQuickAdd} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={quickAddUrl}
                                onChange={(e) => setQuickAddUrl(e.target.value)}
                                placeholder="https://www.strava.com/segments/..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-gray-500"
                                disabled={isQuickAdding}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isQuickAdding || !quickAddUrl.trim()}
                            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 min-w-[140px]"
                        >
                            {isQuickAdding ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Add Segment
                                </>
                            )}
                        </button>
                    </form>
                    {quickAddMessage && (
                        <div className={`mt-4 p-3 rounded-xl text-sm font-medium border animate-in fade-in slide-in-from-top-2 duration-300 ${quickAddMessage.type === "success"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}>
                            {quickAddMessage.text}
                        </div>
                    )}
                </div>

                <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl backdrop-blur-sm">
                    {/* Tab Bar + Refresh */}
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
                        <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1">
                            <button
                                onClick={() => setActiveTab("pending")}
                                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "pending"
                                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                                    }`}
                            >
                                Pending Approvals
                                {pendingSegments.length > 0 && (
                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                                        {pendingSegments.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab("all")}
                                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === "all"
                                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                                    }`}
                            >
                                All Segments
                                {allLoaded && (
                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-600/40 text-gray-300 text-xs font-bold">
                                        {allSegments.length}
                                    </span>
                                )}
                            </button>
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-gray-700"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Refresh
                        </button>
                    </div>

                    {/* Content */}
                    {currentLoading ? (
                        <div className="p-16 flex flex-col items-center justify-center">
                            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-400 font-medium">Loading segments...</p>
                        </div>
                    ) : currentError ? (
                        <div className="p-16 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4">
                                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <p className="text-red-400 font-medium mb-2">Error loading segments</p>
                            <p className="text-sm text-gray-500">{currentError}</p>
                        </div>
                    ) : currentSegments.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">
                                {activeTab === "pending" ? "No pending segments" : "No segments found"}
                            </h3>
                            <p className="text-gray-400">
                                {activeTab === "pending"
                                    ? "All segments have been reviewed. Check back later for new submissions."
                                    : "There are currently no segments in the database."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="bg-gray-900 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                                        <th className="p-5 pl-6">Segment Name</th>
                                        <th className="p-5">Distance</th>
                                        <th className="p-5">Gradient</th>
                                        {activeTab === "all" && <th className="p-5">Status</th>}
                                        <th className="p-5">Strava ID</th>
                                        {activeTab === "all" && <th className="p-5">Created</th>}
                                        <th className="p-5 pr-6 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {currentSegments.map((segment) => (
                                        <tr key={segment.id} className="hover:bg-gray-800/50 transition-colors group">
                                            <td className="p-5 pl-6">
                                                <div className="font-medium text-white">{segment.name || "Unnamed Segment"}</div>
                                                <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                                                    <span>ID: {segment.id}</span>
                                                    {activeTab === "pending" && segment.created_at && (
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
                                            {activeTab === "all" && (
                                                <td className="p-5">
                                                    <div className="flex flex-col gap-1.5">
                                                        {segment.approved ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                                Approved
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                                Pending
                                                            </span>
                                                        )}
                                                        {segment.blocked && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold border border-red-500/20">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                                Blocked
                                                                {segment.blocked_until && (
                                                                    <span className="text-red-400/70 font-normal ml-1">
                                                                        until {new Date(segment.blocked_until).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
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
                                            {activeTab === "all" && (
                                                <td className="p-5 text-sm text-gray-400">
                                                    {segment.created_at ? timeAgo(segment.created_at) : "—"}
                                                </td>
                                            )}
                                            <td className="p-5 pr-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {segment.blocked ? (
                                                        <button
                                                            onClick={() => segment.id && handleUnblock(segment.id)}
                                                            className="inline-flex items-center px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                                                        >
                                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                                            Unblock
                                                        </button>
                                                    ) : (
                                                        <>
                                                            {blockingSegmentId === segment.id ? (
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="date"
                                                                        value={blockUntilDate}
                                                                        onChange={(e) => setBlockUntilDate(e.target.value)}
                                                                        className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                                                                        placeholder="Until (optional)"
                                                                    />
                                                                    <button
                                                                        onClick={() => segment.id && handleBlock(segment.id)}
                                                                        className="inline-flex items-center px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold transition-all hover:bg-red-600"
                                                                    >
                                                                        Confirm
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setBlockingSegmentId(null); setBlockUntilDate(""); }}
                                                                        className="inline-flex items-center px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-xs font-semibold transition-all hover:bg-gray-600"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { setBlockingSegmentId(segment.id || null); setBlockUntilDate(""); }}
                                                                    className="inline-flex items-center px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                                                                >
                                                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                                    Block
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => segment.id && handleDelete(segment.id, segment.name || segment.strava_id || segment.id || "Unknown Segment")}
                                                        className="inline-flex items-center px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                                                    >
                                                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        Delete
                                                    </button>
                                                    {activeTab === "pending" && (
                                                        <button
                                                            onClick={() => segment.id && handleApprove(segment.id, segment.name || segment.strava_id || segment.id || "Unknown Segment")}
                                                            className="inline-flex items-center px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg text-sm font-semibold transition-all shadow-sm focus:opacity-100"
                                                        >
                                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                            Approve
                                                        </button>
                                                    )}
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
