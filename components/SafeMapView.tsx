import { Colors, FontSize, Spacing } from '@/constants/theme';
import MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

// OpenFreeMap - completely free vector tile map, no API key required
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Initialize MapLibre with no access token
MapLibreGL.setAccessToken(null);

export interface SafeMapViewRef {
    /** Fly camera to the given GPS coordinate */
    centerOnUser(longitude: number, latitude: number): void;
}

interface SafeMapViewProps {
    style?: any;
    region?: {
        latitude: number;
        longitude: number;
        latitudeDelta?: number;
        longitudeDelta?: number;
    };
    initialRegion?: {
        latitude: number;
        longitude: number;
        latitudeDelta?: number;
        longitudeDelta?: number;
    };
    showsUserLocation?: boolean;
    scrollEnabled?: boolean;
    zoomEnabled?: boolean;
    children?: React.ReactNode;
}

export const SafeMapView = React.forwardRef<SafeMapViewRef, SafeMapViewProps>(function SafeMapView({
    style,
    region,
    initialRegion,
    children,
}: SafeMapViewProps, ref) {
    const cameraRef = useRef<any>(null);
    const activeRegion = region || initialRegion;

    // Expose centerOnUser method to parent — uses flyTo with real GPS coordinate
    useImperativeHandle(ref, () => ({
        centerOnUser(longitude: number, latitude: number) {
            if (cameraRef.current) {
                cameraRef.current.flyTo([longitude, latitude], 600);
            }
        },
    }));

    return (
        <MapLibreGL.MapView
            style={[styles.map, style]}
            mapStyle={MAP_STYLE_URL}
            attributionEnabled={true}
            logoEnabled={false}
        >
            <MapLibreGL.Camera
                ref={cameraRef}
                defaultSettings={{
                    centerCoordinate: activeRegion
                        ? [activeRegion.longitude, activeRegion.latitude]
                        : [106.6297, 10.8231],
                    zoomLevel: 15,
                }}
            />
            {children}
        </MapLibreGL.MapView>
    );
});

interface PolylineProps {
    coordinates: { latitude: number; longitude: number }[];
    strokeColor?: string;
    strokeWidth?: number;
}

export function SafePolyline({ coordinates, strokeColor, strokeWidth }: PolylineProps) {
    if (!coordinates || coordinates.length < 2) return null;

    const geoJSON: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates.map(c => [c.longitude, c.latitude]),
                },
            },
        ],
    };

    return (
        <MapLibreGL.ShapeSource id="route-source" shape={geoJSON}>
            <MapLibreGL.LineLayer
                id="route-line"
                style={{
                    lineColor: strokeColor || Colors.primary,
                    lineWidth: strokeWidth || 5,
                    lineCap: 'round',
                    lineJoin: 'round',
                }}
            />
        </MapLibreGL.ShapeSource>
    );
}

/** Current position marker — uses ShapeSource to avoid camera follow side-effect of PointAnnotation */
export function UserLocationMarker({ latitude, longitude }: { latitude: number; longitude: number }) {
    const point: GeoJSON.Feature<GeoJSON.Point> = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
        },
    };

    return (
        <MapLibreGL.ShapeSource id="user-location-source" shape={point}>
            {/* Outer halo */}
            <MapLibreGL.CircleLayer
                id="user-location-halo"
                style={{
                    circleRadius: 13,
                    circleColor: 'rgba(0, 122, 255, 0.2)',
                    circleStrokeWidth: 0,
                }}
            />
            {/* Inner blue dot */}
            <MapLibreGL.CircleLayer
                id="user-location-dot"
                style={{
                    circleRadius: 7,
                    circleColor: '#007AFF',
                    circleStrokeWidth: 2.5,
                    circleStrokeColor: '#ffffff',
                }}
            />
        </MapLibreGL.ShapeSource>
    );
}

interface MarkerProps {
    coordinate: { latitude: number; longitude: number };
    children?: React.ReactNode;
}

export function SafeMarker({ coordinate, children }: MarkerProps) {
    return (
        <MapLibreGL.PointAnnotation
            id={`marker-${coordinate.latitude}-${coordinate.longitude}`}
            coordinate={[coordinate.longitude, coordinate.latitude]}
        >
            {children ? <>{children}</> : <View style={styles.markerDot} />}
        </MapLibreGL.PointAnnotation>
    );
}

const styles = StyleSheet.create({
    map: {
        flex: 1,
    },
    placeholder: {
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    placeholderEmoji: {
        fontSize: 48,
        marginBottom: Spacing.sm,
    },
    placeholderText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    placeholderSubtext: {
        fontSize: FontSize.xs,
        color: Colors.textLight,
        marginTop: 4,
    },
    userDotOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(0, 122, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userDotInner: {
        width: 13,
        height: 13,
        borderRadius: 6.5,
        backgroundColor: '#007AFF',
        borderWidth: 2,
        borderColor: '#fff',
    },
    markerDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: Colors.primary,
        borderWidth: 2,
        borderColor: '#fff',
    },
});
