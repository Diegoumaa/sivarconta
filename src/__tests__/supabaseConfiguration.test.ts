import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clientFactory = vi.hoisted(() => vi.fn(() => ({ configured: true })));
vi.mock('@supabase/supabase-js', () => ({ createClient: clientFactory }));

beforeEach(() => { vi.resetModules(); clientFactory.mockClear(); });
afterEach(() => vi.unstubAllEnvs());

describe('Explicit cloud configuration', () => {
  it('keeps a clean checkout isolated from the shared database', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const module = await import('../lib/supabase');
    expect(module.isSupabaseConfigured).toBe(false);
    expect(module.supabase).toBeNull();
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it.each(['https://', 'not a url', 'http://example.supabase.co', 'https://tu-proyecto.supabase.co'])(
    'does not initialize a cloud client for invalid configuration %s', async url => {
      vi.stubEnv('VITE_SUPABASE_URL', url);
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-public-key');
      const module = await import('../lib/supabase');
      expect(module.isSupabaseConfigured).toBe(false);
      expect(clientFactory).not.toHaveBeenCalled();
    });

  it('initializes only the explicitly configured project', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-public-key');
    const module = await import('../lib/supabase');
    expect(module.isSupabaseConfigured).toBe(true);
    expect(clientFactory).toHaveBeenCalledWith('https://example.supabase.co', 'test-public-key', expect.any(Object));
  });
});
