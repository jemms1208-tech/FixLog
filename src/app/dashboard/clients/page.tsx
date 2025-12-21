'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

// 전화번호 자동 포맷팅 함수
const formatPhoneNumber = (value: string): string => {
    // 숫자만 추출
    const numbers = value.replace(/\D/g, '');

    // 빈 문자열이면 그대로 반환
    if (!numbers) return '';

    // 02로 시작하는 서울 지역번호 (02-xxxx-xxxx)
    if (numbers.startsWith('02')) {
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
        if (numbers.length <= 10) return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
        return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
    }

    // 010, 011, 016, 017, 018, 019 휴대폰 번호 (010-xxxx-xxxx)
    if (numbers.match(/^01[016789]/)) {
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        if (numbers.length <= 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }

    // 그 외 지역번호 (031, 032, 033 등) - 0xx-xxx-xxxx 또는 0xx-xxxx-xxxx
    if (numbers.startsWith('0')) {
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        if (numbers.length <= 10) {
            // 10자리: 0xx-xxx-xxxx
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
        }
        // 11자리: 0xx-xxxx-xxxx
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }

    // 0으로 시작하지 않는 경우 그냥 반환
    return numbers;
};

// 사업자등록번호 자동 포맷팅 함수 (3-2-5: 123-45-67890)
const formatBizRegNo = (value: string): string => {
    // 숫자만 추출
    const numbers = value.replace(/\D/g, '').slice(0, 10);

    if (!numbers) return '';
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`;
};

export default function ClientsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);
    const [viewingClient, setViewingClient] = useState<any>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 20;

    const [newClient, setNewClient] = useState({
        name: '',
        biz_reg_no: '',
        phone: '',
        contact_phone: '',
        address: '',
        van_company: '',
        equipment: '',
        group_id: ''
    });

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
        fetchGroups();
    }, []);

    useEffect(() => {
        fetchClients();
    }, [debouncedSearch, currentPage]);

    async function fetchUserRole() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (profile) setUserRole(profile.role);
        }
    }

    async function fetchGroups() {
        const { data } = await supabase.from('client_groups').select('*');
        if (data) setGroups(data);
    }

    async function fetchClients() {
        try {
            setLoading(true);

            // 기본 쿼리 빌더
            let query = supabase
                .from('clients')
                .select(`*, client_groups (name)`, { count: 'exact' });

            // 검색어가 있으면 필터 적용
            if (debouncedSearch.trim()) {
                const search = debouncedSearch.toLowerCase();
                // Supabase에서는 or 조건으로 여러 필드 검색
                query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,biz_reg_no.ilike.%${search}%,address.ilike.%${search}%`);
            }

            // 페이지네이션 및 정렬 적용
            const from = (currentPage - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error, count } = await query
                .order('name')
                .range(from, to);

            if (error) throw error;
            setClients(data || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // 서버 페이지네이션: 검색은 fetchClients의 Supabase 쿼리에서 처리

    async function handleAddClient(e: React.FormEvent) {
        e.preventDefault();
        try {
            const clientData = {
                ...newClient,
                group_id: newClient.group_id || null
            };
            const { error } = await supabase.from('clients').insert([clientData]);
            if (error) throw error;
            setIsModalOpen(false);
            fetchClients();
            setNewClient({ name: '', biz_reg_no: '', phone: '', contact_phone: '', address: '', van_company: '', equipment: '', group_id: '' });
            showToast('거래처가 성공적으로 등록되었습니다.', 'success');
        } catch (error: any) {
            showToast(`등록 실패: ${error.message}`, 'error');
        }
    }

    async function handleUpdateClient(e: React.FormEvent) {
        e.preventDefault();
        if (!editingClient) return;
        try {
            const { error } = await supabase
                .from('clients')
                .update({
                    name: editingClient.name,
                    biz_reg_no: editingClient.biz_reg_no,
                    phone: editingClient.phone,
                    contact_phone: editingClient.contact_phone,
                    address: editingClient.address,
                    van_company: editingClient.van_company,
                    equipment: editingClient.equipment,
                    group_id: editingClient.group_id || null
                })
                .eq('id', editingClient.id);
            if (error) throw error;
            setEditingClient(null);
            showToast('거래처 정보가 수정되었습니다.', 'success');
            fetchClients();
        } catch (error: any) {
            showToast(`수정 실패: ${error.message}`, 'error');
        }
    }

    async function handleDeleteClient(id: string) {
        if (!confirm('정말 이 거래처를 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('clients').delete().eq('id', id);
            if (error) throw error;
            showToast('거래처가 삭제되었습니다.', 'info');
            fetchClients();
            setViewingClient(null);
            setEditingClient(null);
        } catch (error: any) {
            showToast(`삭제 실패: ${error.message}`, 'error');
        }
    }

    async function handleExportExcel() {
        const data = clients.map(c => ({
            '상호': c.name, '번호': c.phone, '주소': c.address, '그룹': c.client_groups?.name
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Clients');
        XLSX.writeFile(wb, 'clients.xlsx');
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">거래처</h1>
                <div className="flex gap-2">
                    <button onClick={handleExportExcel} className="btn-outline">엑셀</button>
                    {(userRole === 'admin' || userRole === 'operator') && (
                        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                            <Plus className="w-4 h-4" /> 추가
                        </button>
                    )}
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="검색어 입력 또는 상호:제이이, 전화:02-1234, 사업자:123-45"
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
                    <div className="hidden lg:grid grid-cols-20 gap-2 p-4 bg-slate-50 border-b text-[11px] font-medium text-slate-800 uppercase">
                        <div className="col-span-3">상호명</div>
                        <div className="col-span-2">사업자번호</div>
                        <div className="col-span-2 text-nowrap">전화번호</div>
                        <div className="col-span-2 text-nowrap">담당자연락처</div>
                        <div className="col-span-3">주소</div>
                        <div className="col-span-2 text-center">그룹</div>
                        <div className="col-span-2 text-center">장비</div>
                        <div className="col-span-2 text-center">밴사</div>
                        <div className="col-span-2 text-right">관리</div>
                    </div>

                    {/* 목록 */}
                    <div className="divide-y divide-slate-100">
                        {clients.map((client: any) => (
                            <div key={client.id} className="group">
                                {/* PC 레이아웃 (lg 이상) */}
                                <div className="hidden lg:grid grid-cols-20 gap-2 p-4 hover:bg-slate-50 transition-colors text-[14px] font-medium items-center">
                                    <div className="col-span-3 text-slate-800 truncate">{client.name}</div>
                                    <div className="col-span-2 text-slate-800 truncate">{client.biz_reg_no || '-'}</div>
                                    <div className="col-span-2 text-slate-800 truncate">{client.phone || '-'}</div>
                                    <div className="col-span-2 text-slate-800 truncate">{client.contact_phone || '-'}</div>
                                    <div className="col-span-3 text-slate-800 truncate">{client.address || '-'}</div>
                                    <div className="col-span-2 flex justify-center">
                                        <span className="text-[11px] bg-slate-100 text-slate-800 px-2 py-1 rounded font-medium uppercase truncate max-w-full">
                                            {client.client_groups?.name || '미구분'}
                                        </span>
                                    </div>
                                    <div className="col-span-2 text-center text-slate-800 truncate">
                                        {client.equipment || '-'}
                                    </div>
                                    <div className="col-span-2 text-center text-slate-800 truncate">
                                        {client.van_company || '-'}
                                    </div>
                                    <div className="col-span-2 flex justify-end">
                                        {(userRole === 'admin' || userRole === 'operator') && (
                                            <div className="flex gap-1 justify-end">
                                                <button
                                                    onClick={() => setEditingClient({ ...client, group_id: client.group_id || '' })}
                                                    className="text-[12px] font-medium text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all"
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClient(client.id)}
                                                    className="text-[12px] font-medium text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-all"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 모바일 레이아웃 (lg 미만) */}
                                <div
                                    className="lg:hidden p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
                                    onClick={() => setViewingClient(client)}
                                >
                                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-800 truncate text-[14px]">{client.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[14px] text-slate-800 font-medium">
                                            <span>{client.client_groups?.name || '일반'}</span>
                                            <span className="text-slate-300 font-normal">|</span>
                                            <span className="truncate">{client.phone || '번호 없음'}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 ml-4 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                            <Search className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {clients.length === 0 && (
                            <div className="text-center py-20 bg-slate-50/50">
                                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-400 font-medium">검색 결과가 없습니다.</p>
                            </div>
                        )}
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
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
                    )}
                </div >
            )
            }

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 거래처 등록">
                <form onSubmit={handleAddClient} className="space-y-4">
                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">상호명</label>
                        <input required className="input-field w-full text-[14px] font-medium text-slate-800" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">대표 전화번호</label>
                            <input
                                placeholder="0212345678"
                                inputMode="numeric"
                                className="input-field w-full text-[14px] font-medium text-slate-800"
                                value={newClient.phone}
                                onChange={(e) => setNewClient({ ...newClient, phone: formatPhoneNumber(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">담당자 연락처</label>
                            <input
                                placeholder="01012345678"
                                inputMode="numeric"
                                className="input-field w-full text-[14px] font-medium text-slate-800"
                                value={newClient.contact_phone}
                                onChange={(e) => setNewClient({ ...newClient, contact_phone: formatPhoneNumber(e.target.value) })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">주소</label>
                        <input className="input-field w-full text-[14px] font-medium text-slate-800" value={newClient.address} onChange={e => setNewClient({ ...newClient, address: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">사업자번호</label>
                            <input
                                placeholder="1234567890"
                                inputMode="numeric"
                                className="input-field w-full text-[14px] font-medium text-slate-800"
                                value={newClient.biz_reg_no}
                                onChange={e => setNewClient({ ...newClient, biz_reg_no: formatBizRegNo(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">관리 그룹</label>
                            <select className="input-field w-full text-[14px] font-medium text-slate-800" value={newClient.group_id} onChange={e => setNewClient({ ...newClient, group_id: e.target.value })}>
                                <option value="">선택 안함</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">밴사</label>
                            <input className="input-field w-full text-[14px] font-medium text-slate-800" value={newClient.van_company} onChange={e => setNewClient({ ...newClient, van_company: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">장비</label>
                            <input className="input-field w-full text-[14px] font-medium text-slate-800" value={newClient.equipment} onChange={e => setNewClient({ ...newClient, equipment: e.target.value })} />
                        </div>
                    </div>
                    <div className="pt-2 flex gap-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn-outline flex-1">취소</button>
                        <button type="submit" className="btn-primary flex-1">저장</button>
                    </div>
                </form>
            </Modal>

            {/* 거래처 정보 상세 보기 모달 */}
            <Modal isOpen={!!viewingClient} onClose={() => setViewingClient(null)} title="거래처 상세 정보">
                {viewingClient && (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1 border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-medium text-slate-800 uppercase">상호명</label>
                                <p className="text-[14px] font-medium text-slate-800">{viewingClient.name}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 border-b border-slate-100 pb-2">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">대표 전화번호</label>
                                    <p className="text-[14px] font-medium text-slate-800">{viewingClient.phone || '-'}</p>
                                </div>
                                <div className="space-y-1 border-b border-slate-100 pb-2">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">담당자 연락처</label>
                                    <p className="text-[14px] font-medium text-slate-800">{viewingClient.contact_phone || '-'}</p>
                                </div>
                            </div>

                            <div className="space-y-1 border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-medium text-slate-800 uppercase">관리 그룹</label>
                                <p className="text-[14px] font-medium text-slate-800">{viewingClient.client_groups?.name || '일반'}</p>
                            </div>

                            <div className="space-y-1 border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-medium text-slate-800 uppercase">사업자등록번호</label>
                                <p className="text-[14px] font-medium text-slate-800">{viewingClient.biz_reg_no || '기록 없음'}</p>
                            </div>

                            <div className="space-y-1 border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-medium text-slate-800 uppercase">주소</label>
                                <p className="text-[14px] font-medium text-slate-800 leading-relaxed">{viewingClient.address || '기록 없음'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 border-b border-slate-100 pb-2">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">밴사(VAN)</label>
                                    <p className="text-[14px] font-medium text-slate-800">{viewingClient.van_company || '-'}</p>
                                </div>
                                <div className="space-y-1 border-b border-slate-100 pb-2">
                                    <label className="text-[11px] font-medium text-slate-800 uppercase">운영 장비</label>
                                    <p className="text-[14px] font-medium text-slate-800">{viewingClient.equipment || '-'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex gap-2">
                            {(userRole === 'admin' || userRole === 'operator') && (
                                <>
                                    <button
                                        onClick={() => {
                                            setEditingClient({ ...viewingClient, group_id: viewingClient.group_id || '' });
                                            setViewingClient(null);
                                        }}
                                        className="flex-1 btn-outline font-bold py-3 h-auto"
                                    >
                                        정보 수정
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClient(viewingClient.id)}
                                        className="flex-1 btn-outline border-red-200 text-red-600 font-bold py-3 h-auto hover:bg-red-50 transition-colors"
                                    >
                                        삭제
                                    </button>
                                </>
                            )}
                            <button onClick={() => setViewingClient(null)} className="flex-1 btn-primary font-bold py-3 h-auto">닫기</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 수정 모달 */}
            <Modal isOpen={!!editingClient} onClose={() => setEditingClient(null)} title="거래처 수정">
                {editingClient && (
                    <form onSubmit={handleUpdateClient} className="space-y-4">
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">상호명</label>
                            <input
                                required
                                className="input-field w-full text-[14px] font-medium text-slate-800"
                                value={editingClient.name}
                                onChange={e => setEditingClient({ ...editingClient, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">대표 전화번호</label>
                                <input
                                    inputMode="numeric"
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.phone || ''}
                                    onChange={(e) => setEditingClient({ ...editingClient, phone: formatPhoneNumber(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">담당자 연락처</label>
                                <input
                                    inputMode="numeric"
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.contact_phone || ''}
                                    onChange={(e) => setEditingClient({ ...editingClient, contact_phone: formatPhoneNumber(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">주소</label>
                            <input
                                className="input-field w-full text-[14px] font-medium text-slate-800"
                                value={editingClient.address || ''}
                                onChange={e => setEditingClient({ ...editingClient, address: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">사업자번호</label>
                                <input
                                    placeholder="1234567890"
                                    inputMode="numeric"
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.biz_reg_no || ''}
                                    onChange={e => setEditingClient({ ...editingClient, biz_reg_no: formatBizRegNo(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">관리 그룹</label>
                                <select
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.group_id || ''}
                                    onChange={e => setEditingClient({ ...editingClient, group_id: e.target.value })}
                                >
                                    <option value="">선택 안함</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">밴사</label>
                                <input
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.van_company || ''}
                                    onChange={e => setEditingClient({ ...editingClient, van_company: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">장비</label>
                                <input
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.equipment || ''}
                                    onChange={e => setEditingClient({ ...editingClient, equipment: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="pt-2 flex gap-2">
                            <button type="button" onClick={() => setEditingClient(null)} className="btn-outline flex-1">취소</button>
                            <button type="submit" className="btn-primary flex-1">수정완료</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div >
    );
}
