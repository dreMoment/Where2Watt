import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchUnapprovedSegments,
  fetchAllSegments,
  deleteSegment,
  approveSegment,
  blockSegment,
  unblockSegment,
  quickAddSegment,
} from "@/utils/api";
import type { Segment } from "@/types";
import { useUiFeedback } from "@/components/ui/UiFeedbackProvider";

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function isAuthFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("unauthorized") || normalized.includes("not authenticated") || normalized.includes("admin access required");
}

export type Tab = "pending" | "all";
export type ApprovalFilter = "all" | "approved" | "pending";
export type BlockFilter = "all" | "blocked" | "unblocked";
export type ReportFilter = "all" | "reported" | "not_reported";

interface UseAdminSegmentsParams {
  token: string;
  onLogout: () => void;
}

export function useAdminSegments({ token, onLogout }: UseAdminSegmentsParams) {
  const { confirm, showToast } = useUiFeedback();
  const [activeTab, setActiveTab] = useState<Tab>("pending");

  const [pendingSegments, setPendingSegments] = useState<Segment[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState("");

  const [allSegments, setAllSegments] = useState<Segment[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState("");
  const [allLoaded, setAllLoaded] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");
  const [blockFilter, setBlockFilter] = useState<BlockFilter>("all");
  const [reportFilter, setReportFilter] = useState<ReportFilter>("all");

  const [quickAddUrl, setQuickAddUrl] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddMessage, setQuickAddMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [blockingSegmentId, setBlockingSegmentId] = useState<string | null>(null);
  const [blockUntilDate, setBlockUntilDate] = useState("");

  const loadPendingSegments = useCallback(async () => {
    try {
      setPendingLoading(true);
      const data = await fetchUnapprovedSegments(token);
      setPendingSegments(data);
      setPendingError("");
    } catch (err: unknown) {
      setPendingError(getErrorMessage(err, "Failed to load segments"));
    } finally {
      setPendingLoading(false);
    }
  }, [token]);

  const loadAllSegments = useCallback(async () => {
    try {
      setAllLoading(true);
      const data = await fetchAllSegments(token);
      setAllSegments(data);
      setAllError("");
      setAllLoaded(true);
    } catch (err: unknown) {
      setAllError(getErrorMessage(err, "Failed to load segments"));
    } finally {
      setAllLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPendingSegments();
  }, [loadPendingSegments]);

  useEffect(() => {
    if (activeTab === "all" && !allLoaded) {
      loadAllSegments();
    }
  }, [activeTab, allLoaded, loadAllSegments]);

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      const confirmed = await confirm({
        title: "Delete segment?",
        description: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        tone: "danger",
      });
      if (!confirmed) {
        return;
      }

      try {
        await deleteSegment(id, token);
        setPendingSegments((prev) => prev.filter((s) => s.id !== id));
        setAllSegments((prev) => prev.filter((s) => s.id !== id));
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Failed to delete segment");
        showToast(message, { type: "error" });
        if (isAuthFailure(message)) {
          onLogout();
        }
      }
    },
    [confirm, onLogout, token, showToast]
  );

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        await approveSegment(id, token);
        setPendingSegments((prev) => prev.filter((s) => s.id !== id));
        setAllSegments((prev) => prev.map((s) => (s.id === id ? { ...s, approved: true } : s)));
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Failed to approve segment");
        showToast(message, { type: "error" });
        if (isAuthFailure(message)) {
          onLogout();
        }
      }
    },
    [onLogout, token, showToast]
  );

  const handleRefresh = useCallback(() => {
    if (activeTab === "pending") {
      loadPendingSegments();
      return;
    }
    loadAllSegments();
  }, [activeTab, loadAllSegments, loadPendingSegments]);

  const currentLoading = activeTab === "pending" ? pendingLoading : allLoading;
  const currentError = activeTab === "pending" ? pendingError : allError;
  const currentSegments = activeTab === "pending" ? pendingSegments : allSegments;

  const filteredSegments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return currentSegments.filter((segment) => {
      const reportCount = segment.blocked_report_count ?? segment.reported_by_strava_ids?.length ?? 0;

      if (approvalFilter !== "all") {
        const isApproved = !!segment.approved;
        if (approvalFilter === "approved" && !isApproved) return false;
        if (approvalFilter === "pending" && isApproved) return false;
      }

      if (blockFilter !== "all") {
        const isBlocked = !!segment.blocked;
        if (blockFilter === "blocked" && !isBlocked) return false;
        if (blockFilter === "unblocked" && isBlocked) return false;
      }

      if (reportFilter !== "all") {
        if (reportFilter === "reported" && reportCount === 0) return false;
        if (reportFilter === "not_reported" && reportCount > 0) return false;
      }

      if (!query) return true;

      const reportedIds = (segment.reported_by_strava_ids || []).join(" ");
      const reportedNames = (segment.reported_by_users || [])
        .map((u) => `${u.firstname || ""} ${u.lastname || ""} ${u.username || ""} ${u.strava_id}`)
        .join(" ");

      const searchCorpus = [
        segment.id,
        segment.name,
        segment.strava_id,
        segment.strava_url,
        segment.created_at,
        segment.submitted_by_strava_id,
        segment.submitted_by_user?.firstname,
        segment.submitted_by_user?.lastname,
        segment.submitted_by_user?.username,
        reportedIds,
        reportedNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchCorpus.includes(query);
    });
  }, [currentSegments, searchQuery, approvalFilter, blockFilter, reportFilter]);

  const summary = useMemo(() => {
    const total = currentSegments.length;
    const approved = currentSegments.filter((s) => s.approved).length;
    const pending = currentSegments.filter((s) => !s.approved).length;
    const blocked = currentSegments.filter((s) => s.blocked).length;
    const reported = currentSegments.filter((s) => (s.blocked_report_count ?? s.reported_by_strava_ids?.length ?? 0) > 0).length;
    return { total, approved, pending, blocked, reported };
  }, [currentSegments]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setApprovalFilter("all");
    setBlockFilter("all");
    setReportFilter("all");
  }, []);

  const handleQuickAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!quickAddUrl.trim()) return;

      try {
        setIsQuickAdding(true);
        setQuickAddMessage(null);
        const newSegment = await quickAddSegment(quickAddUrl, token);

        setQuickAddMessage({ text: `Successfully added and approved "${newSegment.name}"`, type: "success" });
        setQuickAddUrl("");

        loadPendingSegments();
        loadAllSegments();
      } catch (err: unknown) {
        setQuickAddMessage({ text: getErrorMessage(err, "Failed to add segment"), type: "error" });
      } finally {
        setIsQuickAdding(false);
      }
    },
    [loadAllSegments, loadPendingSegments, quickAddUrl, token]
  );

  const handleBlock = useCallback(
    async (id: string) => {
      try {
        const blockedUntil = blockUntilDate ? new Date(blockUntilDate).toISOString() : undefined;
        await blockSegment(id, token, blockedUntil);
        const updateSegment = (s: Segment) =>
          s.id === id ? { ...s, blocked: true, blocked_until: blockedUntil || undefined } : s;

        setPendingSegments((prev) => prev.map(updateSegment));
        setAllSegments((prev) => prev.map(updateSegment));
        setBlockingSegmentId(null);
        setBlockUntilDate("");
      } catch (err: unknown) {
        showToast(getErrorMessage(err, "Failed to block segment"), { type: "error" });
      }
    },
    [blockUntilDate, showToast, token]
  );

  const handleUnblock = useCallback(
    async (id: string) => {
      try {
        await unblockSegment(id, token);
        const updateSegment = (s: Segment) => (s.id === id ? { ...s, blocked: false, blocked_until: undefined } : s);

        setPendingSegments((prev) => prev.map(updateSegment));
        setAllSegments((prev) => prev.map(updateSegment));
      } catch (err: unknown) {
        showToast(getErrorMessage(err, "Failed to unblock segment"), { type: "error" });
      }
    },
    [showToast, token]
  );

  const startBlocking = useCallback((id: string | null) => {
    setBlockingSegmentId(id);
    setBlockUntilDate("");
  }, []);

  const cancelBlocking = useCallback(() => {
    setBlockingSegmentId(null);
    setBlockUntilDate("");
  }, []);

  return {
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
    handleQuickAdd,
    handleRefresh,
    handleDelete,
    handleApprove,
    blockingSegmentId,
    blockUntilDate,
    setBlockUntilDate,
    handleBlock,
    handleUnblock,
    startBlocking,
    cancelBlocking,
  };
}
