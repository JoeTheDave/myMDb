import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { User, X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CastMemberDetail } from '@/lib/types'
import { RoleImageSlot } from '@/components/RoleImageSlot'

interface CastCardProps {
  member: CastMemberDetail
  isEditor: boolean
  mediaTitle: string
  onUpdate: (roleId: string, data: { characterName?: string | undefined; roleImageUrl?: string | undefined; roleImageFocalX?: number | null; roleImageFocalY?: number | null }) => Promise<void>
  onRemove: (roleId: string) => Promise<void>
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement> | undefined
  isDragging?: boolean | undefined
}

export function CastCard({ member, isEditor, mediaTitle, onUpdate, onRemove, dragHandleProps, isDragging }: CastCardProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const committingRef = useRef(false)

  function startEditing() {
    setNameValue(member.characterName ?? '')
    setEditingName(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function commitName() {
    if (committingRef.current) return
    committingRef.current = true
    const trimmed = nameValue.trim()
    setEditingName(false)
    if (!trimmed || trimmed === (member.characterName ?? '')) {
      committingRef.current = false
      return
    }
    setSaving(true)
    try {
      await onUpdate(member.id, { characterName: trimmed })
    } finally {
      setSaving(false)
      committingRef.current = false
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitName()
    } else if (e.key === 'Escape') {
      setEditingName(false)
    }
  }

  async function handleRoleImageChange(url: string | undefined) {
    await onUpdate(member.id, { roleImageUrl: url ?? undefined })
  }

  return (
    <div className={cn(
      'relative group/card rounded-xl overflow-hidden bg-card border border-border',
      isDragging && 'opacity-80 shadow-2xl scale-105 ring-2 ring-gold/40',
    )}>
      {/* Drag handle — visible on card hover (EDITOR only, when dragHandleProps provided) */}
      {isEditor && dragHandleProps && (
        <div
          {...dragHandleProps}
          className={cn(
            'absolute top-2 left-2 z-20',
            'size-6 rounded flex items-center justify-center',
            'opacity-0 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100',
            'transition-all duration-150',
            'cursor-grab active:cursor-grabbing text-white/70 hover:text-white',
          )}
        >
          <GripVertical className="size-4" />
        </div>
      )}

      {/* Remove button — visible on card hover (EDITOR only) */}
      {isEditor && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); void onRemove(member.id) }}
          className={cn(
            'absolute top-2 right-2 z-20',
            'size-6 rounded-full bg-destructive text-white',
            'flex items-center justify-center',
            'opacity-0 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100',
            'transition-all duration-150',
            'hover:scale-125 hover:brightness-110',
          )}
          aria-label={`Remove ${member.actor.name} from cast`}
        >
          <X className="size-3.5" />
        </button>
      )}

      {/* Main image section — 50/50 split */}
      <div className="flex aspect-square">
        {/* Left: actor image — links to actor page */}
        <Link
          to={`/actors/${member.actor.id}`}
          onClick={e => e.stopPropagation()}
          className="flex-1 relative overflow-hidden bg-muted block"
          tabIndex={-1}
        >
          {member.actor.imageUrl ? (
            <img
              src={member.actor.imageUrl}
              alt={member.actor.name}
              className="w-full h-full object-cover"
              style={{ objectPosition: `${member.actor.imageFocalX ?? 50}% ${member.actor.imageFocalY ?? 50}%` }}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <User className="size-8 opacity-30" />
            </div>
          )}
        </Link>

        {/* Divider */}
        <div className="w-px bg-border shrink-0" />

        {/* Right: role image */}
        <div className="flex-1 relative overflow-hidden">
          {isEditor ? (
            <RoleImageSlot
              value={member.roleImageUrl}
              onChange={handleRoleImageChange}
              actorName={member.actor.name}
              characterName={member.characterName}
              mediaTitle={mediaTitle}
              focalX={member.roleImageFocalX}
              focalY={member.roleImageFocalY}
              onFocalPointChange={async (x, y) => {
                await onUpdate(member.id, { roleImageFocalX: x, roleImageFocalY: y })
              }}
            />
          ) : member.roleImageUrl ? (
            <img
              src={member.roleImageUrl}
              alt={`${member.actor.name} as ${member.characterName ?? ''}`}
              className="w-full h-full object-cover"
              style={{ objectPosition: `${member.roleImageFocalX ?? 50}% ${member.roleImageFocalY ?? 50}%` }}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full absolute inset-0 flex items-center justify-center text-muted-foreground bg-muted">
              <User className="size-8 opacity-30" />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-2.5 text-center space-y-1">
        {/* Actor name — links to actor page */}
        <Link
          to={`/actors/${member.actor.id}`}
          onClick={e => e.stopPropagation()}
          className="text-sm font-semibold block truncate hover:text-gold transition-colors leading-tight"
          title={member.actor.name}
        >
          {member.actor.name}
        </Link>

        {/* Character name */}
        {editingName ? (
          <input
            ref={inputRef}
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => void commitName()}
            disabled={saving}
            className={cn(
              'w-full text-xs text-center bg-transparent border-b border-gold/60',
              'outline-none text-foreground disabled:opacity-50 pb-0.5',
            )}
          />
        ) : member.characterName ? (
          <p
            className={cn(
              'text-xs text-muted-foreground truncate',
              isEditor && 'cursor-pointer hover:text-foreground transition-colors',
              saving && 'opacity-50',
            )}
            title={isEditor ? 'Click to edit' : member.characterName}
            onClick={isEditor ? startEditing : undefined}
          >
            {member.characterName}
          </p>
        ) : isEditor ? (
          <button
            type="button"
            onClick={startEditing}
            className="text-xs italic text-zinc-500 hover:text-zinc-400 transition-colors block w-full"
          >
            role
          </button>
        ) : null}
      </div>
    </div>
  )
}
