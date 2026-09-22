import { describe, it, expect } from 'vitest'
import { todayParis, formatDateFr } from '../utils/dates.js'

describe('todayParis', () => {
  it("l'été (UTC+2), 23h30 UTC est déjà le lendemain à Paris", () => {
    expect(todayParis(new Date('2026-09-20T23:30:00Z'))).toBe('2026-09-21')
  })

  it("l'hiver (UTC+1), 22h30 UTC est encore le même jour à Paris", () => {
    expect(todayParis(new Date('2026-12-20T22:30:00Z'))).toBe('2026-12-20')
  })

  it("l'hiver (UTC+1), 23h30 UTC bascule au lendemain", () => {
    expect(todayParis(new Date('2026-12-20T23:30:00Z'))).toBe('2026-12-21')
  })
})

describe('formatDateFr', () => {
  it('convertit AAAA-MM-JJ en JJ/MM/AAAA', () => {
    expect(formatDateFr('2026-09-25')).toBe('25/09/2026')
  })
})
