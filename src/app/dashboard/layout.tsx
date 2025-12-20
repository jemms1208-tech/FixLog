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
    Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase';

const MENU_ITEMS = [
    { name: '대시보드', icon: LayoutDashboard, href: '/dashboard', roles: ['operator', 'admin', 'callcenter', 'field'] },
    { name: '공지사항', icon: Bell, href: '/dashboard/notices', roles: ['operator', 'admin', 'callcenter', 'field'] },
    { name: '거래처', icon: Users, href: '/dashboard/clients', roles: ['operator', 'admin', 'callcenter', 'field'] },
    { name: '접수내역', icon: FileText, href: '/dashboard/records', roles: ['operator', 'admin', 'callcenter', 'field'] },
    { name: '시스템', icon: ShieldCheck, href: '/dashboard/admin', roles: ['operator', 'admin'] },
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
        await supabase.auth.signOut();
        router.push('/login');
    };

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
                    <span className="text-xl font-bold tracking-tight text-primary">픽스로그</span>
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
                <div className="p-4 border-t">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors rounded-lg"
                    >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                    </button>
                </div>
            </aside>

            {/* Mobile Sidebar (Overlay) */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-none flex flex-col border-r">
                        <div className="h-16 flex items-center justify-between px-6 border-b">
                            <span className="text-lg font-bold tracking-tighter">픽스로그</span>
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
                        <span className="font-extrabold tracking-tight text-xl text-slate-900 lg:hidden">픽스로그</span>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-slate-50">
                    <div className="max-w-7xl mx-auto w-full p-4 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
