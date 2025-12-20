'use client';

import {
    Users,
    AlertCircle,
    CheckCircle2,
    Clock,
    ArrowUpRight
} from 'lucide-react';

const STATS = [
    { label: '전체 거래처', value: '128', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '미처리 장애', value: '5', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: '처리 중', value: '2', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: '금일 완료', value: '12', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

export default function DashboardPage() {
    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">대시보드</h1>
                <p className="text-muted-foreground">실시간 장애 현황 및 요약입니다.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {STATS.map((stat) => (
                    <div key={stat.label} className="glass p-6 rounded-3xl border shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <ArrowUpRight className="w-5 h-5 text-muted-foreground/30" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                            <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Activity / Charts Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass rounded-3xl border p-8">
                    <h3 className="text-xl font-bold mb-6">최근 장애 접수</h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-input/50 border border-transparent hover:border-border transition-all">
                                <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center font-bold text-primary">
                                    {i}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">꽈배기 최선생</p>
                                    <p className="text-xs text-muted-foreground">접수내용: 프린터 출력안됨</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600 uppercase tracking-wider">장애</span>
                                    <p className="text-[10px] text-muted-foreground mt-1">14:30</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass rounded-3xl border p-8">
                    <h3 className="text-xl font-bold mb-6">그룹별 비중</h3>
                    <div className="aspect-square rounded-full border-8 border-primary/10 flex items-center justify-center relative">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-primary">75%</p>
                            <p className="text-sm text-muted-foreground">인천 지역</p>
                        </div>
                    </div>
                    <div className="mt-8 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-primary"></span>
                                인천 미추홀구
                            </span>
                            <span className="font-bold">42</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-300"></span>
                                부평구
                            </span>
                            <span className="font-bold">28</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
