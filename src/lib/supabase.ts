import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // 빌드 시점에 환경변수가 없어도 에러가 발생하지 않도록 처리
    return createBrowserClient(url, key);
};
