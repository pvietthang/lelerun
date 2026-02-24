import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert, RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface FriendProfile {
    id: string;
    username: string;
    avatar_url: string | null;
    rp_balance: number;
}

interface Friendship {
    id: string;
    status: string;
    requester_id: string;
    addressee_id: string;
    friend: FriendProfile;
}

export default function FriendsScreen() {
    const { user } = useAuth();
    const [friends, setFriends] = useState<Friendship[]>([]);
    const [pendingReceived, setPendingReceived] = useState<Friendship[]>([]);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        if (!user) return;

        // Get accepted friendships
        const { data: friendships } = await supabase
            .from('friendships')
            .select('*')
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
            .eq('status', 'accepted');

        if (friendships) {
            const friendIds = friendships.map(f =>
                f.requester_id === user.id ? f.addressee_id : f.requester_id
            );

            if (friendIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', friendIds);

                const enriched = friendships.map(f => {
                    const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
                    return {
                        ...f,
                        friend: profiles?.find(p => p.id === friendId) || { id: friendId, username: 'Unknown', avatar_url: null, rp_balance: 0 },
                    };
                });
                setFriends(enriched);
            } else {
                setFriends([]);
            }
        }

        // Get pending received
        const { data: pending } = await supabase
            .from('friendships')
            .select('*')
            .eq('addressee_id', user.id)
            .eq('status', 'pending');

        if (pending && pending.length > 0) {
            const requesterIds = pending.map(p => p.requester_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('id', requesterIds);

            const enriched = pending.map(p => ({
                ...p,
                friend: profiles?.find(pr => pr.id === p.requester_id) || { id: p.requester_id, username: 'Unknown', avatar_url: null, rp_balance: 0 },
            }));
            setPendingReceived(enriched);
        } else {
            setPendingReceived([]);
        }
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

    const searchUsers = async () => {
        if (!searchText.trim() || !user) return;

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .ilike('username', `%${searchText.trim()}%`)
            .neq('id', user.id)
            .limit(10);

        setSearchResults(data || []);
    };

    const sendRequest = async (targetId: string) => {
        if (!user) return;

        // Check existing
        const { data: existing } = await supabase
            .from('friendships')
            .select('id')
            .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user.id})`);

        if (existing && existing.length > 0) {
            Alert.alert('Info', 'Friend request already exists');
            return;
        }

        const { error } = await supabase.from('friendships').insert({
            requester_id: user.id,
            addressee_id: targetId,
        });

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Sent! 🎉', 'Friend request sent!');
            setSearchResults(prev => prev.filter(r => r.id !== targetId));
        }
    };

    const acceptRequest = async (friendshipId: string) => {
        await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', friendshipId);
        await loadData();
    };

    const rejectRequest = async (friendshipId: string) => {
        await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipId);
        await loadData();
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>Friends</Text>

                {/* Search */}
                <View style={styles.searchRow}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by username..."
                        placeholderTextColor={Colors.textLight}
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={searchUsers}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={searchUsers}>
                        <Ionicons name="search" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Search results */}
                {searchResults.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Search Results</Text>
                        {searchResults.map(u => (
                            <View key={u.id} style={styles.userCard}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{(u.username || '?')[0].toUpperCase()}</Text>
                                </View>
                                <Text style={styles.username}>{u.username}</Text>
                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={() => sendRequest(u.id)}
                                >
                                    <Ionicons name="person-add" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Pending requests */}
                {pendingReceived.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Pending Requests ({pendingReceived.length})
                        </Text>
                        {pendingReceived.map(p => (
                            <View key={p.id} style={styles.userCard}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {(p.friend.username || '?')[0].toUpperCase()}
                                    </Text>
                                </View>
                                <Text style={styles.username}>{p.friend.username}</Text>
                                <View style={styles.actions}>
                                    <TouchableOpacity
                                        style={styles.acceptButton}
                                        onPress={() => acceptRequest(p.id)}
                                    >
                                        <Ionicons name="checkmark" size={18} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.rejectButton}
                                        onPress={() => rejectRequest(p.id)}
                                    >
                                        <Ionicons name="close" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Friends list */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Your Friends ({friends.length})
                    </Text>
                    {friends.length === 0 ? (
                        <Text style={styles.emptyText}>No friends yet. Search and add some! 🤝</Text>
                    ) : (
                        friends.map(f => (
                            <View key={f.id} style={styles.userCard}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {(f.friend.username || '?')[0].toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.username}>{f.friend.username}</Text>
                                    <Text style={styles.rpSmall}>💎 {f.friend.rp_balance} RP</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
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
        paddingBottom: Spacing.sm,
    },
    searchRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    searchInput: {
        flex: 1,
        height: 48,
        borderWidth: 2,
        borderColor: Colors.border,
        borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.md,
        fontSize: FontSize.md,
        color: Colors.text,
        backgroundColor: Colors.backgroundSecondary,
        marginRight: Spacing.sm,
    },
    searchButton: {
        width: 48,
        height: 48,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.backgroundCard,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    avatarText: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.primary,
    },
    username: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: '600',
        color: Colors.text,
    },
    rpSmall: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    acceptButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rejectButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.danger,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: FontSize.md,
        paddingVertical: Spacing.xl,
    },
});
