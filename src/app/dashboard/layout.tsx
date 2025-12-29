'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    Menu,
    LogOut,
    ShieldCheck,
    Bell,
    X,
    Loader2,
    UserCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';

const MENU_ITEMS = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['operator', 'admin', 'callcenter', 'field'] },
    { name: '공지사항', icon: Bell, href: '/dashboard/notices', roles: ['operator', 'admin', 'callcenter', 'field'] },
    { name: '거래처 관리', icon: Users, href: '/dashboard/clients', roles: ['operator', 'admin', 'callcenter', 'field'] },
    { name: '접수내역', icon: FileText, href: '/dashboard/records', roles: ['operator', 'admin', 'callcenter', 'field'] },
    { name: '관리자 설정', icon: ShieldCheck, href: '/dashboard/admin', roles: ['operator', 'admin'] },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [userRole, setUserRole] = useState<string>('field');
    const [isApproved, setIsApproved] = useState<boolean>(true);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const { showToast } = useToast();

    const [isMyProfileModalOpen, setIsMyProfileModalOpen] = useState(false);
    const [myProfile, setMyProfile] = useState<any>(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    useEffect(() => {
        async function initDashboard() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('role, is_approved').eq('id', user.id).single();
                if (data) {
                    setUserRole(data.role || 'field');
                    setIsApproved(data.is_approved);
                }
            }
            setLoading(false);
        }
        initDashboard();
    }, []);

    // 관리자 페이지 접근 제어 처리는 별도 useEffect로 분리 (로딩 없이 처리)
    useEffect(() => {
        if (userRole !== 'field' && pathname.startsWith('/dashboard/admin') && !['operator', 'admin'].includes(userRole)) {
            router.push('/dashboard');
        }
    }, [pathname, userRole]);

    // 역할에 따라 메뉴 필터링
    const filteredMenuItems = MENU_ITEMS.filter(item => item.roles.includes(userRole));

    const handleLogout = async () => {
        // 로그아웃 활동 로그 기록
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('email, display_name, username').eq('id', user.id).single();
            await supabase.from('activity_logs').insert([{
                user_id: user.id,
                user_email: profile?.email,
                user_display_name: profile?.display_name,
                action: 'LOGOUT',
                target_type: 'auth',
                target_id: user.id,
                details: { username: profile?.username }
            }]);
        }

        await supabase.auth.signOut();
        showToast('로그아웃 되었습니다.', 'info');
        router.push('/login');
    };

    async function handleUpdateMyProfile(e: React.FormEvent) {
        e.preventDefault();
        if (!myProfile) return;
        setIsSavingProfile(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    display_name: myProfile.display_name,
                    username: myProfile.username,
                    phone: myProfile.phone,
                    team_name: myProfile.team_name
                })
                .eq('id', myProfile.id);

            if (error) throw error;
            showToast('내 정보가 수정되었습니다.', 'success');
            setIsMyProfileModalOpen(false);
        } catch (error: any) {
            showToast(`수정 오류: ${error.message}`, 'error');
        } finally {
            setIsSavingProfile(false);
        }
    }

    async function openMyProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (data) {
                setMyProfile(data);
                setIsMyProfileModalOpen(true);
            }
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!isApproved) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center space-y-6">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
                        <ShieldCheck className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-slate-900">승인 대기 중</h2>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            관리자의 승인이 필요한 계정입니다.<br />
                            승인이 완료될 때까지 대시보드를 이용하실 수 없습니다.
                        </p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full btn-primary bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                    </button>
                    <p className="text-[11px] text-slate-400">
                        문의사항이 있으시면 관리자에게 연락 바랍니다.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 flex">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 flex-col border-r bg-white h-screen sticky top-0 transition-all duration-300">
                <div className="h-16 flex items-center px-6 border-b">
                    <span className="text-xl font-bold tracking-tight text-primary">JE Networks</span>
                </div>
                <nav className="flex-1 p-0 py-4 space-y-0">
                    {filteredMenuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors border-l-4 ${pathname === item.href
                                ? 'bg-blue-50 border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.name}
                        </Link>
                    ))}
                </nav>
            </aside>

            {/* Mobile Sidebar (Overlay) */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-none flex flex-col border-r">
                        <div className="h-16 flex items-center justify-between px-6 border-b">
                            <span className="text-lg font-bold tracking-tighter">JE Networks</span>
                            <button onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <nav className="flex-1 p-0 py-4">
                            {filteredMenuItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center gap-4 px-8 py-4 text-sm font-bold transition-colors border-l-4 ${pathname === item.href
                                        ? 'bg-blue-50 border-blue-600 text-blue-600'
                                        : 'border-transparent text-slate-500'
                                        }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.name}
                                </Link>
                            ))}
                        </nav>
                        <div className="p-6 border-t whitespace-nowrap">
                            <button
                                onClick={handleLogout}
                                className="flex w-full items-center gap-4 px-4 py-3 text-sm font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                                로그아웃
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
                <header className="h-16 flex items-center justify-between px-6 bg-white border-b sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-slate-600">
                            <Menu className="w-6 h-6" />
                        </button>
                        <span className="font-extrabold tracking-tight text-xl text-slate-900 lg:hidden">JE Networks</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={openMyProfile}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                        >
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                <UserCircle className="w-5 h-5" />
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-xs font-bold text-slate-900 leading-none">{myProfile?.display_name || '내 정보'}</p>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight">{userRole}</p>
                            </div>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">로그아웃</span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-slate-50">
                    <div className="max-w-7xl mx-auto w-full p-4 lg:p-8">
                        {children}
                    </div>
                </main>

                {/* My Profile Modal */}
                <Modal
                    isOpen={isMyProfileModalOpen}
                    onClose={() => setIsMyProfileModalOpen(false)}
                    title="내 정보 수정"
                >
                    {myProfile && (
                        <form onSubmit={handleUpdateMyProfile} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">이름</label>
                                    <input
                                        required
                                        className="input-field w-full text-[14px] font-medium text-slate-800"
                                        value={myProfile.display_name || ''}
                                        onChange={(e) => setMyProfile({ ...myProfile, display_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">아이디</label>
                                    <input
                                        required
                                        className="input-field w-full text-[14px] font-medium text-slate-800"
                                        value={myProfile.username || ''}
                                        onChange={(e) => setMyProfile({ ...myProfile, username: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">연락처</label>
                                    <input
                                        className="input-field w-full text-[14px] font-medium text-slate-800"
                                        value={myProfile.phone || ''}
                                        onChange={(e) => setMyProfile({ ...myProfile, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-slate-800 mb-1.5 block uppercase">팀 이름</label>
                                    <input
                                        className="input-field w-full text-[14px] font-medium text-slate-800"
                                        value={myProfile.team_name || ''}
                                        onChange={(e) => setMyProfile({ ...myProfile, team_name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setIsMyProfileModalOpen(false)} className="btn-outline flex-1">취소</button>
                                <button type="submit" disabled={isSavingProfile} className="btn-primary flex-1">
                                    {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '저장하기'}
                                </button>
                            </div>
                        </form>
                    )}
                </Modal>
            </div>
        </div>
    );
}
