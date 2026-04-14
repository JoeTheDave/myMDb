import { useState, useEffect } from 'react'

interface FocalPointEditorProps {
  initialX: number
  initialY: number
  onConfirm: (x: number, y: number) => void
  onCancel: () => void
}

export function FocalPointEditor({ initialX, initialY, onConfirm, onCancel }: FocalPointEditorProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    setPos({ x, y })
  }

  return (
    <>
      {/* Clickable overlay */}
      <div
        className="absolute inset-0 z-30 cursor-crosshair bg-black/30"
        onClick={handleClick}
      >
        {/* Focal point dot */}
        <div
          className="absolute size-4 rounded-full border-2 border-white shadow-md bg-white/40 pointer-events-none"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Confirm / Cancel bar */}
      <div className="absolute bottom-0 left-0 right-0 flex gap-2 p-1.5 bg-black/50 z-40">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onConfirm(pos.x, pos.y)
          }}
          className="flex-1 text-xs font-semibold py-1 px-2 rounded bg-amber-500 text-black hover:bg-amber-400 transition-colors"
        >
          Set
        </button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onCancel()
          }}
          className="flex-1 text-xs py-1 px-2 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
