'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    Settings,
    Shield,
    UserPlus,
    MoreVertical,
    Search,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { resetUserPassword } from '@/app/actions/admin';
import { Modal } from '@/components/Modal';

const ROLE_LABELS = {
    operator: { label: '운영자', color: 'text-purple-600', bg: 'bg-purple-50' },
    admin: { label: '관리자', color: 'text-red-600', bg: 'bg-red-50' },
    callcenter: { label: '콜센터', color: 'text-blue-600', bg: 'bg-blue-50' },
    field: { label: '현장', color: 'text-green-600', bg: 'bg-green-50' },
};

export default function AdminPage() {
    const router = useRouter();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    // 그룹 권한 설정 모달
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [isAllSelected, setIsAllSelected] = useState(true);
    // 장애 유형 관리
    const [serviceTypes, setServiceTypes] = useState<any[]>([]);
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    // 비밀번호 변경 모달
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordTarget, setPasswordTarget] = useState<{ id: string, email: string } | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // 현재 사용자 정보
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string>('field');
    // 사용자 정보 수정 모달
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<any>(null);
    const supabase = createClient();

    useEffect(() => {
        fetchAdminData();
    }, []);

    async function fetchAdminData() {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
            }
            const [profilesRes, groupsRes, typesRes] = await Promise.all([
                supabase.from('profiles').select('*'),
                supabase.from('client_groups').select('*'),
                supabase.from('service_types').select('*').order('sort_order')
            ]);

            if (profilesRes.error) throw profilesRes.error;
            if (groupsRes.error) throw groupsRes.error;

            setProfiles(profilesRes.data || []);
            setGroups(groupsRes.data || []);
            setServiceTypes(typesRes.data || []);

            // 현재 사용자 역할 설정 및 접근 제한
            if (user && profilesRes.data) {
                const currentProfile = profilesRes.data.find(p => p.id === user.id);
                if (currentProfile) {
                    const role = currentProfile.role || 'field';
                    setCurrentUserRole(role);

                    // 운영자나 관리자가 아니면 대시보드로 이동
                    if (role !== 'operator' && role !== 'admin') {
                        router.push('/dashboard');
                        return;
                    }
                } else {
                    // 프로필이 없으면 대시보드로 이동
                    router.push('/dashboard');
                    return;
                }
            }
        } catch (error: any) {
            console.error('Error fetching admin data details:', {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code
            });
            alert(`데이터를 불러오는 중 오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddGroup(e: React.FormEvent) {
        e.preventDefault();
        try {
            if (!newGroupName.trim()) return;
            const { error } = await supabase.from('client_groups').insert([{ name: newGroupName }]);
            if (error) throw error;
            setNewGroupName('');
            setIsGroupModalOpen(false);
            fetchAdminData();
        } catch (error) {
            alert('그룹 추가 중 오류가 발생했습니다.');
        }
    }

    async function handleAddServiceType(e: React.FormEvent) {
        e.preventDefault();
        try {
            if (!newTypeName.trim()) return;
            const { error } = await supabase.from('service_types').insert([{ name: newTypeName }]);
            if (error) throw error;
            setNewTypeName('');
            setIsTypeModalOpen(false);
            fetchAdminData();
        } catch (error: any) {
            alert(`유형 추가 오류: ${error?.message}`);
        }
    }

    async function handleEditServiceType(typeId: string, currentName: string) {
        const newName = prompt('유형 이름 수정', currentName);
        if (!newName || newName === currentName) return;
        try {
            const { error } = await supabase.from('service_types').update({ name: newName }).eq('id', typeId);
            if (error) throw error;
            fetchAdminData();
        } catch (error: any) {
            alert(`수정 오류: ${error?.message}`);
        }
    }

    async function handleDeleteServiceType(typeId: string, name: string) {
        if (!confirm(`"${name}" 유형을 삭제하시겠습니까?`)) return;
        try {
            const { error } = await supabase.from('service_types').delete().eq('id', typeId);
            if (error) throw error;
            fetchAdminData();
        } catch (error: any) {
            alert(`삭제 오류: ${error?.message}`);
        }
    }

    async function handleEditGroup(groupId: string, currentName: string) {
        const newName = prompt('새 그룹명을 입력하세요:', currentName);
        if (!newName || newName.trim() === '' || newName === currentName) return;
        try {
            const { error } = await supabase.from('client_groups').update({ name: newName }).eq('id', groupId);
            if (error) throw error;
            fetchAdminData();
        } catch (error) {
            alert('그룹 수정 중 오류가 발생했습니다.');
        }
    }

    async function handleDeleteGroup(groupId: string, groupName: string) {
        if (!confirm(`"${groupName}" 그룹을 삭제하시겠습니까?`)) return;
        try {
            const { error } = await supabase.from('client_groups').delete().eq('id', groupId);
            if (error) throw error;
            fetchAdminData();
        } catch (error) {
            alert('그룹 삭제 중 오류가 발생했습니다. 해당 그룹에 연결된 거래처가 있을 수 있습니다.');
        }
    }

    function openPasswordModal(userId: string, userEmail: string) {
        setPasswordTarget({ id: userId, email: userEmail });
        setNewPassword('');
        setConfirmPassword('');
        setIsPasswordModalOpen(true);
    }

    async function handlePasswordSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!passwordTarget) return;
        if (newPassword.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }
        try {
            const result = await resetUserPassword(passwordTarget.id, newPassword);
            if (result.success) {
                alert('비밀번호가 변경되었습니다.');
                setIsPasswordModalOpen(false);
            } else {
                alert(`비밀번호 변경 실패: ${result.error}`);
            }
        } catch (error: any) {
            alert(`오류: ${error?.message}`);
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
            alert('사용자 정보가 수정되었습니다.');
            setIsProfileModalOpen(false);
            fetchAdminData();
        } catch (error: any) {
            alert(`수정 오류: ${error.message}`);
        }
    }

    const filteredProfiles = profiles
        .filter(p =>
            (p.username || p.email || p.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.role?.includes(searchTerm)
        )
        .sort((a, b) => {
            const roleOrder: Record<string, number> = { operator: 1, admin: 2, callcenter: 3, field: 4 };
            const aOrder = roleOrder[a.role as keyof typeof roleOrder] || 99;
            const bOrder = roleOrder[b.role as keyof typeof roleOrder] || 99;

            if (aOrder !== bOrder) return aOrder - bOrder;
            // 같은 역할 내에서는 최신순 (created_at 내림차순)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    return (
        <div className="space-y-6">
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">시스템 관리</h1>
                        <p className="text-sm text-slate-500 mt-1">사용자 권한 및 그룹을 관리합니다.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* User Management List */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* User Management List */}
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
                                    <div>
                                        {/* 컬럼 헤더 */}
                                        <div className="p-3 flex items-center gap-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 text-center">
                                            <div className="w-[120px] text-center">이름</div>
                                            <div className="w-[120px] text-center">아이디</div>
                                            <div className="w-[80px] text-center">등급</div>
                                            <div className="w-[80px] text-center">접근그룹</div>
                                            <div className="w-[240px] text-center">관리</div>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {filteredProfiles.map((profile) => {
                                                const role = ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || ROLE_LABELS.field;
                                                return (
                                                    <div key={profile.id} className="p-4 flex items-center hover:bg-slate-50 transition-colors gap-4">
                                                        <div className="w-[120px] text-center flex items-center justify-center gap-1">
                                                            <span className="text-sm text-slate-900 truncate">
                                                                {profile.display_name || '이름 없음'}
                                                            </span>
                                                            {profile.is_approved ? (
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                                            ) : (
                                                                <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                                                            )}
                                                        </div>
                                                        <div className="w-[120px] text-center">
                                                            <span className="text-sm text-slate-500 truncate">{profile.username}</span>
                                                        </div>

                                                        <div className="w-[80px] text-center">
                                                            {/* 운영자 본인은 변경 불가, 운영자는 모든 역할 부여 가능, 관리자는 관리자 제외 역할만 부여 가능 */}
                                                            {profile.id === currentUserId ? (
                                                                <span className={`text-xs px-2 py-1 rounded-md font-medium ${role.bg} ${role.color}`}>
                                                                    {role.label}
                                                                </span>
                                                            ) : profile.role === 'operator' ? (
                                                                <span className={`text-xs px-2 py-1 rounded-md font-medium ${role.bg} ${role.color}`}>
                                                                    {role.label}
                                                                </span>
                                                            ) : (
                                                                <select
                                                                    value={profile.role || 'field'}
                                                                    onChange={async (e) => {
                                                                        const newRole = e.target.value;
                                                                        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profile.id);
                                                                        if (!error) fetchAdminData();
                                                                    }}
                                                                    className="text-xs px-2 py-1 rounded-md font-medium border border-gray-300 cursor-pointer bg-white text-gray-900"
                                                                >
                                                                    {currentUserRole === 'operator' && <option value="admin">관리자</option>}
                                                                    <option value="callcenter">콜센터</option>
                                                                    <option value="field">현장</option>
                                                                </select>
                                                            )}
                                                        </div>

                                                        <div className="w-[80px] text-center">
                                                            {profile.role === 'operator' || profile.role === 'admin' ? (
                                                                <span className="text-xs text-slate-500">전체</span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        const currentGroups = profile.allowed_groups || [];
                                                                        setSelectedProfile(profile);
                                                                        setSelectedGroups(currentGroups);
                                                                        setIsAllSelected(currentGroups.length === 0);
                                                                        setIsPermissionModalOpen(true);
                                                                    }}
                                                                    className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                                                                >
                                                                    편집
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="w-[240px] text-center flex items-center justify-center gap-1.5 flex-nowrap">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingProfile({ ...profile });
                                                                    setIsProfileModalOpen(true);
                                                                }}
                                                                className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 bg-white whitespace-nowrap"
                                                            >
                                                                정보 수정
                                                            </button>
                                                            {profile.role === 'operator' && profile.id !== currentUserId ? null : (
                                                                <button
                                                                    onClick={() => openPasswordModal(profile.id, profile.email)}
                                                                    className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 bg-white whitespace-nowrap"
                                                                >
                                                                    PW 변경
                                                                </button>
                                                            )}
                                                            {!profile.is_approved ? (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!confirm('해당 사용자를 승인하시겠습니까?')) return;
                                                                        const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', profile.id);
                                                                        if (!error) fetchAdminData();
                                                                    }}
                                                                    className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 bg-white whitespace-nowrap"
                                                                >
                                                                    승인
                                                                </button>
                                                            ) : (profile.role === 'operator' || profile.id === currentUserId) ? null : (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!confirm('해당 사용자를 삭제하시겠습니까?')) return;
                                                                        const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
                                                                        if (!error) fetchAdminData();
                                                                    }}
                                                                    className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 bg-white whitespace-nowrap"
                                                                >
                                                                    삭제
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Group Management */}
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-slate-500" />
                                            그룹 관리
                                        </h2>
                                        <button
                                            onClick={() => setIsGroupModalOpen(true)}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                        >
                                            + 그룹 추가
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {groups.map((group) => (
                                            <div key={group.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                                <span className="text-sm font-medium text-slate-700">{group.name}</span>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleEditGroup(group.id, group.name)}
                                                        className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteGroup(group.id, group.name)}
                                                        className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {groups.length === 0 && !loading && (
                                            <p className="text-center text-xs text-slate-400 py-4">등록된 그룹이 없습니다</p>
                                        )}
                                    </div>
                                </div>

                                {/* Service Types Management */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                            <Settings className="w-4 h-4 text-slate-500" />
                                            장애 유형 관리
                                        </h2>
                                        <button
                                            onClick={() => setIsTypeModalOpen(true)}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                        >
                                            + 유형 추가
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {serviceTypes.map((type) => (
                                            <div key={type.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                                <span className="text-sm font-medium text-slate-700">{type.name}</span>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleEditServiceType(type.id, type.name)}
                                                        className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteServiceType(type.id, type.name)}
                                                        className="text-xs text-slate-600 px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {serviceTypes.length === 0 && !loading && (
                                            <p className="text-center text-xs text-slate-400 py-4">등록된 유형이 없습니다</p>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                                    <h3 className="font-bold text-xs text-blue-800 mb-3 flex items-center gap-2">
                                        <Shield className="w-4 h-4" />
                                        권한 안내
                                    </h3>
                                    <ul className="text-xs space-y-2 text-blue-700/80 font-medium leading-relaxed">
                                        <li className="flex gap-2"><span className="text-blue-900 font-bold min-w-[50px]">운영자:</span> 모든 권한 + 관리자 권한 부여 가능</li>
                                        <li className="flex gap-2"><span className="text-blue-900 font-bold min-w-[50px]">관리자:</span> 시스템 관리 권한 (관리자 권한 부여 불가)</li>
                                        <li className="flex gap-2"><span className="text-blue-900 font-bold min-w-[50px]">콜센터:</span> 접수 및 거래처 관리</li>
                                        <li className="flex gap-2"><span className="text-blue-900 font-bold min-w-[50px]">현장:</span> 지정된 그룹 내역만 조회</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Group Add Modal */}
                    {isGroupModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-lg text-slate-900">새 그룹 추가</h3>
                                    <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                        <span className="sr-only">닫기</span>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <form onSubmit={handleAddGroup} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">그룹명</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsGroupModalOpen(false)}
                                            className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                        >
                                            취소
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-[0.98]"
                                        >
                                            추가하기
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* 그룹 권한 설정 모달 */}
                    {isPermissionModalOpen && selectedProfile && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                                <div className="p-6 border-b border-slate-100">
                                    <h3 className="font-bold text-lg text-slate-900">접근 가능 그룹 설정</h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {selectedProfile.display_name || selectedProfile.username}님의 접근 권한
                                    </p>
                                </div>
                                <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto">
                                    {/* 전체 선택 */}
                                    <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={(e) => {
                                                setIsAllSelected(e.target.checked);
                                                if (e.target.checked) {
                                                    setSelectedGroups([]);
                                                }
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="font-bold text-slate-900">전체</span>
                                        <span className="text-xs text-slate-500">(모든 그룹 조회 가능)</span>
                                    </label>

                                    {/* 개별 그룹 */}
                                    {groups.map((group: any) => (
                                        <label
                                            key={group.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isAllSelected
                                                ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                                : 'bg-white border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={isAllSelected}
                                                checked={selectedGroups.includes(group.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedGroups([...selectedGroups, group.id]);
                                                    } else {
                                                        setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                                                    }
                                                }}
                                                className="w-4 h-4 text-blue-600 rounded"
                                            />
                                            <span className="text-sm text-slate-700">{group.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="p-6 border-t border-slate-100 flex gap-3">
                                    <button
                                        onClick={() => setIsPermissionModalOpen(false)}
                                        className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const newAllowedGroups = isAllSelected ? [] : selectedGroups;
                                            const { error } = await supabase
                                                .from('profiles')
                                                .update({ allowed_groups: newAllowedGroups })
                                                .eq('id', selectedProfile.id);
                                            if (!error) {
                                                fetchAdminData();
                                                setIsPermissionModalOpen(false);
                                            } else {
                                                alert('그룹 설정 중 오류가 발생했습니다.');
                                            }
                                        }}
                                        className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-[0.98]"
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Service Type Add Modal */}
            {isTypeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-900">새 유형 추가</h3>
                            <button onClick={() => setIsTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="sr-only">닫기</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddServiceType}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">유형 이름</label>
                                <input
                                    type="text"
                                    value={newTypeName}
                                    onChange={(e) => setNewTypeName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="유형 이름 입력..."
                                    required
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsTypeModalOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                                    취소
                                </button>
                                <button type="submit" className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-[0.98]">
                                    추가
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Password Change Modal */}
            {isPasswordModalOpen && passwordTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-900">비밀번호 변경</h3>
                            <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="sr-only">닫기</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">대상: {passwordTarget.email}</p>
                        <form onSubmit={handlePasswordSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">새 비밀번호</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="최소 6자 이상"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호 확인</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="비밀번호 다시 입력"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                                    취소
                                </button>
                                <button type="submit" className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-[0.98]">
                                    변경
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Profile Edit Modal */}
            <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="사용자 정보 수정">
                {editingProfile && (
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">이름</label>
                                <input
                                    required
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingProfile.display_name || ''}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, display_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">아이디</label>
                                <input
                                    required
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingProfile.username || ''}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, username: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">연락처</label>
                                <input
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingProfile.phone || ''}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">팀 이름</label>
                                <input
                                    className="input-field w-full text-[14px] font-medium text-slate-800"
                                    value={editingProfile.team_name || ''}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, team_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex gap-3">
                            <button type="button" onClick={() => setIsProfileModalOpen(false)} className="btn-outline flex-1">취소</button>
                            <button type="submit" className="btn-primary flex-1">저장하기</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
