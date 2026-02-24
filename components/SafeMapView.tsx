import { Colors, FontSize, Spacing } from '@/constants/theme';
import MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

// OpenFreeMap - completely free vector tile map, no API key required
// Provides full road network, buildings, labels (powered by OpenStreetMap data)
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Initialize MapLibre with no access token
MapLibreGL.setAccessToken(null);

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
    followsUserLocation?: boolean;
    scrollEnabled?: boolean;
    zoomEnabled?: boolean;
    children?: React.ReactNode;
    mapRef?: React.RefObject<any>;
}

export function SafeMapView({
    style,
    region,
    initialRegion,
    showsUserLocation,
    followsUserLocation,
    children,
    mapRef,
}: SafeMapViewProps) {
    const cameraRef = useRef<any>(null);

    const activeRegion = region || initialRegion;

    // When region changes, animate camera
    useEffect(() => {
        if (region && cameraRef.current && !followsUserLocation) {
            cameraRef.current.flyTo([region.longitude, region.latitude], 300);
        }
    }, [region, followsUserLocation]);

    return (
        <MapLibreGL.MapView
            ref={mapRef}
            style={[styles.map, style]}
            mapStyle={MAP_STYLE_URL}
            attributionEnabled={true}
            logoEnabled={false}
        >
            <MapLibreGL.Camera
                ref={cameraRef}
                zoomLevel={15}
                centerCoordinate={
                    activeRegion
                        ? [activeRegion.longitude, activeRegion.latitude]
                        : [106.6297, 10.8231] // Default: Hồ Chí Minh
                }
                followUserLocation={followsUserLocation}
                followZoomLevel={15}
                animationMode="flyTo"
                animationDuration={300}
            />
            {showsUserLocation && (
                <MapLibreGL.UserLocation
                    visible={true}
                    showsUserHeadingIndicator={true}
                />
            )}
            {children}
        </MapLibreGL.MapView>
    );
}

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
    markerDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: Colors.primary,
        borderWidth: 2,
        borderColor: '#fff',
    },
});
