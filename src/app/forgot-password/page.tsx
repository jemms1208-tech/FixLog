'use client';

import Link from 'next/link';
import { KeyRound, Phone, MessageCircle, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[440px] bg-white rounded-xl shadow-lg border border-slate-100 p-8 space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-amber-50 text-amber-600 mb-2">
                        <KeyRound className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">비밀번호 초기화</h1>
                    <p className="text-sm text-slate-500">비밀번호를 잊으셨나요? 아래 방법으로 초기화할 수 있습니다.</p>
                </div>

                <div className="space-y-4">
                    {/* 방법 1: 관리자 문의 */}
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                <Phone className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 text-sm">관리자에게 전화 문의</h3>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                    관리자에게 연락하여 본인 확인 후 비밀번호를 초기화받을 수 있습니다.
                                </p>
                                <div className="mt-3 p-3 bg-white rounded-lg border border-blue-100">
                                    <p className="text-xs text-slate-500">관리자 연락처</p>
                                    <p className="text-lg font-bold text-blue-600">02-1234-5678</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 방법 2: 카카오톡 문의 */}
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                                <MessageCircle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-slate-900 text-sm">카카오톡 문의</h3>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                    카카오톡으로 관리자에게 비밀번호 초기화를 요청할 수 있습니다.
                                </p>
                                <div className="mt-3 p-3 bg-white rounded-lg border border-amber-100">
                                    <p className="text-xs text-slate-500">카카오톡 ID</p>
                                    <p className="text-lg font-bold text-amber-600">@jenetworks</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 안내 문구 */}
                <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-bold text-slate-700 text-sm mb-2">비밀번호 초기화 절차</h4>
                    <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside">
                        <li>관리자에게 아이디와 등록된 연락처를 알려주세요.</li>
                        <li>본인 확인 후 관리자가 임시 비밀번호를 설정합니다.</li>
                        <li>임시 비밀번호로 로그인 후 내 정보에서 비밀번호를 변경하세요.</li>
                    </ol>
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
