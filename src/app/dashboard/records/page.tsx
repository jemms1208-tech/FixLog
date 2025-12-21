'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Loader2, AlertCircle, Clock, CheckCircle2, Pencil, Check, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

const STATUS_MAP = {
    pending: { label: '대기', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    processing: { label: '처리중', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    completed: { label: '완료', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

export default function RecordsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [records, setRecords] = useState<any[]>([]);
    const [clientList, setClientList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRecord, setNewRecord] = useState({
        client_id: '',
        type: '장애',
        details: ''
    });
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [completingRecord, setCompletingRecord] = useState<any>(null);
    const [processingRecord, setProcessingRecord] = useState<any>(null);
    const [viewingRecord, setViewingRecord] = useState<any>(null);
    const [serviceTypes, setServiceTypes] = useState<any[]>([]);
    const [userRole, setUserRole] = useState<string>('field');

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 20;

    // 날짜 범위 필터
    const [receptionDateRange, setReceptionDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [processedDateRange, setProcessedDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [showDateFilter, setShowDateFilter] = useState(false);

    // 사용자 접근 가능 그룹
    const [allowedGroups, setAllowedGroups] = useState<string[]>([]);
    const [allowedGroupsLoaded, setAllowedGroupsLoaded] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clientSearch, setClientSearch] = useState('');

    useEffect(() => {
        if (isModalOpen || editingRecord) {
            setClientSearch('');
        }
    }, [isModalOpen, editingRecord]);

    const supabase = createClient();
    const { showToast } = useToast();

    // 검색어 디바운싱 (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // 검색어 변경 시 첫 페이지로
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchUserRole();
        fetchClients();
        fetchServiceTypes();
    }, []);

    // allowedGroups 로드 완료 후에만 데이터 가져오기
    useEffect(() => {
        if (allowedGroupsLoaded) {
            fetchRecords();
        }
    }, [debouncedSearch, currentPage, allowedGroups, allowedGroupsLoaded, receptionDateRange, processedDateRange]);


    async function fetchUserRole() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('role, allowed_groups').eq('id', user.id).single();
            if (data) {
                setUserRole(data.role || 'field');
                setAllowedGroups(data.allowed_groups || []);
            }
        }
        setAllowedGroupsLoaded(true);
    }

    async function fetchServiceTypes() {
        const { data } = await supabase.from('service_types').select('*').order('sort_order');
        if (data) setServiceTypes(data);
    }

    async function fetchClients() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('allowed_groups').eq('id', user.id).single();

            let query = supabase.from('clients').select('id, name, group_id, client_groups (name)');

            // 접근 그룹 필터링
            if (profile?.allowed_groups && profile.allowed_groups.length > 0) {
                query = query.in('group_id', profile.allowed_groups);
            }

            const { data } = await query;
            if (data) setClientList(data);
        }
    }

    // 키:값 검색 파싱 함수
    const parseSearchQuery = (query: string) => {
        const filters: { [key: string]: string } = {};
        let generalSearch = '';

        const keyValuePattern = /(거래처|유형|상태|내용|결과|처리결과|접수|접수일|접수일시|처리|처리일|처리일시)\s*:\s*([^\s,]+)/g;
        let match;
        const usedRanges: [number, number][] = [];

        while ((match = keyValuePattern.exec(query)) !== null) {
            filters[match[1]] = match[2];
            usedRanges.push([match.index, match.index + match[0].length]);
        }

        let remaining = query;
        usedRanges.sort((a, b) => b[0] - a[0]).forEach(([start, end]) => {
            remaining = remaining.slice(0, start) + remaining.slice(end);
        });
        generalSearch = remaining.replace(/,/g, ' ').trim();

        return { filters, generalSearch };
    };

    async function fetchRecords() {
        try {
            setLoading(true);

            // 접근 그룹 필터링을 위해 먼저 허용된 거래처 ID 목록 조회
            let allowedClientIds: string[] | null = null;
            if (allowedGroups.length > 0) {
                const { data: allowedClients } = await supabase
                    .from('clients')
                    .select('id')
                    .in('group_id', allowedGroups);
                allowedClientIds = allowedClients?.map(c => c.id) || [];
            }

            // 기본 쿼리 빌더
            let query = supabase
                .from('service_records')
                .select(`*, clients (name, group_id, client_groups (name))`, { count: 'exact' });

            // 접근 그룹 필터링 (해당 그룹의 거래처 내역만 조회)
            if (allowedClientIds !== null) {
                if (allowedClientIds.length === 0) {
                    // 접근 가능한 거래처가 없으면 빈 결과 반환
                    setRecords([]);
                    setTotalCount(0);
                    setLoading(false);
                    return;
                }
                query = query.in('client_id', allowedClientIds);
            }

            // 키:값 검색 파싱
            const { filters, generalSearch } = parseSearchQuery(debouncedSearch);

            // 거래처 이름으로 검색 시 먼저 client_id 조회
            if (filters['거래처']) {
                const { data: matchingClients } = await supabase
                    .from('clients')
                    .select('id')
                    .ilike('name', `%${filters['거래처']}%`);

                if (matchingClients && matchingClients.length > 0) {
                    const matchingIds = matchingClients.map(c => c.id);
                    // allowedClientIds가 있으면 교집합, 없으면 matchingIds만
                    if (allowedClientIds !== null) {
                        const intersection = matchingIds.filter(id => allowedClientIds!.includes(id));
                        if (intersection.length === 0) {
                            setRecords([]);
                            setTotalCount(0);
                            setLoading(false);
                            return;
                        }
                        query = query.in('client_id', intersection);
                    } else {
                        query = query.in('client_id', matchingIds);
                    }
                } else {
                    // 매칭되는 거래처가 없으면 빈 결과
                    setRecords([]);
                    setTotalCount(0);
                    setLoading(false);
                    return;
                }
            }

            // 키:값 필터 적용
            if (filters['유형']) query = query.ilike('type', `%${filters['유형']}%`);
            if (filters['내용']) query = query.ilike('details', `%${filters['내용']}%`);

            if (filters['결과'] || filters['처리결과']) {
                query = query.ilike('result', `%${filters['결과'] || filters['처리결과']}%`);
            }

            if (filters['접수'] || filters['접수일'] || filters['접수일시']) {
                const term = filters['접수'] || filters['접수일'] || filters['접수일시'];
                const dateStr = term.replace(/\//g, '-');
                query = query.ilike('reception_at::text', `%${dateStr}%`);
            }

            if (filters['처리'] || filters['처리일'] || filters['처리일시']) {
                const term = filters['처리'] || filters['처리일'] || filters['처리일시'];
                const dateStr = term.replace(/\//g, '-');
                // 처리일시는 완료일(processed_at) 기준 검색
                query = query.ilike('processed_at::text', `%${dateStr}%`);
            }

            if (filters['상태']) {
                // 상태 한글 → 영문 매핑
                const statusMap: { [key: string]: string } = { '대기': 'pending', '처리중': 'processing', '완료': 'completed' };
                const statusValue = statusMap[filters['상태']] || filters['상태'];
                query = query.eq('status', statusValue);
            }

            // 일반 검색어가 있으면 전체 필드에서 검색
            if (generalSearch.trim()) {
                const search = generalSearch;
                // reception_at::text, processed_at::text 등 날짜 필드도 텍스트 검색에 포함시킬 수 있지만 복잡할 수 있음.
                // 여기서는 주요 텍스트 필드만 검색
                query = query.or(`details.ilike.%${search}%,type.ilike.%${search}%,result.ilike.%${search}%`);
            }

            // 날짜 범위 필터 (UTC ISO 변환으로 정확한 시간 비교)
            if (receptionDateRange.start) {
                const startDate = new Date(receptionDateRange.start);
                // 로컬 00:00:00 -> UTC
                query = query.gte('reception_at', startDate.toISOString());
            }
            if (receptionDateRange.end) {
                const endDate = new Date(receptionDateRange.end);
                endDate.setHours(23, 59, 59, 999);
                // 로컬 23:59:59 -> UTC
                query = query.lte('reception_at', endDate.toISOString());
            }

            // 처리일시 필터: 처리일시(processed_at) 검색 시 처리중(started_at)인 건도 포함
            if (processedDateRange.start || processedDateRange.end) {
                const startISO = processedDateRange.start
                    ? new Date(processedDateRange.start).toISOString()
                    : '1970-01-01T00:00:00.000Z';

                let endISO = '9999-12-31T23:59:59.999Z';
                if (processedDateRange.end) {
                    const endDate = new Date(processedDateRange.end);
                    endDate.setHours(23, 59, 59, 999);
                    endISO = endDate.toISOString();
                }

                // (완료일시가 기간 내) OR (시작일시가 기간 내)
                // Supabase OR syntax with AND groups
                query = query.or(`and(processed_at.gte.${startISO},processed_at.lte.${endISO}),and(started_at.gte.${startISO},started_at.lte.${endISO})`);
            }

            // 페이지네이션 및 정렬 적용
            const from = (currentPage - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error, count } = await query
                .order('reception_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            setRecords(data || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setLoading(false);
        }
    }

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // 서버 페이지네이션: 검색은 fetchRecords의 Supabase 쿼리에서 처리

    async function handleAddRecord(e: React.FormEvent) {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const recordData = {
                ...newRecord,
                client_id: newRecord.client_id || null
            };
            const { data, error } = await supabase.from('service_records').insert([recordData]).select().single();
            if (error) {
                console.error('Insert error:', error);
                throw error;
            }

            // 활동 로그 기록
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('id', user.id).single();
                const clientName = clientList.find((c: any) => c.id === newRecord.client_id)?.name || '미지정';

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

            setIsModalOpen(false);
            fetchRecords();
            setNewRecord({ client_id: '', type: '장애', details: '' });
            showToast('접수가 등록되었습니다.', 'success');
        } catch (error: any) {
            showToast(`등록 오류: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleUpdateRecord(e: React.FormEvent) {
        e.preventDefault();
        if (!editingRecord || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('service_records')
                .update({
                    client_id: editingRecord.client_id || null,
                    type: editingRecord.type,
                    details: editingRecord.details,
                    result: editingRecord.result,
                    status: editingRecord.status,
                    processed_at: editingRecord.processed_at,
                    started_at: editingRecord.started_at
                })
                .eq('id', editingRecord.id);
            if (error) throw error;

            // 활동 로그 기록
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('id', user.id).single();
                await supabase.from('activity_logs').insert([{
                    user_id: user.id,
                    user_email: profile?.email,
                    user_display_name: profile?.display_name,
                    action: 'UPDATE_RECORD',
                    target_type: 'record',
                    target_id: editingRecord.id,
                    details: { '유형': editingRecord.type, '거래처': editingRecord.clients?.name || clientList.find((c: any) => c.id === editingRecord.client_id)?.name }
                }]);
            }

            setEditingRecord(null);
            showToast('내역이 수정되었습니다.', 'success');
            fetchRecords();
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
            // 삭제 전에 내역 정보 가져오기
            const recordToDelete = records.find(r => r.id === id);

            const { error } = await supabase.from('service_records').delete().eq('id', id);
            if (error) throw error;

            // 활동 로그 기록
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('id', user.id).single();
                await supabase.from('activity_logs').insert([{
                    user_id: user.id,
                    user_email: profile?.email,
                    user_display_name: profile?.display_name,
                    action: 'DELETE_RECORD',
                    target_type: 'record',
                    target_id: id,
                    details: { '유형': recordToDelete?.type, '거래처': recordToDelete?.clients?.name }
                }]);
            }

            showToast('접수 내역이 삭제되었습니다.', 'info');
            fetchRecords();
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
        setCompletingRecord({
            id: record.id,
            processed_at: localDateTime,
            result: ''
        });
    }

    async function handleCompleteSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!completingRecord || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('service_records')
                .update({
                    processed_at: new Date(completingRecord.processed_at).toISOString(),
                    result: completingRecord.result,
                    status: 'completed'
                })
                .eq('id', completingRecord.id);
            if (error) throw error;
            setCompletingRecord(null);
            showToast('처리가 완료되었습니다.', 'success');
            fetchRecords();
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
        setProcessingRecord({
            id: record.id,
            started_at: localDateTime,
            result: ''
        });
    }

    async function handleProcessingSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!processingRecord || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('service_records')
                .update({
                    status: 'processing',
                    started_at: new Date(processingRecord.started_at).toISOString(),
                    result: processingRecord.result
                })
                .eq('id', processingRecord.id);
            if (error) throw error;
            setProcessingRecord(null);
            showToast('처리 중으로 변경되었습니다.', 'success');
            fetchRecords();
        } catch (error: any) {
            showToast(`처리 시작 오류: ${error.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleStartProcessing(recordId: string) {
        try {
            const { error } = await supabase
                .from('service_records')
                .update({ status: 'processing' })
                .eq('id', recordId);
            if (error) throw error;
            showToast('처리 중으로 변경되었습니다.', 'success');
            fetchRecords();
        } catch (error: any) {
            showToast(`처리 시작 오류: ${error.message}`, 'error');
        }
    }

    function formatDateTime(dateStr: string) {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    function formatClientName(client: any) {
        if (!client) return '-';
        const groupName = client.client_groups?.name || (Array.isArray(client.client_groups) && client.client_groups[0]?.name) || '';
        return groupName ? `(${groupName}) ${client.name}` : client.name;
    }

    async function handleExportExcel() {
        const dataToExport = records.map(r => ({
            '접수일시': new Date(r.reception_at).toLocaleString(),
            '거래처명': formatClientName(r.clients),
            '유형': r.type,
            '내용': r.details || '-',
            '처리상태': STATUS_MAP[r.status as keyof typeof STATUS_MAP]?.label || (r.processed_at ? '완료' : '대기'),
            '처리일시': r.processed_at
                ? new Date(r.processed_at).toLocaleString()
                : (r.started_at ? new Date(r.started_at).toLocaleString() : '-'),
            '처리결과': r.result || '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        const getLength = (str: string) => {
            let len = 0;
            for (let i = 0; i < str.length; i++) {
                len += str.charCodeAt(i) > 127 ? 2 : 1;
            }
            return len;
        };

        const colWidths = Object.keys(dataToExport[0] || {}).map(key => {
            const maxLen = Math.max(
                getLength(key),
                ...dataToExport.map(row => getLength(String(row[key as keyof typeof row] || '')))
            );
            return { wch: maxLen + 4 }; // 여유 공간 4
        });
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '장애접수기록');
        XLSX.writeFile(workbook, `서비스기록_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">접수내역</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportExcel} className="btn-outline">엑셀</button>
                    <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                        <Plus className="w-4 h-4" /> 추가
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex gap-2 relative">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="검색어 입력 또는 거래처:제이이, 유형:장애, 상태:대기"
                            className="input-field w-full"
                            style={{ paddingLeft: '2.5rem' }}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowDateFilter(!showDateFilter)}
                        className={`btn-outline px-3 transition-colors ${showDateFilter ? 'bg-slate-100 border-slate-300' : ''}`}
                        title="기간 설정"
                    >
                        <Calendar className="w-4 h-4" />
                    </button>
                </div>

                {showDateFilter && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">접수일시</label>
                            <div className="flex gap-2 items-center">
                                <input type="date" className="input-field text-sm flex-1 bg-white" value={receptionDateRange.start} onChange={e => setReceptionDateRange({ ...receptionDateRange, start: e.target.value })} />
                                <span className="text-slate-400">~</span>
                                <input type="date" className="input-field text-sm flex-1 bg-white" value={receptionDateRange.end} onChange={e => setReceptionDateRange({ ...receptionDateRange, end: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">처리일시</label>
                            <div className="flex gap-2 items-center">
                                <input type="date" className="input-field text-sm flex-1 bg-white" value={processedDateRange.start} onChange={e => setProcessedDateRange({ ...processedDateRange, start: e.target.value })} />
                                <span className="text-slate-400">~</span>
                                <input type="date" className="input-field text-sm flex-1 bg-white" value={processedDateRange.end} onChange={e => setProcessedDateRange({ ...processedDateRange, end: e.target.value })} />
                            </div>
                        </div>
                        {(receptionDateRange.start || receptionDateRange.end || processedDateRange.start || processedDateRange.end) && (
                            <div className="md:col-span-2 flex justify-end">
                                <button
                                    onClick={() => {
                                        setReceptionDateRange({ start: '', end: '' });
                                        setProcessedDateRange({ start: '', end: '' });
                                    }}
                                    className="text-xs text-slate-500 hover:text-slate-700 underline"
                                >
                                    기간 필터 초기화
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* PC 전용 헤더 (lg 이상) */}
                    <div className="hidden lg:grid grid-cols-16 gap-2 p-4 bg-slate-50 border-b text-[11px] font-medium text-slate-800 uppercase">
                        <div className="col-span-2">접수일시</div>
                        <div className="col-span-2">거래처</div>
                        <div className="col-span-1">유형</div>
                        <div className="col-span-3">내용</div>
                        <div className="col-span-3">처리결과</div>
                        <div className="col-span-2">처리일시</div>
                        <div className="col-span-1 text-center">상태</div>
                        <div className="col-span-2 text-right">관리</div>
                    </div>

                    {/* 목록 */}
                    <div className="divide-y divide-slate-100">
                        {records.map((record: any) => {
                            const statusKey = record.status || (record.processed_at ? 'completed' : 'pending');
                            const status = STATUS_MAP[statusKey as keyof typeof STATUS_MAP];

                            return (
                                <div key={record.id} className="group">
                                    {/* PC 레이아웃 (lg 이상) */}
                                    <div className="hidden lg:grid grid-cols-16 gap-2 p-4 hover:bg-slate-50 transition-colors text-[14px] font-medium items-center">
                                        <div className="col-span-2 text-slate-800 text-nowrap">
                                            {formatDateTime(record.reception_at)}
                                        </div>
                                        <div className="col-span-2 text-slate-800 truncate">
                                            {formatClientName(record.clients)}
                                        </div>
                                        <div className="col-span-1 text-slate-800">{record.type}</div>
                                        <div className="col-span-3 text-slate-800 truncate">{record.details || '-'}</div>
                                        <div className="col-span-3 text-slate-800 truncate">{record.result || '-'}</div>
                                        <div className="col-span-2 text-slate-800 text-nowrap">
                                            {record.processed_at
                                                ? formatDateTime(record.processed_at)
                                                : (record.started_at ? formatDateTime(record.started_at) : '-')}
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full uppercase whitespace-nowrap ${status.bg} ${status.color}`}>
                                                <status.icon className="w-3 h-3" />
                                                {status.label}
                                            </span>
                                        </div>
                                        <div className="col-span-2 flex gap-1 justify-end">
                                            <button
                                                onClick={() => setViewingRecord(record)}
                                                className="text-[12px] font-medium text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                상세보기
                                            </button>
                                        </div>
                                    </div>

                                    {/* 모바일 레이아웃 (lg 미만) */}
                                    <div
                                        className="lg:hidden p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                        onClick={() => setViewingRecord(record)}
                                    >
                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusKey === 'completed' ? 'bg-emerald-500' : statusKey === 'processing' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                                <span className="font-medium text-slate-800 truncate text-[14px]">
                                                    {formatClientName(record.clients)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[14px] text-slate-800 font-medium">
                                                <span className="whitespace-nowrap">{record.type}</span>
                                                <span className="text-slate-300 font-normal">|</span>
                                                <span className="truncate">{record.details || '내용 없음'}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                                            <span className="text-[14px] text-slate-800 font-medium uppercase">
                                                {formatDateTime(record.reception_at)}
                                            </span>
                                            <span className={`text-[14px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 페이지네이션 */}
                    {
                        totalPages > 1 && (
                            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-sm text-slate-500">
                                    총 <span className="font-bold text-slate-700">{totalCount.toLocaleString()}</span>건 중 {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)}건
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                                    >
                                        처음
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                                    >
                                        이전
                                    </button>
                                    <span className="px-4 py-1.5 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                                    >
                                        다음
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                                    >
                                        끝
                                    </button>
                                </div>
                            </div>
                        )
                    }
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 장애/서비스 접수">
                <form onSubmit={handleAddRecord} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium block mb-1">거래처 선택 *</label>
                        <input
                            type="text"
                            placeholder="거래처 검색..."
                            className="input-field w-full mb-2 text-sm bg-slate-50"
                            value={clientSearch}
                            onChange={e => setClientSearch(e.target.value)}
                        />
                        <select
                            required
                            className="input-field w-full"
                            value={newRecord.client_id}
                            onChange={e => setNewRecord({ ...newRecord, client_id: e.target.value })}
                            size={5}
                        >
                            <option value="">거래처를 선택하세요</option>
                            {clientList
                                .filter((c: any) =>
                                    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                    c.client_groups?.name?.toLowerCase().includes(clientSearch.toLowerCase())
                                )
                                .map((client: any) => (
                                    <option key={client.id} value={client.id} className="py-1">
                                        {client.client_groups?.name ? `(${client.client_groups.name}) ` : ''}{client.name}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="space-y-8">
                        <label className="text-sm font-medium block mb-4">접수 유형 *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(serviceTypes.length > 0 ? serviceTypes.map(t => t.name) : ['장애', '서비스', '기타']).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setNewRecord({ ...newRecord, type: t })}
                                    className={`py-2 rounded text-sm font-medium border-2 ${newRecord.type === t
                                        ? 'bg-blue-50 text-primary border-primary font-bold'
                                        : 'bg-white border-gray-200 text-gray-700 hover:border-primary/50'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <label className="text-sm font-medium block mb-4">상세 내용 *</label>
                        <textarea
                            required
                            rows={3}
                            placeholder="발생한 장애 내용이나 요청 사항을 입력하세요..."
                            className="input-field resize-none"
                            value={newRecord.details}
                            onChange={e => setNewRecord({ ...newRecord, details: e.target.value })}
                        />
                    </div>

                    <div className="pt-2 flex gap-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn-outline flex-1" disabled={isSubmitting}>취소</button>
                        <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>{isSubmitting ? '저장 중...' : '저장'}</button>
                    </div>
                </form>
            </Modal>

            {/* 수정 모달 */}
            <Modal isOpen={!!editingRecord} onClose={() => setEditingRecord(null)} title="접수 수정">
                {editingRecord && (
                    <form onSubmit={handleUpdateRecord} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-1">거래처</label>
                            <input
                                type="text"
                                placeholder="거래처 검색..."
                                className="input-field w-full mb-2 text-sm bg-slate-50"
                                value={clientSearch}
                                onChange={e => setClientSearch(e.target.value)}
                            />
                            <select
                                className="input-field w-full"
                                value={editingRecord.client_id || ''}
                                onChange={e => setEditingRecord({ ...editingRecord, client_id: e.target.value })}
                                size={5} // 목록이 보이도록 확장
                            >
                                <option value="">선택 안함</option>
                                {clientList
                                    .filter((c: any) =>
                                        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                        c.client_groups?.name?.toLowerCase().includes(clientSearch.toLowerCase())
                                    )
                                    .map((client: any) => (
                                        <option key={client.id} value={client.id} className="py-1">
                                            {client.client_groups?.name ? `(${client.client_groups.name}) ` : ''}{client.name}
                                        </option>
                                    ))}
                            </select>
                        </div>        <div>
                            <label className="text-sm font-medium block mb-1">유형</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(serviceTypes.length > 0 ? serviceTypes.map(t => t.name) : ['장애', '서비스', '기타']).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setEditingRecord({ ...editingRecord, type: t })}
                                        className={`py-2 rounded text-sm font-medium border-2 ${editingRecord.type === t
                                            ? 'bg-blue-50 text-primary border-primary font-bold'
                                            : 'bg-white border-gray-200 text-gray-700 hover:border-primary/50'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">상세 내용</label>
                            <textarea
                                rows={4}
                                className="input-field w-full resize-none"
                                value={editingRecord.details || ''}
                                onChange={e => setEditingRecord({ ...editingRecord, details: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">처리결과 (대기 상태 시 입력 불가)</label>
                            <textarea
                                rows={2}
                                className={`input-field w-full resize-none ${editingRecord.status === 'pending' ? 'bg-slate-50 text-slate-800 opacity-70' : ''}`}
                                placeholder={editingRecord.status === 'pending' ? '처리중/완료 상태에서 입력 가능합니다.' : '처리 결과를 입력하세요.'}
                                disabled={editingRecord.status === 'pending'}
                                value={editingRecord.status === 'pending' ? '' : (editingRecord.result || '')}
                                onChange={e => setEditingRecord({ ...editingRecord, result: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">상태</label>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(STATUS_MAP).map(([key, value]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            const updates: any = { status: key };
                                            if (key === 'pending') {
                                                updates.result = '';
                                                updates.processed_at = null;
                                                updates.started_at = null;
                                            }
                                            setEditingRecord({ ...editingRecord, ...updates });
                                        }}
                                        className={`py-2 rounded text-sm font-medium border-2 ${editingRecord.status === key
                                            ? 'bg-blue-50 text-blue-600 border-blue-600 font-bold'
                                            : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                                            }`}
                                    >
                                        {value.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="pt-2 flex gap-2">
                            <button type="button" onClick={() => setEditingRecord(null)} className="btn-outline flex-1" disabled={isSubmitting}>취소</button>
                            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>{isSubmitting ? '수정 중...' : '수정'}</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* 완료 처리 모달 */}
            <Modal isOpen={!!completingRecord} onClose={() => setCompletingRecord(null)} title="완료 처리">
                {completingRecord && (
                    <form onSubmit={handleCompleteSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-1">처리일시</label>
                            <input
                                type="datetime-local"
                                className="input-field w-full"
                                value={completingRecord.processed_at}
                                onChange={e => setCompletingRecord({ ...completingRecord, processed_at: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">처리결과</label>
                            <textarea
                                rows={3}
                                className="input-field w-full resize-none"
                                placeholder="처리 내용을 입력하세요..."
                                value={completingRecord.result}
                                onChange={e => setCompletingRecord({ ...completingRecord, result: e.target.value })}
                            />
                        </div>
                        <div className="pt-2 flex gap-2">
                            <button type="button" onClick={() => setCompletingRecord(null)} className="btn-outline flex-1" disabled={isSubmitting}>취소</button>
                            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>{isSubmitting ? '완료 중...' : '완료'}</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* 1차 처리 모달 */}
            <Modal isOpen={!!processingRecord} onClose={() => setProcessingRecord(null)} title="1차 처리">
                {processingRecord && (
                    <form onSubmit={handleProcessingSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-1">처리일시</label>
                            <input
                                type="datetime-local"
                                className="input-field w-full"
                                value={processingRecord.started_at}
                                onChange={e => setProcessingRecord({ ...processingRecord, started_at: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">처리 내용</label>
                            <textarea
                                rows={3}
                                required
                                className="input-field w-full resize-none"
                                placeholder="1차 처리 내용을 입력하세요..."
                                value={processingRecord.result}
                                onChange={e => setProcessingRecord({ ...processingRecord, result: e.target.value })}
                            />
                        </div>
                        <div className="pt-2 flex gap-2">
                            <button type="button" onClick={() => setProcessingRecord(null)} className="btn-outline flex-1" disabled={isSubmitting}>취소</button>
                            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>{isSubmitting ? '저장 중...' : '저장'}</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* 상세 보기 모달 */}
            <Modal isOpen={!!viewingRecord} onClose={() => setViewingRecord(null)} title="접수 상세 정보">
                {viewingRecord && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 border-b border-slate-100 pb-2">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">접수일시</label>
                                    <p className="text-[14px] font-medium text-slate-800">{new Date(viewingRecord.reception_at).toLocaleString()}</p>
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

                            {(viewingRecord.started_at || viewingRecord.processed_at) && (
                                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-2">
                                    {viewingRecord.started_at && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-800 uppercase">처리 시작</label>
                                            <p className="text-[14px] font-medium text-slate-800 font-mono">{new Date(viewingRecord.started_at).toLocaleString()}</p>
                                        </div>
                                    )}
                                    {viewingRecord.processed_at && (
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-800 uppercase">처리 완료</label>
                                            <p className="text-[14px] font-medium text-slate-800 font-mono">{new Date(viewingRecord.processed_at).toLocaleString()}</p>
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
        </div>
    );
}
