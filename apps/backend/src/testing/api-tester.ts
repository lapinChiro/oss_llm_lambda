import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ZodType } from 'zod'

export interface ApiTestResponse<T> {
  status: number
  data: T
  headers: Headers
  raw: Response
  method: string
  path: string
}

export type ContractAssertion = (response: ApiTestResponse<unknown>) => void | Promise<void>

async function parseBody<T>(response: Response, schema?: ZodType<T>): Promise<T> {
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response, received ${contentType}: ${(await response.text()).slice(0, 200)}`)
  }
  const body: unknown = await response.json()
  return schema ? schema.parse(body) : body as T
}

/** Single HTTP-test choke point for request construction, runtime response parsing, and contract checks. */
export class ApiTester {
  constructor(
    private readonly app: OpenAPIHono,
    private readonly assertContract?: ContractAssertion,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; schema?: ZodType<T>; headers?: Record<string, string> } = {},
  ): Promise<ApiTestResponse<T>> {
    const response = await this.app.request(path, {
      method,
      headers: { ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...options.headers },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    })
    const result: ApiTestResponse<T> = {
      status: response.status,
      data: await parseBody(response.clone(), options.schema),
      headers: response.headers,
      raw: response,
      method,
      path,
    }
    await this.assertContract?.(result)
    return result
  }

  get<T>(path: string, schema?: ZodType<T>): Promise<ApiTestResponse<T>> { return this.request('GET', path, { schema }) }
  post<T>(path: string, body: unknown, schema?: ZodType<T>): Promise<ApiTestResponse<T>> {
    return this.request('POST', path, { body, schema })
  }
  put<T>(path: string, body: unknown, schema?: ZodType<T>): Promise<ApiTestResponse<T>> {
    return this.request('PUT', path, { body, schema })
  }
  patch<T>(path: string, body: unknown, schema?: ZodType<T>): Promise<ApiTestResponse<T>> {
    return this.request('PATCH', path, { body, schema })
  }
  delete<T>(path: string, schema?: ZodType<T>): Promise<ApiTestResponse<T>> { return this.request('DELETE', path, { schema }) }
}
