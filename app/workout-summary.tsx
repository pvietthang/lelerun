import { SafeMapView, SafePolyline } from '@/components/SafeMapView';
import { BorderRadius, Colors, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LocationService } from '@/services/LocationService';
import { StreakService } from '@/services/StreakService';
import { TargetService } from '@/services/TargetService';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WorkoutSummaryScreen() {
    const { user, refreshProfile } = useAuth();
    const params = useLocalSearchParams<{
        distance: string;
        duration: string;
        calories: string;
        routeGeoJSON: string;
        startedAt: string;
    }>();

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [rpEarned, setRpEarned] = useState(0);
    const [streakResult, setStreakResult] = useState<any>(null);

    const distance = parseFloat(params.distance || '0');
    const duration = parseInt(params.duration || '0');
    const calories = parseInt(params.calories || '0');
    const startedAt = params.startedAt || null;
    const finishedAt = new Date().toISOString();
    const routeGeoJSON = params.routeGeoJSON ? JSON.parse(params.routeGeoJSON) : null;
    const routeCoords = routeGeoJSON ? LocationService.fromGeoJSON(routeGeoJSON) : [];

    const mapRegion = routeCoords.length > 0
        ? {
            latitude: routeCoords[Math.floor(routeCoords.length / 2)].latitude,
            longitude: routeCoords[Math.floor(routeCoords.length / 2)].longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }
        : undefined;

    useEffect(() => {
        saveWorkout();
    }, []);

    const saveWorkout = async () => {
        if (!user || saving || saved) return;
        setSaving(true);

        try {
            // Save workout to database
            const { error } = await supabase.from('workouts').insert({
                user_id: user.id,
                distance_km: distance,
                duration_sec: duration,
                route_geojson: routeGeoJSON,
                calories: calories,
                date: new Date().toISOString().split('T')[0],
                started_at: startedAt,
                finished_at: finishedAt,
            });

            if (error) throw error;

            // Update streak and earn RP
            const todayTarget = await TargetService.getTodayTarget(user.id);
            const result = await StreakService.updateStreakAfterWorkout(user.id, distance, todayTarget);
            setRpEarned(result.rpEarned);
            setStreakResult(result);

            await refreshProfile();
            setSaved(true);
        } catch (error) {
            console.error('Error saving workout:', error);
        } finally {
            setSaving(false);
        }
    };

    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const avgPace = distance > 0 ? duration / distance : 0;
    const paceMin = Math.floor(avgPace / 60);
    const paceSec = Math.round(avgPace % 60);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.emoji}>🎉</Text>
                    <Text style={styles.title}>Hoàn thành chạy!</Text>
                </View>

                {/* Map */}
                {mapRegion && routeCoords.length > 1 && (
                    <View style={styles.mapCard}>
                        <SafeMapView
                            style={styles.map}
                            initialRegion={mapRegion}
                            scrollEnabled={false}
                            zoomEnabled={false}
                        >
                            <SafePolyline
                                coordinates={routeCoords}
                                strokeWidth={4}
                                strokeColor={Colors.primary}
                            />
                        </SafeMapView>
                    </View>
                )}

                {/* Stats */}
                <View style={styles.statsCard}>
                    <View style={styles.mainStat}>
                        <Text style={styles.mainStatValue}>{distance.toFixed(2)}</Text>
                        <Text style={styles.mainStatLabel}>kilometers</Text>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Ionicons name="time-outline" size={22} color={Colors.primary} />
                            <Text style={styles.statValue}>{formatTime(duration)}</Text>
                            <Text style={styles.statLabel}>Thời gian</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="speedometer-outline" size={22} color={Colors.primary} />
                            <Text style={styles.statValue}>{paceMin}:{String(paceSec).padStart(2, '0')}</Text>
                            <Text style={styles.statLabel}>Tốc độ /km</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="flame-outline" size={22} color={Colors.primary} />
                            <Text style={styles.statValue}>{calories}</Text>
                            <Text style={styles.statLabel}>Calories</Text>
                        </View>
                    </View>
                </View>

                {/* Rewards */}
                {saved && streakResult && (
                    <View style={styles.rewardsCard}>
                        <Text style={styles.rewardsTitle}>Phần thưởng 🏆</Text>

                        {streakResult.streakUpdated && (
                            <View style={styles.rewardItem}>
                                <Text style={styles.rewardEmoji}>🔥</Text>
                                <Text style={styles.rewardText}>
                                    Chuỗi: {streakResult.newStreak} ngày!
                                </Text>
                            </View>
                        )}

                        {rpEarned > 0 && (
                            <View style={styles.rewardItem}>
                                <Text style={styles.rewardEmoji}>💎</Text>
                                <Text style={styles.rewardText}>+{rpEarned} RP nhận được!</Text>
                            </View>
                        )}

                        {streakResult.penaltyCleared > 0 && (
                            <View style={styles.rewardItem}>
                                <Text style={styles.rewardEmoji}>✅</Text>
                                <Text style={styles.rewardText}>
                                    Đã xoá {streakResult.penaltyCleared.toFixed(1)} km phạt!
                                </Text>
                            </View>
                        )}

                        {!streakResult.streakUpdated && rpEarned === 0 && (
                            <View style={styles.rewardItem}>
                                <Text style={styles.rewardEmoji}>💪</Text>
                                <Text style={styles.rewardText}>
                                    Cố lên biểu! Chạy thêm để đạt mục tiêu.
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Done button */}
                <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => router.replace('/(tabs)')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.doneText}>XONG</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    emoji: { fontSize: 56 },
    title: {
        fontSize: FontSize.xxl,
        fontWeight: '800',
        color: Colors.text,
        marginTop: Spacing.sm,
    },
    mapCard: {
        height: 200,
        marginHorizontal: Spacing.lg,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginBottom: Spacing.lg,
    },
    map: { flex: 1 },
    statsCard: {
        backgroundColor: Colors.backgroundSecondary,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    mainStat: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    mainStatValue: {
        fontSize: 48,
        fontWeight: '800',
        color: Colors.primary,
    },
    mainStatLabel: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: { alignItems: 'center' },
    statValue: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
        marginTop: 4,
    },
    statLabel: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    rewardsCard: {
        backgroundColor: '#FFF8E1',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    rewardsTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    rewardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    rewardEmoji: { fontSize: 24, marginRight: Spacing.sm },
    rewardText: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.text,
    },
    doneButton: {
        backgroundColor: Colors.primary,
        height: 56,
        borderRadius: BorderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.xxl,
        ...Shadow.button,
    },
    doneText: {
        fontSize: FontSize.lg,
        fontWeight: '800',
        color: Colors.textOnPrimary,
        letterSpacing: 2,
    },
});
