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

    it("submits the new mixed rating inputs", async () => {
        authState.isLoggedIn = true;
        authState.token = "mock-token";

        (rateSegment as jest.Mock).mockResolvedValue({
            status: "rated",
            ratings_count: 1,
            average_ratings: {
                overall_quality: 8,
                traffic_level: 2,
                road_surface: 3,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            },
        });

        render(<CommunityRatingsPanel segment={mockSegment} />);

        fireEvent.click(screen.getByRole("button", { name: /Rate this segment/i }));
        fireEvent.click(screen.getByRole("button", { name: "Overall Quality star 4" }));
        fireEvent.click(screen.getByRole("button", { name: "Traffic Level: Med" }));
        fireEvent.click(screen.getByRole("button", { name: "Road Surface: Smooth" }));
        fireEvent.click(screen.getByRole("button", { name: "Gradient Profile: Flowing" }));
        fireEvent.click(screen.getByRole("button", { name: "Sketchy Left Turns: 1" }));
        fireEvent.click(screen.getByRole("button", { name: /Submit Rating/i }));

        await waitFor(() => {
            expect(rateSegment).toHaveBeenCalledWith("1", "mock-token", {
                overall_quality: 8,
                traffic_level: 2,
                road_surface: 3,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            });
        });
    });

    it("requires all ratings before submit and shows a warning in the popup", async () => {
        authState.isLoggedIn = true;
        authState.token = "mock-token";

        render(<CommunityRatingsPanel segment={mockSegment} />);

        fireEvent.click(screen.getByRole("button", { name: /Rate this segment/i }));
        fireEvent.click(screen.getByRole("button", { name: "Overall Quality star 1" }));
        fireEvent.click(screen.getByRole("button", { name: /Submit Rating/i }));

        expect(screen.getByRole("alert")).toHaveTextContent("Please rate all required fields before submitting.");
        expect(rateSegment).not.toHaveBeenCalled();
    });

    it("shows all category labels without numeric averages", () => {
        const segmentWithAverages: import("@/types").Segment = {
            ...mockSegment,
            ratings_count: 8,
            average_ratings: {
                overall_quality: 3.6,
                traffic_level: 2.2,
                road_surface: 1.8,
                gradient_profile: 2.7,
                sketchy_left_turns: 0.4,
            },
        };

        render(<CommunityRatingsPanel segment={segmentWithAverages} />);

        expect(screen.getByTestId("community-categories-grid")).toBeInTheDocument();
        expect(screen.getByText("Traffic Level")).toBeInTheDocument();
        expect(screen.getByText("Road Surface")).toBeInTheDocument();
        expect(screen.getByText("Gradient Profile")).toBeInTheDocument();
        expect(screen.getByText("Sketchy Left Turns")).toBeInTheDocument();
        expect(screen.getByText("Med")).toBeInTheDocument();
        expect(screen.getByText("Patchy")).toBeInTheDocument();
        expect(screen.getByText("Steady")).toBeInTheDocument();
        expect(screen.getByText("0")).toBeInTheDocument();
        expect(screen.queryByText("2.7")).not.toBeInTheDocument();
        expect(screen.queryByText(/average\s*\/\s*3/i)).not.toBeInTheDocument();
    });

    it("hides category cards while rating form is open", () => {
        authState.isLoggedIn = true;
        authState.token = "mock-token";

        const segmentWithAverages: import("@/types").Segment = {
            ...mockSegment,
            ratings_count: 4,
            average_ratings: {
                overall_quality: 4,
                traffic_level: 2,
                road_surface: 2,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            },
        };

        render(<CommunityRatingsPanel segment={segmentWithAverages} />);
        expect(screen.getByTestId("community-categories-grid")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Rate this segment/i }));

        expect(screen.queryByTestId("community-categories-grid")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Overall Quality star 1" })).toBeInTheDocument();
    });

    it("folds and expands the ratings popup content from the top-right toggle", () => {
        const segmentWithAverages: import("@/types").Segment = {
            ...mockSegment,
            ratings_count: 3,
            average_ratings: {
                overall_quality: 4,
                traffic_level: 2,
                road_surface: 2,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            },
        };

        render(<CommunityRatingsPanel segment={segmentWithAverages} />);

        expect(screen.getByTestId("community-categories-grid")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Fold ratings popup/i }));
        expect(screen.queryByTestId("community-categories-grid")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Expand ratings popup/i }));
        expect(screen.getByTestId("community-categories-grid")).toBeInTheDocument();
    });
});
