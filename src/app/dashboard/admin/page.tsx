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

const ROLE_LABELS = {
    admin: { label: '관리자', color: 'text-red-600', bg: 'bg-red-50' },
    editor: { label: '편집자', color: 'text-blue-600', bg: 'bg-blue-50' },
    viewer: { label: '조회자', color: 'text-gray-600', bg: 'bg-gray-50' },
};

export default function AdminPage() {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const supabase = createClient();

    useEffect(() => {
        fetchAdminData();
    }, []);

    async function fetchAdminData() {
        try {
            setLoading(true);
            const [profilesRes, groupsRes] = await Promise.all([
                supabase.from('profiles').select('*'),
                supabase.from('client_groups').select('*')
            ]);

            if (profilesRes.error) throw profilesRes.error;
            if (groupsRes.error) throw groupsRes.error;

            setProfiles(profilesRes.data || []);
            setGroups(groupsRes.data || []);
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredProfiles = profiles.filter(p =>
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.role?.includes(searchTerm)
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-1">시스템 관리</h1>
                    <p className="text-muted-foreground text-sm">사용자 권한 및 관리 그룹 구성을 설정합니다.</p>
                </div>
                <button className="btn-premium flex items-center gap-2 text-sm !py-2">
                    <UserPlus className="w-4 h-4" />
                    사용자 초대
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User Management List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass p-4 rounded-2xl border shadow-sm flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="사용자 검색..."
                                className="w-full pl-10 pr-4 py-2 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="glass rounded-3xl border shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-input/50 border-b">
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase">사용자 UUID</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase">등급</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase">허용 그룹</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredProfiles.map((profile) => {
                                        const role = ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] || ROLE_LABELS.viewer;
                                        return (
                                            <tr key={profile.id} className="hover:bg-primary/5 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <p className="text-sm font-medium font-mono truncate max-w-[150px]">{profile.id}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${role.bg} ${role.color}`}>
                                                        {role.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <p className="text-xs text-muted-foreground">
                                                        {profile.allowed_groups?.length || 0}개 그룹 허용됨
                                                    </p>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <button className="p-2 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-primary">
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Group Management */}
                <div className="space-y-6">
                    <div className="glass p-6 rounded-3xl border shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-bold flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                관리 그룹
                            </h2>
                            <button className="text-xs font-bold text-primary hover:underline">추가</button>
                        </div>

                        <div className="space-y-3">
                            {groups.map((group) => (
                                <div key={group.id} className="flex items-center justify-between p-3 rounded-xl bg-input/40 border border-transparent hover:border-border transition-all">
                                    <span className="text-sm font-medium">{group.name}</span>
                                    <button className="p-1 hover:text-red-600 transition-colors">
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {groups.length === 0 && !loading && (
                                <p className="text-center text-xs text-muted-foreground py-4 italic">등록된 그룹이 없습니다.</p>
                            )}
                        </div>
                    </div>

                    <div className="glass p-6 rounded-3xl border shadow-sm bg-primary/5 border-primary/10">
                        <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-primary" />
                            권한 안내
                        </h3>
                        <ul className="text-[11px] space-y-2 text-muted-foreground list-disc pl-4">
                            <li>관리자: 모든 기능 및 시스템 설정 가능</li>
                            <li>편집자: 거래처 및 장애 기록 등록/수정 가능</li>
                            <li>조회자: 본인 허용 그룹의 데이터만 열람 가능</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
