'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
    Users,
    Settings,
    Shield,
    History,
    Search,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Plus,
    Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { resetUserPassword, deleteUser } from '@/app/actions/admin';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

const ROLE_LABELS = {
    operator: { label: '운영자', color: 'text-purple-600', bg: 'bg-purple-50' },
    admin: { label: '관리자', color: 'text-red-600', bg: 'bg-red-50' },
    callcenter: { label: '콜센터', color: 'text-blue-600', bg: 'bg-blue-50' },
    field: { label: '현장', color: 'text-green-600', bg: 'bg-green-50' },
};

export default function AdminPage() {
    const router = useRouter();
    const supabase = createClient();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [serviceTypes, setServiceTypes] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Tabs
    const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
    const [logs, setLogs] = useState<any[]>([]);
    const [isLogsLoading, setIsLogsLoading] = useState(false);

    // Modals
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [isAllSelected, setIsAllSelected] = useState(true);

    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<any>(null);

    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordTarget, setPasswordTarget] = useState<{ id: string, email: string } | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [newGroupName, setNewGroupName] = useState('');
    const [newServiceType, setNewServiceType] = useState('');

    // Current User
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string>('field');

    useEffect(() => {
        fetchAdminData();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') {
            fetchActivityLogs();
        }
    }, [activeTab]);

    async function fetchAdminData() {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                if (profile) setCurrentUserRole(profile.role || 'field');
            }

            const { data: profiles, error: pError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            const { data: groups, error: gError } = await supabase.from('client_groups').select('*').order('name');
            const { data: types, error: tError } = await supabase.from('service_types').select('*').order('sort_order');

            if (pError || gError || tError) throw pError || gError || tError;

            setProfiles(profiles || []);
            setGroups(groups || []);
            setServiceTypes(types || []);
        } catch (error: any) {
            showToast(`데이터 로드 실패: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    }

    async function fetchActivityLogs() {
        setIsLogsLoading(true);
        try {
            const { data, error } = await supabase
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            setLogs(data || []);
        } catch (error: any) {
            showToast('로그 로드 실패', 'error');
        } finally {
            setIsLogsLoading(false);
        }
    }

    async function handleAddGroup(e: React.FormEvent) {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        try {
            const { error } = await supabase.from('client_groups').insert([{ name: newGroupName }]);
            if (error) throw error;
            setNewGroupName('');
            showToast('새 그룹이 추가되었습니다.', 'success');
            fetchAdminData();
        } catch (error: any) {
            showToast(`그룹 추가 오류: ${error.message}`, 'error');
        }
    }

    async function handleDeleteGroup(id: string) {
        if (!confirm('그룹을 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('client_groups').delete().eq('id', id);
            if (error) throw error;
            showToast('그룹이 삭제되었습니다.', 'success');
            fetchAdminData();
        } catch (error: any) {
            showToast(`그룹 삭제 오류: ${error.message}`, 'error');
        }
    }

    async function handleAddServiceType(e: React.FormEvent) {
        e.preventDefault();
        if (!newServiceType.trim()) return;
        try {
            const { error } = await supabase.from('service_types').insert([{
                name: newServiceType,
                sort_order: serviceTypes.length
            }]);
            if (error) throw error;
            setNewServiceType('');
            showToast('서비스 유형이 추가되었습니다.', 'success');
            fetchAdminData();
        } catch (error: any) {
            showToast(`유형 추가 오류: ${error.message}`, 'error');
        }
    }

    async function handleDeleteServiceType(id: string) {
        if (!confirm('서비스 유형을 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('service_types').delete().eq('id', id);
            if (error) throw error;
            showToast('서비스 유형이 삭제되었습니다.', 'success');
            fetchAdminData();
        } catch (error: any) {
            showToast(`유형 삭제 오류: ${error.message}`, 'error');
        }
    }

    async function handlePasswordSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!passwordTarget) return;
        if (newPassword !== confirmPassword) {
            showToast('비밀번호가 일치하지 않습니다.', 'error');
            return;
        }
        try {
            const result = await resetUserPassword(passwordTarget.id, newPassword);
            if (result.success) {
                showToast('비밀번호가 변경되었습니다.', 'success');
                setIsPasswordModalOpen(false);
            } else {
                showToast(`비밀번호 변경 실패: ${result.error}`, 'error');
            }
        } catch (error: any) {
            showToast(`오류: ${error?.message}`, 'error');
        }
    }

    async function handleUpdateProfile(e: React.FormEvent) {
        e.preventDefault();
        if (!editingProfile) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    display_name: editingProfile.display_name,
                    username: editingProfile.username,
                    phone: editingProfile.phone,
                    team_name: editingProfile.team_name
                })
                .eq('id', editingProfile.id);

            if (error) throw error;
            showToast('사용자 정보가 수정되었습니다.', 'success');
            setIsProfileModalOpen(false);
            fetchAdminData();
        } catch (error: any) {
            showToast(`수정 오류: ${error.message}`, 'error');
        }
    }

    const filteredProfiles = profiles
        .filter(p =>
            (p.display_name || p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.role || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const roleOrder: { [key: string]: number } = { operator: 0, admin: 1 };
            const aOrder = roleOrder[a.role] ?? 2;
            const bOrder = roleOrder[b.role] ?? 2;

            if (aOrder !== bOrder) return aOrder - bOrder;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">시스템 관리</h1>
                    <p className="text-sm text-slate-500 mt-1">사용자 권한 및 전체 설정을 관리합니다.</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users className="w-4 h-4 shrink-0" />
                        사용자 관리
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History className="w-4 h-4 shrink-0" />
                        활동 로그
                    </button>
                </div>
            </div>

            {activeTab === 'users' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                                <Search className="w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="사용자 검색 (이름, ID, 권한)..."
                                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 pl-2"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-center border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                                <th className="px-4 py-3 min-w-[80px]">이름</th>
                                                <th className="px-4 py-3 min-w-[100px]">아이디</th>
                                                <th className="px-4 py-3 min-w-[80px]">등급</th>
                                                <th className="px-4 py-3 min-w-[80px]">접근그룹</th>
                                                <th className="px-4 py-3 min-w-[200px]">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredProfiles.map((profile) => {
                                                const role = ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || ROLE_LABELS.field;
                                                return (
                                                    <tr key={profile.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className="text-sm font-bold text-slate-900">{profile.display_name || '이름 없음'}</span>
                                                                {profile.is_approved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-sm text-slate-500 whitespace-nowrap text-center">{profile.username}</td>
                                                        <td className="px-4 py-4 uppercase whitespace-nowrap text-center">
                                                            {profile.id === currentUserId || profile.role === 'operator' ? (
                                                                <span className={`text-[10px] px-2 py-1 rounded-md font-bold whitespace-nowrap inline-block ${role.bg} ${role.color}`}>
                                                                    {role.label}
                                                                </span>
                                                            ) : (
                                                                <select
                                                                    value={profile.role || 'field'}
                                                                    onChange={async (e) => {
                                                                        const { error } = await supabase.from('profiles').update({ role: e.target.value }).eq('id', profile.id);
                                                                        if (!error) {
                                                                            showToast('역할이 변경되었습니다.', 'success');
                                                                            fetchAdminData();
                                                                        }
                                                                    }}
                                                                    className="text-xs px-2 py-1 rounded border border-slate-200 outline-none"
                                                                >
                                                                    {currentUserRole === 'operator' && <option value="admin">관리자</option>}
                                                                    <option value="callcenter">콜센터</option>
                                                                    <option value="field">현장</option>
                                                                </select>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                                            {profile.role === 'operator' || profile.role === 'admin' ? (
                                                                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">전체</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedProfile(profile);
                                                                        setSelectedGroups(profile.allowed_groups || []);
                                                                        setIsAllSelected(profile.allowed_groups?.length === 0 || !profile.allowed_groups);
                                                                        setIsPermissionModalOpen(true);
                                                                    }}
                                                                    className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded whitespace-nowrap"
                                                                >
                                                                    편집
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => { setEditingProfile(profile); setIsProfileModalOpen(true); }}
                                                                    className="text-[12px] font-medium text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all text-nowrap"
                                                                >
                                                                    수정
                                                                </button>
                                                                <button
                                                                    onClick={() => { setPasswordTarget({ id: profile.id, email: profile.email }); setIsPasswordModalOpen(true); }}
                                                                    className="text-[12px] font-medium text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm transition-all text-nowrap"
                                                                >
                                                                    비밀번호 변경
                                                                </button>
                                                                {!profile.is_approved ? (
                                                                    <button
                                                                        onClick={async () => {
                                                                            await supabase.from('profiles').update({ is_approved: true }).eq('id', profile.id);
                                                                            showToast('승인되었습니다.', 'success');
                                                                            fetchAdminData();
                                                                        }}
                                                                        className="text-[12px] font-medium text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all text-nowrap shadow-sm"
                                                                    >
                                                                        승인
                                                                    </button>
                                                                ) : (
                                                                    profile.id !== currentUserId && profile.role !== 'operator' && (
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (confirm('삭제하시겠습니까? 계정과 프로필이 모두 삭제됩니다.')) {
                                                                                    const result = await deleteUser(profile.id);
                                                                                    if (result.success) {
                                                                                        showToast('사용자가 완전히 삭제되었습니다.', 'info');
                                                                                        fetchAdminData();
                                                                                    } else {
                                                                                        showToast(`삭제 실패: ${result.error}`, 'error');
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="text-[12px] font-medium text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition-all text-nowrap"
                                                                        >
                                                                            삭제
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <h2 className="text-sm font-bold text-slate-900">거래처 그룹 관리</h2>
                            <form onSubmit={handleAddGroup} className="flex gap-2">
                                <input
                                    className="input-field flex-1 text-sm h-10"
                                    placeholder="새 그룹명..."
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                                <button className="btn-primary p-0 w-10 h-10 shrink-0"><Plus className="w-5 h-5 mx-auto" /></button>
                            </form>
                            <div className="space-y-1">
                                {groups.map(g => (
                                    <div key={g.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg group">
                                        <span className="text-sm font-medium text-slate-700">{g.name}</span>
                                        <button onClick={() => handleDeleteGroup(g.id)} className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <h2 className="text-sm font-bold text-slate-900">서비스 유형 관리</h2>
                            <form onSubmit={handleAddServiceType} className="flex gap-2">
                                <input
                                    className="input-field flex-1 text-sm h-10"
                                    placeholder="새 유형명..."
                                    value={newServiceType}
                                    onChange={(e) => setNewServiceType(e.target.value)}
                                />
                                <button className="btn-primary p-0 w-10 h-10 shrink-0"><Plus className="w-5 h-5 mx-auto" /></button>
                            </form>
                            <div className="space-y-1">
                                {serviceTypes.map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg group">
                                        <span className="text-sm font-medium text-slate-700">{t.name}</span>
                                        <button onClick={() => handleDeleteServiceType(t.id)} className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                        <h2 className="font-bold text-slate-900">사용자 활동 로그</h2>
                        <p className="text-xs text-slate-500 mt-1">최근 100건의 주요 보안 및 데이터 변경 사항을 기록합니다.</p>
                    </div>
                    {isLogsLoading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                                        <th className="px-6 py-4">시간</th>
                                        <th className="px-6 py-4">사용자</th>
                                        <th className="px-6 py-4">활동</th>
                                        <th className="px-6 py-4">대상</th>
                                        <th className="px-6 py-4">상세정보</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors text-[13px] font-medium">
                                            <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString('ko-KR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900 font-bold">{log.user_display_name}</span>
                                                    <span className="text-[10px] text-slate-500">{log.user_email}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight
                                                    ${log.action.includes('CREATE') ? 'bg-emerald-50 text-emerald-600' :
                                                        log.action.includes('UPDATE') ? 'bg-blue-50 text-blue-600' :
                                                            log.action.includes('DELETE') ? 'bg-red-50 text-red-600' :
                                                                'bg-slate-100 text-slate-600'}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 whitespace-nowrap uppercase">
                                                {log.target_type}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-medium max-w-xs">
                                                <div className="text-[11px] truncate">
                                                    {log.details && typeof log.details === 'object' ? (
                                                        Object.entries(log.details)
                                                            .filter(([key]) => !['id', 'created_at', 'updated_at'].includes(key))
                                                            .map(([key, value]) => `${key}: ${value}`)
                                                            .join(', ')
                                                    ) : JSON.stringify(log.details)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <Modal isOpen={isPermissionModalOpen} onClose={() => setIsPermissionModalOpen(false)} title="접근 그룹 편집">
                {selectedProfile && (
                    <div className="space-y-6">
                        <label className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={isAllSelected} onChange={(e) => { setIsAllSelected(e.target.checked); if (e.target.checked) setSelectedGroups([]); }} className="w-5 h-5 rounded text-blue-600" />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900">전체 접근 허용</span>
                                <span className="text-xs text-slate-500">모든 그룹의 데이터를 조회할 수 있습니다.</span>
                            </div>
                        </label>
                        <div className="space-y-2">
                            <p className="text-[11px] font-bold text-slate-400 uppercase ml-1">개별 그룹 선택</p>
                            <div className="grid grid-cols-2 gap-2">
                                {groups.map(g => (
                                    <label key={g.id} className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${isAllSelected ? 'opacity-40 pointer-events-none bg-slate-50 border-transparent' : 'bg-white border-slate-200 hover:border-blue-500'}`}>
                                        <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={(e) => {
                                            if (e.target.checked) setSelectedGroups([...selectedGroups, g.id]);
                                            else setSelectedGroups(selectedGroups.filter(id => id !== g.id));
                                        }} className="w-4 h-4 rounded text-blue-600" />
                                        <span className="text-sm font-medium text-slate-700">{g.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4 border-t">
                            <button className="flex-1 btn-outline" onClick={() => setIsPermissionModalOpen(false)}>취소</button>
                            <button className="flex-1 btn-primary" onClick={async () => {
                                await supabase.from('profiles').update({ allowed_groups: isAllSelected ? [] : selectedGroups }).eq('id', selectedProfile.id);
                                showToast('권한이 저장되었습니다.', 'success');
                                setIsPermissionModalOpen(false);
                                fetchAdminData();
                            }}>저장하기</button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="사용자 정보 수정">
                {editingProfile && (
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 mb-1 block">이름</label>
                                <input className="input-field w-full text-sm" value={editingProfile.display_name || ''} onChange={e => setEditingProfile({ ...editingProfile, display_name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 mb-1 block">아이디</label>
                                <input className="input-field w-full text-sm" value={editingProfile.username || ''} onChange={e => setEditingProfile({ ...editingProfile, username: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 mb-1 block">연락처</label>
                                <input className="input-field w-full text-sm" value={editingProfile.phone || ''} onChange={e => setEditingProfile({ ...editingProfile, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 mb-1 block">팀 이름</label>
                                <input className="input-field w-full text-sm" value={editingProfile.team_name || ''} onChange={e => setEditingProfile({ ...editingProfile, team_name: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" className="flex-1 btn-outline" onClick={() => setIsProfileModalOpen(false)}>취소</button>
                            <button type="submit" className="flex-1 btn-primary">저장하기</button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="비밀번호 변경">
                {passwordTarget && (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 mb-4">
                            <p className="text-[11px] font-bold text-amber-800 uppercase">대상 사용자 이메일</p>
                            <p className="text-sm font-bold text-amber-900 truncate">{passwordTarget.email}</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 mb-1 block">새 비밀번호</label>
                                <input type="password" required className="input-field w-full text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="6자 이상 입력" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 mb-1 block">비밀번호 확인</label>
                                <input type="password" required className="input-field w-full text-sm" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="다시 한번 입력" />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" className="flex-1 btn-outline" onClick={() => setIsPasswordModalOpen(false)}>취소</button>
                            <button type="submit" className="flex-1 btn-primary">변경하기</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
