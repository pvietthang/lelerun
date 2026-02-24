import { supabase } from '@/lib/supabase';

export const ShopService = {
    /**
     * Get all shop items
     */
    async getItems() {
        const { data, error } = await supabase
            .from('shop_items')
            .select('*')
            .order('rp_cost', { ascending: true });
        return { data, error };
    },

    /**
     * Purchase a skip day card
     * Validates: enough RP, max 2/week, sets 24h expiry
     */
    async purchaseSkipCard(userId: string, itemId: string, rpCost: number) {
        // Check current RP balance
        const { data: profile } = await supabase
            .from('profiles')
            .select('rp_balance')
            .eq('id', userId)
            .single();

        if (!profile || profile.rp_balance < rpCost) {
            return { error: { message: 'Not enough RP' } };
        }

        // Check weekly limit (max 2 per week)
        const now = new Date();
        const currentWeek = getISOWeek(now);
        const currentYear = now.getFullYear();
        const weekOfYear = currentYear * 100 + currentWeek;

        const { count } = await supabase
            .from('purchases')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('item_id', itemId)
            .eq('week_of_year', weekOfYear);

        if (count !== null && count >= 2) {
            return { error: { message: 'Maximum 2 skip cards per week' } };
        }

        // Create purchase with 24h expiry
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const { data: purchase, error: purchaseError } = await supabase
            .from('purchases')
            .insert({
                user_id: userId,
                item_id: itemId,
                expires_at: expiresAt.toISOString(),
                week_of_year: weekOfYear,
            })
            .select()
            .single();

        if (purchaseError) return { error: purchaseError };

        // Deduct RP
        await supabase
            .from('profiles')
            .update({ rp_balance: profile.rp_balance - rpCost })
            .eq('id', userId);

        return { data: purchase, error: null };
    },

    /**
     * Get user's active (unused, not expired) skip cards
     */
    async getActiveSkipCards(userId: string) {
        const { data, error } = await supabase
            .from('purchases')
            .select('*, shop_items!inner(name, type)')
            .eq('user_id', userId)
            .eq('shop_items.type', 'skip_day')
            .is('used_at', null)
            .gte('expires_at', new Date().toISOString());
        return { data, error };
    },

    /**
     * Get purchases this week for limit checking
     */
    async getWeeklyPurchaseCount(userId: string, itemId: string): Promise<number> {
        const now = new Date();
        const weekOfYear = now.getFullYear() * 100 + getISOWeek(now);

        const { count } = await supabase
            .from('purchases')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('item_id', itemId)
            .eq('week_of_year', weekOfYear);

        return count || 0;
    },
};

/**
 * Get ISO week number
 */
function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
