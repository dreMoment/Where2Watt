import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { useAdminSegments } from "@/hooks/useAdminSegments";
import {
  approveSegment,
  blockSegment,
  deleteAdminSegmentRating,
  deleteSegment,
  fetchAdminSegmentRatings,
  fetchAllSegments,
  fetchUnapprovedSegments,
  quickAddSegment,
  unblockSegment,
} from "@/utils/api";

const confirmMock = jest.fn();
const showToastMock = jest.fn();

jest.mock("@/utils/api", () => ({
  fetchUnapprovedSegments: jest.fn(),
  fetchAllSegments: jest.fn(),
  fetchAdminSegmentRatings: jest.fn(),
  deleteAdminSegmentRating: jest.fn(),
  deleteSegment: jest.fn(),
  approveSegment: jest.fn(),
  blockSegment: jest.fn(),
  unblockSegment: jest.fn(),
  quickAddSegment: jest.fn(),
}));

jest.mock("@/components/ui/UiFeedbackProvider", () => ({
  useUiFeedback: () => ({
    confirm: confirmMock,
    showToast: showToastMock,
  }),
}));

const sampleSegment = {
  id: "s1",
  name: "Segment A",
  strava_url: "https://www.strava.com/segments/1",
  distance_km: 2.1,
  gradient_pct: 4.2,
  approved: false,
  completion_times: { beginner: "10:00", intermediate: "08:00", advanced: "06:00" },
};

describe("useAdminSegments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchUnapprovedSegments as jest.Mock).mockResolvedValue([sampleSegment]);
    (fetchAllSegments as jest.Mock).mockResolvedValue([sampleSegment]);
    (fetchAdminSegmentRatings as jest.Mock).mockResolvedValue([]);
  });

  it("loads pending segments on mount", async () => {
    const { result } = renderHook(() => useAdminSegments({ token: "token-1", onLogout: jest.fn() }));

    await waitFor(() => expect(result.current.currentLoading).toBe(false));
    expect(fetchUnapprovedSegments).toHaveBeenCalledWith("token-1");
    expect(result.current.pendingSegments).toHaveLength(1);
    expect(result.current.summary.total).toBe(1);
  });

  it("does not delete segment when confirmation is cancelled", async () => {
    confirmMock.mockResolvedValue(false);
    const { result } = renderHook(() => useAdminSegments({ token: "token-1", onLogout: jest.fn() }));
    await waitFor(() => expect(result.current.currentLoading).toBe(false));

    await act(async () => {
      await result.current.handleDelete("s1", "Segment A");
    });

    expect(deleteSegment).not.toHaveBeenCalled();
  });

  it("logs out on auth failure message during delete", async () => {
    const onLogout = jest.fn();
    confirmMock.mockResolvedValue(true);
    (deleteSegment as jest.Mock).mockRejectedValue(new Error("Admin access required"));
    const { result } = renderHook(() => useAdminSegments({ token: "token-1", onLogout }));
    await waitFor(() => expect(result.current.currentLoading).toBe(false));

    await act(async () => {
      await result.current.handleDelete("s1", "Segment A");
    });

    expect(showToastMock).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });

  it("supports quick-add success flow", async () => {
    (quickAddSegment as jest.Mock).mockResolvedValue({ ...sampleSegment, approved: true });
    const { result } = renderHook(() => useAdminSegments({ token: "token-1", onLogout: jest.fn() }));
    await waitFor(() => expect(result.current.currentLoading).toBe(false));

    act(() => result.current.setQuickAddUrl("https://www.strava.com/segments/123"));
    await act(async () => {
      await result.current.handleQuickAdd({ preventDefault: jest.fn() } as unknown as React.FormEvent);
    });

    expect(quickAddSegment).toHaveBeenCalledWith("https://www.strava.com/segments/123", "token-1");
    expect(result.current.quickAddMessage?.type).toBe("success");
  });

  it("handles approve and block/unblock mutations", async () => {
    (approveSegment as jest.Mock).mockResolvedValue(undefined);
    (blockSegment as jest.Mock).mockResolvedValue(undefined);
    (unblockSegment as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAdminSegments({ token: "token-1", onLogout: jest.fn() }));
    await waitFor(() => expect(result.current.currentLoading).toBe(false));

    await act(async () => {
      await result.current.handleApprove("s1");
    });
    expect(approveSegment).toHaveBeenCalledWith("s1", "token-1");

    await act(async () => {
      await result.current.handleBlock("s1");
    });
    expect(blockSegment).toHaveBeenCalledWith("s1", "token-1");

    await act(async () => {
      await result.current.handleUnblock("s1");
    });
    expect(unblockSegment).toHaveBeenCalledWith("s1", "token-1");
  });

  it("loads and deletes ratings from moderation panel", async () => {
    (fetchAdminSegmentRatings as jest.Mock).mockResolvedValue([
      {
        id: "r1",
        segment_id: "s1",
        rated_by_actor_id: "actor-1",
        ratings: {
          overall_quality: 4,
          traffic_level: 2,
          road_surface: 2,
          gradient_profile: 3,
          sketchy_left_turns: 1,
        },
      },
    ]);
    confirmMock.mockResolvedValue(true);
    (deleteAdminSegmentRating as jest.Mock).mockResolvedValue({
      status: "deleted",
      ratings_count: 0,
      average_ratings: {
        overall_quality: null,
        traffic_level: null,
        road_surface: null,
        gradient_profile: null,
        sketchy_left_turns: null,
      },
    });

    const { result } = renderHook(() => useAdminSegments({ token: "token-1", onLogout: jest.fn() }));
    await waitFor(() => expect(result.current.currentLoading).toBe(false));

    await act(async () => {
      result.current.handleToggleRatings("s1");
    });
    await waitFor(() => expect(fetchAdminSegmentRatings).toHaveBeenCalledWith("s1", "token-1"));
    expect(result.current.expandedRatingsSegmentId).toBe("s1");
    expect(result.current.segmentRatingsById.s1).toHaveLength(1);

    await act(async () => {
      await result.current.handleDeleteRating("s1", "r1");
    });
    expect(deleteAdminSegmentRating).toHaveBeenCalledWith("s1", "r1", "token-1");
    expect(result.current.segmentRatingsById.s1).toHaveLength(0);
  });
});
