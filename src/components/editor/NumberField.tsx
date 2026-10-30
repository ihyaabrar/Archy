'use client'

import { useState } from 'react'

// Nilai diterapkan saat fokus lepas atau Enter, supaya mengetik tidak membanjiri riwayat undo.
export function NumberField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setText(String(value))
  }
  const n = Number(text.replace(',', '.'))
  const invalid = !Number.isFinite(n) || n < min || n > max
  const commit = () => {
    if (!invalid && n !== value) onCommit(n)
    else if (invalid) setText(String(value))
  }
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={text}
        aria-invalid={invalid}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {invalid && <small className="field-error">Isi angka {min} sampai {max.toFixed(2)}</small>}
    </label>
  )
}
