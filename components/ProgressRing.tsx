import { Colors, FontSize } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ProgressRingProps {
    progress: number; // 0 to 1
    size?: number;
    strokeWidth?: number;
    current: string;
    target: string;
    unit?: string;
}

export function ProgressRing({
    progress,
    size = 200,
    strokeWidth = 14,
    current,
    target,
    unit = 'km',
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progressValue = Math.min(Math.max(progress, 0), 1);
    const strokeDashoffset = circumference * (1 - progressValue);

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} style={styles.svg}>
                {/* Background circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={Colors.surface}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={progressValue >= 1 ? Colors.warning : Colors.primary}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            <View style={styles.textContainer}>
                <Text style={styles.currentText}>{current}</Text>
                <Text style={styles.divider}>/ {target} {unit}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    svg: {
        position: 'absolute',
    },
    textContainer: {
        alignItems: 'center',
    },
    currentText: {
        fontSize: FontSize.xxl,
        fontWeight: '800',
        color: Colors.text,
    },
    divider: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
});
