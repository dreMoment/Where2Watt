import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchUnapprovedSegments,
  fetchAllSegments,
} from "@/utils/api";
import type { Segment } from "@/types";
import { useUiFeedback } from "@/components/ui/UiFeedbackProvider";
import { matchesAdminFilters } from "@/hooks/adminFilters";
import { getErrorMessage } from "@/hooks/adminErrors";
import { useAdminRatingsModeration } from "@/hooks/useAdminRatingsModeration";
import { useAdminSegmentActions } from "@/hooks/useAdminSegmentActions";

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

  const {
    expandedRatingsSegmentId,
    segmentRatingsById,
    segmentRatingsLoadingById,
    segmentRatingsErrorById,
    handleToggleRatings,
    handleDeleteRating,
  } = useAdminRatingsModeration({
    token,
    onLogout,
    confirm,
    showToast,
    setPendingSegments,
    setAllSegments,
  });

  const {
    handleDelete,
    handleApprove,
    handleQuickAdd,
    handleBlock,
    handleUnblock,
    handleMerge,
    handleSplit,
    handleRefresh,
  } = useAdminSegmentActions({
    token,
    activeTab,
    onLogout,
    confirm,
    showToast,
    quickAddUrl,
    setQuickAddUrl,
    setIsQuickAdding,
    setQuickAddMessage,
    setPendingSegments,
    setAllSegments,
    loadPendingSegments,
    loadAllSegments,
  });

  const ensureAllSegmentsLoaded = useCallback(async () => {
    if (allLoaded) {
      return;
    }
    await loadAllSegments();
  }, [allLoaded, loadAllSegments]);

  const currentLoading = activeTab === "pending" ? pendingLoading : allLoading;
  const currentError = activeTab === "pending" ? pendingError : allError;
  const currentSegments = activeTab === "pending" ? pendingSegments : allSegments;

  const filteredSegments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return currentSegments.filter((segment) =>
      matchesAdminFilters(segment, {
        approval: approvalFilter,
        block: blockFilter,
        report: reportFilter,
        query,
      })
    );
  }, [currentSegments, searchQuery, approvalFilter, blockFilter, reportFilter]);

  const summary = useMemo(() => {
    const total = currentSegments.length;
    const approved = currentSegments.filter((s) => s.approved).length;
    const pending = currentSegments.filter((s) => !s.approved).length;
    const blocked = currentSegments.filter((s) => s.blocked).length;
    const reported = currentSegments.filter((s) => (s.reported_by_actor_ids?.length ?? 0) > 0).length;
    return { total, approved, pending, blocked, reported };
  }, [currentSegments]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setApprovalFilter("all");
    setBlockFilter("all");
    setReportFilter("all");
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
    handleMerge,
    handleSplit,
    ensureAllSegmentsLoaded,
    handleToggleRatings,
    handleDeleteRating,
  };
}
