import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SubmissionForm from '../SubmissionForm';
import { submitSegment } from '@/utils/api';

jest.mock('@/utils/api', () => ({
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
        expect(screen.queryByLabelText(/Safety Notes/i)).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole('button', { name: /Overall Quality star 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Traffic Level: Low/i }));
        fireEvent.click(screen.getByRole('button', { name: /Road Surface: Patchy/i }));
        fireEvent.click(screen.getByRole('button', { name: /Gradient Profile: Flowing/i }));
        fireEvent.click(screen.getByRole('button', { name: /Sketchy Left Turns: 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Submit Segment/i }));

        expect(submitSegment).toHaveBeenCalledWith({
            strava_url: 'https://www.strava.com/segments/123',
            safety_notes: '',
            ratings: {
                overall_quality: 2,
                traffic_level: 1,
                road_surface: 2,
                gradient_profile: 2,
                sketchy_left_turns: 1,
            },
        }, 'mock-token');

        await waitFor(() => {
            expect(screen.getByText(/Submitted!/i)).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        }, { timeout: 2500 });
    });

    it('accepts activity segment-effort URLs', async () => {
        (submitSegment as jest.Mock).mockResolvedValueOnce({ status: 'created' });
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.change(screen.getByLabelText(/Strava Segment URL/i), {
            target: { value: 'https://www.strava.com/activities/17650152462/segments/3465746799772048188' },
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
    });
});
