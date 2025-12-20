import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
    // 빌드 시점에 환경변수가 없어도 에러가 발생하지 않도록 placeholder 사용
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

    return createBrowserClient(url, key);
};
