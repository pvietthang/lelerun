import { ProgressRing } from '@/components/ProgressRing';
import { BorderRadius, Colors, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { StreakService } from '@/services/StreakService';
import { TargetService } from '@/services/TargetService';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [todayTarget, setTodayTarget] = useState(0);
  const [todayDistance, setTodayDistance] = useState(0);
  const [streak, setStreak] = useState({ current_streak: 0, longest_streak: 0, penalty_km: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;

    // Generate targets for current month if needed
    const now = new Date();
    await TargetService.generateMonthlyTargets(user.id, now.getFullYear(), now.getMonth() + 1);

    // Check and apply penalties for missed days
    await StreakService.checkAndApplyPenalties(user.id);

    // Fetch today's data
    const [target, distance, streakData] = await Promise.all([
      TargetService.getTodayTarget(user.id),
      TargetService.getTodayDistance(user.id),
      StreakService.getStreak(user.id),
    ]);

    setTodayTarget(target);
    setTodayDistance(distance);
    if (streakData.data) setStreak(streakData.data);
    await refreshProfile();
  }, [user]);

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

  const progress = todayTarget > 0 ? todayDistance / todayTarget : 0;
  const totalRequired = todayTarget + (streak.penalty_km || 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.streakBadge}>
              <Text style={styles.streakIcon}>🔥</Text>
              <Text style={styles.streakCount}>{streak.current_streak}</Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>LeLeRun</Text>
          <View style={styles.headerRight}>
            <View style={styles.rpBadge}>
              <Text style={styles.rpIcon}>💎</Text>
              <Text style={styles.rpCount}>{profile?.rp_balance || 0}</Text>
            </View>
          </View>
        </View>

        {/* Mascot */}
        <View style={styles.mascotArea}>
          <Text style={styles.mascot}>🏃‍♂️</Text>
          <Text style={styles.greeting}>
            {getGreeting()}, {profile?.username || 'Runner'}!
          </Text>
        </View>

        {/* Progress Ring */}
        <View style={styles.progressArea}>
          <ProgressRing
            progress={progress}
            size={220}
            current={todayDistance.toFixed(1)}
            target={todayTarget.toFixed(1)}
          />
        </View>

        {/* Penalty warning */}
        {streak.penalty_km > 0 && (
          <View style={styles.penaltyCard}>
            <Ionicons name="warning" size={20} color={Colors.danger} />
            <Text style={styles.penaltyText}>
              Penalty: +{streak.penalty_km.toFixed(1)} km from missed days!
            </Text>
          </View>
        )}

        {/* Today's info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Today's Target</Text>
              <Text style={styles.infoValue}>
                {todayTarget > 0 ? `${todayTarget.toFixed(1)} km` : 'Rest day 😴'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Best Streak</Text>
              <Text style={styles.infoValue}>{streak.longest_streak} days</Text>
            </View>
          </View>
        </View>

        {/* Start Run Button */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push('/workout')}
          activeOpacity={0.8}
        >
          <Ionicons name="play" size={28} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.startButtonText}>START RUN</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  headerLeft: {},
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primary,
  },
  headerRight: {},
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  streakIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  streakCount: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.streakFire,
  },
  rpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  rpIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  rpCount: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.rpGem,
  },
  mascotArea: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  mascot: {
    fontSize: 64,
  },
  greeting: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  progressArea: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  penaltyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  penaltyText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  infoCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    height: 64,
    borderRadius: BorderRadius.xl,
    ...Shadow.button,
  },
  startButtonText: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.textOnPrimary,
    letterSpacing: 2,
  },
});
