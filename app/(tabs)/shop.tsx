import { BorderRadius, Colors, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ShopService } from '@/services/ShopService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert, RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ShopItem {
    id: string;
    name: string;
    description: string;
    type: string;
    rp_cost: number;
}

export default function ShopScreen() {
    const { user, profile, refreshProfile } = useAuth();
    const [items, setItems] = useState<ShopItem[]>([]);
    const [weeklyCount, setWeeklyCount] = useState<Record<string, number>>({});
    const [activeCards, setActiveCards] = useState(0);
    const [buying, setBuying] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        if (!user) return;

        const [itemsResult, skipCardsResult] = await Promise.all([
            ShopService.getItems(),
            ShopService.getActiveSkipCards(user.id),
        ]);

        if (itemsResult.data) {
            setItems(itemsResult.data);

            // Check weekly purchase counts
            const counts: Record<string, number> = {};
            for (const item of itemsResult.data) {
                counts[item.id] = await ShopService.getWeeklyPurchaseCount(user.id, item.id);
            }
            setWeeklyCount(counts);
        }

        setActiveCards(skipCardsResult.data?.length || 0);
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        await refreshProfile();
        setRefreshing(false);
    };

    const handleBuy = async (item: ShopItem) => {
        if (!user) return;

        Alert.alert(
            'Confirm Purchase',
            `Buy "${item.name}" for ${item.rp_cost} RP?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Buy',
                    onPress: async () => {
                        setBuying(item.id);
                        const result = await ShopService.purchaseSkipCard(user.id, item.id, item.rp_cost);
                        setBuying(null);

                        if (result.error) {
                            Alert.alert('Purchase Failed', result.error.message);
                        } else {
                            Alert.alert('Success! 🎉', `You bought "${item.name}"! It will expire in 24 hours.`);
                            await loadData();
                            await refreshProfile();
                        }
                    },
                },
            ]
        );
    };

    const getItemIcon = (type: string) => {
        switch (type) {
            case 'skip_day': return '🛌';
            default: return '🎁';
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Shop</Text>
                    <View style={styles.rpBadge}>
                        <Text style={styles.rpIcon}>💎</Text>
                        <Text style={styles.rpCount}>{profile?.rp_balance || 0} RP</Text>
                    </View>
                </View>

                {/* Active cards info */}
                {activeCards > 0 && (
                    <View style={styles.activeInfo}>
                        <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                        <Text style={styles.activeText}>
                            You have {activeCards} active skip card{activeCards > 1 ? 's' : ''}
                        </Text>
                    </View>
                )}

                {/* Items */}
                {items.map(item => {
                    const weekCount = weeklyCount[item.id] || 0;
                    const isMaxed = item.type === 'skip_day' && weekCount >= 2;
                    const canAfford = (profile?.rp_balance || 0) >= item.rp_cost;

                    return (
                        <View key={item.id} style={styles.itemCard}>
                            <View style={styles.itemHeader}>
                                <Text style={styles.itemIcon}>{getItemIcon(item.type)}</Text>
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <Text style={styles.itemDesc}>{item.description}</Text>
                                </View>
                            </View>

                            <View style={styles.itemFooter}>
                                {item.type === 'skip_day' && (
                                    <View style={styles.limitBadge}>
                                        <Text style={styles.limitText}>{weekCount}/2 this week</Text>
                                    </View>
                                )}

                                <View style={styles.priceContainer}>
                                    <Text style={styles.price}>💎 {item.rp_cost}</Text>
                                </View>

                                <TouchableOpacity
                                    style={[
                                        styles.buyButton,
                                        (!canAfford || isMaxed) && styles.buyButtonDisabled,
                                    ]}
                                    onPress={() => handleBuy(item)}
                                    disabled={!canAfford || isMaxed || buying === item.id}
                                    activeOpacity={0.8}
                                >
                                    {buying === item.id ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.buyText}>
                                            {isMaxed ? 'MAX' : !canAfford ? 'NOT ENOUGH' : 'BUY'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}

                {items.length === 0 && (
                    <Text style={styles.emptyText}>No items available yet. Check back later! 🏪</Text>
                )}

                {/* How to earn RP */}
                <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>💡 How to earn RP</Text>
                    <Text style={styles.infoDesc}>
                        Run more than your daily target! Every extra 100m = 1 RP. Keep running and level up! 🏃‍♂️
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    title: {
        fontSize: FontSize.xxl,
        fontWeight: '800',
        color: Colors.text,
    },
    rpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3E5F5',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
    },
    rpIcon: { fontSize: 18, marginRight: 4 },
    rpCount: { fontSize: FontSize.md, fontWeight: '700', color: Colors.rpGem },
    activeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        marginHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
    },
    activeText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: '600',
        marginLeft: Spacing.sm,
    },
    itemCard: {
        backgroundColor: Colors.backgroundCard,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 2,
        borderColor: Colors.borderLight,
        ...Shadow.sm,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    itemIcon: { fontSize: 40, marginRight: Spacing.md },
    itemInfo: { flex: 1 },
    itemName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
    itemDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    itemFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    limitBadge: {
        backgroundColor: Colors.warning + '30',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    limitText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.accent },
    priceContainer: { flex: 1, alignItems: 'center' },
    price: { fontSize: FontSize.md, fontWeight: '700', color: Colors.rpGem },
    buyButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        minWidth: 90,
        alignItems: 'center',
        ...Shadow.button,
    },
    buyButtonDisabled: {
        backgroundColor: Colors.surface,
        shadowOpacity: 0,
        elevation: 0,
    },
    buyText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
    emptyText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: FontSize.md,
        paddingVertical: Spacing.xxl,
    },
    infoBox: {
        backgroundColor: '#E3F2FD',
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.md,
        marginBottom: Spacing.xxl,
    },
    infoTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
    infoDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
});
