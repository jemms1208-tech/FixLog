'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    FileText,
    Settings,
    Menu,
    X,
    LogOut,
    ChevronRight,
    Database,
    ShieldCheck
} from 'lucide-react';

const MENU_ITEMS = [
    { name: '대시보드', icon: LayoutDashboard, href: '/dashboard' },
    { name: '거래처 관리', icon: Users, href: '/dashboard/clients' },
    { name: '장애/접수 기록', icon: FileText, href: '/dashboard/records' },
    { name: '시스템 관리', icon: ShieldCheck, href: '/dashboard/admin' },
    { name: '설정', icon: Settings, href: '/dashboard/settings' },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-background flex">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed inset-y-0 left-0 w-72 glass border-r z-50 transition-transform duration-300 lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="h-full flex flex-col p-6">
                    <div className="flex items-center gap-3 px-2 mb-10">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                            <Database className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight">FixLog</span>
                    </div>

                    <nav className="flex-1 space-y-2">
                        {MENU_ITEMS.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                    ${isActive
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'}
                  `}
                                >
                                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'group-hover:text-primary'}`} />
                                    <span className="font-medium">{item.name}</span>
                                    {isActive && <ChevronRight className="ml-auto w-4 h-4" />}
                                </Link>
                            );
                        })}
                    </nav>

                    <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all mt-auto border border-dashed border-transparent hover:border-red-200">
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">로그아웃</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-20 glass border-b px-6 flex items-center justify-between sticky top-0 z-30">
                    <button
                        className="lg:hidden p-2 rounded-lg hover:bg-primary/10 transition-colors"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end mr-2">
                            <span className="text-sm font-semibold">관리자</span>
                            <span className="text-xs text-muted-foreground">admin@fixlog.com</span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-md"></div>
                    </div>
                </header>

                <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
                    {children}
                </main>
            </div>
        </div>
    );
}
