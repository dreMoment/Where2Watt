import type { ApprovalFilter, BlockFilter, ReportFilter, Tab } from "@/hooks/useAdminSegments";

interface AdminFiltersProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  pendingCount: number;
  allCount: number;
  allLoaded: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  approvalFilter: ApprovalFilter;
  setApprovalFilter: (value: ApprovalFilter) => void;
  blockFilter: BlockFilter;
  setBlockFilter: (value: BlockFilter) => void;
  reportFilter: ReportFilter;
  setReportFilter: (value: ReportFilter) => void;
  onResetFilters: () => void;
  onRefresh: () => void;
  shownCount: number;
  totalCount: number;
}

export default function AdminFilters({
  activeTab,
  setActiveTab,
  pendingCount,
  allCount,
  allLoaded,
  searchQuery,
  setSearchQuery,
  approvalFilter,
  setApprovalFilter,
  blockFilter,
  setBlockFilter,
  reportFilter,
  setReportFilter,
  onResetFilters,
  onRefresh,
  shownCount,
  totalCount,
}: AdminFiltersProps) {
  return (
    <div className="p-6 border-b border-gray-800 bg-gray-900/80 space-y-4">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "pending"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                : "text-gray-400 hover:text-white hover:bg-gray-700/50"
            }`}
          >
            Pending Approvals
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">{pendingCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "all"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                : "text-gray-400 hover:text-white hover:bg-gray-700/50"
            }`}
          >
            All Segments
            {allLoaded && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-600/40 text-gray-300 text-xs font-bold">{allCount}</span>
            )}
          </button>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-gray-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, Strava ID, user, reporter..."
          className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value as ApprovalFilter)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All approval states</option>
          <option value="approved">Approved only</option>
          <option value="pending">Pending only</option>
        </select>
        <select
          value={blockFilter}
          onChange={(e) => setBlockFilter(e.target.value as BlockFilter)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All block states</option>
          <option value="blocked">Blocked only</option>
          <option value="unblocked">Unblocked only</option>
        </select>
        <select
          value={reportFilter}
          onChange={(e) => setReportFilter(e.target.value as ReportFilter)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All report states</option>
          <option value="reported">Reported only</option>
          <option value="not_reported">Not reported</option>
        </select>
        <button
          onClick={onResetFilters}
          className="bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
        >
          Reset filters
        </button>
        <div className="md:col-span-2 text-sm text-gray-400 flex items-center md:justify-end">
          Showing {shownCount} of {totalCount} segment{totalCount !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
