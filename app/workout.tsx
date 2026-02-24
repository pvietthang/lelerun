import { SafeMapView, SafeMapViewRef, SafePolyline, UserLocationMarker } from '@/components/SafeMapView';
import { BorderRadius, Colors, FontSize, Shadow, Spacing } from '@/constants/theme';
import { LocationPoint, LocationService } from '@/services/LocationService';
import { MotionService, MotionState } from '@/services/MotionService';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert, AppState,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WorkoutScreen() {
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [distance, setDistance] = useState(0); // km
    const [duration, setDuration] = useState(0); // seconds
    const [speed, setSpeed] = useState(0); // km/h
    const [calories, setCalories] = useState(0);
    const [motionState, setMotionState] = useState<MotionState>('stationary');
    const [routePoints, setRoutePoints] = useState<LocationPoint[]>([]);
    const [mapRegion, setMapRegion] = useState<any>(null);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const pausedDurationRef = useRef<number>(0);
    const pauseStartRef = useRef<number>(0);
    const mapRef = useRef<SafeMapViewRef>(null);
    const lastLocationRef = useRef<LocationPoint | null>(null); // Latest GPS point for locate button
    const emaSpeedRef = useRef<number>(0); // Exponential moving average for smooth speed display
    const appStateRef = useRef(AppState.currentState);

    // Handle app state changes (background/foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
                // Going to background - timer continues via Date diff
            }
            if (nextState === 'active' && isRunning && !isPaused) {
                // Coming back to foreground - recalculate duration from start time
                updateDurationFromTime();
            }
            appStateRef.current = nextState;
        });

        return () => subscription.remove();
    }, [isRunning, isPaused]);

    const updateDurationFromTime = () => {
        if (startTimeRef.current > 0 && !isPaused) {
            const now = Date.now();
            const elapsed = Math.floor((now - startTimeRef.current) / 1000) - Math.floor(pausedDurationRef.current / 1000);
            setDuration(elapsed);
        }
    };

    const startWorkout = async () => {
        const hasPermission = await LocationService.requestPermissions();
        if (!hasPermission) {
            Alert.alert('Permission Required', 'Location permission is needed to track your run.');
            return;
        }

        setIsRunning(true);
        setIsPaused(false);
        startTimeRef.current = Date.now();
        pausedDurationRef.current = 0;

        // Start timer
        timerRef.current = setInterval(() => {
            updateDurationFromTime();
        }, 1000);

        // Start location tracking
        await LocationService.startTracking((location) => {
            // --- Speed: prefer GPS chip speed (Doppler), fallback to position diff ---
            let rawSpeedKmh = 0;
            const prev = lastLocationRef.current;

            if (location.speed !== null && location.speed >= 0) {
                // GPS chip speed is in m/s
                rawSpeedKmh = location.speed * 3.6;
            } else if (prev) {
                // Fallback: distance between consecutive points
                const distKm = LocationService.calculateDistance(
                    prev.latitude, prev.longitude,
                    location.latitude, location.longitude
                );
                const elapsedSec = (location.timestamp - prev.timestamp) / 1000;
                if (elapsedSec > 0) rawSpeedKmh = (distKm / elapsedSec) * 3600;
            }

            // Exponential Moving Average (α=0.25) — smooth without too much lag
            const alpha = 0.25;
            emaSpeedRef.current = alpha * rawSpeedKmh + (1 - alpha) * emaSpeedRef.current;
            setSpeed(Math.round(emaSpeedRef.current * 10) / 10);


            // Store latest location for locate button
            lastLocationRef.current = location;

            setRoutePoints(prev => {
                const newPoints = [...prev, location];
                const totalDist = LocationService.calculateTotalDistance(newPoints);
                setDistance(totalDist);

                // Update calories
                const elapsed = (Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000;
                const elapsedMin = elapsed / 60;
                setCalories(LocationService.estimateCalories(totalDist, elapsedMin));

                // Set initial map center only once — camera stays put after user pans
                setMapRegion((prev: any) => prev ?? {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                });

                return newPoints;
            });
        });

        // Start motion detection
        MotionService.startMonitoring(setMotionState);
    };

    const pauseWorkout = () => {
        setIsPaused(true);
        pauseStartRef.current = Date.now();
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const resumeWorkout = () => {
        setIsPaused(false);
        pausedDurationRef.current += Date.now() - pauseStartRef.current;

        timerRef.current = setInterval(() => {
            updateDurationFromTime();
        }, 1000);
    };

    const stopWorkout = () => {
        Alert.alert('End Workout', 'Are you sure you want to end this workout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'End',
                style: 'destructive',
                onPress: async () => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    await LocationService.stopTracking();
                    MotionService.stopMonitoring();

                    // Navigate to summary
                    router.replace({
                        pathname: '/workout-summary',
                        params: {
                            distance: distance.toFixed(4),
                            duration: duration.toString(),
                            calories: calories.toString(),
                            routeGeoJSON: JSON.stringify(LocationService.toGeoJSON(routePoints)),
                            startedAt: new Date(startTimeRef.current).toISOString(),
                        },
                    });
                },
            },
        ]);
    };

    useEffect(() => {
        // Auto-start workout
        startWorkout();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            LocationService.stopTracking();
            MotionService.stopMonitoring();
        };
    }, []);

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const mapCoords = routePoints.map(p => ({ latitude: p.latitude, longitude: p.longitude }));

    const getMotionEmoji = () => {
        switch (motionState) {
            case 'running': return '🏃';
            case 'walking': return '🚶';
            default: return '🧍';
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Map */}
            <View style={styles.mapContainer}>
                {mapRegion ? (
                    <SafeMapView
                        ref={mapRef}
                        style={styles.map}
                        region={mapRegion}
                    >
                        {mapCoords.length > 1 && (
                            <SafePolyline
                                coordinates={mapCoords}
                                strokeWidth={5}
                                strokeColor={Colors.primary}
                            />
                        )}
                        {/* Custom marker at exact GPS point — no offset from route */}
                        {mapCoords.length > 0 && (
                            <UserLocationMarker
                                latitude={mapCoords[mapCoords.length - 1].latitude}
                                longitude={mapCoords[mapCoords.length - 1].longitude}
                            />
                        )}
                    </SafeMapView>
                ) : (
                    <View style={styles.mapPlaceholder}>
                        <Ionicons name="location" size={48} color={Colors.textLight} />
                        <Text style={styles.mapPlaceholderText}>Waiting for GPS signal...</Text>
                    </View>
                )}

                {/* Motion state badge */}
                <View style={styles.motionBadge}>
                    <Text style={styles.motionEmoji}>{getMotionEmoji()}</Text>
                    <Text style={styles.motionText}>{motionState}</Text>
                </View>

                {/* Locate me button */}
                {mapRegion && (
                    <TouchableOpacity
                        style={styles.locateButton}
                        onPress={() => {
                            const loc = lastLocationRef.current;
                            if (loc) mapRef.current?.centerOnUser(loc.longitude, loc.latitude);
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="locate" size={22} color={Colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Stats */}
            <View style={styles.statsArea}>
                <Text style={styles.distanceValue}>{distance.toFixed(2)}</Text>
                <Text style={styles.distanceLabel}>kilometers</Text>

                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                        <Text style={styles.statValue}>{formatTime(duration)}</Text>
                        <Text style={styles.statLabel}>Duration</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="speedometer-outline" size={20} color={Colors.textSecondary} />
                        <Text style={styles.statValue}>{speed.toFixed(1)}</Text>
                        <Text style={styles.statLabel}>Speed km/h</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="flame-outline" size={20} color={Colors.textSecondary} />
                        <Text style={styles.statValue}>{calories}</Text>
                        <Text style={styles.statLabel}>Calories</Text>
                    </View>
                </View>

                {/* Controls */}
                <View style={styles.controls}>
                    {isPaused ? (
                        <TouchableOpacity style={styles.resumeButton} onPress={resumeWorkout}>
                            <Ionicons name="play" size={32} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.pauseButton} onPress={pauseWorkout}>
                            <Ionicons name="pause" size={32} color="#fff" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.stopButton} onPress={stopWorkout}>
                        <Ionicons name="stop" size={32} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    mapContainer: {
        flex: 1,
        minHeight: 250,
        position: 'relative',
    },
    map: { flex: 1 },
    mapPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundSecondary,
    },
    mapPlaceholderText: {
        fontSize: FontSize.md,
        color: Colors.textLight,
        marginTop: Spacing.sm,
    },
    motionBadge: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        ...Shadow.sm,
    },
    locateButton: {
        position: 'absolute',
        bottom: Spacing.md,
        right: Spacing.md,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.md,
    },
    motionEmoji: { fontSize: 18, marginRight: 4 },
    motionText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.text,
        textTransform: 'capitalize',
    },
    statsArea: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    distanceValue: {
        fontSize: 56,
        fontWeight: '800',
        color: Colors.text,
    },
    distanceLabel: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: Spacing.xl,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        color: Colors.text,
        marginTop: 4,
    },
    statLabel: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg,
    },
    pauseButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.md,
    },
    resumeButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.button,
    },
    stopButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.buttonDanger,
    },
});
