import { defineConfig } from 'vitest/config'

// Alias @/ dibaca dari tsconfig.json, sama dengan Next. Lingkungan bawaan node; tes komponen memilih jsdom lewat komentar di filenya.
export default defineConfig({ resolve: { tsconfigPaths: true } })
