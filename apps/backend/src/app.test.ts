import type { Document } from 'openapi-backend'

import { buildApp } from './app.js'
import { ApiTester } from './testing/api-tester.js'
import { assertResponseMatchesContract, createContractValidator } from './testing/openapi-contract.js'

describe('application shell', () => {
  it('serves health without authentication or external credentials', async () => {
    const response = await new ApiTester(buildApp()).get<{ status: string }>('/api/health')
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ status: 'ok' })
    expect(response.headers.get('x-request-id')).toMatch(/^req_/)
    expect(response.headers.get('x-trace-id')).toBeTruthy()
  })

  it('publishes the health contract in OpenAPI', async () => {
    const app = buildApp()
    const response = await app.request('/openapi.json')
    const document = await response.json() as Document
    expect(document.paths).toHaveProperty('/api/health')

    const healthResponse = await app.request('/api/health')
    assertResponseMatchesContract({
      validator: await createContractValidator(document),
      method: 'get',
      path: '/api/health',
      status: healthResponse.status,
      body: await healthResponse.json(),
    })
  })

  it('returns the generic error envelope for unknown routes', async () => {
    const response = await new ApiTester(buildApp()).get<Record<string, unknown>>('/missing')
    expect(response.status).toBe(404)
    expect(response.data).toMatchObject({ success: false, code: 'NOT_FOUND', path: '/missing' })
  })
})
