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

const STATUS_MAP = {
    pending: { label: '대기', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    processing: { label: '처리중', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    completed: { label: '완료', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
};

export default function RecordsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchRecords();
    }, []);

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

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">장애/접수 기록</h1>
                    <p className="text-muted-foreground text-sm">접수된 모든 서비스 내역을 실시간으로 관리합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-input border hover:bg-white transition-all text-sm font-medium">
                        <Download className="w-4 h-4" />
                        엑셀 추출
                    </button>
                    <button className="btn-premium flex items-center gap-2 text-sm !py-2">
                        <Plus className="w-4 h-4" />
                        새 기록 접수
                    </button>
                </div>
            </div>

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
