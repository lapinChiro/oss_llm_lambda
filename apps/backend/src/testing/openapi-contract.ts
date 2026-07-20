import type { Document } from 'openapi-backend'

import addFormatsModule from 'ajv-formats'
import { OpenAPIBackend } from 'openapi-backend'

const addFormats = addFormatsModule.default

export async function createContractValidator(document: Document): Promise<OpenAPIBackend> {
  const validator = new OpenAPIBackend({
    definition: document,
    customizeAjv: (ajv) => {
      addFormats(ajv)
      return ajv
    },
  })
  await validator.init()
  return validator
}

export function assertResponseMatchesContract(params: {
  validator: OpenAPIBackend
  method: string
  path: string
  status: number
  body: unknown
}): void {
  const operation = params.validator.matchOperation({ method: params.method, path: params.path, headers: {} })
  if (!operation) throw new Error(`No OpenAPI operation matched ${params.method.toUpperCase()} ${params.path}`)
  if (!operation.responses || !(String(params.status) in operation.responses)) {
    throw new Error(`Response status ${params.status} is not declared for ${params.path}`)
  }
  const result = params.validator.validateResponse(params.body, operation, params.status)
  if (!result.valid) throw new Error(`Response does not satisfy OpenAPI: ${JSON.stringify(result.errors)}`)
}
