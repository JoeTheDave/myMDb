export type UserRole = 'admin' | 'editor' | 'viewer'

export interface AppUserIdentity {
  user: string
  role: UserRole
  loggedIn: boolean
}
