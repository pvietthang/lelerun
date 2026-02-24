import { Colors, FontSize, Spacing } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Conditionally import react-native-maps
// It requires a native build and will crash on Expo Go
let MapViewComponent: any = null;
let PolylineComponent: any = null;
let MarkerComponent: any = null;

try {
    const Maps = require('react-native-maps');
    MapViewComponent = Maps.default;
    PolylineComponent = Maps.Polyline;
    MarkerComponent = Maps.Marker;
} catch (e) {
    // Maps not available (Expo Go)
}

interface SafeMapViewProps {
    style?: any;
    region?: any;
    initialRegion?: any;
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
    scrollEnabled,
    zoomEnabled,
    children,
    mapRef,
}: SafeMapViewProps) {
    if (!MapViewComponent) {
        return (
            <View style={[styles.placeholder, style]}>
                <Text style={styles.placeholderEmoji}>🗺️</Text>
                <Text style={styles.placeholderText}>Map requires a development build</Text>
                <Text style={styles.placeholderSubtext}>Run `npx expo run:android` to enable maps</Text>
            </View>
        );
    }

    return (
        <MapViewComponent
            ref={mapRef}
            style={style}
            region={region}
            initialRegion={initialRegion}
            showsUserLocation={showsUserLocation}
            followsUserLocation={followsUserLocation}
            scrollEnabled={scrollEnabled}
            zoomEnabled={zoomEnabled}
        >
            {children}
        </MapViewComponent>
    );
}

export function SafePolyline(props: any) {
    if (!PolylineComponent) return null;
    return <PolylineComponent {...props} />;
}

export function SafeMarker(props: any) {
    if (!MarkerComponent) return null;
    return <MarkerComponent {...props} />;
}

const styles = StyleSheet.create({
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
});
