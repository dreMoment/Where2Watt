import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommunityRatingsPanel from "../CommunityRatingsPanel";
import { fetchMySegmentRatingStatus, rateSegment } from "@/utils/api";

const authState = {
    isLoggedIn: false,
    token: null as string | null,
};

const mockLogin = jest.fn();

jest.mock("@/components/AuthContext", () => ({
    useAuth: () => ({
        isLoggedIn: authState.isLoggedIn,
        token: authState.token,
        login: mockLogin,
    }),
}));

jest.mock("@/utils/api", () => ({
    fetchMySegmentRatingStatus: jest.fn(),
    rateSegment: jest.fn(),
}));

jest.mock("@/components/ui/UiFeedbackProvider", () => ({
    useUiFeedback: () => ({
        showToast: jest.fn(),
        confirm: jest.fn(),
    }),
}));

const mockSegment: import("@/types").Segment = {
    _id: "1",
    id: "1",
    strava_url: "https://strava.com",
    name: "Test Climb",
    distance_km: 2.5,
    gradient_pct: 5,
    completion_times: { beginner: "10:00", intermediate: "08:00", advanced: "06:00" },
    approved: true,
};

describe("CommunityRatingsPanel", () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        authState.isLoggedIn = false;
        authState.token = null;

        (fetchMySegmentRatingStatus as jest.Mock).mockResolvedValue({
            segment_id: "1",
            has_rated: false,
            rating: null,
        });
    });

    it("toggles full star to half star on second click and submits half-star value", async () => {
        authState.isLoggedIn = true;
        authState.token = "mock-token";

        (rateSegment as jest.Mock).mockResolvedValue({
            status: "rated",
            ratings_count: 1,
            average_ratings: {
                traffic: 1,
                steady_gradient: 6,
                sketchy_left_turns: 6,
                downhills: 6,
            },
        });

        render(<CommunityRatingsPanel segment={mockSegment} />);

        fireEvent.click(screen.getByRole("button", { name: /Rate this segment/i }));

        const trafficStarOne = screen.getByRole("button", { name: "Traffic star 1" });
        const steadyGradientStarThree = screen.getByRole("button", { name: "Steady Gradient star 3" });
        const sketchyLeftTurnsStarThree = screen.getByRole("button", { name: "Sketchy Left Turns star 3" });
        const downhillsStarThree = screen.getByRole("button", { name: "Downhills star 3" });

        fireEvent.click(steadyGradientStarThree);
        fireEvent.click(sketchyLeftTurnsStarThree);
        fireEvent.click(downhillsStarThree);
        fireEvent.click(trafficStarOne);
        fireEvent.click(trafficStarOne);

        fireEvent.click(screen.getByRole("button", { name: /Submit Rating/i }));

        await waitFor(() => {
            expect(rateSegment).toHaveBeenCalledWith("1", "mock-token", {
                traffic: 1,
                steady_gradient: 6,
                sketchy_left_turns: 6,
                downhills: 6,
            });
        });
    });

    it("requires all ratings before submit and shows a warning in the popup", async () => {
        authState.isLoggedIn = true;
        authState.token = "mock-token";

        render(<CommunityRatingsPanel segment={mockSegment} />);

        fireEvent.click(screen.getByRole("button", { name: /Rate this segment/i }));
        fireEvent.click(screen.getByRole("button", { name: "Traffic star 1" }));
        fireEvent.click(screen.getByRole("button", { name: /Submit Rating/i }));

        expect(screen.getByRole("alert")).toHaveTextContent("Please rate all required fields before submitting.");
        expect(rateSegment).not.toHaveBeenCalled();
    });

    it("shows community average stars rounded to the nearest half when not rating", () => {
        const segmentWithAverages: import("@/types").Segment = {
            ...mockSegment,
            ratings_count: 8,
            average_ratings: {
                traffic: 7.2,
                steady_gradient: 8.1,
                sketchy_left_turns: 6.9,
                downhills: 5.4,
            },
        };

        render(<CommunityRatingsPanel segment={segmentWithAverages} />);

        expect(screen.getByLabelText("Traffic average stars")).toBeInTheDocument();
        expect(screen.queryByText("7.2/10")).not.toBeInTheDocument();

        const starsFill = screen.getByTestId("average-stars-fill-traffic");
        expect(starsFill).toBeTruthy();
        expect((starsFill as HTMLSpanElement).style.width).toBe("70%");
    });

    it("hides community average cards while rating form is open", () => {
        authState.isLoggedIn = true;
        authState.token = "mock-token";

        const segmentWithAverages: import("@/types").Segment = {
            ...mockSegment,
            ratings_count: 4,
            average_ratings: {
                traffic: 8,
                steady_gradient: 8,
                sketchy_left_turns: 8,
                downhills: 8,
            },
        };

        render(<CommunityRatingsPanel segment={segmentWithAverages} />);
        expect(screen.getByLabelText("Traffic average stars")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Rate this segment/i }));

        expect(screen.queryByLabelText("Traffic average stars")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Traffic star 1" })).toBeInTheDocument();
    });

    it("folds and expands the ratings popup content from the top-right toggle", () => {
        const segmentWithAverages: import("@/types").Segment = {
            ...mockSegment,
            ratings_count: 3,
            average_ratings: {
                traffic: 7,
                steady_gradient: 7,
                sketchy_left_turns: 7,
                downhills: 7,
            },
        };

        render(<CommunityRatingsPanel segment={segmentWithAverages} />);

        expect(screen.getByLabelText("Traffic average stars")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Fold ratings popup/i }));
        expect(screen.queryByLabelText("Traffic average stars")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Expand ratings popup/i }));
        expect(screen.getByLabelText("Traffic average stars")).toBeInTheDocument();
    });
});
