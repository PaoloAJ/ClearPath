const originalPreview = process.env.EXPO_PUBLIC_FIXTURE_PREVIEW;
const originalDemo = process.env.EXPO_PUBLIC_DEMO_MODE;
afterEach(() => {
  process.env.EXPO_PUBLIC_FIXTURE_PREVIEW = originalPreview;
  process.env.EXPO_PUBLIC_DEMO_MODE = originalDemo;
  jest.restoreAllMocks();
});

it.each([
  [true, 'true', 'false', true],
  [true, 'false', 'true', false],
  [true, undefined, 'true', false],
  [false, 'true', 'true', false],
])('gates fixture preview for development=%s preview=%s demo=%s', (development, preview, demo, expected) => {
  if (preview === undefined) delete process.env.EXPO_PUBLIC_FIXTURE_PREVIEW;
  else process.env.EXPO_PUBLIC_FIXTURE_PREVIEW = preview;
  process.env.EXPO_PUBLIC_DEMO_MODE = demo;
  jest.replaceProperty(globalThis as typeof globalThis & { __DEV__: boolean }, '__DEV__', development);
  jest.isolateModules(() => {
    const { previewEnabled } = jest.requireActual<typeof import('@/lib/preview')>('@/lib/preview');
    expect(previewEnabled).toBe(expected);
  });
});
