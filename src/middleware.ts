import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const ADMIN_COOKIE = 'admin_token'

function getAdminSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.ADMIN_JWT_SECRET ?? 'fallback-dev-secret')
}

async function verifyAdminJwt(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getAdminSecret())
    return true
  } catch {
    return false
  }
}

// Handles /admin/* routes (before NextAuth middleware)
async function adminMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname

  if (!pathname.startsWith('/admin')) return null

  // Public admin paths
  if (
    pathname === '/admin/login' ||
    pathname === '/admin/setup-2fa' ||
    pathname.startsWith('/admin/recuperar-senha')
  ) {
    return NextResponse.next()
  }

  // All other /admin/* need a valid admin_token cookie
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  if (!token || !(await verifyAdminJwt(token))) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  // Redirect logged-in admin away from login page
  return NextResponse.next()
}

// Rotas protegidas por NextAuth (requerem sessão ativa)
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/estoque',
  '/configuracoes',
  '/plano-bloqueado',
  '/rede',
]

export default withAuth(
  async function middleware(req) {
    const adminResponse = await adminMiddleware(req)
    if (adminResponse) return adminResponse

    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Redireciona usuários autenticados para fora das páginas de auth
    if (pathname.startsWith('/auth') && token) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname

        if (pathname.startsWith('/admin')) return true
        if (pathname.startsWith('/auth')) return true
        if (pathname.startsWith('/convite')) return true
        if (pathname.startsWith('/api/convite')) return true
        if (pathname.startsWith('/recuperar-senha')) return true
        if (pathname.startsWith('/api/recuperar-senha')) return true

        if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
          return !!token
        }

        return true
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/estoque/:path*',
    '/configuracoes/:path*',
    '/plano-bloqueado/:path*',
    '/rede/:path*',
    '/auth/:path*',
    '/admin/:path*',
    '/recuperar-senha/:path*',
  ],
}
