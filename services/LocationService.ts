import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_LOCATION_TASK = 'LELERUN_BACKGROUND_LOCATION';

export type LocationPoint = {
    latitude: number;
    longitude: number;
    timestamp: number;
    speed: number | null;
    altitude: number | null;
};

// Global variable to store location callback
let locationCallback: ((location: LocationPoint) => void) | null = null;

// Register background task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }: any) => {
    if (error) {
        console.error('Background location error:', error);
        return;
    }
    if (data) {
        const { locations } = data;
        if (locations && locations.length > 0 && locationCallback) {
            const loc = locations[locations.length - 1];
            locationCallback({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                timestamp: loc.timestamp,
                speed: loc.coords.speed,
                altitude: loc.coords.altitude,
            });
        }
    }
});

export const LocationService = {
    /**
     * Request location permissions (foreground + background)
     */
    async requestPermissions(): Promise<boolean> {
        const { status: foreground } = await Location.requestForegroundPermissionsAsync();
        if (foreground !== 'granted') return false;

        const { status: background } = await Location.requestBackgroundPermissionsAsync();
        if (background !== 'granted') {
            console.warn('Background location permission not granted - tracking may stop when app is backgrounded');
        }
        return true;
    },

    /**
     * Start tracking location (foreground + background)
     */
    async startTracking(onLocation: (location: LocationPoint) => void): Promise<boolean> {
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) return false;

        locationCallback = onLocation;

        // Start foreground location updates (more frequent)
        await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.BestForNavigation,
                distanceInterval: 5, // Update every 5 meters
                timeInterval: 3000,  // Or every 3 seconds
            },
            (loc) => {
                if (locationCallback) {
                    locationCallback({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        timestamp: loc.timestamp,
                        speed: loc.coords.speed,
                        altitude: loc.coords.altitude,
                    });
                }
            }
        );

        // Start background location updates (keeps running when screen is off)
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
                notificationTitle: 'LeLeRun is tracking your run',
                notificationBody: 'Your workout is being recorded 🏃',
                notificationColor: '#58CC02',
            },
        });

        return true;
    },

    /**
     * Stop tracking location
     */
    async stopTracking(): Promise<void> {
        locationCallback = null;
        const isTracking = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (isTracking) {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        }
    },

    /**
     * Calculate distance between two points using Haversine formula (km)
     */
    calculateDistance(
        lat1: number, lon1: number,
        lat2: number, lon2: number
    ): number {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    /**
     * Calculate total distance from array of points (km)
     */
    calculateTotalDistance(points: LocationPoint[]): number {
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            total += this.calculateDistance(
                points[i - 1].latitude, points[i - 1].longitude,
                points[i].latitude, points[i].longitude
            );
        }
        return total;
    },

    /**
     * Convert route points to GeoJSON for storage
     */
    toGeoJSON(points: LocationPoint[]): object {
        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: points.map(p => [p.longitude, p.latitude, p.altitude || 0]),
            },
            properties: {
                timestamps: points.map(p => p.timestamp),
                speeds: points.map(p => p.speed),
            },
        };
    },

    /**
     * Parse GeoJSON back to coordinate array for map display
     */
    fromGeoJSON(geojson: any): { latitude: number; longitude: number }[] {
        if (!geojson?.geometry?.coordinates) return [];
        return geojson.geometry.coordinates.map((c: number[]) => ({
            latitude: c[1],
            longitude: c[0],
        }));
    },

    /**
     * Estimate calories burned (simple formula)
     */
    estimateCalories(distanceKm: number, durationMin: number): number {
        // MET-based estimation: running ~10 MET, walking ~3.5 MET
        const avgSpeedKmH = (distanceKm / durationMin) * 60;
        const met = avgSpeedKmH > 8 ? 10 : avgSpeedKmH > 5 ? 6.5 : 3.5;
        const weightKg = 70; // Default weight
        return Math.round((met * weightKg * (durationMin / 60)));
    },
};
