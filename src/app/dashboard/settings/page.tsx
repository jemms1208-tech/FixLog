'use client';

import { Settings, Bell, Moon, Sun, Globe } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-1">설정</h1>
                <p className="text-muted-foreground text-sm">시스템 환경 설정을 관리합니다.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profile Settings */}
                <div className="glass rounded-3xl border p-8 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        프로필 설정
                    </h2>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">이름</label>
                            <input
                                type="text"
                                placeholder="관리자"
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">이메일</label>
                            <input
                                type="email"
                                placeholder="admin@fixlog.com"
                                className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                                disabled
                            />
                        </div>
                    </div>

                    <button className="btn-premium w-full">
                        변경사항 저장
                    </button>
                </div>

                {/* Notification Settings */}
                <div className="glass rounded-3xl border p-8 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" />
                        알림 설정
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-input/50 border">
                            <div>
                                <p className="font-medium">장애 접수 알림</p>
                                <p className="text-xs text-muted-foreground">새 장애가 접수되면 알림을 받습니다.</p>
                            </div>
                            <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                                <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow"></div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-input/50 border">
                            <div>
                                <p className="font-medium">이메일 알림</p>
                                <p className="text-xs text-muted-foreground">중요한 업데이트를 이메일로 받습니다.</p>
                            </div>
                            <div className="w-12 h-6 bg-gray-300 rounded-full relative cursor-pointer">
                                <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Appearance Settings */}
                <div className="glass rounded-3xl border p-8 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Sun className="w-5 h-5 text-primary" />
                        화면 설정
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-input/50 border">
                            <div>
                                <p className="font-medium">다크 모드</p>
                                <p className="text-xs text-muted-foreground">어두운 테마를 사용합니다.</p>
                            </div>
                            <div className="w-12 h-6 bg-gray-300 rounded-full relative cursor-pointer">
                                <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Language Settings */}
                <div className="glass rounded-3xl border p-8 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary" />
                        언어 설정
                    </h2>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-muted-foreground">표시 언어</label>
                            <select className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20">
                                <option>한국어</option>
                                <option>English</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
