import type { Instrumentation } from 'next'

// Kesalahan di server: satu baris JSON di log, dengan rute dan jenis render. Path tanpa query (bisa berisi data pengguna).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  console.error(
    '[kesalahan-server]',
    JSON.stringify({
      message: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      digest: typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined,
      path: request.path.split('?')[0],
      method: request.method,
      route: context.routePath,
      type: context.routeType,
    }),
  )
}
