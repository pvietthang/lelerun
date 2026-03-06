import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oxiolgdhzmvxledgfhem.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94aW9sZ2Roem12eGxlZGdmaGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODg5MTYsImV4cCI6MjA4NzE2NDkxNn0.T7KFKsh4Shc88BQSoTN_oHBLn_N_RV_uy7LfNorEDus';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data, error } = await supabase.from('streaks').update({
        fake_column_does_not_exist: 123
    }).eq('user_id', '11111111-1111-1111-1111-111111111111');
    console.log("Streaks fake update data:", data);
    console.log("Error:", error);
}

check();
