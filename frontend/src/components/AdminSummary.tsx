interface AdminSummaryProps {
  summary: {
    total: number;
    approved: number;
    pending: number;
    blocked: number;
    reported: number;
  };
}

export default function AdminSummary({ summary }: AdminSummaryProps) {
  return (
    <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
        <div className="text-xs text-gray-500">Total</div>
        <div className="text-xl font-bold">{summary.total}</div>
      </div>
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
        <div className="text-xs text-gray-500">Approved</div>
        <div className="text-xl font-bold text-emerald-400">{summary.approved}</div>
      </div>
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
        <div className="text-xs text-gray-500">Pending</div>
        <div className="text-xl font-bold text-amber-400">{summary.pending}</div>
      </div>
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
        <div className="text-xs text-gray-500">Blocked</div>
        <div className="text-xl font-bold text-red-400">{summary.blocked}</div>
      </div>
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
        <div className="text-xs text-gray-500">Reported</div>
        <div className="text-xl font-bold text-blue-400">{summary.reported}</div>
      </div>
    </div>
  );
}
