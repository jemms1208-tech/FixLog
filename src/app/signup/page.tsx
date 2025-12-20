'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';

export default function SignUpPage() {
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [teamName, setTeamName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const router = useRouter();
    const supabase = createClient();

    // 전화번호 포맷팅 (xxx-xxxx-xxxx)
    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '').slice(0, 11);
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (password !== confirmPassword) {
            setMessage({ text: '비밀번호가 일치하지 않습니다.', type: 'error' });
            return;
        }

        if (!displayName.trim()) {
            setMessage({ text: '이름을 입력해주세요.', type: 'error' });
            return;
        }

        setLoading(true);

        try {
            const email = `${username}@fixlog.local`;

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                let errorMessage = error.message;
                if (error.message.includes('User already registered')) {
                    errorMessage = '이미 등록된 아이디입니다.';
                } else if (error.message.includes('Password should be')) {
                    errorMessage = '비밀번호는 최소 6자 이상이어야 합니다.';
                } else if (error.message.includes('Invalid email')) {
                    errorMessage = '유효하지 않은 아이디 형식입니다.';
                }
                setMessage({ text: errorMessage, type: 'error' });
            } else if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ display_name: displayName, team_name: teamName, phone: phone })
                    .eq('id', data.user.id);

                if (profileError) {
                    console.error('Profile update error:', profileError);
                }

                setMessage({
                    text: '회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.',
                    type: 'success'
                });
                setTimeout(() => router.push('/login'), 1500);
            }
        } catch (error) {
            setMessage({ text: '오류가 발생했습니다.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[400px] bg-white rounded-xl shadow-lg border border-slate-100 p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-50 text-blue-600 mb-2">
                        <Lock className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">회원가입</h1>
                    <p className="text-sm text-slate-500">서비스 이용을 위해 계정을 생성하세요.</p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">아이디 *</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                            placeholder="아이디를 입력하세요"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">이름 *</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                            placeholder="이름을 입력하세요"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">팀 이름</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                            placeholder="소속 팀을 입력하세요"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">핸드폰 번호 *</label>
                        <input
                            type="tel"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                            placeholder="010-0000-0000"
                            value={phone}
                            onChange={(e) => setPhone(formatPhone(e.target.value))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">비밀번호 *</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                            placeholder="비밀번호를 입력하세요"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">비밀번호 확인 *</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-sm"
                            placeholder="비밀번호를 다시 입력하세요"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    {message && (
                        <div className={`text-xs font-bold p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-blue-200"
                    >
                        {loading ? '가입 중...' : '가입하기'}
                    </button>
                </form>

                <div className="text-center pt-2">
                    <p className="text-sm text-slate-500">
                        이미 계정이 있으신가요? {' '}
                        <Link href="/login" className="text-blue-600 font-bold hover:underline underline-offset-4">
                            로그인
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
