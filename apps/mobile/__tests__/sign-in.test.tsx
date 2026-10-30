import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/(auth)/sign-in';

const mockPrepareFirstFactor = jest.fn();
const mockAttemptFirstFactor = jest.fn();
const mockCreate = jest.fn();
const mockSetActive = jest.fn();
const mockReplace = jest.fn();

jest.mock('@clerk/expo/legacy', () => ({
  useSignIn: () => ({
    isLoaded: true,
    setActive: mockSetActive,
    signIn: {
      create: mockCreate,
      prepareFirstFactor: mockPrepareFirstFactor,
      attemptFirstFactor: mockAttemptFirstFactor,
    },
  }),
}));

jest.mock('@clerk/expo', () => ({
  isClerkAPIResponseError: () => false,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SignInScreen (email code)', () => {
  it('sends a code and moves to the verify step when the account supports email_code', async () => {
    mockCreate.mockResolvedValue({
      supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    mockPrepareFirstFactor.mockResolvedValue({});

    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'gator@ufl.edu');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByText(/Check your email/i)).toBeTruthy());
    expect(mockCreate).toHaveBeenCalledWith({ identifier: 'gator@ufl.edu' });
    expect(mockPrepareFirstFactor).toHaveBeenCalledWith({ strategy: 'email_code', emailAddressId: 'idn_1' });
  });

  it('trims the email before sending it to Clerk', async () => {
    mockCreate.mockResolvedValue({ supportedFirstFactors: [] });

    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), '  gator@ufl.edu  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ identifier: 'gator@ufl.edu' }));
  });

  it('signs in on a complete attempt and lands on the map', async () => {
    mockCreate.mockResolvedValue({
      supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    mockPrepareFirstFactor.mockResolvedValue({});
    mockAttemptFirstFactor.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_1' });

    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'gator@ufl.edu');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => screen.getByText(/Check your email/i));

    await fireEvent.changeText(screen.getByLabelText('Verification code'), '424242');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_1' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('explains needs_second_factor instead of leaving the user stuck', async () => {
    mockCreate.mockResolvedValue({
      supportedFirstFactors: [{ strategy: 'email_code', emailAddressId: 'idn_1' }],
    });
    mockPrepareFirstFactor.mockResolvedValue({});
    mockAttemptFirstFactor.mockResolvedValue({ status: 'needs_second_factor', createdSessionId: null });

    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'gator@ufl.edu');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => screen.getByText(/Check your email/i));

    await fireEvent.changeText(screen.getByLabelText('Verification code'), '424242');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText(/second verification step/i)).toBeTruthy());
    expect(mockSetActive).not.toHaveBeenCalled();
  });
});
