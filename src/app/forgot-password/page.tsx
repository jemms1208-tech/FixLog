'use client';

import Link from 'next/link';
import { KeyRound, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[400px] bg-white rounded-xl shadow-lg border border-slate-100 p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-amber-50 text-amber-600 mb-2">
                        <KeyRound className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">비밀번호 초기화</h1>
                </div>

                <div className="text-center py-8">
                    <p className="text-slate-600 font-medium">
                        관리자에게 문의 바랍니다.
                    </p>
                </div>

                <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    로그인 페이지로 돌아가기
                </Link>
            </div>
        </div>
    );
}
