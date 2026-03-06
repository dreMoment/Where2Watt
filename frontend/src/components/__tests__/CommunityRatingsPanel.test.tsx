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
});
