import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { StreakService } from '@/services/StreakService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert, ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
    const { user, profile, signOut, refreshProfile } = useAuth();
    const [streak, setStreak] = useState({ current_streak: 0, longest_streak: 0, penalty_km: 0 });
    const [totalWorkouts, setTotalWorkouts] = useState(0);
    const [totalDistance, setTotalDistance] = useState(0);

    useFocusEffect(
        useCallback(() => {
            if (!user) return;
            const load = async () => {
                const [streakData, workouts] = await Promise.all([
                    StreakService.getStreak(user.id),
                    supabase
                        .from('workouts')
                        .select('distance_km')
                        .eq('user_id', user.id),
                ]);

                if (streakData.data) setStreak(streakData.data);
                if (workouts.data) {
                    setTotalWorkouts(workouts.data.length);
                    setTotalDistance(workouts.data.reduce((sum, w) => sum + Number(w.distance_km), 0));
                }
                await refreshProfile();
            };
            load();
        }, [user])
    );

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: signOut },
        ]);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Profile</Text>

                {/* Avatar & name */}
                <View style={styles.profileSection}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarText}>
                            {(profile?.username || '?')[0].toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.username}>{profile?.username || 'Runner'}</Text>
                    <Text style={styles.email}>{user?.email}</Text>
                </View>

                {/* Stats grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statEmoji}>🔥</Text>
                        <Text style={styles.statValue}>{streak.current_streak}</Text>
                        <Text style={styles.statLabel}>Day Streak</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statEmoji}>🏆</Text>
                        <Text style={styles.statValue}>{streak.longest_streak}</Text>
                        <Text style={styles.statLabel}>Best Streak</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statEmoji}>🏃</Text>
                        <Text style={styles.statValue}>{totalWorkouts}</Text>
                        <Text style={styles.statLabel}>Workouts</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statEmoji}>📏</Text>
                        <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
                        <Text style={styles.statLabel}>Total km</Text>
                    </View>
                </View>

                {/* RP */}
                <View style={styles.rpCard}>
                    <Text style={styles.rpIcon}>💎</Text>
                    <View>
                        <Text style={styles.rpValue}>{profile?.rp_balance || 0} RP</Text>
                        <Text style={styles.rpLabel}>Run Points</Text>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
                    <Ionicons name="log-out-outline" size={22} color={Colors.danger} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
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
    profileSection: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    avatarText: {
        fontSize: 42,
        fontWeight: '700',
        color: Colors.primary,
    },
    username: {
        fontSize: FontSize.xl,
        fontWeight: '700',
        color: Colors.text,
    },
    email: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    statCard: {
        width: '48%',
        backgroundColor: Colors.backgroundSecondary,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        flexGrow: 1,
    },
    statEmoji: { fontSize: 28, marginBottom: Spacing.xs },
    statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
    statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
    rpCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3E5F5',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    rpIcon: { fontSize: 36, marginRight: Spacing.md },
    rpValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.rpGem },
    rpLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        marginHorizontal: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        borderColor: Colors.danger + '40',
        marginBottom: Spacing.xxl,
    },
    logoutText: {
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.danger,
        marginLeft: Spacing.sm,
    },
});
