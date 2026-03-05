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

jest.mock('@/components/ui/UiFeedbackProvider', () => ({
    useUiFeedback: () => ({
        showToast: jest.fn(),
        confirm: jest.fn(),
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
        expect(screen.getByLabelText(/Safety Notes/i)).toBeInTheDocument();
    });

    it('submits form data successfully', async () => {
        (submitSegment as jest.Mock).mockResolvedValueOnce(undefined);
        render(<SubmissionForm onClose={mockOnClose} />);

        fireEvent.change(screen.getByLabelText(/Strava Segment URL/i), {
            target: { value: 'https://www.strava.com/segments/123' },
        });
        fireEvent.change(screen.getByLabelText(/Safety Notes/i), {
            target: { value: 'Watch out' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Submit Segment/i }));

        expect(submitSegment).toHaveBeenCalledWith({
            strava_url: 'https://www.strava.com/segments/123',
            safety_notes: 'Watch out',
        }, 'mock-token');

        await waitFor(() => {
            expect(screen.getByText(/Submitted!/i)).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        }, { timeout: 2500 });
    });
});
