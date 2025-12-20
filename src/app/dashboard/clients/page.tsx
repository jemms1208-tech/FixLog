'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Loader2, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/Modal';

export default function ClientsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<any>(null);
    const [viewingClient, setViewingClient] = useState<any>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
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

    useEffect(() => {
        fetchUserRole();
        fetchClients();
        fetchGroups();
    }, []);

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
            const { data, error } = await supabase
                .from('clients')
                .select(`*, client_groups (name)`).order('name');
            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
    );

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
        } catch (error) {
            console.error(error);
            alert('오류 발생');
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
            fetchClients();
        } catch (error) {
            console.error(error);
            alert('수정 중 오류 발생');
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
                    placeholder="상호명 또는 전화번호 검색..."
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
                        {filteredClients.map((client) => (
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
                                            <button
                                                onClick={() => setEditingClient({ ...client, group_id: client.group_id || '' })}
                                                className="text-[12px] font-medium text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                수정
                                            </button>
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
                        {filteredClients.length === 0 && (
                            <div className="text-center py-20 bg-slate-50/50">
                                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-400 font-medium">검색 결과가 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
                                placeholder="02-1234-5678"
                                className="input-field w-full text-[14px] font-medium text-slate-800"
                                value={newClient.phone}
                                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">담당자 연락처</label>
                            <input
                                placeholder="010-1234-5678"
                                className="input-field w-full text-[14px] font-medium text-slate-800"
                                value={newClient.contact_phone}
                                onChange={(e) => setNewClient({ ...newClient, contact_phone: e.target.value })}
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
                            <input className="input-field w-full text-[14px] font-medium text-slate-800" value={newClient.biz_reg_no} onChange={e => setNewClient({ ...newClient, biz_reg_no: e.target.value })} />
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
                                <button
                                    onClick={() => {
                                        setEditingClient({ ...viewingClient, group_id: viewingClient.group_id || '' });
                                        setViewingClient(null);
                                    }}
                                    className="flex-1 btn-outline font-semibold py-3"
                                >
                                    정보 수정
                                </button>
                            )}
                            <button onClick={() => setViewingClient(null)} className="flex-1 btn-primary font-semibold py-3">닫기</button>
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
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.phone || ''}
                                    onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">담당자 연락처</label>
                                <input
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.contact_phone || ''}
                                    onChange={(e) => setEditingClient({ ...editingClient, contact_phone: e.target.value })}
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
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingClient.biz_reg_no || ''}
                                    onChange={e => setEditingClient({ ...editingClient, biz_reg_no: e.target.value })}
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
