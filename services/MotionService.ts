import { Accelerometer } from 'expo-sensors';

export type MotionState = 'stationary' | 'walking' | 'running';

let motionCallback: ((state: MotionState) => void) | null = null;
let subscription: any = null;
let accelerationHistory: number[] = [];
const HISTORY_SIZE = 20;

/**
 * Calculate acceleration magnitude from x, y, z
 */
function magnitude(x: number, y: number, z: number): number {
    return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Calculate variance of acceleration magnitudes
 */
function variance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

export const MotionService = {
    /**
     * Start monitoring motion to detect walking/running
     */
    startMonitoring(onMotionChange: (state: MotionState) => void): void {
        motionCallback = onMotionChange;
        accelerationHistory = [];

        Accelerometer.setUpdateInterval(200); // 5Hz

        subscription = Accelerometer.addListener((data) => {
            const mag = magnitude(data.x, data.y, data.z);
            accelerationHistory.push(mag);
            if (accelerationHistory.length > HISTORY_SIZE) {
                accelerationHistory.shift();
            }

            if (accelerationHistory.length >= HISTORY_SIZE / 2) {
                const v = variance(accelerationHistory);
                let state: MotionState;

                if (v < 0.003) {
                    state = 'stationary';
                } else if (v < 0.02) {
                    state = 'walking';
                } else {
                    state = 'running';
                }

                if (motionCallback) {
                    motionCallback(state);
                }
            }
        });
    },

    /**
     * Stop monitoring motion
     */
    stopMonitoring(): void {
        if (subscription) {
            subscription.remove();
            subscription = null;
        }
        motionCallback = null;
        accelerationHistory = [];
    },

    /**
     * Check if the user is actually moving (not stationary)
     */
    isMoving(speed: number | null): boolean {
        if (speed === null) return false;
        return speed > 0.5; // > 0.5 m/s = moving
    },
};
