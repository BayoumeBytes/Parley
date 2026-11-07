import { ApiError, ApiService } from './api.service';

describe('ApiService', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses credentialed JSON requests', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: [] }) });
    vi.stubGlobal('fetch', fetch);
    await new ApiService().request('conv/getuserrooms', {});
    expect(fetch).toHaveBeenCalledWith(
      '/api/conv/getuserrooms',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: '{}',
      }),
    );
  });
  it('preserves endpoint errors and authentication status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      }),
    );
    await expect(new ApiService().request('auth/logout', {})).rejects.toMatchObject({
      message: 'Unauthorized',
      status: 401,
    });
  });
  it('handles legacy service errors in successful HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ error: 'Room is not a group' }),
      }),
    );
    await expect(new ApiService().request('conv/addmembers', {})).rejects.toThrow(
      'Room is not a group',
    );
  });
  it('reports unreachable services without leaking low-level errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(new ApiService().request('conv/getuserrooms', {})).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
