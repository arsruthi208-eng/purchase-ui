/** Returns today's date as an ISO-8601 date string (YYYY-MM-DD). */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
