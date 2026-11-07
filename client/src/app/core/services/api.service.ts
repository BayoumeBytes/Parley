import { Injectable } from '@angular/core';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  async request<T>(path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError('Cannot reach Parley. Check your connection and try again.', 0);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      throw new ApiError(
        data.error || data.message || 'Something went wrong. Please try again.',
        response.status,
        data.code,
      );
    }
    return data as T;
  }
}
