import { render, screen } from '@testing-library/react';
import SegmentCard from '../SegmentCard';

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
