interface ApiErrorBody {
  message?: unknown
  code?: unknown
  requestId?: unknown
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {}
  try {
    body = await response.json() as ApiErrorBody
  } catch {
    // A non-JSON gateway failure still becomes the same typed transport error.
  }
  return new ApiError(
    typeof body.message === 'string' ? body.message : `Request failed with status ${response.status}`,
    typeof body.code === 'string' ? body.code : 'HTTP_ERROR',
    response.status,
    typeof body.requestId === 'string' ? body.requestId : undefined,
  )
}
