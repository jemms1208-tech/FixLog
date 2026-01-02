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
import { useRouter, useSearchParams } from 'next/navigation';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

const STATUS_MAP = {
    pending: { label: '\uB300\uAE30', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    processing: { label: '\uCC98\uB9AC\uC911', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    completed: { label: '\uC644\uB8CC', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

export default function DashboardPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
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
        details: '',
        receiver_id: ''
    });
    const [clientSearch, setClientSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [viewingRecord, setViewingRecord] = useState<any>(null);
    const [userRole, setUserRole] = useState<string>('field');
    const [staffList, setStaffList] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [completingRecord, setCompletingRecord] = useState<any>(null);
    const [processingRecord, setProcessingRecord] = useState<any>(null);
    const { showToast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        fetchDashboardData();
        fetchStaff();
    }, []);

    // Handle openInquiry query parameter from navigation menu
    useEffect(() => {
        if (searchParams.get('openInquiry') === 'true') {
            setIsAddModalOpen(true);
            // Clear the query parameter from URL without navigation
            router.replace('/dashboard', { scroll: false });
        }
    }, [searchParams, router]);

    async function fetchStaff() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: currentProfile } = await supabase.from('profiles').select('allowed_groups').eq('id', user.id).single();
                let query = supabase.from('profiles').select('id, display_name, email, allowed_groups').eq('is_approved', true);
                const { data } = await query;
                if (data) {
                    const filteredStaff = (currentProfile?.allowed_groups && currentProfile.allowed_groups.length > 0)
                        ? data.filter((staff: any) =>
                            (staff.allowed_groups && Array.isArray(staff.allowed_groups) && staff.allowed_groups.some((g: string) => currentProfile.allowed_groups.includes(g))) ||
                            (!staff.allowed_groups || staff.allowed_groups.length === 0)
                        )
                        : data;
                    setStaffList(filteredStaff);
                }
            }
        } catch (err) {
            console.error('fetchStaff error:', err);
        }
    }

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
                    .select('allowed_groups, role')
                    .eq('id', user.id)
                    .single();

                allowedGroups = profile?.allowed_groups || [];
                setUserRole(profile?.role || 'field');

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
                .select('*, clients(name), receiver:profiles!receiver_id(display_name), first_handler:profiles!first_handler_id(display_name), handler:profiles!handler_id(display_name)')
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
            let clientsForModalQuery = supabase.from('clients').select('id, name, biz_reg_no, client_groups(name)').order('name');
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
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const recordWithReceiver = { ...newRecord, receiver_id: newRecord.receiver_id || user?.id };
            const { data, error } = await supabase.from('service_records').insert([recordWithReceiver]).select().single();
            if (error) throw error;

            // 활동 로그 기록
            if (user && data) {
                const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('id', user.id).single();
                const clientName = clients.find((c: any) => c.id === newRecord.client_id)?.name || '미지정';

                await supabase.from('activity_logs').insert([{
                    user_id: user.id,
                    user_email: profile?.email,
                    user_display_name: profile?.display_name,
                    action: 'CREATE_RECORD',
                    target_type: 'record',
                    target_id: data.id,
                    details: {
                        '유형': newRecord.type,
                        '거래처': clientName,
                        '내용': newRecord.details
                    }
                }]);
            }

            setIsAddModalOpen(false);
            setNewRecord({ client_id: '', type: '장애', details: '', receiver_id: '' });
            setClientSearch('');
            showToast('접수가 등록되었습니다.', 'success');
            fetchDashboardData();
            fetchStaff();
        } catch (error: any) {
            showToast(`등록 오류: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    function formatDateTime(dateStr: string | null | undefined) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';

        const year = d.getFullYear().toString().slice(2);
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    async function handleUpdateRecord(e: React.FormEvent) {
        e.preventDefault();
        if (!editingRecord || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('service_records')
                .update({
                    client_id: editingRecord.client_id || null,
                    type: editingRecord.type,
                    details: editingRecord.details,
                    result: editingRecord.result,
                    status: editingRecord.status,
                    processed_at: editingRecord.processed_at,
                    started_at: editingRecord.started_at,
                    receiver_id: editingRecord.receiver_id || null,
                    first_handler_id: editingRecord.first_handler_id || null,
                    handler_id: editingRecord.handler_id || null
                })
                .eq('id', editingRecord.id);
            if (error) throw error;
            setEditingRecord(null);
            showToast('내역이 수정되었습니다.', 'success');
            fetchDashboardData();
            fetchStaff();
        } catch (error: any) {
            showToast(`수정 오류: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeleteRecord(id: string) {
        if (isSubmitting) return;
        if (!confirm('이 접수 내역을 정말 삭제하시겠습니까?')) return;
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('service_records').delete().eq('id', id);
            if (error) throw error;
            showToast('접수 내역이 삭제되었습니다.', 'info');
            fetchDashboardData();
            fetchStaff();
            setViewingRecord(null);
        } catch (error: any) {
            showToast(`삭제 오류: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    function openCompleteModal(record: any) {
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16);
        setCompletingRecord({ id: record.id, processed_at: localDateTime, result: '', handler_id: record.handler_id || '' });
    }

    async function handleCompleteSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!completingRecord || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('service_records')
                .update({
                    processed_at: new Date(completingRecord.processed_at).toISOString(),
                    result: completingRecord.result,
                    status: 'completed',
                    handler_id: completingRecord.handler_id || user?.id
                })
                .eq('id', completingRecord.id);
            if (error) throw error;
            setCompletingRecord(null);
            showToast('처리가 완료되었습니다.', 'success');
            fetchDashboardData();
            fetchStaff();
        } catch (error: any) {
            showToast(`완료 처리 오류: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    function openProcessingModal(record: any) {
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString().slice(0, 16);
        setProcessingRecord({ id: record.id, started_at: localDateTime, result: '', first_handler_id: record.first_handler_id || '' });
    }

    async function handleProcessingSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!processingRecord || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('service_records')
                .update({
                    status: 'processing',
                    started_at: new Date(processingRecord.started_at).toISOString(),
                    result: processingRecord.result,
                    first_handler_id: processingRecord.first_handler_id || user?.id
                })
                .eq('id', processingRecord.id);
            if (error) throw error;
            setProcessingRecord(null);
            showToast('처리 중으로 변경되었습니다.', 'success');
            fetchDashboardData();
            fetchStaff();
        } catch (error: any) {
            showToast(`처리 시작 오류: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    const STATS_CONFIG = [
        { label: '대기 중', value: stats.pendingRecords, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', filter: 'pending' },
        { label: '처리 중', value: stats.processingRecords, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', filter: 'processing' },
        { label: '금일 완료', value: stats.completedToday, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', filter: 'completed' },
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
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 shadow-sm whitespace-nowrap">
                    {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Stats Grid - Compact cards */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
                {STATS_CONFIG.map((stat) => (
                    <div
                        key={stat.label}
                        onClick={() => stat.filter && router.push(`/dashboard/records?status=${stat.filter}`)}
                        className="bg-white p-3 md:p-4 rounded-lg border border-slate-100 shadow-sm text-center cursor-pointer hover:border-blue-200 hover:shadow-md transition-all"
                    >
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
                            recentRecords.map((record) => {
                                const statusKey = record.status || (record.processed_at ? 'completed' : 'pending');
                                const status = STATUS_MAP[statusKey as keyof typeof STATUS_MAP] || STATUS_MAP.pending;
                                return (
                                    <div
                                        key={record.id}
                                        onClick={() => setViewingRecord(record)}
                                        className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${statusKey === 'completed' ? 'bg-emerald-500' : statusKey === 'processing' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">{record.clients?.name || '알 수 없음'}</p>
                                                <p className="text-xs text-slate-500 truncate mt-0.5">{record.details || '내용 없음'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                                                {formatDateTime(record.created_at)}
                                            </span>
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold min-w-[50px] text-center ${status.bg} ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
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
                        문의 등록
                    </button>
                </div>
            </div>

            {/* Notice Section - Below Recent Records */}
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
                        <input
                            type="text"
                            placeholder="거래처 검색..."
                            className="input-field w-full mb-2 text-sm bg-slate-50"
                            value={clientSearch}
                            onChange={e => setClientSearch(e.target.value)}
                        />
                        {clientSearch.trim() && (
                            <div className="border border-slate-200 rounded-lg overflow-y-auto max-h-[250px] bg-white divide-y divide-slate-100 shadow-inner">
                                {clients
                                    .filter((c: any) =>
                                        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                        c.client_groups?.name?.toLowerCase().includes(clientSearch.toLowerCase())
                                    )
                                    .map((client: any) => {
                                        const isSelected = newRecord.client_id === client.id;
                                        return (
                                            <div
                                                key={client.id}
                                                onClick={() => setNewRecord({ ...newRecord, client_id: client.id })}
                                                className={`p-3 cursor-pointer transition-colors flex items-center justify-between group ${isSelected
                                                    ? 'bg-blue-50 border-l-4 border-blue-600'
                                                    : 'hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={`text-[14px] ${isSelected ? 'font-bold text-blue-700' : 'font-medium text-slate-700'}`}>
                                                        {client.name}
                                                    </span>
                                                    {client.biz_reg_no && (
                                                        <span className="text-[11px] text-slate-400 font-normal">{client.biz_reg_no}</span>
                                                    )}
                                                </div>
                                                {client.client_groups?.name && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                        {client.client_groups.name}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                {clients.filter((c: any) =>
                                    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                    c.client_groups?.name?.toLowerCase().includes(clientSearch.toLowerCase())
                                ).length === 0 && (
                                        <div className="p-8 text-center text-sm text-slate-400">
                                            검색 결과가 없습니다.
                                        </div>
                                    )}
                            </div>
                        )}
                        <input type="hidden" required value={newRecord.client_id} />
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
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">접수자</label>
                        <select
                            className="input-field w-full text-sm mb-4"
                            value={newRecord.receiver_id}
                            onChange={e => setNewRecord({ ...newRecord, receiver_id: e.target.value })}
                        >
                            <option value="">현재 사용자 (자동)</option>
                            {staffList.map(s => (
                                <option key={s.id} value={s.id}>{s.display_name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">상세 내용</label>
                        <textarea
                            rows={3}
                            placeholder="상세 내용을 입력하세요"
                            className="input-field w-full text-[14px] font-medium text-slate-800 h-auto"
                            value={newRecord.details}
                            onChange={(e) => setNewRecord({ ...newRecord, details: e.target.value })}
                        />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-outline flex-1" disabled={isSubmitting}>취소</button>
                        <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
                            {isSubmitting ? '등록 중...' : '등록하기'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* 접수 상세 정보 모달 */}
            <Modal isOpen={!!viewingRecord} onClose={() => setViewingRecord(null)} title="접수 상세 정보">
                {viewingRecord && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 border-b border-slate-100 pb-2">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">접수일시</label>
                                    <p className="text-[14px] font-medium text-slate-800">{formatDateTime(viewingRecord.created_at || viewingRecord.reception_at)}</p>
                                </div>
                                <div className="space-y-1 border-b border-slate-100 pb-2">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">상태</label>
                                    <div>
                                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_MAP[viewingRecord.status as keyof typeof STATUS_MAP]?.bg || 'bg-slate-100'} ${STATUS_MAP[viewingRecord.status as keyof typeof STATUS_MAP]?.color || 'text-slate-600'}`}>
                                            {STATUS_MAP[viewingRecord.status as keyof typeof STATUS_MAP]?.label || '대기'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-medium text-slate-800 uppercase">거래처</label>
                                <p className="text-[14px] font-medium text-slate-800">{viewingRecord.clients?.name || '미지정'}</p>
                            </div>

                            <div className="space-y-1 border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-medium text-slate-800 uppercase">유형</label>
                                <p className="text-[14px] font-medium text-slate-800">{viewingRecord.type}</p>
                            </div>

                            <div className="space-y-1 border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-medium text-slate-800 uppercase">상세 내용</label>
                                <p className="text-[14px] font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{viewingRecord.details || '내용 없음'}</p>
                            </div>

                            <div className="space-y-1 border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-medium text-slate-800 uppercase block mb-1">처리 결과</label>
                                <p className="text-[14px] font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{viewingRecord.result || '아직 처리 결과가 없습니다.'}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">접수자</label>
                                    <p className="text-[13px] font-medium text-slate-700">{viewingRecord.receiver?.display_name || '-'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">1차 처리자</label>
                                    <p className="text-[13px] font-medium text-slate-700">{viewingRecord.first_handler?.display_name || '-'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">완료 담당자</label>
                                    <p className="text-[13px] font-medium text-slate-700">{viewingRecord.handler?.display_name || '-'}</p>
                                </div>
                            </div>

                            {(viewingRecord.started_at || viewingRecord.processed_at) && (
                                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2">
                                    {viewingRecord.started_at && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-800 uppercase">처리 시작</label>
                                            <p className="text-[14px] font-medium text-slate-800 font-mono">{formatDateTime(viewingRecord.started_at)}</p>
                                        </div>
                                    )}
                                    {viewingRecord.processed_at && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-800 uppercase">처리 완료</label>
                                            <p className="text-[14px] font-medium text-slate-800 font-mono">{formatDateTime(viewingRecord.processed_at)}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 space-y-2">
                            <div className="flex gap-2">
                                {(userRole === 'operator' || userRole === 'admin' || userRole === 'callcenter') && (viewingRecord.status === 'pending' || !viewingRecord.status) && (
                                    <button
                                        onClick={() => {
                                            openProcessingModal(viewingRecord);
                                            setViewingRecord(null);
                                        }}
                                        className="flex-1 btn-outline border-blue-200 text-blue-600 font-bold py-3 h-auto hover:bg-blue-50 transition-colors"
                                    >
                                        1차 처리
                                    </button>
                                )}
                                {(viewingRecord.status !== 'completed' && viewingRecord.status !== '완료') && (
                                    <button
                                        onClick={() => {
                                            openCompleteModal(viewingRecord);
                                            setViewingRecord(null);
                                        }}
                                        className="flex-1 btn-outline border-emerald-200 text-emerald-600 font-bold py-3 h-auto hover:bg-emerald-50 transition-colors"
                                    >
                                        완료
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2">
                                {(userRole === 'operator' || userRole === 'admin') && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setEditingRecord({ ...viewingRecord, client_id: viewingRecord.client_id || '' });
                                                setViewingRecord(null);
                                            }}
                                            className="flex-1 btn-outline font-bold py-3 h-auto"
                                        >
                                            접수 수정
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRecord(viewingRecord.id)}
                                            className="flex-1 btn-outline border-red-200 text-red-600 font-bold py-3 h-auto hover:bg-red-50 transition-colors"
                                        >
                                            삭제
                                        </button>
                                    </>
                                )}
                            </div>
                            <button onClick={() => setViewingRecord(null)} className="w-full btn-primary font-bold py-3 h-auto">닫기</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 수정 모달 */}
            <Modal isOpen={!!editingRecord} onClose={() => setEditingRecord(null)} title="접수 수정">
                {editingRecord && (
                    <form onSubmit={handleUpdateRecord} className="space-y-4">
                        <div>
                            <label className="text-[11px] font-medium block mb-1">거래처</label>
                            <select
                                className="input-field w-full"
                                value={editingRecord.client_id || ''}
                                onChange={e => setEditingRecord({ ...editingRecord, client_id: e.target.value })}
                            >
                                <option value="">선택 안함</option>
                                {clients.map((client: any) => (
                                    <option key={client.id} value={client.id}>
                                        {client.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-medium block mb-1">유형</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(serviceTypes.length > 0 ? serviceTypes.map(t => t.name) : ['장애', '서비스', '기타']).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setEditingRecord({ ...editingRecord, type: t })}
                                        className={`py-2 rounded text-sm font-medium border-2 ${editingRecord.type === t
                                            ? 'bg-blue-50 text-blue-600 border-blue-600 font-bold'
                                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-medium block mb-1">상세 내용</label>
                            <textarea
                                rows={4}
                                className="input-field w-full resize-none h-auto"
                                value={editingRecord.details || ''}
                                onChange={e => setEditingRecord({ ...editingRecord, details: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium block mb-1">처리결과</label>
                            <textarea
                                rows={2}
                                className="input-field w-full resize-none h-auto"
                                value={editingRecord.result || ''}
                                onChange={e => setEditingRecord({ ...editingRecord, result: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3 pb-2 border-t border-slate-50 pt-2">
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="text-[11px] font-medium block mb-1">접수자</label>
                                    <select
                                        className="input-field w-full text-sm"
                                        value={editingRecord.receiver_id || ''}
                                        onChange={e => setEditingRecord({ ...editingRecord, receiver_id: e.target.value })}
                                    >
                                        <option value="">미지정</option>
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>{s.display_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] font-medium block mb-1">1차 처리자</label>
                                        <select
                                            className="input-field w-full text-sm"
                                            value={editingRecord.first_handler_id || ''}
                                            onChange={e => setEditingRecord({ ...editingRecord, first_handler_id: e.target.value })}
                                        >
                                            <option value="">미지정</option>
                                            {staffList.map(s => (
                                                <option key={s.id} value={s.id}>{s.display_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-medium block mb-1">완료 담당자</label>
                                        <select
                                            className="input-field w-full text-sm"
                                            value={editingRecord.handler_id || ''}
                                            onChange={e => setEditingRecord({ ...editingRecord, handler_id: e.target.value })}
                                        >
                                            <option value="">미지정</option>
                                            {staffList.map(s => (
                                                <option key={s.id} value={s.id}>{s.display_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="pt-2 flex gap-2">
                            <button type="button" onClick={() => setEditingRecord(null)} className="btn-outline flex-1">취소</button>
                            <button type="submit" className="btn-primary flex-1">수정</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* 완료 처리 모달 */}
            <Modal isOpen={!!completingRecord} onClose={() => setCompletingRecord(null)} title="완료 처리">
                {completingRecord && (
                    <form onSubmit={handleCompleteSubmit} className="space-y-4">
                        <div>
                            <label className="text-[11px] font-medium block mb-1">처리일시</label>
                            <input
                                type="datetime-local"
                                className="input-field w-full"
                                value={completingRecord.processed_at}
                                onChange={e => setCompletingRecord({ ...completingRecord, processed_at: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium block mb-1">처리결과</label>
                            <textarea
                                rows={3}
                                className="input-field w-full resize-none h-auto"
                                placeholder="처리 내용을 입력하세요..."
                                value={completingRecord.result}
                                onChange={e => setCompletingRecord({ ...completingRecord, result: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium block mb-1">완료 담당자</label>
                            <select
                                className="input-field w-full text-sm"
                                value={completingRecord.handler_id || ''}
                                onChange={e => setCompletingRecord({ ...completingRecord, handler_id: e.target.value })}
                            >
                                <option value="">현재 사용자 (자동)</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>{s.display_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="pt-2 flex gap-2">
                            <button type="button" onClick={() => setCompletingRecord(null)} className="btn-outline flex-1">취소</button>
                            <button type="submit" className="btn-primary flex-1">완료</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* 1차 처리 모달 */}
            <Modal isOpen={!!processingRecord} onClose={() => setProcessingRecord(null)} title="1차 처리">
                {processingRecord && (
                    <form onSubmit={handleProcessingSubmit} className="space-y-4">
                        <div>
                            <label className="text-[11px] font-medium block mb-1">처리일시</label>
                            <input
                                type="datetime-local"
                                className="input-field w-full"
                                value={processingRecord.started_at}
                                onChange={e => setProcessingRecord({ ...processingRecord, started_at: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium block mb-1">처리 내용</label>
                            <textarea
                                rows={3}
                                required
                                className="input-field w-full resize-none h-auto"
                                placeholder="1차 처리 내용을 입력하세요..."
                                value={processingRecord.result}
                                onChange={e => setProcessingRecord({ ...processingRecord, result: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium block mb-1">1차 처리자</label>
                            <select
                                className="input-field w-full text-sm"
                                value={processingRecord.first_handler_id || ''}
                                onChange={e => setProcessingRecord({ ...processingRecord, first_handler_id: e.target.value })}
                            >
                                <option value="">현재 사용자 (자동)</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>{s.display_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="pt-2 flex gap-2">
                            <button type="button" onClick={() => setProcessingRecord(null)} className="btn-outline flex-1">취소</button>
                            <button type="submit" className="btn-primary flex-1">저장</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
