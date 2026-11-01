'use client'

import { useEffect, type ReactNode } from 'react'
import { startPersistence } from '@/lib/store'
import { startCloudSync } from '@/lib/cloud'

// Memuat proyek dari browser (atau tautan kiriman) dan menyalakan sinkron cloud, sekali untuk semua halaman aplikasi.
export function AppState({ children }: { children: ReactNode }) {
  useEffect(() => startPersistence(), [])
  useEffect(() => startCloudSync(), [])
  return children
}
