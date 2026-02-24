import { supabase } from '@/lib/supabase';

/**
 * Progressive running target — Duolingo-style
 *
 * Phase 1  (day  1-29):  1.0 → 2.5 km  (beginner warm-up)
 * Phase 2  (day 30-59):  2.5 → 4.0 km  (building habit)
 * Phase 3  (day 60-99):  4.0 → 6.0 km  (intermediate)
 * Phase 4  (day 100+):   5.0 → 8.0 km  (advanced, slow climb)
 *
 * Each target = baseForPhase + (streakDay / daysInPhase) * phaseRange
 * Rounded to 0.5 km increments for clean display.
 */
function getTargetKm(streakDay: number): number {
    // streakDay: 1-indexed day within the current streak goal
    let raw: number;
    if (streakDay <= 30) {
        // Phase 1: 1.0 → 2.5 km over 30 days
        raw = 1.0 + ((streakDay - 1) / 29) * 1.5;
    } else if (streakDay <= 60) {
        // Phase 2: 2.5 → 4.0 km over 30 days
        raw = 2.5 + ((streakDay - 30) / 29) * 1.5;
    } else if (streakDay <= 100) {
        // Phase 3: 4.0 → 6.0 km over 40 days
        raw = 4.0 + ((streakDay - 60) / 39) * 2.0;
    } else {
        // Phase 4: 6.0 → 8.0 km (slow climb, cap at day 200)
        raw = 6.0 + (Math.min(streakDay - 100, 100) / 100) * 2.0;
    }
    // Round to nearest 0.5
    return Math.round(raw * 2) / 2;
}

function localDateStr(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + 'T12:00:00'); // noon to avoid DST edge cases
    d.setDate(d.getDate() + n);
    return localDateStr(d);
}

export const TargetService = {
    /**
     * Generate future targets starting from today.
     * streakDay = the streak counter for today (1 = first day of new streak).
     * Generates DAYS_AHEAD days into the future (not including past).
     */
    async generateFutureTargets(userId: string, startStreakDay: number, daysAhead = 90) {
        const today = localDateStr();
        const rows: { user_id: string; target_km: number; effective_date: string }[] = [];

        for (let i = 0; i < daysAhead; i++) {
            const date = addDays(today, i);
            const streakDay = startStreakDay + i;
            rows.push({
                user_id: userId,
                effective_date: date,
                target_km: getTargetKm(streakDay),
            });
        }

        // Upsert — updates if already exists (phase change, recalculate)
        await supabase
            .from('daily_targets')
            .upsert(rows, { onConflict: 'user_id,effective_date' });
    },

    /**
     * Delete all future targets for a user (from tomorrow onwards).
     * Called when streak is broken.
     */
    async deleteFutureTargets(userId: string) {
        const tomorrow = addDays(localDateStr(), 1);
        await supabase
            .from('daily_targets')
            .delete()
            .eq('user_id', userId)
            .gte('effective_date', tomorrow);
    },

    /**
     * Ensure today's target exists.
     * Called on app open and after workout.
     * If today has no target, user has started a new streak → generate from day 1.
     */
    async ensureTodayTarget(userId: string): Promise<number> {
        const today = localDateStr();

        // Check if today already has a target
        const { data: todayTarget } = await supabase
            .from('daily_targets')
            .select('target_km')
            .eq('user_id', userId)
            .eq('effective_date', today)
            .single();

        if (todayTarget) return Number(todayTarget.target_km);

        // No target for today → first day of (new) streak; look up current streak day
        const { data: streak } = await supabase
            .from('streaks')
            .select('current_streak')
            .eq('user_id', userId)
            .single();

        const currentStreak = streak?.current_streak ?? 0;
        const startDay = currentStreak + 1; // today becomes day N+1

        await this.generateFutureTargets(userId, startDay);
        return getTargetKm(startDay);
    },

    /**
     * Get today's target for a user (generates if missing)
     */
    async getTodayTarget(userId: string): Promise<number> {
        return this.ensureTodayTarget(userId);
    },

    /**
     * Get all targets for a month (for calendar display)
     */
    async getMonthTargets(userId: string, year: number, month: number) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
            .from('daily_targets')
            .select('effective_date, target_km')
            .eq('user_id', userId)
            .gte('effective_date', startDate)
            .lte('effective_date', endDate)
            .order('effective_date', { ascending: true });

        return { data, error };
    },

    /**
     * Get today's total workout distance
     */
    async getTodayDistance(userId: string): Promise<number> {
        const today = localDateStr();
        const { data } = await supabase
            .from('workouts')
            .select('distance_km')
            .eq('user_id', userId)
            .eq('date', today);

        if (!data) return 0;
        return data.reduce((sum, w) => sum + Number(w.distance_km), 0);
    },
};
