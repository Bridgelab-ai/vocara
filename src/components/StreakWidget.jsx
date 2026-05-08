import React from 'react'
import { calcStreak, todayStr } from '../appShared'

function getLast7Days(history) {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const sessions = history?.filter(h => h.date === dateStr) || []
    result.push({ date: dateStr, done: sessions.length > 0, total: sessions.reduce((a, b) => a + (b.total || 0), 0), correct: sessions.reduce((a, b) => a + (b.correct || 0), 0) })
  }
  return result
}

function StreakWidget({ history, th, t }) {
  const streak = calcStreak(history)
  const days = getLast7Days(history)
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const today = todayStr()
  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${th.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: th.sub, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{t.historyLabel}</span>
        <span style={{ color: streak > 0 ? th.gold : th.sub, fontSize: '0.85rem', fontWeight: streak > 0 ? 'bold' : 'normal' }}>
          {streak > 0 ? `🔥 ${streak} ${t.streak}` : t.streakNone}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
        {days.map((day, i) => {
          const isToday = day.date === today
          const pct = day.total > 0 ? Math.round((day.correct / day.total) * 100) : 0
          const [dy, dm, dd] = day.date.split('-').map(Number)
          const d = new Date(dy, dm - 1, dd)
          const dayLabel = weekDays[d.getDay() === 0 ? 6 : d.getDay() - 1]
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '100%', height: '32px', borderRadius: '6px', background: day.done ? (pct >= 70 ? th.accent : th.accent + '66') : th.border, border: isToday ? `2px solid ${th.gold}` : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: day.done ? '#fff' : th.sub, fontWeight: 'bold' }}>
                {day.done ? (day.total > 0 ? `${pct}%` : '✓') : ''}
              </div>
              <span style={{ color: isToday ? th.gold : th.sub, fontSize: '0.65rem' }}>{dayLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default StreakWidget
