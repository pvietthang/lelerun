import { supabase } from '@/lib/supabase';

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
            // No streak record, create one
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
     * Update streak after a workout
     * Returns: { streakUpdated, rpEarned, penaltyCleared }
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

        const today = new Date().toISOString().split('T')[0];
        const lastRun = streak.last_run_date;
        let currentStreak = streak.current_streak || 0;
        let longestStreak = streak.longest_streak || 0;
        let penaltyKm = streak.penalty_km || 0;

        // Calculate remaining distance after meeting target + penalty
        const totalRequired = targetKm + penaltyKm;
        let remaining = distanceKm;
        let penaltyCleared = 0;

        // First, clear penalty with distance
        if (penaltyKm > 0) {
            if (remaining >= penaltyKm) {
                penaltyCleared = penaltyKm;
                remaining -= penaltyKm;
                penaltyKm = 0;
            } else {
                penaltyCleared = remaining;
                penaltyKm -= remaining;
                remaining = 0;
            }
        }

        // Then check if target is met
        const targetMet = remaining >= targetKm;
        let rpEarned = 0;

        if (targetMet) {
            // Excess distance → RP (1 RP per 100m excess)
            const excessKm = remaining - targetKm;
            rpEarned = Math.floor(excessKm * 10); // 10 RP per km = 1 RP per 100m

            // Update streak
            if (lastRun) {
                const lastDate = new Date(lastRun);
                const todayDate = new Date(today);
                const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    currentStreak += 1;
                } else if (diffDays > 1) {
                    currentStreak = 1;
                }
                // diffDays === 0 means already ran today, don't increment
            } else {
                currentStreak = 1;
            }

            longestStreak = Math.max(longestStreak, currentStreak);
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

        // Update RP balance
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
     * Check missed days and apply penalties
     * Should be called when the app opens
     */
    async checkAndApplyPenalties(userId: string): Promise<number> {
        const { data: streak } = await this.getStreak(userId);
        if (!streak || !streak.last_run_date) return 0;

        const today = new Date();
        const lastRun = new Date(streak.last_run_date);
        const diffDays = Math.floor((today.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) return 0;

        // Check if user has active skip cards
        const missedDays = diffDays - 1;
        let actualMissed = missedDays;

        const { data: skipCards } = await supabase
            .from('purchases')
            .select('*, shop_items!inner(type)')
            .eq('user_id', userId)
            .eq('shop_items.type', 'skip_day')
            .is('used_at', null)
            .gte('expires_at', new Date().toISOString());

        if (skipCards && skipCards.length > 0) {
            // Use available skip cards (up to missed days)
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
            // Get daily targets for missed days
            const { data: targets } = await supabase
                .from('daily_targets')
                .select('target_km')
                .eq('user_id', userId)
                .order('effective_date', { ascending: false })
                .limit(1);

            const targetKm = targets?.[0]?.target_km || 2.0;
            const penaltyKm = actualMissed * targetKm;

            // Add penalty and reset streak
            await supabase
                .from('streaks')
                .update({
                    penalty_km: (streak.penalty_km || 0) + penaltyKm,
                    current_streak: 0,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

            return penaltyKm;
        }

        return 0;
    },
};
