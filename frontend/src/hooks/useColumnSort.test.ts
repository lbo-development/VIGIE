import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useColumnSort, sortRows } from './useColumnSort'

describe('useColumnSort', () => {
  it('cycle neutre → asc → desc → neutre au fil des appels sur la même colonne', () => {
    const { result } = renderHook(() => useColumnSort<'lib' | 'actif'>())

    expect(result.current.sort).toBeNull()

    act(() => result.current.toggleSort('lib'))
    expect(result.current.sort).toEqual({ column: 'lib', direction: 'asc' })

    act(() => result.current.toggleSort('lib'))
    expect(result.current.sort).toEqual({ column: 'lib', direction: 'desc' })

    act(() => result.current.toggleSort('lib'))
    expect(result.current.sort).toBeNull()
  })

  it('changer de colonne repart en asc, quel que soit l\'état précédent', () => {
    const { result } = renderHook(() => useColumnSort<'lib' | 'actif'>())

    act(() => result.current.toggleSort('lib'))
    act(() => result.current.toggleSort('lib')) // lib: desc
    act(() => result.current.toggleSort('actif'))

    expect(result.current.sort).toEqual({ column: 'actif', direction: 'asc' })
  })
})

describe('sortRows', () => {
  const rows = [
    { lib: 'Cap Janet', actif: true },
    { lib: 'Bassin Est', actif: false },
    { lib: 'Môle 1', actif: true },
  ]
  const getValue = (row: (typeof rows)[number], column: 'lib' | 'actif') => row[column]

  it('retourne la liste inchangée si aucun tri actif', () => {
    expect(sortRows(rows, null, getValue)).toEqual(rows)
  })

  it('trie du texte par ordre alphabétique (localisé fr) ascendant/descendant', () => {
    expect(sortRows(rows, { column: 'lib', direction: 'asc' }, getValue).map((r) => r.lib)).toEqual([
      'Bassin Est',
      'Cap Janet',
      'Môle 1',
    ])
    expect(sortRows(rows, { column: 'lib', direction: 'desc' }, getValue).map((r) => r.lib)).toEqual([
      'Môle 1',
      'Cap Janet',
      'Bassin Est',
    ])
  })

  it('trie un booléen (actif) — false avant true en ascendant', () => {
    expect(sortRows(rows, { column: 'actif', direction: 'asc' }, getValue).map((r) => r.actif)).toEqual([
      false,
      true,
      true,
    ])
  })
})
