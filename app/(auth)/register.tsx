import { BorderRadius, Colors, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView, Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from 'react-native';

export default function RegisterScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();

    const handleRegister = async () => {
        if (!username || !email || !password) {
            Alert.alert('Lỗi', 'Vui lòng điền đủ thông tin');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Lỗi', 'Mật khẩu phải từ 6 ký tự');
            return;
        }
        setLoading(true);
        const { error } = await signUp(email, password, username);
        setLoading(false);
        if (error) {
            Alert.alert('Đăng ký thất bại', error.message);
        } else {
            // No email verification required — session is active immediately
            router.replace('/(tabs)');
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <View style={styles.mascotContainer}>
                    <Text style={styles.mascot}>🎯</Text>
                </View>

                <Text style={styles.title}>Tham gia LeLeRun</Text>
                <Text style={styles.tagline}>Bắt đầu hành trình chạy bộ ngay hôm nay! 💪</Text>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Tên người dùng"
                        placeholderTextColor={Colors.textLight}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={Colors.textLight}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Mật khẩu (tối thiểu 6 ký tự)"
                        placeholderTextColor={Colors.textLight}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>ĐĂNG KÝ</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Đã có tài khoản? </Text>
                        <Link href="/(auth)/login" asChild>
                            <TouchableOpacity>
                                <Text style={styles.linkText}>Đăng nhập</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    mascotContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FFF3E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    mascot: {
        fontSize: 64,
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: Colors.primary,
        letterSpacing: -1,
    },
    tagline: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
        marginBottom: Spacing.xxl,
    },
    form: {
        width: '100%',
    },
    input: {
        width: '100%',
        height: 56,
        borderWidth: 2,
        borderColor: Colors.border,
        borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.lg,
        fontSize: FontSize.md,
        color: Colors.text,
        backgroundColor: Colors.backgroundSecondary,
        marginBottom: Spacing.md,
    },
    button: {
        width: '100%',
        height: 56,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.sm,
        ...Shadow.button,
    },
    buttonDisabled: {
        backgroundColor: Colors.primaryLight,
    },
    buttonText: {
        fontSize: FontSize.lg,
        fontWeight: '700',
        color: Colors.textOnPrimary,
        letterSpacing: 1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: Spacing.lg,
    },
    footerText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    linkText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: '700',
    },
});
