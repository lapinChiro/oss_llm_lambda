import type { OpenAPIHono } from '@hono/zod-openapi'

export const OPENAPI_DOC_CONFIG = {
  openapi: '3.0.0',
  info: { version: '1.0.0', title: 'Web Application API', description: 'Hono + PostgreSQL API template' },
}

export function setupOpenAPIDoc(app: OpenAPIHono): void {
  app.doc('/openapi.json', OPENAPI_DOC_CONFIG)
}

export function setupSwaggerUI(app: OpenAPIHono): void {
  if (process.env.NODE_ENV === 'production') return
  app.get('/docs', (c) => c.html(`<!doctype html><html><head><title>API Documentation</title></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui'})</script></body></html>`))
}
