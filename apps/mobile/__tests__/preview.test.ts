const originalFlag = process.env.EXPO_PUBLIC_DEMO_MODE;
afterEach(() => {
  process.env.EXPO_PUBLIC_DEMO_MODE = originalFlag;
  jest.restoreAllMocks();
});

it.each([
  [true, 'true', true],
  [true, 'false', false],
  [false, 'true', false],
])('gates preview for development=%s and demo=%s', (development, flag, expected) => {
  process.env.EXPO_PUBLIC_DEMO_MODE = flag;
  jest.replaceProperty(globalThis as typeof globalThis & { __DEV__: boolean }, '__DEV__', development);
  jest.isolateModules(() => {
    const { previewEnabled } = jest.requireActual<typeof import('@/lib/preview')>('@/lib/preview');
    expect(previewEnabled).toBe(expected);
  });
});
