'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    AlertCircle,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totalClients: 0,
        pendingRecords: 0,
        processingRecords: 0,
        completedToday: 0
    });
    const [recentRecords, setRecentRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        try {
            setLoading(true);

            // Fetch total clients
            const { count: clientCount } = await supabase
                .from('clients')
                .select('*', { count: 'exact', head: true });

            // Fetch pending records (no processed_at)
            const { count: pendingCount } = await supabase
                .from('service_records')
                .select('*', { count: 'exact', head: true })
                .is('processed_at', null);

            // Fetch today's completed records
            const today = new Date().toISOString().split('T')[0];
            const { count: completedCount } = await supabase
                .from('service_records')
                .select('*', { count: 'exact', head: true })
                .gte('processed_at', today);

            // Fetch recent records
            const { data: records } = await supabase
                .from('service_records')
                .select('*, clients(name)')
                .order('created_at', { ascending: false })
                .limit(5);

            setStats({
                totalClients: clientCount || 0,
                pendingRecords: pendingCount || 0,
                processingRecords: 0,
                completedToday: completedCount || 0
            });

            setRecentRecords(records || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }

    const STATS_CONFIG = [
        { label: '전체 거래처', value: stats.totalClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: '미처리 장애', value: stats.pendingRecords, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
        { label: '처리 중', value: stats.processingRecords, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: '금일 완료', value: stats.completedToday, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">대시보드</h1>
                <p className="text-muted-foreground">실시간 장애 현황 및 요약입니다.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {STATS_CONFIG.map((stat) => (
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

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass rounded-3xl border p-8">
                    <h3 className="text-xl font-bold mb-6">최근 장애 접수</h3>
                    <div className="space-y-4">
                        {recentRecords.length > 0 ? (
                            recentRecords.map((record, i) => (
                                <div key={record.id} className="flex items-center gap-4 p-4 rounded-2xl bg-input/50 border border-transparent hover:border-border transition-all">
                                    <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center font-bold text-primary">
                                        {i + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{record.clients?.name || '미지정'}</p>
                                        <p className="text-xs text-muted-foreground truncate">접수내용: {record.details || '-'}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${record.processed_at
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-red-100 text-red-600'
                                            }`}>
                                            {record.type || '장애'}
                                        </span>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {record.created_at ? new Date(record.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-muted-foreground">
                                접수된 기록이 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass rounded-3xl border p-8">
                    <h3 className="text-xl font-bold mb-6">빠른 통계</h3>
                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                            <p className="text-sm text-blue-600 font-medium">전체 거래처</p>
                            <p className="text-3xl font-bold text-blue-700 mt-1">{stats.totalClients}개</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
                            <p className="text-sm text-red-600 font-medium">미처리 장애</p>
                            <p className="text-3xl font-bold text-red-700 mt-1">{stats.pendingRecords}건</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                            <p className="text-sm text-emerald-600 font-medium">금일 완료</p>
                            <p className="text-3xl font-bold text-emerald-700 mt-1">{stats.completedToday}건</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
