import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'

interface FocalPointEditorProps {
  imageSrc: string
  initialX: number
  initialY: number
  onConfirm: (x: number, y: number) => void
  onCancel: () => void
}

export function FocalPointEditor({ imageSrc, initialX, initialY, onConfirm, onCancel }: FocalPointEditorProps) {
  const [focalX, setFocalX] = useState(initialX)
  const [focalY, setFocalY] = useState(initialY)
  const [dragging, setDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const lastPosRef = useRef({ x: 0, y: 0 })
  // Track position in a ref so global mouse handlers always have the latest value
  const focalRef = useRef({ x: initialX, y: initialY })
  const onConfirmRef = useRef(onConfirm)
  const onCancelRef = useRef(onCancel)
  // Keep refs in sync with latest props without triggering re-renders
  useLayoutEffect(() => {
    onConfirmRef.current = onConfirm
    onCancelRef.current = onCancel
  })

  // Escape key cancels
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancelRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Compute how many % one pixel of drag corresponds to, based on the actual
  // rendered image dimensions vs container dimensions (object-fit: cover math).
  // Wrapped in useCallback — deps are stable refs, no re-creation needed.
  const getSensitivity = useCallback((): { x: number; y: number } => {
    const container = containerRef.current
    const img = imgRef.current
    if (!container) return { x: 0.5, y: 0.5 }
    const rect = container.getBoundingClientRect()
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      return { x: 100 / rect.width, y: 100 / rect.height }
    }
    const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
    const overflowX = img.naturalWidth * scale - rect.width
    const overflowY = img.naturalHeight * scale - rect.height
    return {
      x: overflowX > 1 ? 100 / overflowX : 0,
      y: overflowY > 1 ? 100 / overflowY : 0,
    }
  }, [])

  // Dragging right → image moves right → you see more of the left side → focalX decreases
  const applyDelta = useCallback((dx: number, dy: number) => {
    const s = getSensitivity()
    const newX = Math.min(100, Math.max(0, focalRef.current.x - dx * s.x))
    const newY = Math.min(100, Math.max(0, focalRef.current.y - dy * s.y))
    focalRef.current = { x: newX, y: newY }
    setFocalX(newX)
    setFocalY(newY)
  }, [getSensitivity])

  // Global mouse handlers while dragging — captures events outside the container
  useEffect(() => {
    if (!dragging) return

    function handleMouseMove(e: MouseEvent) {
      const dx = e.clientX - lastPosRef.current.x
      const dy = e.clientY - lastPosRef.current.y
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      applyDelta(dx, dy)
    }

    function handleMouseUp() {
      setDragging(false)
      onConfirmRef.current(focalRef.current.x, focalRef.current.y)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, applyDelta])

  function handleMouseDown(e: React.MouseEvent) {
    // Only primary button
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }

  // Touch support
  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation()
    const touch = e.touches[0]
    if (!touch) return
    lastPosRef.current = { x: touch.clientX, y: touch.clientY }
    setDragging(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.stopPropagation()
    const touch = e.touches[0]
    if (!touch) return
    const dx = touch.clientX - lastPosRef.current.x
    const dy = touch.clientY - lastPosRef.current.y
    lastPosRef.current = { x: touch.clientX, y: touch.clientY }
    applyDelta(dx, dy)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.stopPropagation()
    setDragging(false)
    onConfirmRef.current(focalRef.current.x, focalRef.current.y)
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-30 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Live preview — the image moves in real time as you drag */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt=""
        className="w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: `${focalX}% ${focalY}%` }}
        draggable={false}
      />

      {/* Cancel button — circular, lower-right */}
      <button
        type="button"
        title="Cancel repositioning"
        onClick={e => { e.stopPropagation(); onCancelRef.current() }}
        onMouseDown={e => e.stopPropagation()} // prevent triggering drag
        className="absolute bottom-1.5 right-1.5 z-10 size-6 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer hover:brightness-125 transition-all"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
