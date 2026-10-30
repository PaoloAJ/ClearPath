import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import SignUpScreen from '@/app/(auth)/sign-up';

const mockCreate = jest.fn();
const mockPrepareEmailAddressVerification = jest.fn();
const mockAttemptEmailAddressVerification = jest.fn();
const mockSetActive = jest.fn();
const mockReplace = jest.fn();

jest.mock('@clerk/expo/legacy', () => ({
  useSignUp: () => ({
    isLoaded: true,
    setActive: mockSetActive,
    signUp: {
      create: mockCreate,
      prepareEmailAddressVerification: mockPrepareEmailAddressVerification,
      attemptEmailAddressVerification: mockAttemptEmailAddressVerification,
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

describe('SignUpScreen (email code)', () => {
  it('prepares email verification and moves to the verify step', async () => {
    mockCreate.mockResolvedValue({ status: 'missing_requirements' });
    mockPrepareEmailAddressVerification.mockResolvedValue({});

    await render(<SignUpScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'gator@ufl.edu');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByText(/Check your email/i)).toBeTruthy());
    expect(mockCreate).toHaveBeenCalledWith({ emailAddress: 'gator@ufl.edu' });
    expect(mockPrepareEmailAddressVerification).toHaveBeenCalledWith({ strategy: 'email_code' });
  });

  it('signs up immediately when create already returns complete, skipping verification', async () => {
    mockCreate.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_1' });

    await render(<SignUpScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'gator@ufl.edu');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_1' }));
    expect(mockPrepareEmailAddressVerification).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('verifies the trimmed code and completes sign-up', async () => {
    mockCreate.mockResolvedValue({ status: 'missing_requirements' });
    mockPrepareEmailAddressVerification.mockResolvedValue({});
    mockAttemptEmailAddressVerification.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_2' });

    await render(<SignUpScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'gator@ufl.edu');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => screen.getByText(/Check your email/i));

    await fireEvent.changeText(screen.getByLabelText('Verification code'), ' 424242 ');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(mockAttemptEmailAddressVerification).toHaveBeenCalledWith({ code: '424242' }));
    expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_2' });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('can resend the code from the verify step', async () => {
    mockCreate.mockResolvedValue({ status: 'missing_requirements' });
    mockPrepareEmailAddressVerification.mockResolvedValue({});

    await render(<SignUpScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'gator@ufl.edu');
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => screen.getByText(/Check your email/i));

    await fireEvent.press(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(mockPrepareEmailAddressVerification).toHaveBeenCalledTimes(2));
  });
});
