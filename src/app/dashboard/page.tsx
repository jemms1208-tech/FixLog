'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
    Users,
    AlertCircle,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    Loader2,
    Megaphone,
    ChevronRight,
    Calendar,
    Shield,
    Plus
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalClients: 0,
        pendingRecords: 0,
        processingRecords: 0,
        completedToday: 0
    });
    const [recentRecords, setRecentRecords] = useState<any[]>([]);
    const [latestNotice, setLatestNotice] = useState<any>(null);
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [serviceTypes, setServiceTypes] = useState<any[]>([]);
    const [newRecord, setNewRecord] = useState({
        client_id: '',
        type: '장애',
        details: ''
    });
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    async function fetchDashboardData() {
        try {
            setLoading(true);

            // 먼저 사용자의 접근 가능 그룹 조회
            const { data: { user } } = await supabase.auth.getUser();
            let allowedGroups: string[] = [];
            let allowedClientIds: string[] | null = null;

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('allowed_groups')
                    .eq('id', user.id)
                    .single();

                allowedGroups = profile?.allowed_groups || [];

                // 접근 가능한 그룹이 있으면 해당 거래처 ID 조회
                if (allowedGroups.length > 0) {
                    const { data: allowedClients } = await supabase
                        .from('clients')
                        .select('id')
                        .in('group_id', allowedGroups);
                    allowedClientIds = allowedClients?.map(c => c.id) || [];
                }
            }

            // 거래처 수 조회 (그룹 필터링 적용)
            let clientQuery = supabase.from('clients').select('*', { count: 'exact', head: true });
            if (allowedGroups.length > 0) {
                clientQuery = clientQuery.in('group_id', allowedGroups);
            }
            const { count: clientCount } = await clientQuery;

            // 접수 내역 통계 조회 (그룹 필터링 적용)
            let pendingQuery = supabase.from('service_records').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            let processingQuery = supabase.from('service_records').select('*', { count: 'exact', head: true }).eq('status', 'processing');
            let completedQuery = supabase.from('service_records').select('*', { count: 'exact', head: true })
                .eq('status', 'completed')
                .gte('processed_at', new Date().toISOString().split('T')[0]);

            if (allowedClientIds !== null && allowedClientIds.length > 0) {
                pendingQuery = pendingQuery.in('client_id', allowedClientIds);
                processingQuery = processingQuery.in('client_id', allowedClientIds);
                completedQuery = completedQuery.in('client_id', allowedClientIds);
            } else if (allowedClientIds !== null && allowedClientIds.length === 0) {
                // 접근 가능한 거래처가 없으면 0으로 설정
                setStats({ totalClients: 0, pendingRecords: 0, processingRecords: 0, completedToday: 0 });
                setRecentRecords([]);
                setLoading(false);
                return;
            }

            const [{ count: pendingCount }, { count: processingCount }, { count: completedCount }] = await Promise.all([
                pendingQuery,
                processingQuery,
                completedQuery
            ]);

            // 최근 접수 내역 조회 (그룹 필터링 적용)
            let recordsQuery = supabase
                .from('service_records')
                .select('*, clients(name)')
                .order('created_at', { ascending: false })
                .limit(5);

            if (allowedClientIds !== null && allowedClientIds.length > 0) {
                recordsQuery = recordsQuery.in('client_id', allowedClientIds);
            }

            const { data: records } = await recordsQuery;

            // Fetch latest notice
            const { data: noticeData } = await supabase
                .from('notices')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            // 거래처 목록 조회 (접수 등록용, 그룹 필터링 적용)
            let clientsForModalQuery = supabase.from('clients').select('id, name').order('name');
            if (allowedGroups.length > 0) {
                clientsForModalQuery = clientsForModalQuery.in('group_id', allowedGroups);
            }

            const [{ data: clientsData }, { data: typesData }] = await Promise.all([
                clientsForModalQuery,
                supabase.from('service_types').select('*').order('sort_order')
            ]);

            setStats({
                totalClients: clientCount || 0,
                pendingRecords: pendingCount || 0,
                processingRecords: processingCount || 0,
                completedToday: completedCount || 0
            });

            setRecentRecords(records || []);
            setLatestNotice(noticeData);
            setClients(clientsData || []);
            setServiceTypes(typesData || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddRecord(e: React.FormEvent) {
        e.preventDefault();
        try {
            const { error } = await supabase.from('service_records').insert([newRecord]);
            if (error) throw error;
            setIsAddModalOpen(false);
            setNewRecord({ client_id: '', type: '장애', details: '' });
            showToast('접수가 등록되었습니다.', 'success');
            fetchDashboardData(); // Refresh counts and recent records
        } catch (error: any) {
            showToast(`등록 오류: ${error.message}`, 'error');
        }
    }

    const STATS_CONFIG = [
        { label: '전체 거래처', value: stats.totalClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: '대기 중', value: stats.pendingRecords, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
        { label: '처리 중', value: stats.processingRecords, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: '금일 완료', value: stats.completedToday, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 shadow-sm whitespace-nowrap">
                    {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Latest Notice Banner */}
            {latestNotice && (
                <div
                    onClick={() => setIsNoticeModalOpen(true)}
                    className="bg-white border border-blue-100 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-blue-50/50 transition-all group shadow-sm"
                >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Megaphone className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-tight">최신 공지</span>
                            <span className="text-[11px] text-slate-400 font-medium">
                                {new Date(latestNotice.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <p className="text-[14px] font-medium text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                            {latestNotice.title}
                        </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </div>
            )}

            {/* Stats Grid - Compact cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {STATS_CONFIG.map((stat) => (
                    <div key={stat.label} className="bg-white p-3 md:p-4 rounded-lg border border-slate-100 shadow-sm text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className={`p-1 rounded-md ${stat.bg} ${stat.color}`}>
                                <stat.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </div>
                            <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-900">{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* Main Content Area - Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity List */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-lg text-slate-800">최근 접수 내역</h3>
                        <button
                            onClick={() => router.push('/dashboard/records')}
                            className="text-sm text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                        >
                            전체보기
                        </button>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {recentRecords.length > 0 ? (
                            recentRecords.map((record) => (
                                <div key={record.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${record.processed_at ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{record.clients?.name || '알 수 없음'}</p>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">{record.details || '내용 없음'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                                            {new Date(record.created_at).toLocaleDateString()}
                                        </span>
                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold min-w-[50px] text-center ${record.status === 'completed'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : record.status === 'processing'
                                                ? 'bg-amber-50 text-amber-700'
                                                : 'bg-red-50 text-red-700'
                                            }`}>
                                            {record.status === 'completed' ? '완료' : record.status === 'processing' ? '처리중' : '대기'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-16 text-slate-400 text-sm">
                                접수된 내역이 없습니다
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold text-sm shadow-md shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        신규 접수 등록
                    </button>
                </div>
            </div>

            {/* Notice Detail Modal */}
            <Modal isOpen={isNoticeModalOpen} onClose={() => setIsNoticeModalOpen(false)} title="공지사항 확인">
                {latestNotice && (
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[11px] text-slate-400 font-medium">
                                    {new Date(latestNotice.created_at).toLocaleString()}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 leading-tight">
                                {latestNotice.title}
                            </h2>
                            <div className="pb-4 border-b border-slate-100" />
                        </div>

                        <div className="text-slate-800 text-[14px] font-medium leading-relaxed whitespace-pre-wrap min-h-[200px]">
                            {latestNotice.content}
                        </div>

                        <div className="pt-4 border-t border-slate-50 flex justify-end">
                            <button onClick={() => setIsNoticeModalOpen(false)} className="btn-primary px-8">닫기</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Add Record Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="신규 접수 등록">
                <form onSubmit={handleAddRecord} className="space-y-4">
                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">거래처 선택 *</label>
                        <select
                            required
                            className="input-field w-full text-[14px] font-medium text-slate-800"
                            value={newRecord.client_id}
                            onChange={(e) => setNewRecord({ ...newRecord, client_id: e.target.value })}
                        >
                            <option value="">거래처를 선택하세요</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">서비스 유형 *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {serviceTypes.map(type => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setNewRecord({ ...newRecord, type: type.name })}
                                    className={`py-2 px-3 rounded-lg border text-[13px] font-medium transition-all ${newRecord.type === type.name
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {type.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">상세 내용</label>
                        <textarea
                            rows={3}
                            placeholder="상세 내용을 입력하세요"
                            className="input-field w-full text-[14px] font-medium text-slate-800"
                            value={newRecord.details}
                            onChange={(e) => setNewRecord({ ...newRecord, details: e.target.value })}
                        />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-outline flex-1">취소</button>
                        <button type="submit" className="btn-primary flex-1">등록하기</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
