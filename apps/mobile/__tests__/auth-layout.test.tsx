import { render } from '@testing-library/react-native';

import AuthLayout from '@/app/(auth)/_layout';

const mockRedirect = jest.fn<null, [unknown]>(() => null);
const mockStack = jest.fn(() => null);
let mockAuth = { isLoaded: true, isSignedIn: true };
let mockSegments = ['(auth)', 'sign-up'];

jest.mock('@clerk/expo', () => ({ useAuth: () => mockAuth }));
jest.mock('expo-router', () => ({
  Redirect: (props: unknown) => mockRedirect(props),
  Stack: () => mockStack(),
  useSegments: () => mockSegments,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isLoaded: true, isSignedIn: true };
  mockSegments = ['(auth)', 'sign-up'];
});

it('preserves the profile handoff if the session activates before sign-up unmounts', async () => {
  await render(<AuthLayout />);
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/profile' });
});

it('sends a signed-in returning user to the map', async () => {
  mockSegments = ['(auth)', 'sign-in'];
  await render(<AuthLayout />);
  expect(mockRedirect).toHaveBeenCalledWith({ href: '/' });
});

it('waits for Clerk to load without redirecting', async () => {
  mockAuth.isLoaded = false;
  await render(<AuthLayout />);
  expect(mockRedirect).not.toHaveBeenCalled();
  expect(mockStack).not.toHaveBeenCalled();
});

it('keeps authentication screens available while signed out', async () => {
  mockAuth.isSignedIn = false;
  await render(<AuthLayout />);
  expect(mockStack).toHaveBeenCalled();
  expect(mockRedirect).not.toHaveBeenCalled();
});
