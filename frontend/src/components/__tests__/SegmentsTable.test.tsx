import { fireEvent, render, screen } from "@testing-library/react";
import SegmentsTable from "@/components/SegmentsTable";
import type { Segment } from "@/types";

const baseSegment: Segment = {
  id: "seg-1",
  name: "Test Segment",
  distance_km: 2.4,
  gradient_pct: 3.2,
  completion_times: {
    beginner: "10:00",
    intermediate: "08:00",
    advanced: "06:00",
  },
  strava_url: "https://www.strava.com/segments/12345",
  strava_id: "12345",
  approved: false,
  created_at: "2026-03-10T09:00:00Z",
};

describe("SegmentsTable", () => {
  it("opens preview when clicking segment name", () => {
    const onPreview = jest.fn();
    const segment = { ...baseSegment };

    render(
      <SegmentsTable
        activeTab="pending"
        currentLoading={false}
        currentError=""
        currentSegments={[segment]}
        filteredSegments={[segment]}
        expandedRatingsSegmentId={null}
        segmentRatingsById={{}}
        segmentRatingsLoadingById={{}}
        segmentRatingsErrorById={{}}
        onDelete={jest.fn()}
        onApprove={jest.fn()}
        onBlock={jest.fn()}
        onUnblock={jest.fn()}
        onMerge={jest.fn()}
        onSplit={jest.fn()}
        onToggleRatings={jest.fn()}
        onDeleteRating={jest.fn()}
        onPreview={onPreview}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Test Segment" }));

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith(segment);
  });
});
