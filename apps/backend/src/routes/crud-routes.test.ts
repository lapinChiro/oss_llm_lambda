import { buildCrudErrorResponses } from './crud-routes.js'

describe('CRUD route contract composition', () => {
  it('keeps operation-specific validation/not-found responses symmetric', () => {
    const ascending = (left: number, right: number): number => left - right
    expect(Object.keys(buildCrudErrorResponses('getAll')).map(Number).sort(ascending)).toEqual([500])
    expect(Object.keys(buildCrudErrorResponses('create')).map(Number).sort(ascending)).toEqual([400, 500])
    expect(Object.keys(buildCrudErrorResponses('getById')).map(Number).sort(ascending)).toEqual([400, 404, 500])
    expect(Object.keys(buildCrudErrorResponses('update', { 409: { description: 'Conflict' } })).map(Number).sort(ascending))
      .toEqual([400, 404, 409, 500])
    expect(Object.keys(buildCrudErrorResponses('delete')).map(Number).sort(ascending)).toEqual([400, 404, 500])
  })
})
