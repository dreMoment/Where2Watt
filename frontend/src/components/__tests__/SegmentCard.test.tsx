import { render, screen, fireEvent } from '@testing-library/react';
import SegmentCard from '../SegmentCard';

const mockSegment: import('@/types').Segment = {
    _id: "1",
    id: "1",
    strava_url: "https://strava.com",
    terrain: "Hilly" as const,
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
        expect(screen.getByText('Hilly')).toBeInTheDocument();
        expect(screen.getByText('2.5')).toBeInTheDocument();
        expect(screen.getByText('5%')).toBeInTheDocument();
    });

    it('calculates estimated time when power and weight are provided', () => {
        render(<SegmentCard segment={mockSegment} />);

        // Change power to 300, weight to 70
        fireEvent.change(screen.getByLabelText(/Power \(W\)/i), { target: { value: '300' } });
        fireEvent.change(screen.getByLabelText(/Weight \(kg\)/i), { target: { value: '70' } });

        expect(screen.queryByText("--:--")).not.toBeInTheDocument();
    });
});
