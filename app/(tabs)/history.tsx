import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TargetService } from '@/services/TargetService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface WorkoutItem {
    id: string;
    date: string;
    distance_km: number;
    duration_sec: number;
    route_geojson: any;
}

interface DayData {
    date: string;
    completed: boolean;
    hasTarget: boolean;
    targetKm: number;
    distanceKm: number;
}

export default function HistoryScreen() {
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
    const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        if (!user) return;

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;

        // Get targets and workouts for the month
        const [targetsResult, workoutsResult] = await Promise.all([
            TargetService.getMonthTargets(user.id, year, month),
            supabase
                .from('workouts')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
                .lte('date', `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`)
                .order('date', { ascending: false }),
        ]);

        const targets = targetsResult.data || [];
        const monthWorkouts = workoutsResult.data || [];
        setWorkouts(monthWorkouts);

        // Build calendar data
        const daysInMonth = new Date(year, month, 0).getDate();
        const days: DayData[] = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const target = targets.find((t: any) => t.effective_date === dateStr);
            const dayWorkouts = monthWorkouts.filter(w => w.date === dateStr);
            const totalKm = dayWorkouts.reduce((sum, w) => sum + Number(w.distance_km), 0);

            days.push({
                date: dateStr,
                completed: target ? totalKm >= Number(target.target_km) : totalKm > 0,
                hasTarget: !!target,
                targetKm: target ? Number(target.target_km) : 0,
                distanceKm: totalKm,
            });
        }

        setCalendarDays(days);
    }, [user, currentMonth]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const changeMonth = (delta: number) => {
        setCurrentMonth(prev => {
            const next = new Date(prev);
            next.setMonth(next.getMonth() + delta);
            return next;
        });
    };

    const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const today = new Date().toISOString().split('T')[0];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>History</Text>

                {/* Month navigation */}
                <View style={styles.monthNav}>
                    <TouchableOpacity onPress={() => changeMonth(-1)}>
                        <Ionicons name="chevron-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>{monthName}</Text>
                    <TouchableOpacity onPress={() => changeMonth(1)}>
                        <Ionicons name="chevron-forward" size={24} color={Colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Calendar grid */}
                <View style={styles.calendarCard}>
                    {/* Weekday headers */}
                    <View style={styles.weekRow}>
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                            <Text key={i} style={styles.weekDay}>{d}</Text>
                        ))}
                    </View>

                    {/* Day cells */}
                    <View style={styles.daysGrid}>
                        {/* Empty cells for offset */}
                        {Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }).map((_, i) => (
                            <View key={`empty-${i}`} style={styles.dayCell} />
                        ))}

                        {calendarDays.map((day) => {
                            const dayNum = parseInt(day.date.split('-')[2]);
                            const isToday = day.date === today;
                            const isPast = day.date < today;
                            const isFuture = day.date > today;

                            return (
                                <View key={day.date} style={[styles.dayCell, isToday && styles.todayCell]}>
                                    <Text style={[styles.dayNum, isToday && styles.todayText]}>
                                        {dayNum}
                                    </Text>
                                    {day.hasTarget && isPast && day.completed && (
                                        <Ionicons name="checkmark-circle" size={16} color={Colors.calendarCompleted} />
                                    )}
                                    {day.hasTarget && isPast && !day.completed && (
                                        <Ionicons name="close-circle" size={16} color={Colors.calendarMissed} />
                                    )}
                                    {!day.hasTarget && isPast && day.distanceKm > 0 && (
                                        <Ionicons name="checkmark-circle" size={16} color={Colors.calendarCompleted} />
                                    )}
                                    {isFuture && day.hasTarget && (
                                        <View style={styles.futureDot} />
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Workout list */}
                <Text style={styles.sectionTitle}>Recent Workouts</Text>
                {workouts.length === 0 ? (
                    <Text style={styles.emptyText}>No workouts this month yet. Start running! 🏃</Text>
                ) : (
                    workouts.map(wo => (
                        <View key={wo.id} style={styles.workoutCard}>
                            <View style={styles.workoutDate}>
                                <Text style={styles.workoutDay}>
                                    {new Date(wo.date).getDate()}
                                </Text>
                                <Text style={styles.workoutMonth}>
                                    {new Date(wo.date).toLocaleDateString('en-US', { month: 'short' })}
                                </Text>
                            </View>
                            <View style={styles.workoutInfo}>
                                <Text style={styles.workoutDistance}>{Number(wo.distance_km).toFixed(2)} km</Text>
                                <Text style={styles.workoutDuration}>{formatDuration(wo.duration_sec)}</Text>
                            </View>
                            <View style={styles.workoutPace}>
                                <Text style={styles.paceValue}>
                                    {wo.duration_sec > 0 && Number(wo.distance_km) > 0
                                        ? formatPace(wo.duration_sec, Number(wo.distance_km))
                                        : '--'}
                                </Text>
                                <Text style={styles.paceLabel}>/km</Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPace(seconds: number, km: number): string {
    const paceSeconds = seconds / km;
    const m = Math.floor(paceSeconds / 60);
    const s = Math.round(paceSeconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    title: {
        fontSize: FontSize.xxl,
        fontWeight: '800',
        color: Colors.text,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
    },
    monthNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    monthText: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
    },
    calendarCard: {
        backgroundColor: Colors.backgroundSecondary,
        borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: Spacing.sm,
    },
    weekDay: {
        width: 40,
        textAlign: 'center',
        fontSize: FontSize.xs,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 2,
    },
    todayCell: {
        backgroundColor: Colors.calendarToday + '20',
        borderRadius: BorderRadius.md,
    },
    dayNum: {
        fontSize: FontSize.sm,
        fontWeight: '600',
        color: Colors.text,
    },
    todayText: {
        color: Colors.calendarToday,
        fontWeight: '800',
    },
    futureDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.calendarFuture,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: FontSize.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xl,
    },
    workoutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundCard,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    workoutDate: {
        width: 50,
        alignItems: 'center',
    },
    workoutDay: {
        fontSize: FontSize.xl,
        fontWeight: '800',
        color: Colors.primary,
    },
    workoutMonth: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    workoutInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    workoutDistance: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
    },
    workoutDuration: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    workoutPace: {
        alignItems: 'center',
    },
    paceValue: {
        fontSize: FontSize.md,
        fontWeight: '700',
        color: Colors.text,
    },
    paceLabel: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },
});
