'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    Download,
    Calendar,
    AlertCircle,
    Clock,
    CheckCircle2,
    ChevronRight,
    User,
    Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/Modal';

const STATUS_MAP = {
    pending: { label: '대기', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    processing: { label: '처리중', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    completed: { label: '완료', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
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
        details: '',
        status: 'pending'
    });

    const supabase = createClient();

    useEffect(() => {
        fetchRecords();
        fetchClients();
    }, []);

    async function fetchClients() {
        const { data } = await supabase.from('clients').select('id, name');
        if (data) setClients(data);
    }

    async function fetchRecords() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('service_records')
                .select(`
          *,
          clients (name)
        `)
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
            const { error } = await supabase.from('service_records').insert([newRecord]);
            if (error) throw error;
            setIsModalOpen(false);
            fetchRecords();
            setNewRecord({ client_id: '', type: '장애', details: '', status: 'pending' });
        } catch (error) {
            alert('오류가 발생했습니다.');
        }
    }

    async function handleExportExcel() {
        const dataToExport = records.map(r => ({
            '접수일시': new Date(r.reception_at).toLocaleString(),
            '거래처명': r.clients?.name || '미지정',
            '유형': r.type,
            '내용': r.details,
            '처리상태': r.processed_at ? '완료' : '대기',
            '처리결과': r.result || '-'
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '장애접수기록');
        XLSX.writeFile(workbook, `서비스기록_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">장애/접수 기록</h1>
                    <p className="text-muted-foreground text-sm">접수된 모든 서비스 내역을 실시간으로 관리합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-input border hover:bg-white transition-all text-sm font-medium"
                    >
                        <Download className="w-4 h-4" />
                        엑셀 추출
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="btn-premium flex items-center gap-2 text-sm !py-2"
                    >
                        <Plus className="w-4 h-4" />
                        새 기록 접수
                    </button>
                </div>
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="새 장애/서비스 접수"
            >
                <form onSubmit={handleAddRecord} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground ml-1">거래처 선택 *</label>
                        <select
                            required
                            className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground"
                            value={newRecord.client_id}
                            onChange={e => setNewRecord({ ...newRecord, client_id: e.target.value })}
                        >
                            <option value="">거래처를 선택하세요</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground ml-1">접수 유형 *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['신규', '장애', '용지요청', '메뉴수정', '사업자변경', '기타'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setNewRecord({ ...newRecord, type: t })}
                                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${newRecord.type === t
                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                        : 'bg-input border-border hover:border-primary/50 text-foreground'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-muted-foreground ml-1">상세 내용 *</label>
                        <textarea
                            required
                            rows={4}
                            placeholder="발생한 장애 내용이나 요청 사항을 입력하세요..."
                            className="w-full px-4 py-3 bg-input border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-foreground"
                            value={newRecord.details}
                            onChange={e => setNewRecord({ ...newRecord, details: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 py-3 px-6 rounded-2xl border font-bold hover:bg-black/5 transition-all text-foreground"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="flex-[2] btn-premium text-lg"
                        >
                            접수하기
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="거래처명, 내용 검색..."
                        className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="date"
                        className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm">
                        <option>전체 상태</option>
                        <option>대기</option>
                        <option>처리중</option>
                        <option>완료</option>
                    </select>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredRecords.map((record) => {
                        const statusKey = record.processed_at ? 'completed' : 'pending';
                        const status = STATUS_MAP[statusKey as keyof typeof STATUS_MAP];
                        return (
                            <div key={record.id} className="glass rounded-2xl border shadow-sm hover:shadow-md transition-all group overflow-hidden">
                                <div className="flex flex-col lg:flex-row lg:items-center">
                                    <div className={`h-1.5 w-full lg:h-auto lg:w-1.5 shrink-0 ${status.bg}`} />

                                    <div className="p-5 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                                        <div className="lg:col-span-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                                                    {record.type}
                                                </span>
                                                <p className="text-xs text-muted-foreground">{new Date(record.reception_at).toLocaleString()}</p>
                                            </div>
                                            <h3 className="font-bold text-lg">{record.clients?.name || '미지정'}</h3>
                                        </div>

                                        <div className="lg:col-span-4 bg-input/40 p-3 rounded-xl border border-transparent group-hover:border-border transition-colors">
                                            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">접수 내용</p>
                                            <p className="text-sm line-clamp-2">{record.details}</p>
                                        </div>

                                        <div className="lg:col-span-3 p-3 lg:p-0">
                                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                처리 결과
                                            </div>
                                            <p className="text-sm italic text-muted-foreground">{record.result || '-'}</p>
                                        </div>

                                        <div className="lg:col-span-2 flex items-center justify-between lg:justify-end gap-4 p-3 lg:p-0 border-t lg:border-0">
                                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${status.bg} ${status.color} ${status.border}`}>
                                                <status.icon className="w-3.5 h-3.5" />
                                                <span className="text-xs font-bold">{status.label}</span>
                                            </div>
                                            <button className="p-2 rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all">
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredRecords.length === 0 && !loading && (
                        <div className="text-center py-20 glass rounded-3xl border border-dashed">
                            <p className="text-muted-foreground">접수된 기록이 없습니다.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
