import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://oxiolgdhzmvxledgfhem.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94aW9sZ2Roem12eGxlZGdmaGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODg5MTYsImV4cCI6MjA4NzE2NDkxNn0.T7KFKsh4Shc88BQSoTN_oHBLn_N_RV_uy7LfNorEDus';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});
