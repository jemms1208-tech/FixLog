'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
    Search,
    Plus,
    Loader2,
    Bell,
    User,
    Calendar,
    ChevronRight,
    Trash2,
    Pencil,
    Shield,
    Eye
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

const ROLE_LABELS: Record<string, string> = {
    operator: '전체',
    admin: '관리자',
    callcenter: '콜센터',
    field: '현장'
};

const ALL_ROLES = ['operator', 'admin', 'callcenter', 'field'];

export default function NoticesPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [notices, setNotices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>('field');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewNotice, setViewNotice] = useState<any>(null);
    const [editingNotice, setEditingNotice] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        allowed_roles: ['operator', 'admin', 'callcenter', 'field']
    });
    const { showToast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        fetchInitialData();
    }, []);

    async function fetchInitialData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (profile) setUserRole(profile.role || 'field');
        }
        await fetchNotices();
    }

    async function fetchNotices() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notices')
                .select(`
                    *,
                    author:profiles(display_name, role)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotices(data || []);
        } catch (error: any) {
            console.error('Error fetching notices:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        try {
            const { data, error } = await supabase
                .from('notices')
                .insert([{
                    ...formData,
                    author_id: currentUserId
                }])
                .select()
                .single();

            if (error) throw error;

            // 활동 로그 기록
            const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('id', currentUserId).single();
            await supabase.from('activity_logs').insert([{
                user_id: currentUserId,
                user_email: profile?.email,
                user_display_name: profile?.display_name,
                action: 'CREATE_NOTICE',
                target_type: 'notice',
                target_id: data?.id,
                details: { title: formData.title }
            }]);

            setIsCreateModalOpen(false);
            setFormData({ title: '', content: '', allowed_roles: ALL_ROLES });
            showToast('공지사항이 등록되었습니다.', 'success');
            fetchNotices();
        } catch (error: any) {
            showToast(`공지 등록 오류: ${error.message}`, 'error');
        }
    }

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault();
        if (!editingNotice) return;
        try {
            const { error } = await supabase
                .from('notices')
                .update({
                    title: editingNotice.title,
                    content: editingNotice.content,
                    allowed_roles: editingNotice.allowed_roles
                })
                .eq('id', editingNotice.id);

            if (error) throw error;

            // 활동 로그 기록
            const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('id', currentUserId).single();
            await supabase.from('activity_logs').insert([{
                user_id: currentUserId,
                user_email: profile?.email,
                user_display_name: profile?.display_name,
                action: 'UPDATE_NOTICE',
                target_type: 'notice',
                target_id: editingNotice.id,
                details: { title: editingNotice.title }
            }]);

            setEditingNotice(null);
            showToast('공지사항이 수정되었습니다.', 'success');
            fetchNotices();
        } catch (error: any) {
            showToast(`공지 수정 오류: ${error.message}`, 'error');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            // 삭제 전에 공지 정보 가져오기
            const noticeToDelete = notices.find(n => n.id === id);

            const { error } = await supabase.from('notices').delete().eq('id', id);
            if (error) throw error;

            // 활동 로그 기록
            const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('id', currentUserId).single();
            await supabase.from('activity_logs').insert([{
                user_id: currentUserId,
                user_email: profile?.email,
                user_display_name: profile?.display_name,
                action: 'DELETE_NOTICE',
                target_type: 'notice',
                target_id: id,
                details: { title: noticeToDelete?.title }
            }]);

            showToast('공지사항이 삭제되었습니다.', 'info');
            fetchNotices();
        } catch (error: any) {
            showToast(`공지 삭제 오류: ${error.message}`, 'error');
        }
    }

    const filteredNotices = notices.filter(n =>
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const canManage = userRole === 'operator' || userRole === 'admin';

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">공지사항</h1>
                    <p className="text-sm text-slate-500 mt-1">사내 공지 및 업무 지침을 확인하세요.</p>
                </div>
                {canManage && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn-primary flex items-center gap-2 justify-center"
                    >
                        <Plus className="w-4 h-4" />
                        새 공지 작성
                    </button>
                )}
            </div>



            {/* Notice List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="divide-y divide-slate-100">
                        {filteredNotices.length > 0 ? (
                            filteredNotices.map((notice) => (
                                <div
                                    key={notice.id}
                                    className="p-4 hover:bg-slate-50 transition-colors group cursor-pointer"
                                    onClick={() => setViewNotice(notice)}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                {notice.allowed_roles?.length < ALL_ROLES.length && (
                                                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                                        <Shield className="w-2.5 h-2.5" />
                                                        권한제한
                                                    </span>
                                                )}
                                                <h3 className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate text-[14px]">
                                                    {notice.title}
                                                </h3>
                                            </div>
                                            <p className="text-[14px] font-medium text-slate-800 line-clamp-1 mb-3">
                                                {notice.content}
                                            </p>
                                            <div className="flex items-center gap-4 text-[11px] text-slate-800 font-medium">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(notice.created_at).toLocaleString('ko-KR', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: false
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                            {(userRole === 'operator' || (userRole === 'admin' && notice.author?.role !== 'operator')) && (
                                                <div className="flex items-center gap-1 opacity-100">
                                                    <button
                                                        onClick={() => setEditingNotice(notice)}
                                                        className="text-[12px] font-medium text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(notice.id)}
                                                        className="text-[12px] font-medium text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-all"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20">
                                <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400">작성된 공지사항이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="새 공지 작성">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">대상 권한</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ALL_ROLES.map(role => {
                                const isAllSelected = formData.allowed_roles.includes('operator');
                                const isChecked = isAllSelected || formData.allowed_roles.includes(role);
                                const isDisabled = isAllSelected && role !== 'operator';

                                return (
                                    <label
                                        key={role}
                                        className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${isDisabled ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' : 'border-slate-200 cursor-pointer hover:bg-slate-50'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={isDisabled}
                                            onChange={(e) => {
                                                let newRoles;
                                                if (role === 'operator') {
                                                    // '전체' 선택 시 모든 역할 포함
                                                    newRoles = e.target.checked ? [...ALL_ROLES] : [];
                                                } else {
                                                    newRoles = e.target.checked
                                                        ? [...formData.allowed_roles, role]
                                                        : formData.allowed_roles.filter((r: string) => r !== role);
                                                }
                                                setFormData({ ...formData, allowed_roles: newRoles });
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                        />
                                        <span className={`text-sm font-medium ${isDisabled ? 'text-slate-400' : 'text-slate-700'}`}>
                                            {ROLE_LABELS[role]}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                        {formData.allowed_roles.length === 0 && (
                            <p className="text-[10px] text-red-500 mt-1 font-medium">* 최소 한 개 이상의 권한을 선택해야 합니다.</p>
                        )}
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">공지 제목 *</label>
                        <input
                            required
                            type="text"
                            placeholder="제목을 입력하세요"
                            className="input-field w-full"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">공지 내용 *</label>
                        <textarea
                            required
                            rows={15}
                            placeholder="공지 내용을 입력하세요..."
                            className="input-field w-full resize-none h-auto min-h-[300px]"
                            value={formData.content}
                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                        />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-outline flex-1">취소</button>
                        <button
                            type="submit"
                            disabled={formData.allowed_roles.length === 0}
                            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            등록하기
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={!!editingNotice} onClose={() => setEditingNotice(null)} title="공지 수정">
                {editingNotice && (
                    <form onSubmit={handleUpdate} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">대상 권한</label>
                            <div className="grid grid-cols-2 gap-2">
                                {ALL_ROLES.map(role => {
                                    const isAllSelected = editingNotice.allowed_roles.includes('operator');
                                    const isChecked = isAllSelected || editingNotice.allowed_roles.includes(role);
                                    const isDisabled = isAllSelected && role !== 'operator';

                                    return (
                                        <label
                                            key={role}
                                            className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${isDisabled ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' : 'border-slate-200 cursor-pointer hover:bg-slate-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                disabled={isDisabled}
                                                onChange={(e) => {
                                                    let newRoles;
                                                    if (role === 'operator') {
                                                        newRoles = e.target.checked ? [...ALL_ROLES] : [];
                                                    } else {
                                                        newRoles = e.target.checked
                                                            ? [...editingNotice.allowed_roles, role]
                                                            : editingNotice.allowed_roles.filter((r: string) => r !== role);
                                                    }
                                                    setEditingNotice({ ...editingNotice, allowed_roles: newRoles });
                                                }}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                            />
                                            <span className={`text-sm font-medium ${isDisabled ? 'text-slate-400' : 'text-slate-700'}`}>
                                                {ROLE_LABELS[role]}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">공지 제목 *</label>
                            <input
                                required
                                type="text"
                                className="input-field w-full"
                                value={editingNotice.title}
                                onChange={e => setEditingNotice({ ...editingNotice, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">공지 내용 *</label>
                            <textarea
                                required
                                rows={15}
                                className="input-field w-full resize-none h-auto min-h-[300px]"
                                value={editingNotice.content}
                                onChange={e => setEditingNotice({ ...editingNotice, content: e.target.value })}
                            />
                        </div>
                        <div className="pt-2 flex gap-3">
                            <button type="button" onClick={() => setEditingNotice(null)} className="btn-outline flex-1">취소</button>
                            <button
                                type="submit"
                                disabled={editingNotice.allowed_roles.length === 0}
                                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                수정완료
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* View Modal */}
            <Modal isOpen={!!viewNotice} onClose={() => setViewNotice(null)} title="공지사항 확인">
                {viewNotice && (
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                {viewNotice.allowed_roles?.length < ALL_ROLES.length && (
                                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                        <Shield className="w-2.5 h-2.5" />
                                        권한제한
                                    </span>
                                )}
                                <span className="text-[11px] text-slate-400 font-medium">
                                    {new Date(viewNotice.created_at).toLocaleString()}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 leading-tight">
                                {viewNotice.title}
                            </h2>
                            <div className="pb-4 border-b border-slate-100" />
                        </div>

                        <div className="text-slate-800 text-[14px] font-medium leading-relaxed whitespace-pre-wrap min-h-[200px]">
                            {viewNotice.content}
                        </div>

                        <div className="pt-4 border-t border-slate-50 flex justify-end">
                            <button onClick={() => setViewNotice(null)} className="btn-primary px-8">닫기</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
