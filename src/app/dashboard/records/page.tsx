'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Loader2, AlertCircle, Clock, CheckCircle2, Pencil, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/Modal';

const STATUS_MAP = {
    pending: { label: '대기', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    processing: { label: '처리중', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    completed: { label: '완료', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
};

export default function RecordsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [records, setRecords] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
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

    const supabase = createClient();

    useEffect(() => {
        fetchUserRole();
        fetchRecords();
        fetchClients();
        fetchServiceTypes();
    }, []);

    async function fetchUserRole() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (data) setUserRole(data.role || 'field');
        }
    }

    async function fetchServiceTypes() {
        const { data } = await supabase.from('service_types').select('*').order('sort_order');
        if (data) setServiceTypes(data);
    }

    async function fetchClients() {
        const { data } = await supabase.from('clients').select('id, name');
        if (data) setClients(data);
    }

    async function fetchRecords() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('service_records')
                .select(`*, clients (name)`)
                .order('reception_at', { ascending: false });

            if (error) throw error;
            setRecords(data || []);
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredRecords = records.filter(r =>
        r.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.details?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    async function handleAddRecord(e: React.FormEvent) {
        e.preventDefault();
        try {
            const recordData = {
                ...newRecord,
                client_id: newRecord.client_id || null
            };
            const { error } = await supabase.from('service_records').insert([recordData]);
            if (error) {
                console.error('Insert error:', error);
                throw error;
            }
            setIsModalOpen(false);
            fetchRecords();
            setNewRecord({ client_id: '', type: '장애', details: '' });
        } catch (error: any) {
            console.error('Full error:', error);
            alert(`오류: ${error?.message || error?.code || JSON.stringify(error)}`);
        }
    }

    async function handleUpdateRecord(e: React.FormEvent) {
        e.preventDefault();
        if (!editingRecord) return;
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
            setEditingRecord(null);
            fetchRecords();
        } catch (error: any) {
            alert(`수정 오류: ${error?.message}`);
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
        if (!completingRecord) return;
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
            fetchRecords();
        } catch (error: any) {
            alert(`완료 처리 오류: ${error?.message}`);
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
        if (!processingRecord) return;
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
            fetchRecords();
        } catch (error: any) {
            alert(`처리 시작 오류: ${error?.message}`);
        }
    }

    async function handleStartProcessing(recordId: string) {
        try {
            const { error } = await supabase
                .from('service_records')
                .update({ status: 'processing' })
                .eq('id', recordId);
            if (error) throw error;
            fetchRecords();
        } catch (error: any) {
            alert(`처리 시작 오류: ${error?.message}`);
        }
    }

    function formatDateTime(dateStr: string) {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    async function handleExportExcel() {
        const dataToExport = records.map(r => ({
            '접수일시': new Date(r.reception_at).toLocaleString(),
            '거래처명': r.clients?.name || '미지정',
            '유형': r.type,
            '내용': r.details,
            '처리상태': STATUS_MAP[r.status as keyof typeof STATUS_MAP]?.label || (r.processed_at ? '완료' : '대기'),
            '처리일시': r.processed_at
                ? new Date(r.processed_at).toLocaleString()
                : (r.started_at ? new Date(r.started_at).toLocaleString() : '-'),
            '처리결과': r.result || '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
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

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="거래처명 또는 내용 검색..."
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
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
                        <div className="col-span-2">내용</div>
                        <div className="col-span-2">처리결과</div>
                        <div className="col-span-2">처리일시</div>
                        <div className="col-span-2 text-center">상태</div>
                        <div className="col-span-3 text-right">관리</div>
                    </div>

                    {/* 목록 */}
                    <div className="divide-y divide-slate-100">
                        {filteredRecords.map((record) => {
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
                                            {record.clients?.name || '-'}
                                        </div>
                                        <div className="col-span-1 text-slate-800">{record.type}</div>
                                        <div className="col-span-2 text-slate-800 truncate">{record.details || '-'}</div>
                                        <div className="col-span-2 text-slate-800 truncate">{record.result || '-'}</div>
                                        <div className="col-span-2 text-slate-800 text-nowrap">
                                            {record.processed_at
                                                ? formatDateTime(record.processed_at)
                                                : (record.started_at ? formatDateTime(record.started_at) : '-')}
                                        </div>
                                        <div className="col-span-2 flex justify-center">
                                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full uppercase ${status.bg} ${status.color}`}>
                                                <status.icon className="w-3 h-3" />
                                                {status.label}
                                            </span>
                                        </div>
                                        <div className="col-span-3 flex gap-1 justify-end">
                                            <button
                                                onClick={() => setEditingRecord({ ...record, client_id: record.client_id || '' })}
                                                className="text-[12px] font-medium text-slate-600 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                수정
                                            </button>

                                            {(userRole === 'operator' || userRole === 'admin' || userRole === 'callcenter') && statusKey === 'pending' && (
                                                <button
                                                    onClick={() => openProcessingModal(record)}
                                                    className="text-[12px] font-medium text-blue-600 px-2 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-all"
                                                >
                                                    1차
                                                </button>
                                            )}

                                            {statusKey !== 'completed' && (
                                                <button
                                                    onClick={() => openCompleteModal(record)}
                                                    className="text-[12px] font-medium text-emerald-600 px-2 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-all"
                                                >
                                                    완료
                                                </button>
                                            )}
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
                                                <span className="font-medium text-slate-800 truncate text-[14px]">{record.clients?.name || '미지정'}</span>
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
                        {filteredRecords.length === 0 && (
                            <div className="text-center py-20 bg-slate-50/50">
                                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-800 font-medium">검색 결과가 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 장애/서비스 접수">
                <form onSubmit={handleAddRecord} className="space-y-4">
                    <div className="space-y-8">
                        <label className="text-sm font-medium block mb-4">거래처 선택 *</label>
                        <select
                            required
                            className="input-field w-full"
                            value={newRecord.client_id}
                            onChange={e => setNewRecord({ ...newRecord, client_id: e.target.value })}
                        >
                            <option value="">거래처를 선택하세요</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn-outline flex-1">취소</button>
                        <button type="submit" className="btn-primary flex-1">저장</button>
                    </div>
                </form>
            </Modal>

            {/* 수정 모달 */}
            <Modal isOpen={!!editingRecord} onClose={() => setEditingRecord(null)} title="접수 수정">
                {editingRecord && (
                    <form onSubmit={handleUpdateRecord} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-1">거래처</label>
                            <select
                                className="input-field w-full"
                                value={editingRecord.client_id || ''}
                                onChange={e => setEditingRecord({ ...editingRecord, client_id: e.target.value })}
                            >
                                <option value="">선택 안함</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
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
                                rows={2}
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
                            <button type="button" onClick={() => setProcessingRecord(null)} className="btn-outline flex-1">취소</button>
                            <button type="submit" className="btn-primary flex-1">저장</button>
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
                                {viewingRecord.processed_at && (
                                    <p className="text-[10px] text-slate-800 mt-2 font-mono">완료일시: {new Date(viewingRecord.processed_at).toLocaleString()}</p>
                                )}
                                {viewingRecord.started_at && !viewingRecord.processed_at && (
                                    <p className="text-[10px] text-slate-800 mt-2 font-mono">처리시작: {new Date(viewingRecord.started_at).toLocaleString()}</p>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 flex gap-2">
                            <button
                                onClick={() => {
                                    setEditingRecord({ ...viewingRecord, client_id: viewingRecord.client_id || '' });
                                    setViewingRecord(null);
                                }}
                                className="flex-1 btn-outline font-semibold"
                            >
                                수정하기
                            </button>
                            <button onClick={() => setViewingRecord(null)} className="flex-1 btn-primary font-semibold">닫기</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
