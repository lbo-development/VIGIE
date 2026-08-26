import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDragReorder } from './useDragReorder'

// Un DragEvent minimal suffisant pour les handlers (preventDefault seul est utilisé) —
// évite de dépendre du support (limité) des événements drag natifs de jsdom.
function fakeDragEvent() {
  return { preventDefault: vi.fn() } as unknown as React.DragEvent
}

describe('useDragReorder', () => {
  it("déplace l'élément glissé à la position de la cible (avant)", () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useDragReorder(['A', 'B', 'C'], onReorder))

    act(() => result.current.dragProps('C').onDragStart())
    act(() => result.current.dragProps('A').onDrop(fakeDragEvent()))

    expect(onReorder).toHaveBeenCalledWith(['C', 'A', 'B'])
  })

  it("déplace l'élément glissé à la position de la cible (après)", () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useDragReorder(['A', 'B', 'C'], onReorder))

    act(() => result.current.dragProps('A').onDragStart())
    act(() => result.current.dragProps('C').onDrop(fakeDragEvent()))

    expect(onReorder).toHaveBeenCalledWith(['B', 'C', 'A'])
  })

  it('ne fait rien si on dépose sur soi-même', () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useDragReorder(['A', 'B', 'C'], onReorder))

    act(() => result.current.dragProps('B').onDragStart())
    act(() => result.current.dragProps('B').onDrop(fakeDragEvent()))

    expect(onReorder).not.toHaveBeenCalled()
  })

  it("ne fait rien si aucun élément n'a été démarré en glissement", () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useDragReorder(['A', 'B', 'C'], onReorder))

    act(() => result.current.dragProps('B').onDrop(fakeDragEvent()))

    expect(onReorder).not.toHaveBeenCalled()
  })

  it('réinitialise draggedKey après le drop', () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useDragReorder(['A', 'B'], onReorder))

    act(() => result.current.dragProps('A').onDragStart())
    expect(result.current.draggedKey).toBe('A')

    act(() => result.current.dragProps('B').onDrop(fakeDragEvent()))
    expect(result.current.draggedKey).toBeNull()
  })
})
