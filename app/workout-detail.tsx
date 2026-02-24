import { SafeMapView, SafePolyline } from '@/components/SafeMapView';
import { BorderRadius, Colors, FontSize, Shadow, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { LocationService } from '@/services/LocationService';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Workout {
    id: string;
    date: string;
    distance_km: number;
    duration_sec: number;
    calories: number;
    avg_speed_kmh: number | null;
    route_geojson: any;
}

export default function WorkoutDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [workout, setWorkout] = useState<Workout | null>(null);
    const [loading, setLoading] = useState(true);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        if (!id) return;
        supabase
            .from('workouts')
            .select('*')
            .eq('id', id)
            .single()
            .then(({ data }) => {
                setWorkout(data);
                setLoading(false);
            });
    }, [id]);

    const routeCoords = workout?.route_geojson
        ? LocationService.fromGeoJSON(workout.route_geojson)
        : [];

    // Center map on the middle of the route
    const mapRegion = routeCoords.length > 0
        ? {
            latitude: routeCoords[Math.floor(routeCoords.length / 2)].latitude,
            longitude: routeCoords[Math.floor(routeCoords.length / 2)].longitude,
        }
        : undefined;

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const avgPace = workout && workout.distance_km > 0
        ? workout.duration_sec / workout.distance_km
        : 0;
    const paceMin = Math.floor(avgPace / 60);
    const paceSec = Math.round(avgPace % 60);

    const dateLabel = workout
        ? new Date(workout.date).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })
        : '';

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
            </SafeAreaView>
        );
    }

    if (!workout) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.errorText}>Workout not found.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Workout Detail</Text>
                    <Text style={styles.headerDate}>{dateLabel}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Map */}
                <View style={styles.mapCard}>
                    {mapRegion && routeCoords.length > 1 ? (
                        <SafeMapView
                            ref={mapRef}
                            style={styles.map}
                            initialRegion={mapRegion}
                        >
                            <SafePolyline
                                coordinates={routeCoords}
                                strokeWidth={5}
                                strokeColor={Colors.primary}
                            />
                        </SafeMapView>
                    ) : (
                        <View style={styles.noMap}>
                            <Ionicons name="map-outline" size={48} color={Colors.textLight} />
                            <Text style={styles.noMapText}>No route data</Text>
                        </View>
                    )}
                </View>

                {/* Main distance */}
                <View style={styles.distanceCard}>
                    <Text style={styles.distanceValue}>
                        {Number(workout.distance_km).toFixed(2)}
                    </Text>
                    <Text style={styles.distanceLabel}>kilometers</Text>
                </View>

                {/* Stats grid */}
                <View style={styles.statsCard}>
                    <View style={styles.statRow}>
                        <StatItem
                            icon="time-outline"
                            value={formatTime(workout.duration_sec)}
                            label="Duration"
                        />
                        <View style={styles.divider} />
                        <StatItem
                            icon="speedometer-outline"
                            value={avgPace > 0 ? `${paceMin}:${String(paceSec).padStart(2, '0')}` : '--'}
                            label="Avg Pace /km"
                        />
                    </View>
                    <View style={styles.statRowBorder} />
                    <View style={styles.statRow}>
                        <StatItem
                            icon="flame-outline"
                            value={String(workout.calories)}
                            label="Calories"
                        />
                        <View style={styles.divider} />
                        <StatItem
                            icon="flash-outline"
                            value={workout.avg_speed_kmh
                                ? `${Number(workout.avg_speed_kmh).toFixed(1)}`
                                : (workout.distance_km > 0 && workout.duration_sec > 0
                                    ? `${((workout.distance_km / workout.duration_sec) * 3600).toFixed(1)}`
                                    : '--')}
                            label="Avg Speed km/h"
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function StatItem({ icon, value, label }: { icon: any; value: string; label: string }) {
    return (
        <View style={styles.statItem}>
            <Ionicons name={icon} size={24} color={Colors.primary} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
    },
    headerDate: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    mapCard: {
        height: 280,
        margin: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadow.md,
    },
    map: { flex: 1 },
    noMap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundSecondary,
    },
    noMapText: {
        fontSize: FontSize.md,
        color: Colors.textLight,
        marginTop: Spacing.sm,
    },
    distanceCard: {
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    distanceValue: {
        fontSize: 64,
        fontWeight: '800',
        color: Colors.primary,
        lineHeight: 72,
    },
    distanceLabel: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    statsCard: {
        backgroundColor: Colors.backgroundSecondary,
        borderRadius: BorderRadius.xl,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.xxl,
        ...Shadow.sm,
        overflow: 'hidden',
    },
    statRow: {
        flexDirection: 'row',
        paddingVertical: Spacing.lg,
    },
    statRowBorder: {
        height: 1,
        backgroundColor: Colors.borderLight,
        marginHorizontal: Spacing.lg,
    },
    divider: {
        width: 1,
        backgroundColor: Colors.borderLight,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        color: Colors.text,
    },
    statLabel: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    errorText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        marginTop: 40,
        fontSize: FontSize.md,
    },
});
