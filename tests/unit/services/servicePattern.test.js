describe('patrón de servicio con DI', () => {
  function createUserService(api = window.electronAPI) {
    return {
      async fetchUsers(filters) {
        return api.invoke('users:fetch', filters);
      }
    };
  }

  test('delegación a window.electronAPI.invoke', async () => {
    const svc = createUserService();
    const result = await svc.fetchUsers({ group: 'B' });
    expect(window.electronAPI.invoke).toHaveBeenCalledWith('users:fetch', { group: 'B' });
    expect(result).toEqual({ channel: 'users:fetch', args: [{ group: 'B' }] });
  });

  test('permite inyectar mock propio', async () => {
    const fake = { invoke: jest.fn().mockResolvedValue({ ok: true }) };
    const svc = createUserService(fake);
    const out = await svc.fetchUsers({});
    expect(fake.invoke).toHaveBeenCalled();
    expect(out).toEqual({ ok: true });
  });
});

