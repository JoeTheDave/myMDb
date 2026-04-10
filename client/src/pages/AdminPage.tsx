import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Loader2, Plus } from 'lucide-react'
import { usersApi } from '@/lib/api'
import type { User } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const ROLES = ['VIEWER', 'EDITOR', 'ADMIN'] as const

function RoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'ADMIN') return 'default'
  if (role === 'EDITOR') return 'secondary'
  return 'outline'
}

export function AdminPage() {
  const queryClient = useQueryClient()
  const [addForm, setAddForm] = useState({ email: '', role: 'VIEWER' })
  const [addErrors, setAddErrors] = useState<{ email?: string }>({})
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => usersApi.create(data),
    onSuccess: () => {
      toast.success('User added')
      setAddForm({ email: '', role: 'VIEWER' })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; active?: boolean } }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to update user'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success('User removed')
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Failed to delete user'),
  })

  function validateAdd(): boolean {
    const e: { email?: string } = {}
    if (!addForm.email.trim()) e['email'] = 'Email is required'
    else if (!addForm.email.includes('@')) e['email'] = 'Invalid email'
    setAddErrors(e)
    return Object.keys(e).length === 0
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!validateAdd()) return
    createMutation.mutate(addForm)
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">User Management</h1>

      {/* Add user form */}
      <div className="rounded-xl border border-border bg-card p-5 mb-8">
        <h2 className="text-base font-semibold mb-4">Add User</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="addEmail">Email</Label>
            <Input
              id="addEmail"
              type="email"
              placeholder="user@example.com"
              value={addForm.email}
              onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
            />
            {addErrors['email'] && <p className="text-xs text-destructive">{addErrors['email']}</p>}
          </div>
          <div className="space-y-1.5 w-36">
            <Label>Role</Label>
            <Select
              value={addForm.role}
              onValueChange={v => setAddForm(f => ({ ...f, role: v }))}
            >
              {ROLES.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </Select>
          </div>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-gold text-black hover:bg-gold/90 font-semibold"
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <><Plus className="size-4 mr-1" />Add</>
            )}
          </Button>
        </form>
      </div>

      {/* Users table */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map(user => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{user.email}</p>
                      {user.name && <p className="text-xs text-muted-foreground">{user.name}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-28">
                      <Select
                        value={user.role}
                        onValueChange={v => updateMutation.mutate({ id: user.id, data: { role: v } })}
                        className="h-7 text-xs"
                      >
                        {ROLES.map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </Select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => updateMutation.mutate({ id: user.id, data: { active: !user.active } })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        user.active ? 'bg-gold' : 'bg-muted-foreground/30'
                      }`}
                      role="switch"
                      aria-checked={user.active}
                    >
                      <span
                        className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                          user.active ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={RoleBadgeVariant(user.role)} className="mr-2 hidden sm:inline-flex">
                      {user.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(user)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleteTarget?.email}</strong> from the database? They will no longer be able to sign in.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
