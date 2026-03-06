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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders form fields correctly', () => {
        render(<SubmissionForm onClose={mockOnClose} />);
        expect(screen.getByText('Add a Segment')).toBeInTheDocument();
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
        (submitSegment as jest.Mock).mockResolvedValueOnce(undefined);
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.change(screen.getByLabelText(/Strava Segment URL/i), {
            target: { value: 'https://www.strava.com/segments/123' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Traffic star 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Steady Gradient star 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Sketchy Left Turns star 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Downhills star 1/i }));
        fireEvent.click(screen.getByRole('button', { name: /Submit Segment/i }));

        expect(submitSegment).toHaveBeenCalledWith({
            strava_url: 'https://www.strava.com/segments/123',
            safety_notes: '',
            ratings: {
                traffic: 2,
                steady_gradient: 2,
                sketchy_left_turns: 2,
                downhills: 2,
            },
        }, 'mock-token');

        await waitFor(() => {
            expect(screen.getByText(/Submitted!/i)).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        }, { timeout: 2500 });
    });
});
