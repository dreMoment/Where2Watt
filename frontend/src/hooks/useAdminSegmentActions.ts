import { useCallback } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { approveSegment, blockSegment, deleteSegment, quickAddSegment, unblockSegment } from "@/utils/api";
import type { Segment } from "@/types";
import { getErrorMessage, isAuthFailure } from "@/hooks/adminErrors";

type ConfirmDialogFn = (options: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}) => Promise<boolean>;

type ShowToastFn = (message: string, options?: { type?: "info" | "success" | "error" }) => void;

type QuickAddMessage = { text: string; type: "success" | "error" } | null;

interface UseAdminSegmentActionsParams {
  token: string;
  activeTab: "pending" | "all";
  onLogout: () => void;
  confirm: ConfirmDialogFn;
  showToast: ShowToastFn;
  quickAddUrl: string;
  setQuickAddUrl: Dispatch<SetStateAction<string>>;
  setIsQuickAdding: Dispatch<SetStateAction<boolean>>;
  setQuickAddMessage: Dispatch<SetStateAction<QuickAddMessage>>;
  setPendingSegments: Dispatch<SetStateAction<Segment[]>>;
  setAllSegments: Dispatch<SetStateAction<Segment[]>>;
  loadPendingSegments: () => void;
  loadAllSegments: () => void;
}

export function useAdminSegmentActions({
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
}: UseAdminSegmentActionsParams) {
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
        setPendingSegments((prev) => prev.filter((segment) => segment.id !== id));
        setAllSegments((prev) => prev.filter((segment) => segment.id !== id));
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Failed to delete segment");
        showToast(message, { type: "error" });
        if (isAuthFailure(message)) {
          onLogout();
        }
      }
    },
    [confirm, onLogout, setAllSegments, setPendingSegments, showToast, token]
  );

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        await approveSegment(id, token);
        setPendingSegments((prev) => prev.filter((segment) => segment.id !== id));
        setAllSegments((prev) => prev.map((segment) => (segment.id === id ? { ...segment, approved: true } : segment)));
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Failed to approve segment");
        showToast(message, { type: "error" });
        if (isAuthFailure(message)) {
          onLogout();
        }
      }
    },
    [onLogout, setAllSegments, setPendingSegments, showToast, token]
  );

  const handleQuickAdd = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!quickAddUrl.trim()) {
        return;
      }

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
    [loadAllSegments, loadPendingSegments, quickAddUrl, setIsQuickAdding, setQuickAddMessage, setQuickAddUrl, token]
  );

  const handleBlock = useCallback(
    async (id: string) => {
      try {
        const messageInput = typeof window !== "undefined"
          ? window.prompt("Optional message shown to users when this segment is blocked:", "")
          : "";
        if (messageInput === null) {
          return;
        }
        const blockMessage = messageInput.trim();
        await blockSegment(id, token, blockMessage || undefined);
        const updateSegment = (segment: Segment) =>
          segment.id === id
            ? {
                ...segment,
                blocked: true,
                block_message: blockMessage || null,
                reported_by_actor_ids: [],
                reported_by_users: [],
                block_reports: [],
              }
            : segment;

        setPendingSegments((prev) => prev.map(updateSegment));
        setAllSegments((prev) => prev.map(updateSegment));
      } catch (err: unknown) {
        showToast(getErrorMessage(err, "Failed to block segment"), { type: "error" });
      }
    },
    [setAllSegments, setPendingSegments, showToast, token]
  );

  const handleUnblock = useCallback(
    async (id: string) => {
      try {
        await unblockSegment(id, token);
        const updateSegment = (segment: Segment) =>
          segment.id === id
            ? {
                ...segment,
                blocked: false,
                block_message: null,
                reported_by_actor_ids: [],
                reported_by_users: [],
                block_reports: [],
              }
            : segment;

        setPendingSegments((prev) => prev.map(updateSegment));
        setAllSegments((prev) => prev.map(updateSegment));
      } catch (err: unknown) {
        showToast(getErrorMessage(err, "Failed to unblock segment"), { type: "error" });
      }
    },
    [setAllSegments, setPendingSegments, showToast, token]
  );

  const handleRefresh = useCallback(() => {
    if (activeTab === "pending") {
      loadPendingSegments();
      return;
    }

    loadAllSegments();
  }, [activeTab, loadAllSegments, loadPendingSegments]);

  return {
    handleDelete,
    handleApprove,
    handleQuickAdd,
    handleBlock,
    handleUnblock,
    handleRefresh,
  };
}
