describe('window.electronAPI mock', () => {
  test('está disponible y con métodos básicos', () => {
    expect(window).toBeDefined();
    expect(window.electronAPI).toBeDefined();
    expect(typeof window.electronAPI.invoke).toBe('function');
    expect(typeof window.electronAPI.send).toBe('function');
  });

  test('invoke devuelve una promesa con canal y args', async () => {
    const res = await window.electronAPI.invoke('users:fetch', { group: 'A' });
    expect(res).toEqual({ channel: 'users:fetch', args: [{ group: 'A' }] });
    expect(window.electronAPI.invoke).toHaveBeenCalledWith('users:fetch', { group: 'A' });
  });
});

