import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubmissionForm from '../SubmissionForm';
import { fetchStarredStravaSegments, fetchStravaSegmentPreview, submitSegment } from '@/utils/api';

jest.mock('@/utils/api', () => ({
    fetchStarredStravaSegments: jest.fn(),
    fetchStravaSegmentPreview: jest.fn(),
    submitSegment: jest.fn(),
}));

jest.mock('@/components/AuthContext', () => ({
    useAuth: () => ({
        isLoggedIn: true,
        token: 'mock-token',
        user: { strava_id: 1, firstname: 'Test', lastname: 'User', username: 'testuser', profile_pic: null },
        login: jest.fn(),
        logout: jest.fn(),
        isLoading: false,
    }),
}));

jest.mock('@/components/AdminSegmentPreviewModal', () => ({
    __esModule: true,
    default: ({ segment }: { segment: { name: string } | null }) => segment ? <div>Segment Preview: {segment.name}</div> : null,
}));

// This component intentionally exercises the complete multi-step form in jsdom.
jest.setTimeout(15_000);

describe('SubmissionForm', () => {
    const mockOnClose = jest.fn();
    const mockOnExistingSegmentRated = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockOnExistingSegmentRated.mockResolvedValue(undefined);
    });

    it('renders form fields correctly', () => {
        render(<SubmissionForm onClose={mockOnClose} />);
        expect(screen.getByText('Add a Segment')).toBeInTheDocument();
        expect(screen.getByText(/Segment URLs and activity segment-effort URLs are supported/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Strava Segment URL/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add safety notes/i })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByLabelText(/Safety notes/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Choose from your starred Strava segments/i })).toBeInTheDocument();
    });

    it('expands the optional safety notes field', () => {
        render(<SubmissionForm onClose={mockOnClose} />);

        const toggle = screen.getByRole('button', { name: /Add safety notes/i });
        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByLabelText(/Safety notes/i)).toBeInTheDocument();
    });

    it('loads starred Strava segments and selects one', async () => {
        (fetchStarredStravaSegments as jest.Mock).mockResolvedValueOnce([
            { id: '456', name: 'Hawk Hill', distance_km: 2.68, elevation_m: 153 },
        ]);
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.click(screen.getByRole('button', { name: /Choose from your starred Strava segments/i }));

        expect(await screen.findByText('Hawk Hill')).toBeInTheDocument();
        expect(screen.getByText(/2.68 km · 153 m elevation/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Select Hawk Hill' }));

        expect(screen.getByLabelText(/Strava Segment URL/i)).toHaveValue('https://www.strava.com/segments/456');
        expect(fetchStarredStravaSegments).toHaveBeenCalledWith('mock-token');
    });

    it('preserves the recently-added order returned by the backend', async () => {
        (fetchStarredStravaSegments as jest.Mock).mockResolvedValueOnce([
            { id: '1', name: 'Zulu Climb', distance_km: 2, elevation_m: 100 },
            { id: '2', name: 'Alpine Road', distance_km: 8, elevation_m: 400 },
        ]);
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.click(screen.getByRole('button', { name: /Choose from your starred Strava segments/i }));
        await screen.findByText('Alpine Road');

        const selectButtons = screen.getAllByRole('button', { name: /^Select / });
        expect(selectButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
            'Select Zulu Climb',
            'Select Alpine Road',
        ]);
    });

    it('fetches full segment details only when preview is requested', async () => {
        (fetchStarredStravaSegments as jest.Mock).mockResolvedValueOnce([
            { id: '456', name: 'Hawk Hill', distance_km: 2.68, elevation_m: 153 },
        ]);
        (fetchStravaSegmentPreview as jest.Mock).mockResolvedValueOnce({
            id: '456',
            strava_id: '456',
            name: 'Hawk Hill',
            strava_url: 'https://www.strava.com/segments/456',
            distance_km: 2.68,
            gradient_pct: 5.7,
            polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
            approved: false,
            completion_times: { beginner: '', intermediate: '', advanced: '' },
        });
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.click(screen.getByRole('button', { name: /Choose from your starred Strava segments/i }));
        fireEvent.click(await screen.findByRole('button', { name: 'Preview Hawk Hill' }));

        await waitFor(() => expect(fetchStravaSegmentPreview).toHaveBeenCalledWith('456', 'mock-token'));
        expect(await screen.findByText(/Segment Preview: Hawk Hill/)).toBeInTheDocument();
    });

    it('prevents submit when required ratings are missing', async () => {
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.change(screen.getByLabelText(/Strava Segment URL/i), {
            target: { value: 'https://www.strava.com/segments/123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Submit Segment/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Please rate all required fields before submitting.');
        });
        expect(submitSegment).not.toHaveBeenCalled();
    });

    it('submits form data successfully', async () => {
        (submitSegment as jest.Mock).mockResolvedValueOnce({ status: 'created' });
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.change(screen.getByLabelText(/Strava Segment URL/i), {
            target: { value: 'https://www.strava.com/segments/123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Add safety notes/i }));
        fireEvent.change(screen.getByLabelText(/Safety notes/i), {
            target: { value: 'Gravel near the finish' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Overall Quality star 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Traffic Level: Low/i }));
        fireEvent.click(screen.getByRole('button', { name: /Road Surface: Patchy/i }));
        fireEvent.click(screen.getByRole('button', { name: /Gradient Profile: Flowing/i }));
        fireEvent.click(screen.getByRole('button', { name: /Sketchy Left Turns: 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Submit Segment/i }));

        await waitFor(() => {
            expect(submitSegment).toHaveBeenCalledWith({
                strava_url: 'https://www.strava.com/segments/123',
                safety_notes: 'Gravel near the finish',
                ratings: {
                    overall_quality: 2,
                    traffic_level: 1,
                    road_surface: 2,
                    gradient_profile: 2,
                    sketchy_left_turns: 1,
                },
            }, 'mock-token');
        });

        await waitFor(() => {
            expect(screen.getByText(/Submitted!/i)).toBeInTheDocument();
        });

    });

    it('accepts activity segment-effort URLs', async () => {
        (submitSegment as jest.Mock).mockResolvedValueOnce({ status: 'created' });
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.change(screen.getByLabelText(/Strava Segment URL/i), {
            target: { value: 'https://www.strava.com/activities/19268839605/segments/3511011627260237700' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Overall Quality star 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Traffic Level: Low/i }));
        fireEvent.click(screen.getByRole('button', { name: /Road Surface: Patchy/i }));
        fireEvent.click(screen.getByRole('button', { name: /Gradient Profile: Flowing/i }));
        fireEvent.click(screen.getByRole('button', { name: /Sketchy Left Turns: 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Submit Segment/i }));

        await waitFor(() => {
            expect(submitSegment).toHaveBeenCalled();
        });
    });

    it('shows existing-segment message and confirms rating was added', async () => {
        (submitSegment as jest.Mock).mockResolvedValueOnce({
            id: "segment-123",
            status: 'existing',
            duplicate_reason: 'under_review',
            rating_status: 'added',
        });
        render(<SubmissionForm onClose={mockOnClose} onExistingSegmentRated={mockOnExistingSegmentRated} />);

        fireEvent.change(screen.getByLabelText(/Strava Segment URL/i), {
            target: { value: 'https://www.strava.com/segments/123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Overall Quality star 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Traffic Level: Low/i }));
        fireEvent.click(screen.getByRole('button', { name: /Road Surface: Patchy/i }));
        fireEvent.click(screen.getByRole('button', { name: /Gradient Profile: Flowing/i }));
        fireEvent.click(screen.getByRole('button', { name: /Sketchy Left Turns: 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Submit Segment/i }));

        await waitFor(() => {
            expect(screen.getByText(/still under review/i)).toBeInTheDocument();
            expect(screen.getByText(/rating has still been added/i)).toBeInTheDocument();
        });
        expect(mockOnExistingSegmentRated).toHaveBeenCalledTimes(1);
        expect(mockOnExistingSegmentRated).toHaveBeenCalledWith("segment-123");
    });
});
