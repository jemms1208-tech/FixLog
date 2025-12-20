import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // /dashboard 경로 보호
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // 승인 여부 확인을 위한 프로필 조회
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_approved, role')
            .eq('id', user.id)
            .single()

        // 미승인 사용자가 대시보드 접근 시 처리 (일반 로그아웃 유도 또는 전용 페이지)
        // 현재는 Layout에서 처리하고 있으나, /dashboard/admin 등은 여기서 미리 막을 수도 있음.

        if (request.nextUrl.pathname.startsWith('/dashboard/admin')) {
            if (!profile || !['admin', 'operator'].includes(profile.role)) {
                return NextResponse.redirect(new URL('/dashboard', request.url))
            }
        }
    }

    // 로그인한 사용자가 로그인 페이지 접근 시 대시보드로 리다이렉트
    if (request.nextUrl.pathname === '/login' && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
