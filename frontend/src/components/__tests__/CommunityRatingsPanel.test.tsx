import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommunityRatingsPanel from "../CommunityRatingsPanel";
import { deleteMySegmentRating, fetchMySegmentRatingStatus, rateSegment } from "@/utils/api";

const mockConfirm = jest.fn();
const mockShowToast = jest.fn();

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
    deleteMySegmentRating: jest.fn(),
    fetchMySegmentRatingStatus: jest.fn(),
    rateSegment: jest.fn(),
}));

jest.mock("@/components/ui/UiFeedbackProvider", () => ({
    useUiFeedback: () => ({
        showToast: mockShowToast,
        confirm: mockConfirm,
    }),
}));

const mockSegment: import("@/types").Segment = {
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
        mockConfirm.mockResolvedValue(true);

        (fetchMySegmentRatingStatus as jest.Mock).mockResolvedValue({
            segment_id: "1",
            has_rated: false,
            rating: null,
        });
    });

    it("starts folded when requested and can be expanded", () => {
        render(<CommunityRatingsPanel segment={mockSegment} initiallyFolded />);

        expect(screen.queryByText(/No ratings yet/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Expand ratings popup" }));
        expect(screen.getByText(/No ratings yet/i)).toBeInTheDocument();
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
        fireEvent.click(screen.getByRole("button", { name: "Traffic Level: Medium" }));
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

        await waitFor(() => expect(fetchMySegmentRatingStatus).toHaveBeenCalled());

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
        expect(screen.getByText("Medium")).toBeInTheDocument();
        expect(screen.getByText("Patchy")).toBeInTheDocument();
        expect(screen.getByText("Steady")).toBeInTheDocument();
        expect(screen.getByText("None")).toBeInTheDocument();
        expect(screen.queryByText("2.7")).not.toBeInTheDocument();
        expect(screen.queryByText(/average\s*\/\s*3/i)).not.toBeInTheDocument();
    });

    it("allows editing an existing rating", async () => {
        authState.isLoggedIn = true;
        authState.token = "mock-token";

        (fetchMySegmentRatingStatus as jest.Mock).mockResolvedValue({
            segment_id: "1",
            has_rated: true,
            rating: {
                overall_quality: 6,
                traffic_level: 2,
                road_surface: 2,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            },
        });
        (rateSegment as jest.Mock).mockResolvedValue({
            status: "rated",
            ratings_count: 4,
            average_ratings: {
                overall_quality: 7,
                traffic_level: 2,
                road_surface: 2,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            },
        });

        render(<CommunityRatingsPanel segment={mockSegment} />);

        await waitFor(() => {
            expect(fetchMySegmentRatingStatus).toHaveBeenCalled();
        });

        fireEvent.click(screen.getByRole("button", { name: /Edit your rating/i }));
        fireEvent.click(screen.getByRole("button", { name: "Overall Quality star 5" }));
        fireEvent.click(screen.getByRole("button", { name: /Update Rating/i }));

        await waitFor(() => {
            expect(rateSegment).toHaveBeenCalledWith("1", "mock-token", {
                overall_quality: 10,
                traffic_level: 2,
                road_surface: 2,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            });
        });
    });

    it("allows deleting an existing rating", async () => {
        authState.isLoggedIn = true;
        authState.token = "mock-token";

        (fetchMySegmentRatingStatus as jest.Mock).mockResolvedValue({
            segment_id: "1",
            has_rated: true,
            rating: {
                overall_quality: 6,
                traffic_level: 2,
                road_surface: 2,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            },
        });
        (deleteMySegmentRating as jest.Mock).mockResolvedValue({
            status: "deleted",
            ratings_count: 3,
            average_ratings: {
                overall_quality: 7,
                traffic_level: 2,
                road_surface: 2,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            },
        });

        render(<CommunityRatingsPanel segment={mockSegment} />);

        await waitFor(() => {
            expect(fetchMySegmentRatingStatus).toHaveBeenCalled();
        });

        fireEvent.click(screen.getByRole("button", { name: /Edit your rating/i }));
        fireEvent.click(screen.getByRole("button", { name: /Delete My Rating/i }));

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalled();
            expect(deleteMySegmentRating).toHaveBeenCalledWith("1", "mock-token");
        });
    });
});
