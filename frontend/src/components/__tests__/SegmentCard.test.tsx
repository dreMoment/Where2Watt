import { render, screen } from '@testing-library/react';
import SegmentCard from '../SegmentCard';
import { fetchMySegmentReportStatus } from '@/utils/api';

const authState = {
    isLoggedIn: false,
    token: null as string | null,
};

const mockLogin = jest.fn();

jest.mock('@/components/AuthContext', () => ({
    useAuth: () => ({
        isLoggedIn: authState.isLoggedIn,
        token: authState.token,
        login: mockLogin,
    }),
}));

jest.mock('@/utils/api', () => ({
    fetchMySegmentReportStatus: jest.fn(),
    reportSegmentBlocked: jest.fn(),
    reportSegmentUnblocked: jest.fn(),
}));

jest.mock('@/components/ui/UiFeedbackProvider', () => ({
    useUiFeedback: () => ({
        showToast: jest.fn(),
        confirm: jest.fn(),
    }),
}));

const mockSegment: import('@/types').Segment = {
    _id: "1",
    id: "1",
    strava_url: "https://strava.com",
    name: "Test Climb",
    distance_km: 2.5,
    gradient_pct: 5,
    completion_times: { beginner: "10:00", intermediate: "08:00", advanced: "06:00" },
    approved: true
};

describe('SegmentCard', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        authState.isLoggedIn = false;
        authState.token = null;

        (fetchMySegmentReportStatus as jest.Mock).mockResolvedValue({
            segment_id: '1',
            expected_action: 'blocked',
            has_reported: false,
            report: null,
        });
    });

    it('renders segment data correctly', () => {
        render(<SegmentCard segment={mockSegment} />);
        expect(screen.getByText('Test Climb')).toBeInTheDocument();
        expect(screen.getByText('2.5')).toBeInTheDocument();
        expect(screen.getByText('5%')).toBeInTheDocument();
    });

    it('calculates estimated time when power and weight are provided', () => {
        render(<SegmentCard segment={mockSegment} riderPower="300" riderWeight="70" />);
        expect(screen.queryByText("--:--")).not.toBeInTheDocument();
    });

});
