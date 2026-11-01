// Tangkap kesalahan yang lolos dari semua penanganan di browser dan laporkan ke server.
import { report } from '@/lib/report'

addEventListener('error', (e) => report(e.error ?? e.message, 'jendela'))
addEventListener('unhandledrejection', (e) => report(e.reason, 'janji'))
