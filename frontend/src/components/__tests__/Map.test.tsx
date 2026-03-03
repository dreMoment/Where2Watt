import { render } from '@testing-library/react';
import React from 'react';
import InteractiveMap from '../Map';

jest.mock('react-map-gl/maplibre', () => {
    return {
        __esModule: true,
        default: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-map">{children}</div>,
        Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-popup">{children}</div>,
        Source: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-source">{children}</div>,
        Layer: () => <div data-testid="mock-layer" />,
    };
});

jest.mock('@/utils/polyline', () => ({
    decodePolyline: () => [[0, 0], [1, 1]],
}));

describe('InteractiveMap', () => {
    const mockSegments: import('@/types').Segment[] = [
        {
            _id: "1",
            id: "1",
            strava_url: "https://strava.com",
            terrain: "Flat" as const,
            name: "Test Flat",
            distance_km: 10,
            gradient_pct: 0,
            polyline: "abc",
            completion_times: { beginner: "10:00", intermediate: "08:00", advanced: "06:00" },
            approved: true
        }
    ];

    it('renders map with segments', () => {
        const { getByTestId, getAllByTestId } = render(<InteractiveMap segments={mockSegments} activeFilter="All" />);
        expect(getByTestId('mock-map')).toBeInTheDocument();
        expect(getAllByTestId('mock-source').length).toBeGreaterThan(0);
        expect(getByTestId('mock-layer')).toBeInTheDocument();
    });
});
