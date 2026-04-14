import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { castApi, mediaApi } from '@/lib/api'
import type { CastMemberDetail, CastSortOrder } from '@/lib/types'
import { CastCard } from '@/components/CastCard'
import { AddCastCard } from '@/components/AddCastCard'
import { ImdbCastImport } from '@/components/ImdbCastImport'
import { Select, SelectItem } from '@/components/ui/select'

interface SortableCastCardProps {
  member: CastMemberDetail
  isEditor: boolean
  mediaTitle: string
  onUpdate: (roleId: string, data: { characterName?: string | undefined; roleImageUrl?: string | null | undefined; roleImageFocalX?: number | null; roleImageFocalY?: number | null }) => Promise<void>
  onRemove: (roleId: string) => Promise<void>
}

function SortableCastCard({ member, isEditor, mediaTitle, onUpdate, onRemove }: SortableCastCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: member.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const dragHandleProps = isEditor ? { ...attributes, ...listeners } : undefined
  return (
    <div ref={setNodeRef} style={style}>
      <CastCard
        member={member}
        isEditor={isEditor}
        mediaTitle={mediaTitle}
        onUpdate={onUpdate}
        onRemove={onRemove}
        {...(dragHandleProps != null ? { dragHandleProps } : {})}
        isDragging={isDragging}
      />
    </div>
  )
}

interface CastSectionProps {
  mediaId: string
  mediaTitle: string
  cast: CastMemberDetail[]
  isEditor: boolean
  castSortOrder: CastSortOrder
}

export function CastSection({ mediaId, mediaTitle, cast, isEditor, castSortOrder }: CastSectionProps) {
  const queryClient = useQueryClient()
  const [localCast, setLocalCast] = useState(cast)
  const [currentSort, setCurrentSort] = useState<CastSortOrder>(castSortOrder)

  useEffect(() => { setLocalCast(cast) }, [cast])
  useEffect(() => { setCurrentSort(castSortOrder) }, [castSortOrder])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  async function handleUpdate(
    roleId: string,
    data: { characterName?: string | undefined; roleImageUrl?: string | null | undefined; roleImageFocalX?: number | null; roleImageFocalY?: number | null },
  ) {
    await castApi.update(roleId, data)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['media', mediaId] }),
      queryClient.invalidateQueries({ queryKey: ['actor'] }),
    ])
  }

  async function handleRemove(roleId: string) {
    await castApi.delete(roleId)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['media', mediaId] }),
      queryClient.invalidateQueries({ queryKey: ['actor'] }),
    ])
  }

  function handleCastAdded() {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['media', mediaId] }),
      queryClient.invalidateQueries({ queryKey: ['actor'] }),
    ])
  }

  async function handleSortChange(value: string) {
    const newSortOrder = value as CastSortOrder
    if (newSortOrder === 'CUSTOM') return

    const sorted = [...localCast].sort((a, b) => {
      if (newSortOrder === 'BY_ACTOR') {
        return a.actor.name.toLowerCase().localeCompare(b.actor.name.toLowerCase())
      } else {
        // BY_ROLE: empty/null sorts last
        const aName = (a.characterName ?? '').toLowerCase()
        const bName = (b.characterName ?? '').toLowerCase()
        if (!aName && !bName) return 0
        if (!aName) return 1
        if (!bName) return -1
        return aName.localeCompare(bName)
      }
    })

    const newOrder = sorted.map((m, i) => ({ id: m.id, billingOrder: i }))

    setLocalCast(sorted)
    setCurrentSort(newSortOrder)

    await castApi.reorder(mediaId, newOrder)
    await mediaApi.updateCastSort(mediaId, newSortOrder)
    await queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localCast.findIndex(m => m.id === active.id)
    const newIndex = localCast.findIndex(m => m.id === over.id)

    const reordered = arrayMove(localCast, oldIndex, newIndex)
    const newOrder = reordered.map((m, i) => ({ id: m.id, billingOrder: i }))

    setLocalCast(reordered)
    setCurrentSort('CUSTOM')

    await castApi.reorder(mediaId, newOrder)
    await mediaApi.updateCastSort(mediaId, 'CUSTOM')
    await queryClient.invalidateQueries({ queryKey: ['media', mediaId] })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-xl font-semibold">Cast</h2>
        {isEditor && <ImdbCastImport mediaId={mediaId} />}
        {isEditor && (
          <Select value={currentSort} onValueChange={value => { void handleSortChange(value) }} size="sm" className="min-w-[6.5rem]">
            {/* CUSTOM label item — hidden from the dropdown list, only used for display */}
            <SelectItem value="CUSTOM" className="hidden">Custom</SelectItem>
            <SelectItem value="BY_ACTOR">By Actor</SelectItem>
            <SelectItem value="BY_ROLE">By Role</SelectItem>
          </Select>
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={event => { void handleDragEnd(event) }}>
        <SortableContext items={localCast.map(m => m.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {localCast.map(member => (
              <SortableCastCard
                key={member.id}
                member={member}
                isEditor={isEditor}
                mediaTitle={mediaTitle}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
              />
            ))}
            {isEditor && (
              <AddCastCard
                mediaId={mediaId}
                onCastAdded={handleCastAdded}
              />
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
