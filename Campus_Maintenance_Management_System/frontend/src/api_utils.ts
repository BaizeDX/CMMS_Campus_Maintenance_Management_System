const API = '/api';

interface ApiError {
  error?: string;
}

type RequestOptions = Omit<RequestInit, 'body' | 'method'>;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = `API error: ${res.statusText}`;
    try {
      const err: ApiError = await res.json();
      if (err.error) {
        errorMessage = err.error;
      }
    } catch {
      // If JSON parsing fails, use the default error message
    }
    throw new Error(errorMessage);
  }
  return res.json();
}

export async function get<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API}${endpoint}`, {
    credentials: 'same-origin'
  });
  return handleResponse<T>(res);
}

export async function post<T>(endpoint: string, data: unknown, options: RequestOptions = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify(data)
  });
  return handleResponse<T>(res);
}

export async function put<T>(endpoint: string, data: unknown): Promise<T> {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse<T>(res);
}

export async function del<T>(endpoint: string, data?: unknown): Promise<T> {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined
  });
  return handleResponse<T>(res);
}
