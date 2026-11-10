import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { UiFeedbackProvider } from '../ui/UiFeedbackProvider';
import InteractiveMap from '../Map';

jest.mock('react-map-gl/maplibre', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const listeners = new Map<string, Set<() => void>>();
    const mapState = {
        hasTerrainSource: true,
        isMoving: false,
        isTerrainLoaded: true,
        elevations: [200, 220],
    };
    const nativeMap = {
        fitBounds: jest.fn(() => {
            mapState.isMoving = true;
        }),
        flyTo: jest.fn(() => {
            mapState.isMoving = true;
        }),
        getSource: jest.fn(() => mapState.hasTerrainSource ? {} : undefined),
        isMoving: jest.fn(() => mapState.isMoving),
        isSourceLoaded: jest.fn(() => mapState.isTerrainLoaded),
        queryTerrainElevation: jest.fn(() => mapState.elevations.shift() ?? null),
        on: jest.fn((eventName: string, listener: () => void) => {
            const eventListeners = listeners.get(eventName) ?? new Set();
            eventListeners.add(listener);
            listeners.set(eventName, eventListeners);
        }),
        off: jest.fn((eventName: string, listener: () => void) => {
            listeners.get(eventName)?.delete(listener);
        }),
    };

    const MockMap = React.forwardRef(function MockMap(
        { children, onLoad }: { children?: React.ReactNode; onLoad?: () => void },
        ref: React.ForwardedRef<unknown>,
    ) {
        const onLoadRef = React.useRef(onLoad);
        React.useImperativeHandle(ref, () => ({
            getMap: () => nativeMap,
            fitBounds: nativeMap.fitBounds,
            flyTo: nativeMap.flyTo,
        }));
        React.useEffect(() => {
            onLoadRef.current?.();
        }, []);

        return <div data-testid="mock-map">{children}</div>;
    });

    return {
        __esModule: true,
        __emitMapEvent: (eventName: string) => {
            listeners.get(eventName)?.forEach((listener) => listener());
        },
        __mapState: mapState,
        __nativeMap: nativeMap,
        default: MockMap,
        Popup: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-popup">{children}</div>,
        Source: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-source">{children}</div>,
        Layer: () => <div data-testid="mock-layer" />,
        NavigationControl: () => null,
    };
});

const mapMock = jest.requireMock('react-map-gl/maplibre') as {
    __emitMapEvent: (eventName: string) => void;
    __mapState: {
        hasTerrainSource: boolean;
        isMoving: boolean;
        isTerrainLoaded: boolean;
        elevations: number[];
    };
    __nativeMap: {
        fitBounds: jest.Mock;
        flyTo: jest.Mock;
        queryTerrainElevation: jest.Mock;
    };
};

jest.mock('@/utils/polyline', () => ({
    decodePolyline: () => [[0, 0], [1, 1]],
}));

describe('InteractiveMap', () => {
    const mockSegments: import('@/types').Segment[] = [
        {
            id: "1",
            strava_url: "https://strava.com",
            name: "Test Flat",
            distance_km: 10,
            gradient_pct: 0,
            polyline: "abc",
            completion_times: { beginner: "10:00", intermediate: "08:00", advanced: "06:00" },
            approved: true
        }
    ];

    beforeEach(() => {
        mapMock.__mapState.hasTerrainSource = true;
        mapMock.__mapState.isMoving = false;
        mapMock.__mapState.isTerrainLoaded = true;
        mapMock.__mapState.elevations = [200, 220];
        jest.clearAllMocks();
    });

    it('waits for focused terrain tiles before sampling the elevation profile', async () => {
        render(
            <UiFeedbackProvider>
                <InteractiveMap
                    segments={mockSegments}
                    autoSelectFocusedSegment
                    focusSegmentId="1"
                />
            </UiFeedbackProvider>
        );

        await waitFor(() => expect(mapMock.__nativeMap.fitBounds).toHaveBeenCalled());
        await act(async () => {
            await new Promise((resolve) => window.setTimeout(resolve, 0));
        });
        expect(mapMock.__nativeMap.queryTerrainElevation).not.toHaveBeenCalled();

        act(() => {
            mapMock.__mapState.isMoving = false;
            mapMock.__emitMapEvent('idle');
        });

        await waitFor(() => expect(mapMock.__nativeMap.queryTerrainElevation).toHaveBeenCalledTimes(2));
        expect(screen.getByText(/↗ 10 m/)).toBeInTheDocument();
    });
});
