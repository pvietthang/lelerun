import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { TargetService } from '@/services/TargetService';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Modal,
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
    started_at: string | null;
    finished_at: string | null;
}

interface DayData {
    date: string;
    completed: boolean;
    hasTarget: boolean;
    targetKm: number;
    distanceKm: number;
}

interface Friend {
    id: string;
    username: string;
}

// Local date string YYYY-MM-DD (avoids UTC shift issues)
function localDateStr(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Format time hh:MM am/pm from ISO string
function formatTime(iso: string | null): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

export default function HistoryScreen() {
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
    const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Friend picker state
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedUser, setSelectedUser] = useState<Friend | null>(null);
    const [pickerVisible, setPickerVisible] = useState(false);

    const viewingId = selectedUser?.id ?? user?.id;

    const loadFriends = useCallback(async () => {
        if (!user) return;
        const { data: friendships } = await supabase
            .from('friendships')
            .select('requester_id, addressee_id')
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
            .eq('status', 'accepted');

        if (!friendships || friendships.length === 0) { setFriends([]); return; }

        const friendIds = friendships.map(f =>
            f.requester_id === user.id ? f.addressee_id : f.requester_id
        );
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', friendIds);

        setFriends(profiles || []);
    }, [user]);

    const loadData = useCallback(async () => {
        if (!viewingId) return;

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        const end = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
        const isOwn = viewingId === user?.id;

        const [targetsResult, workoutsResult] = await Promise.all([
            isOwn
                ? TargetService.getMonthTargets(viewingId, year, month)
                : Promise.resolve({ data: [] }),
            supabase
                .from('workouts')
                .select('id, date, distance_km, duration_sec, route_geojson, started_at, finished_at')
                .eq('user_id', viewingId)
                .gte('date', start)
                .lte('date', end)
                .order('started_at', { ascending: false }),
        ]);

        const targets = (targetsResult.data || []) as any[];
        const monthWorkouts = (workoutsResult.data || []) as WorkoutItem[];
        setWorkouts(monthWorkouts);

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
    }, [viewingId, currentMonth, user]);

    useFocusEffect(
        useCallback(() => {
            loadFriends();
            loadData();
        }, [loadFriends, loadData])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadFriends(), loadData()]);
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
    const today = localDateStr();

    // Build calendar as 2D array of weeks (Monday-first)
    // This avoids the flexWrap + percentage-width floating point bug in React Native
    const buildCalendarWeeks = (): (DayData | null)[][] => {
        const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const rawDay = firstDayOfMonth.getDay(); // 0=Sun 1=Mon ... 6=Sat
        const offset = rawDay === 0 ? 6 : rawDay - 1; // Mon=0 ... Sun=6

        const weeks: (DayData | null)[][] = [];
        let week: (DayData | null)[] = Array(offset).fill(null);
        for (const day of calendarDays) {
            week.push(day);
            if (week.length === 7) { weeks.push(week); week = []; }
        }
        if (week.length > 0) {
            while (week.length < 7) week.push(null);
            weeks.push(week);
        }
        return weeks;
    };
    const calendarWeeks = buildCalendarWeeks();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header row */}
                <View style={styles.headerRow}>
                    <Text style={styles.title}>Lịch sử</Text>
                    <TouchableOpacity
                        style={styles.friendPickerBtn}
                        onPress={() => setPickerVisible(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={selectedUser ? 'person' : 'person-circle-outline'}
                            size={16}
                            color={Colors.primary}
                        />
                        <Text style={styles.friendPickerText} numberOfLines={1}>
                            {selectedUser ? selectedUser.username : 'Lịch sử của tôi'}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={Colors.primary} />
                    </TouchableOpacity>
                </View>

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

                {/* Calendar — 2D week rows, no flexWrap */}
                <View style={styles.calendarCard}>
                    {/* Weekday headers */}
                    <View style={styles.calWeekHeader}>
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                            <Text key={i} style={styles.calHeaderCell}>{d}</Text>
                        ))}
                    </View>
                    {calendarWeeks.map((week, wi) => (
                        <View key={wi} style={styles.calWeekRow}>
                            {week.map((day, di) => {
                                if (!day) return <View key={di} style={styles.calDayCell} />;
                                const dayNum = parseInt(day.date.split('-')[2]);
                                const isToday = day.date === today;
                                const isPast = day.date < today;
                                const isFuture = day.date > today;
                                return (
                                    <View key={di} style={[styles.calDayCell, isToday && styles.todayCell]}>
                                        <Text style={[styles.dayNum, isToday && styles.todayText]}>{dayNum}</Text>
                                        {day.hasTarget && (
                                            <Text style={[styles.dayTarget, day.completed && isPast && styles.dayTargetDone]}>
                                                {day.targetKm.toFixed(1)}
                                            </Text>
                                        )}
                                        {day.hasTarget && isPast && day.completed && (
                                            <Ionicons name="checkmark-circle" size={12} color={Colors.calendarCompleted} />
                                        )}
                                        {day.hasTarget && isPast && !day.completed && (
                                            <Ionicons name="close-circle" size={12} color={Colors.calendarMissed} />
                                        )}
                                        {!day.hasTarget && isPast && day.distanceKm > 0 && (
                                            <Ionicons name="checkmark-circle" size={12} color={Colors.calendarCompleted} />
                                        )}
                                        {isFuture && day.hasTarget && (
                                            <View style={styles.futureDot} />
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </View>

                {/* Workout list */}
                <Text style={styles.sectionTitle}>
                    {selectedUser ? `Bài tập của ${selectedUser.username}` : 'Gần đay'}
                </Text>
                {workouts.length === 0 ? (
                    <Text style={styles.emptyText}>
                        Chưa có bài tập nào.{!selectedUser ? ' Bắt đầu chạy ngay! 🏃' : ''}
                    </Text>
                ) : (
                    workouts.map(wo => (
                        <TouchableOpacity
                            key={wo.id}
                            style={styles.workoutCard}
                            onPress={() => router.push({ pathname: '/workout-detail', params: { id: wo.id } })}
                            activeOpacity={0.75}
                        >
                            {/* Date block */}
                            <View style={styles.workoutDate}>
                                <Text style={styles.workoutDay}>{new Date(wo.date + 'T00:00:00').getDate()}</Text>
                                <Text style={styles.workoutMonth}>
                                    {new Date(wo.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                                </Text>
                            </View>

                            {/* Main info */}
                            <View style={styles.workoutInfo}>
                                <Text style={styles.workoutDistance}>{Number(wo.distance_km).toFixed(2)} km</Text>
                                <Text style={styles.workoutDuration}>{formatDuration(wo.duration_sec)}</Text>
                                {/* Start → End time */}
                                {(wo.started_at || wo.finished_at) && (
                                    <View style={styles.timeRow}>
                                        <Ionicons name="time-outline" size={11} color={Colors.textLight} />
                                        <Text style={styles.timeText}>
                                            {formatTime(wo.started_at)} → {formatTime(wo.finished_at)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Pace */}
                            <View style={styles.workoutPace}>
                                <Text style={styles.paceValue}>
                                    {wo.duration_sec > 0 && Number(wo.distance_km) > 0
                                        ? formatPace(wo.duration_sec, Number(wo.distance_km))
                                        : '--'}
                                </Text>
                                <Text style={styles.paceLabel}>/km</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Friend picker modal */}
            <Modal
                visible={pickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setPickerVisible(false)}
                >
                    <View style={styles.pickerSheet}>
                        <Text style={styles.pickerTitle}>Xem Lịch Sử</Text>
                        <TouchableOpacity
                            style={[styles.pickerItem, !selectedUser && styles.pickerItemActive]}
                            onPress={() => { setSelectedUser(null); setPickerVisible(false); }}
                        >
                            <Ionicons name="person-circle-outline" size={22} color={!selectedUser ? Colors.primary : Colors.textSecondary} />
                            <Text style={[styles.pickerItemText, !selectedUser && styles.pickerItemTextActive]}>Lịch sử của tôi</Text>
                            {!selectedUser && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                        </TouchableOpacity>

                        {friends.length > 0 && (
                            <>
                                <Text style={styles.pickerSectionLabel}>Bạn bè</Text>
                                {friends.map(f => (
                                    <TouchableOpacity
                                        key={f.id}
                                        style={[styles.pickerItem, selectedUser?.id === f.id && styles.pickerItemActive]}
                                        onPress={() => { setSelectedUser(f); setPickerVisible(false); }}
                                    >
                                        <View style={styles.friendAvatar}>
                                            <Text style={styles.friendAvatarText}>{(f.username || '?')[0].toUpperCase()}</Text>
                                        </View>
                                        <Text style={[styles.pickerItemText, selectedUser?.id === f.id && styles.pickerItemTextActive]}>
                                            {f.username}
                                        </Text>
                                        {selectedUser?.id === f.id && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </>
                        )}
                        {friends.length === 0 && (
                            <Text style={styles.noFriendsText}>Thêm bạn bè để xem lịch sử của họ 🤝</Text>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
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
    headerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    },
    title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
    friendPickerBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: Colors.primary + '18',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1.5, borderColor: Colors.primary + '40',
        maxWidth: 160,
    },
    friendPickerText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary, flexShrink: 1 },
    monthNav: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    monthText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
    calendarCard: {
        backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.lg, padding: Spacing.md, marginBottom: Spacing.lg,
    },
    calWeekHeader: { flexDirection: 'row', marginBottom: 4 },
    calHeaderCell: {
        flex: 1, textAlign: 'center',
        fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary,
        paddingVertical: 4,
    },
    calWeekRow: { flexDirection: 'row' },
    calDayCell: {
        flex: 1, minHeight: 54,
        justifyContent: 'flex-start', alignItems: 'center',
        paddingTop: 3, paddingBottom: 2,
    },
    todayCell: { backgroundColor: Colors.calendarToday + '20', borderRadius: BorderRadius.md },
    dayNum: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
    todayText: { color: Colors.calendarToday, fontWeight: '800' },
    dayTarget: { fontSize: 9, fontWeight: '600', color: Colors.textLight, marginTop: 1 },
    dayTargetDone: { color: Colors.calendarCompleted },
    futureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.calendarFuture, marginTop: 2 },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    emptyText: { textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl },
    workoutCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.backgroundCard, borderRadius: BorderRadius.lg,
        padding: Spacing.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
        borderWidth: 1, borderColor: Colors.borderLight,
    },
    workoutDate: { width: 46, alignItems: 'center', marginRight: 4 },
    workoutDay: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primary },
    workoutMonth: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },
    workoutInfo: { flex: 1, marginLeft: Spacing.sm },
    workoutDistance: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
    workoutDuration: { fontSize: FontSize.sm, color: Colors.textSecondary },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    timeText: { fontSize: 11, color: Colors.textLight },
    workoutPace: { alignItems: 'center' },
    paceValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
    paceLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    pickerSheet: {
        backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingTop: Spacing.lg, paddingBottom: 32, paddingHorizontal: Spacing.lg,
    },
    pickerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md, textAlign: 'center' },
    pickerSectionLabel: {
        fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary,
        textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm,
    },
    pickerItem: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.lg, marginBottom: 4,
    },
    pickerItemActive: { backgroundColor: Colors.primary + '12' },
    pickerItemText: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
    pickerItemTextActive: { color: Colors.primary },
    friendAvatar: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center',
    },
    friendAvatarText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
    noFriendsText: { textAlign: 'center', color: Colors.textSecondary, fontSize: FontSize.sm, paddingVertical: Spacing.lg },
});
