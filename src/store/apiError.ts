import type { ApiError } from '@/server/api-contract';

// Narrows an unknown RTK Query error to the body the API actually sends.
function apiErrorOf(error: unknown): ApiError | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null;

  const body = (error as { data: unknown }).data;
  if (typeof body !== 'object' || body === null || !('message' in body)) return null;

  return body as ApiError;
}

/**
 * Turns a failed request into something worth showing an operator.
 *
 * The API sends a remedy with the errors that have one, and dropping it would
 * leave the interface saying only that something went wrong — which is the
 * message this project set out not to show.
 */
export function apiErrorMessage(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined;

  const body = apiErrorOf(error);
  if (body === null) return 'That request did not go through. Try again.';

  return body.remedy === undefined ? body.message : `${body.message} ${body.remedy}`;
}
