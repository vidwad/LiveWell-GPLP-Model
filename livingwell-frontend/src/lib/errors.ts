interface PydanticError {
  msg: string;
  loc?: (string | number)[];
  type?: string;
}

/**
 * Extract a human-readable message from any API error shape:
 * - FastAPI 422: { detail: [{msg, loc, type, input}] }
 * - FastAPI 400/401/404: { detail: "string" }
 * - Network errors / unknown
 */
export function getApiErrorMessage(err: unknown, fallback = "An error occurred"): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;

  if (!detail) return fallback;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return (detail as PydanticError[])
      .map((e) => e.msg ?? JSON.stringify(e))
      .join("; ");
  }

  return fallback;
}
