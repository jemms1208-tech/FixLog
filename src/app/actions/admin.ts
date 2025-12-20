'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// 지연 로딩을 위해 null로 초기화하고 함수 내부에서 생성
let supabaseAdminInstance: any = null;

function getSupabaseAdmin() {
    if (!supabaseAdminInstance) {
        supabaseAdminInstance = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
            process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
            { auth: { autoRefreshToken: false, persistSession: false } }
        );
    }
    return supabaseAdminInstance;
}

export async function resetUserPassword(userId: string, newPassword: string) {
    try {
        // 1. 요청자 권한 확인 (Server Side Session Check)
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: '인증되지 않은 사용자입니다.' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'operator'].includes(profile.role)) {
            return { success: false, error: '비밀번호를 변경할 권한이 없습니다.' };
        }

        // 2. 권한 확인 후 패스워드 재설정 (Admin Auth API 사용)
        const adminClient = getSupabaseAdmin();
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
            password: newPassword
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || '알 수 없는 오류가 발생했습니다.' };
    }
}

export async function deleteUser(userId: string) {
    try {
        // 1. 요청자 권한 확인
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: '인증되지 않은 사용자입니다.' };

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || !['admin', 'operator'].includes(profile.role)) {
            return { success: false, error: '사용자를 삭제할 권한이 없습니다.' };
        }

        // 2. Authentication 계정 삭제 (이때 RLS/FK 설정에 따라 profiles 테이블도 연쇄 삭제됨)
        const adminClient = getSupabaseAdmin();
        const { error } = await adminClient.auth.admin.deleteUser(userId);

        if (error) {
            // 이미 삭제되었거나 다른 문제가 있을 경우
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || '알 수 없는 오류가 발생했습니다.' };
    }
}
