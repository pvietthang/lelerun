import { supabase } from '@/lib/supabase';
import { TargetService } from './TargetService';

function localDateStr(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const StreakService = {
    /**
     * Get streak data for a user
     */
    async getStreak(userId: string) {
        const { data, error } = await supabase
            .from('streaks')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code === 'PGRST116') {
            const { data: newStreak, error: createError } = await supabase
                .from('streaks')
                .insert({ user_id: userId, current_streak: 0, longest_streak: 0, penalty_km: 0 })
                .select()
                .single();
            return { data: newStreak, error: createError };
        }

        return { data, error };
    },

    /**
     * Update streak after a workout.
     * Returns: { streakUpdated, rpEarned, penaltyCleared, newStreak }
     */
    async updateStreakAfterWorkout(
        userId: string,
        distanceKm: number,
        targetKm: number
    ): Promise<{
        streakUpdated: boolean;
        rpEarned: number;
        penaltyCleared: number;
        newStreak: number;
    }> {
        const { data: streak } = await this.getStreak(userId);
        if (!streak) return { streakUpdated: false, rpEarned: 0, penaltyCleared: 0, newStreak: 0 };

        const today = localDateStr();
        const lastRun = streak.last_run_date;
        let currentStreak = streak.current_streak || 0;
        let longestStreak = streak.longest_streak || 0;
        let penaltyKm = streak.penalty_km || 0;
        let penaltyCleared = 0;
        let rpEarned = 0;

        // First, clear penalty with distance
        if (penaltyKm > 0) {
            if (distanceKm >= penaltyKm) {
                penaltyCleared = penaltyKm;
                penaltyKm = 0;
            } else {
                penaltyCleared = distanceKm;
                penaltyKm -= distanceKm;
            }
        }

        // Remaining distance after penalty
        const remaining = distanceKm - penaltyCleared;
        const targetMet = targetKm > 0 ? remaining >= targetKm : distanceKm > 0;

        if (targetMet) {
            // Bonus RP for excess distance (10 RP per km)
            if (targetKm > 0) {
                const excessKm = remaining - targetKm;
                rpEarned = Math.max(0, Math.floor(excessKm * 10));
            }

            // Only update streak if this is a NEW run day
            const alreadyRanToday = lastRun === today;
            if (!alreadyRanToday) {
                if (lastRun) {
                    const diffDays = Math.floor(
                        (new Date(today + 'T12:00:00').getTime() - new Date(lastRun + 'T12:00:00').getTime())
                        / (1000 * 60 * 60 * 24)
                    );
                    if (diffDays === 1) {
                        currentStreak += 1;
                    } else if (diffDays > 1) {
                        currentStreak = 1;
                    }
                } else {
                    currentStreak = 1;
                }
                longestStreak = Math.max(longestStreak, currentStreak);

                // Re-generate future targets based on NEW streak day
                // Today is streak day `currentStreak`, tomorrow = currentStreak+1, etc.
                await TargetService.generateFutureTargets(userId, currentStreak + 1, 90);
            }
        }

        // Update streak record
        await supabase
            .from('streaks')
            .update({
                current_streak: currentStreak,
                longest_streak: longestStreak,
                last_run_date: today,
                penalty_km: penaltyKm,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        // Award RP
        if (rpEarned > 0) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('rp_balance')
                .eq('id', userId)
                .single();
            if (profileData) {
                await supabase
                    .from('profiles')
                    .update({ rp_balance: (profileData.rp_balance || 0) + rpEarned })
                    .eq('id', userId);
            }
        }

        return { streakUpdated: targetMet, rpEarned, penaltyCleared, newStreak: currentStreak };
    },

    /**
     * Check missed days and apply penalties / reset streak.
     * Should be called when the app opens.
     * Returns penalty km added (0 if none).
     */
    async checkAndApplyPenalties(userId: string): Promise<number> {
        const { data: streak } = await this.getStreak(userId);
        if (!streak || !streak.last_run_date) {
            // First time user, just ensure today has a target
            await TargetService.ensureTodayTarget(userId);
            return 0;
        }

        const today = localDateStr();
        const lastRun = streak.last_run_date;

        if (lastRun === today) {
            // Already ran today, target is fine
            await TargetService.ensureTodayTarget(userId);
            return 0;
        }

        const diffDays = Math.floor(
            (new Date(today + 'T12:00:00').getTime() - new Date(lastRun + 'T12:00:00').getTime())
            / (1000 * 60 * 60 * 24)
        );

        if (diffDays <= 1) {
            // Yesterday → streak still intact, ensure today's target exists
            await TargetService.ensureTodayTarget(userId);
            return 0;
        }

        // Missed 1+ days
        const missedDays = diffDays - 1;

        // Try to consume skip cards first
        const { data: skipCards } = await supabase
            .from('purchases')
            .select('id, shop_items!inner(type)')
            .eq('user_id', userId)
            .eq('shop_items.type', 'skip_day')
            .is('used_at', null)
            .gte('expires_at', new Date().toISOString());

        let actualMissed = missedDays;
        if (skipCards && skipCards.length > 0) {
            const cardsToUse = Math.min(skipCards.length, missedDays);
            for (let i = 0; i < cardsToUse; i++) {
                await supabase
                    .from('purchases')
                    .update({ used_at: new Date().toISOString() })
                    .eq('id', skipCards[i].id);
            }
            actualMissed -= cardsToUse;
        }

        if (actualMissed > 0) {
            // Get last known target as base for penalty
            const { data: lastTarget } = await supabase
                .from('daily_targets')
                .select('target_km')
                .eq('user_id', userId)
                .lte('effective_date', today)
                .order('effective_date', { ascending: false })
                .limit(1);

            const targetKm = lastTarget?.[0]?.target_km || 2.0;
            const penaltyKm = actualMissed * Number(targetKm);

            // Reset streak and add penalty
            await supabase
                .from('streaks')
                .update({
                    penalty_km: (streak.penalty_km || 0) + penaltyKm,
                    current_streak: 0,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

            // Delete future targets — user starts fresh next run
            await TargetService.deleteFutureTargets(userId);

            // Ensure today has a target (day 1 of new streak)
            await TargetService.ensureTodayTarget(userId);

            return penaltyKm;
        }

        // Had skip cards, streak preserved — ensure today's target
        await TargetService.ensureTodayTarget(userId);
        return 0;
    },
};
