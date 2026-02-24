import { supabase } from '@/lib/supabase';

/**
 * Beginner running progression plan (km per day)
 * Month 1: Start easy, gradually increase
 * Month 2+: Maintain with slight increases
 */
const BEGINNER_PROGRESSION: Record<number, number[]> = {
    // Week patterns: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    1: [1.0, 0, 1.5, 0, 1.0, 2.0, 0],    // Week 1: ~5.5 km total
    2: [1.5, 0, 2.0, 0, 1.5, 2.5, 0],    // Week 2: ~7.5 km
    3: [2.0, 1.0, 2.0, 0, 2.0, 3.0, 0],  // Week 3: ~10 km
    4: [2.0, 1.5, 2.5, 0, 2.0, 3.5, 0],  // Week 4: ~11.5 km
    5: [2.5, 1.5, 3.0, 1.0, 2.5, 4.0, 0], // Week 5+
    6: [3.0, 2.0, 3.0, 1.5, 3.0, 4.5, 0],
    7: [3.0, 2.0, 3.5, 2.0, 3.0, 5.0, 0],
    8: [3.5, 2.5, 3.5, 2.0, 3.5, 5.0, 0],
};

export const TargetService = {
    /**
     * Generate daily targets for a month
     */
    async generateMonthlyTargets(userId: string, year: number, month: number) {
        // Check if targets already exist
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const { data: existing } = await supabase
            .from('daily_targets')
            .select('id')
            .eq('user_id', userId)
            .gte('effective_date', startDate.toISOString().split('T')[0])
            .lte('effective_date', endDate.toISOString().split('T')[0]);

        if (existing && existing.length > 0) return; // Already generated

        // Determine which week the user is on
        const { data: profile } = await supabase
            .from('profiles')
            .select('created_at')
            .eq('id', userId)
            .single();

        const createdAt = profile ? new Date(profile.created_at) : new Date();
        const weeksSinceStart = Math.floor(
            (startDate.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
        );

        const targets: { user_id: string; target_km: number; effective_date: string }[] = [];
        const daysInMonth = endDate.getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ...
            const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon, 6=Sun

            const currentWeek = weeksSinceStart + Math.ceil(day / 7);
            const progressionWeek = Math.min(currentWeek, 8);
            const weekPattern = BEGINNER_PROGRESSION[progressionWeek] || BEGINNER_PROGRESSION[8];
            const targetKm = weekPattern[adjustedDay];

            if (targetKm > 0) {
                targets.push({
                    user_id: userId,
                    target_km: targetKm,
                    effective_date: date.toISOString().split('T')[0],
                });
            }
        }

        if (targets.length > 0) {
            await supabase.from('daily_targets').insert(targets);
        }
    },

    /**
     * Get today's target for a user
     */
    async getTodayTarget(userId: string): Promise<number> {
        const today = new Date().toISOString().split('T')[0];

        const { data } = await supabase
            .from('daily_targets')
            .select('target_km')
            .eq('user_id', userId)
            .eq('effective_date', today)
            .single();

        return data?.target_km || 0;
    },

    /**
     * Get all targets for a month
     */
    async getMonthTargets(userId: string, year: number, month: number) {
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('daily_targets')
            .select('*')
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
        const today = new Date().toISOString().split('T')[0];

        const { data } = await supabase
            .from('workouts')
            .select('distance_km')
            .eq('user_id', userId)
            .eq('date', today);

        if (!data) return 0;
        return data.reduce((total, w) => total + Number(w.distance_km), 0);
    },
};
