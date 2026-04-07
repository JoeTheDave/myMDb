import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const isUnauthorized = searchParams.get('error') === 'unauthorized'

  // Force dark class on login page
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => {
      // Restore from localStorage when leaving login
      const stored = localStorage.getItem('theme')
      if (stored === 'light') {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Logo */}
        <Logo size="lg" />

        {/* Subtitle */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-white">myMDb</h1>
          <p className="text-muted-foreground text-sm">Your personal movie &amp; show database</p>
        </div>

        {/* Error callout */}
        {isUnauthorized && (
          <div className="w-full rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Access denied.</strong> Your account is not authorized. Contact the admin to request access.
          </div>
        )}

        {/* Sign in button */}
        <a href="/api/auth/google" className="w-full">
          <Button
            variant="default"
            className="w-full h-11 bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 font-medium gap-3"
          >
            <svg className="size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </Button>
        </a>
      </div>
    </div>
  )
}
