describe('helpers de timers', () => {
  function debounce(fn, waitMs) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), waitMs);
    };
  }

  test('advanceAll permite resolver debounce sin esperas reales', async () => {
    const spy = jest.fn();
    const db = debounce(spy, 250);
    db('a');
    db('b');
    await global.advanceAll();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('b');
  });
});

