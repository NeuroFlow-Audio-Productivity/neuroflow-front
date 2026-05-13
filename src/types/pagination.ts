export type PaginationQuery = {
  [key: string]: string | number | boolean | null | undefined | Array<string | null>
  page?: number
  per_page?: number
}

export type PaginationMeta = {
  currentPage: number
  from: number | null
  lastPage: number
  perPage: number
  to: number | null
  total: number
}

type PaginationNumber = number | string | null | undefined

export type PaginatedResponse<T> = {
  data: T[]
  meta?: {
    current_page?: PaginationNumber
    from?: PaginationNumber
    last_page?: PaginationNumber
    per_page?: PaginationNumber
    to?: PaginationNumber
    total?: PaginationNumber
  }
  current_page?: PaginationNumber
  from?: PaginationNumber
  last_page?: PaginationNumber
  per_page?: PaginationNumber
  to?: PaginationNumber
  total?: PaginationNumber
}

const toNumber = (value: PaginationNumber, fallback: number) => {
  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : fallback
}

const toNullableNumber = (value: PaginationNumber) => {
  if (value === null || value === undefined) return null

  const numberValue = Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

export const paginationMetaFromResponse = <T>(
  response: PaginatedResponse<T>,
  fallbackCount = response.data.length,
): PaginationMeta => {
  const source = response.meta ?? response
  const perPage = Math.max(1, toNumber(source.per_page, Math.max(1, fallbackCount)))
  const total = Math.max(0, toNumber(source.total, fallbackCount))
  const lastPage = Math.max(1, toNumber(source.last_page, Math.ceil(total / perPage) || 1))
  const currentPage = Math.min(
    lastPage,
    Math.max(1, toNumber(source.current_page, response.data.length > 0 ? 1 : 1)),
  )
  const from = toNullableNumber(source.from) ?? (total > 0 ? (currentPage - 1) * perPage + 1 : null)
  const to = toNullableNumber(source.to) ?? (from === null ? null : from + response.data.length - 1)

  return {
    currentPage,
    from,
    lastPage,
    perPage,
    to,
    total,
  }
}
