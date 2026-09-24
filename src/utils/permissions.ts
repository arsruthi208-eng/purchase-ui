/**
 * Returns true if the error was caused by a 403 Forbidden response,
 * meaning the current user's role doesn't have access to that operation.
 */
export function isForbiddenError(e: unknown): boolean {
  return (e as any)?.httpStatus === 403
}

/**
 * Standard user-facing message shown whenever a 403 is caught.
 */
export const PERMISSION_DENIED_MSG =
  "Your role doesn't have permission to perform this action. Contact Admin to update your access."
