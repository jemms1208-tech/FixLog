'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Loader2 } from 'lucide-react';

import { createClient } from '@/lib/supabase';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Internally use a dummy email
        const email = `${username}@jenetworks.local`;

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            alert('로그인 실패: 아이디 또는 비밀번호를 확인해주세요.');
            setLoading(false);
            return;
        }

        // Check if user is approved
        if (authData.user) {
            console.log('Login attempt for user ID:', authData.user.id);

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .maybeSingle(); // Use maybeSingle to avoid error on 0 rows

            if (profileError) {
                console.error('Profile fetch error stringified:', JSON.stringify(profileError, null, 2));
                console.error('Profile fetch error raw:', profileError);
                alert(`사용자 프로필을 불러오는 중 오류가 발생했습니다: ${profileError.message || '알 수 없는 오류 (RLS 정책 위반 가능성)'}`);
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            if (!profile) {
                console.error('No profile found for user ID:', authData.user.id);
                alert('사용자 프로필을 찾을 수 없습니다. (DB의 profiles 테이블에 데이터가 생성되지 않았습니다.)');
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            console.log('Fetched profile:', profile);

            // If user is admin, they are always allowed (failsafe), or strictly check is_approved
            if (!profile.is_approved) {
                await supabase.auth.signOut();
                alert('계정이 아직 승인되지 않았습니다. 관리자의 승인을 기다려주세요.');
                setLoading(false);
                return;
            }

            // 로그인 활동 로그 기록
            await supabase.from('activity_logs').insert([{
                user_id: authData.user.id,
                user_email: profile.email,
                user_display_name: profile.display_name,
                action: 'LOGIN',
                target_type: 'auth',
                target_id: authData.user.id,
                details: { username: profile.username }
            }]);

            router.push('/dashboard');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[400px] bg-white rounded-xl shadow-lg border border-slate-100 p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-50 text-blue-600 mb-2">
                        <Lock className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">로그인</h1>
                    <p className="text-sm text-slate-500">서비스 이용을 위해 로그인해주세요.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">아이디</label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                                placeholder="아이디를 입력하세요"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">비밀번호</label>
                        <div className="relative">
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                                placeholder="비밀번호를 입력하세요"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-blue-200"
                    >
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                </form>

                <div className="text-center pt-2 space-y-2">
                    <p className="text-sm text-slate-500">
                        계정이 없으신가요? {' '}
                        <Link href="/signup" className="text-blue-600 font-bold hover:underline underline-offset-4">
                            회원가입
                        </Link>
                    </p>
                    <p className="text-xs text-slate-400">
                        비밀번호를 잊으셨나요? {' '}
                        <Link href="/forgot-password" className="text-slate-500 font-medium hover:underline underline-offset-4">
                            비밀번호 초기화 안내
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
