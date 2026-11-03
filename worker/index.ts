// Entrada do Worker do CSPTools: /api/* vai para a API (worker/api.ts); o
// resto é o site estático (dist/). O módulo de entrada só pode exportar o
// handler, por isso a lógica fica em api.ts.
import { handleApi, type Env } from './api'

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) return handleApi(req, env)
    if (env.ASSETS) return env.ASSETS.fetch(req)
    return new Response('Not found', { status: 404 })
  },
}
