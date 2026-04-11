import { useQueryClient } from '@tanstack/react-query'
import { castApi } from '@/lib/api'
import type { CastMemberDetail } from '@/lib/types'
import { CastCard } from '@/components/CastCard'
import { AddCastCard } from '@/components/AddCastCard'
import { ImdbCastImport } from '@/components/ImdbCastImport'

interface CastSectionProps {
  mediaId: string
  cast: CastMemberDetail[]
  isEditor: boolean
}

export function CastSection({ mediaId, cast, isEditor }: CastSectionProps) {
  const queryClient = useQueryClient()

  async function handleUpdate(
    roleId: string,
    data: { characterName?: string | undefined; roleImageUrl?: string | undefined },
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">Cast</h2>
        {isEditor && <ImdbCastImport mediaId={mediaId} />}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {cast.map(member => (
          <CastCard
            key={member.id}
            member={member}
            isEditor={isEditor}
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
    </div>
  )
}
