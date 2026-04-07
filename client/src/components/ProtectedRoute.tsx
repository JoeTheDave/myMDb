import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/lib/types'
import { hasMinRole } from '@/lib/types'

interface ProtectedRouteProps {
  minRole?: Role
}

export function ProtectedRoute({ minRole = 'VIEWER' }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!hasMinRole(user.role, minRole)) {
    return <Navigate to="/movies" replace />
  }

  return <Outlet />
}
