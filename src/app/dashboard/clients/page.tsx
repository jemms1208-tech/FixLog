'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    Download,
    MoreVertical,
    Edit2,
    Trash2,
    Phone,
    MapPin,
    Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase';

export default function ClientsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        fetchClients();
    }, []);

    async function fetchClients() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('clients')
                .select(`
          *,
          client_groups (name)
        `)
                .order('name');

            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.biz_reg_no?.includes(searchTerm) ||
        c.phone?.includes(searchTerm)
    );

    async function handleExportExcel() {
        const dataToExport = clients.map(c => ({
            '상호명': c.name,
            '사업자번호': c.biz_reg_no,
            '관리 그룹': c.client_groups?.name || '미분류',
            '전화번호': c.phone,
            '주소': c.address,
            '밴사': c.van_company,
            '장비': c.equipment
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '거래처목록');
        XLSX.writeFile(workbook, `거래처관리_${new Date().toISOString().split('T')[0]}.xlsx`);
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">거래처 관리</h1>
                    <p className="text-muted-foreground text-sm">전체 거래처 목록 및 상세 정보를 관리합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-input border hover:bg-white transition-all text-sm font-medium">
                        <Download className="w-4 h-4" />
                        엑셀 추출
                    </button>
                    <button className="btn-premium flex items-center gap-2 text-sm !py-2">
                        <Plus className="w-4 h-4" />
                        거래처 추가
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="glass p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="상호명, 사업자번호, 전화번호로 검색..."
                        className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* ... filter buttons ... */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-40">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm">
                            <option>전체 그룹</option>
                            <option>인천 미추홀구</option>
                            <option>서울 강남</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Desktop Table */}
                    <div className="hidden lg:block glass rounded-3xl border shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-input/50 border-b">
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">상호명 / 사업자번호</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">연락처 / 주소</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">관리 그룹</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">밴사 / 장비</th>
                                    <th className="px-6 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-foreground">
                                {filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-primary/5 transition-colors group">
                                        <td className="px-6 py-5">
                                            <p className="font-bold">{client.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{client.biz_reg_no}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                                {client.phone}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 lowercase">
                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate max-w-[200px]">{client.address}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                                {client.client_groups?.name || '미분류'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-sm">
                                            <p>{client.van_company}</p>
                                            <p className="text-xs text-muted-foreground">{client.equipment}</p>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button className="p-2 rounded-lg hover:bg-background transition-colors text-muted-foreground opacity-0 group-hover:opacity-100">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden space-y-4">
                        {filteredClients.map((client) => (
                            <div key={client.id} className="glass p-5 rounded-2xl border shadow-sm space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg">{client.name}</h3>
                                        <p className="text-xs text-muted-foreground">{client.biz_reg_no}</p>
                                    </div>
                                    <button className="p-1 text-muted-foreground">
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pb-2 border-b border-dashed border-border">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">관리 그룹</p>
                                        <p className="text-sm font-medium">{client.client_groups?.name || '미분류'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">밴사 / 장비</p>
                                        <p className="text-sm font-medium">{client.van_company || '-'} / {client.equipment || '-'}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 pt-1 text-foreground">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Phone className="w-4 h-4 text-primary/60" />
                                        {client.phone}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin className="w-4 h-4 text-primary/60 shrink-0" />
                                        <span className="truncate">{client.address}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredClients.length === 0 && !loading && (
                        <div className="text-center py-20 glass rounded-3xl border border-dashed">
                            <p className="text-muted-foreground">등록된 거래처가 없습니다.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
