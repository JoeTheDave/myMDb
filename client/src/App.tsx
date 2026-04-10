import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Sun, Moon, Shield, LogOut } from 'lucide-react'

import { AuthContext, useAuthState } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

import { Logo } from '@/components/Logo'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

import { LoginPage } from '@/pages/LoginPage'
import { MoviesPage } from '@/pages/MoviesPage'
import { MediaDetailPage } from '@/pages/MediaDetailPage'
import { MediaFormPage } from '@/pages/MediaFormPage'
import { ActorsPage } from '@/pages/ActorsPage'
import { ActorDetailPage } from '@/pages/ActorDetailPage'
import { ActorFormPage } from '@/pages/ActorFormPage'
import { AdminPage } from '@/pages/AdminPage'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

// ---- Error boundary ----

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-xl font-semibold text-destructive">Something went wrong</p>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            An unexpected error occurred. Please try again or refresh the page.
          </p>
          <Button onClick={() => this.setState({ hasError: false, message: '' })}>Try again</Button>
        </div>
      )
    }
    return this.props.children
  }
}

// ---- Navbar ----

function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'text-sm font-medium transition-colors hover:text-gold',
      isActive ? 'text-gold' : 'text-muted-foreground',
    )

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="container mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <NavLink to="/movies" className="shrink-0">
          <Logo size="sm" />
        </NavLink>

        {/* Nav links */}
        {user && (
          <nav className="flex items-center gap-5">
            <NavLink to="/movies" className={navLinkClass}>Movies</NavLink>
            <NavLink to="/actors" className={navLinkClass}>Actors</NavLink>
            {user.role === 'ADMIN' && (
              <NavLink to="/admin" className={navLinkClass}>
                <Shield className="size-4 inline mr-1" />
                Admin
              </NavLink>
            )}
          </nav>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="text-muted-foreground hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        {/* User menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Avatar size="sm">
                {user.imageUrl && (
                  <AvatarImage src={user.imageUrl} alt={user.name ?? user.email} />
                )}
                <AvatarFallback size="sm">
                  {(user.name ?? user.email).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">{user.name ?? user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{user.role}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await logout()
                  navigate('/login')
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}

// ---- Layout shell ----

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
    </div>
  )
}

// ---- Root component ----

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/movies" replace />} />

      {/* Protected: VIEWER+ */}
      <Route element={<ProtectedRoute minRole="VIEWER" />}>
        <Route
          path="/movies"
          element={
            <AppLayout>
              <ErrorBoundary><MoviesPage /></ErrorBoundary>
            </AppLayout>
          }
        />
        <Route
          path="/movies/:id"
          element={
            <AppLayout>
              <ErrorBoundary><MediaDetailPage /></ErrorBoundary>
            </AppLayout>
          }
        />
        <Route
          path="/actors"
          element={
            <AppLayout>
              <ErrorBoundary><ActorsPage /></ErrorBoundary>
            </AppLayout>
          }
        />
        <Route
          path="/actors/:id"
          element={
            <AppLayout>
              <ErrorBoundary><ActorDetailPage /></ErrorBoundary>
            </AppLayout>
          }
        />
      </Route>

      {/* Protected: EDITOR+ */}
      <Route element={<ProtectedRoute minRole="EDITOR" />}>
        <Route
          path="/movies/new"
          element={
            <AppLayout>
              <ErrorBoundary><MediaFormPage /></ErrorBoundary>
            </AppLayout>
          }
        />
        <Route
          path="/movies/:id/edit"
          element={
            <AppLayout>
              <ErrorBoundary><MediaFormPage /></ErrorBoundary>
            </AppLayout>
          }
        />
        <Route
          path="/actors/new"
          element={
            <AppLayout>
              <ErrorBoundary><ActorFormPage /></ErrorBoundary>
            </AppLayout>
          }
        />
        <Route
          path="/actors/:id/edit"
          element={
            <AppLayout>
              <ErrorBoundary><ActorFormPage /></ErrorBoundary>
            </AppLayout>
          }
        />
      </Route>

      {/* Protected: ADMIN */}
      <Route element={<ProtectedRoute minRole="ADMIN" />}>
        <Route
          path="/admin"
          element={
            <AppLayout>
              <ErrorBoundary><AdminPage /></ErrorBoundary>
            </AppLayout>
          }
        />
      </Route>
    </Routes>
  )
}

function AuthProvider({ children }: { children: ReactNode }) {
  const authState = useAuthState()
  return <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
