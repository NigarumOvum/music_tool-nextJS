import { NextResponse } from "next/server";

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 500, details?: unknown) {
  const resolvedStatus = status === 500 && message === "Unauthorized" ? 401 : status;
  return NextResponse.json(
    {
      error: message,
      details: details ?? null,
    },
    { status: resolvedStatus },
  );
}

export async function parseJsonBody<T>(request: Request, fallback: T): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return fallback;
  }
}