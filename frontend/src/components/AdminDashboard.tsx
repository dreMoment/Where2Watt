"use client";

import { useState } from "react";
import Link from "next/link";
import AdminFilters from "@/components/AdminFilters";
import AdminSummary from "@/components/AdminSummary";
import SegmentsTable from "@/components/SegmentsTable";
import AdminSegmentPreviewModal from "@/components/AdminSegmentPreviewModal";
import { useAdminSegments } from "@/hooks/useAdminSegments";
import type { Segment } from "@/types";

interface AdminDashboardProps {
  token: string;
  onLogout: () => void;
}

export default function AdminDashboard({ token, onLogout }: AdminDashboardProps) {
  const [previewSegment, setPreviewSegment] = useState<Segment | null>(null);

  const {
    activeTab,
    setActiveTab,
    pendingSegments,
    allSegments,
    allLoaded,
    currentLoading,
    currentError,
    currentSegments,
    filteredSegments,
    summary,
    searchQuery,
    setSearchQuery,
    approvalFilter,
    setApprovalFilter,
    blockFilter,
    setBlockFilter,
    reportFilter,
    setReportFilter,
    resetFilters,
    quickAddUrl,
    setQuickAddUrl,
    isQuickAdding,
    quickAddMessage,
    expandedRatingsSegmentId,
    segmentRatingsById,
    segmentRatingsLoadingById,
    segmentRatingsErrorById,
    handleQuickAdd,
    handleRefresh,
    handleDelete,
    handleApprove,
    handleBlock,
    handleUnblock,
    handleToggleRatings,
    handleDeleteRating,
  } = useAdminSegments({ token, onLogout });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Admin Dashboard</h1>
          </div>
          <div className="flex gap-4">
            <Link href="/" className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-semibold transition-all border border-gray-700 hover:border-gray-600 shadow-sm">
              View App
            </Link>
            <button
              onClick={onLogout}
              className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-xl text-sm font-semibold transition-all shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 md:px-6 py-8">
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
            <div className={`mt-4 p-3 rounded-xl text-sm font-medium border animate-in fade-in slide-in-from-top-2 duration-300 ${
              quickAddMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {quickAddMessage.text}
            </div>
          )}
        </div>

        <AdminSummary summary={summary} />

        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl backdrop-blur-sm">
          <AdminFilters
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingCount={pendingSegments.length}
            allCount={allSegments.length}
            allLoaded={allLoaded}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            approvalFilter={approvalFilter}
            setApprovalFilter={setApprovalFilter}
            blockFilter={blockFilter}
            setBlockFilter={setBlockFilter}
            reportFilter={reportFilter}
            setReportFilter={setReportFilter}
            onResetFilters={resetFilters}
            onRefresh={handleRefresh}
            shownCount={filteredSegments.length}
            totalCount={currentSegments.length}
          />

          <SegmentsTable
            activeTab={activeTab}
            currentLoading={currentLoading}
            currentError={currentError}
            currentSegments={currentSegments}
            filteredSegments={filteredSegments}
            onDelete={handleDelete}
            onApprove={handleApprove}
            onBlock={handleBlock}
            onUnblock={handleUnblock}
            expandedRatingsSegmentId={expandedRatingsSegmentId}
            segmentRatingsById={segmentRatingsById}
            segmentRatingsLoadingById={segmentRatingsLoadingById}
            segmentRatingsErrorById={segmentRatingsErrorById}
            onToggleRatings={handleToggleRatings}
            onDeleteRating={handleDeleteRating}
            onPreview={setPreviewSegment}
          />
        </div>
      </main>
      <AdminSegmentPreviewModal segment={previewSegment} onClose={() => setPreviewSegment(null)} />
    </div>
  );
}
