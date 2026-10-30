import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { EmailCodeAuth } from '@/components/EmailCodeAuth';

const mockReplace = jest.fn();
const mockSignIn = {
  emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
  status: 'complete',
  finalize: jest.fn(),
};
const mockSignUp = {
  create: jest.fn(),
  verifications: { sendEmailCode: jest.fn(), verifyEmailCode: jest.fn() },
  status: 'complete',
  finalize: jest.fn(),
};

jest.mock('@clerk/expo', () => ({
  useSignIn: () => ({ signIn: mockSignIn }),
  useSignUp: () => ({ signUp: mockSignUp }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.status = 'complete';
  mockSignUp.status = 'complete';
  for (const fn of [mockSignIn.emailCode.sendCode, mockSignIn.emailCode.verifyCode,
    mockSignUp.create, mockSignUp.verifications.sendEmailCode, mockSignUp.verifications.verifyEmailCode]) {
    fn.mockResolvedValue({ error: null });
  }
  for (const fn of [mockSignIn.finalize, mockSignUp.finalize]) {
    fn.mockImplementation(async ({ navigate }: { navigate: () => void }) => { navigate(); return { error: null }; });
  }
});

async function requestCode(creatingAccount = false) {
  await render(<EmailCodeAuth creatingAccount={creatingAccount} />);
  await fireEvent.changeText(screen.getByLabelText('Email address'), ' student@ufl.edu ');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByLabelText('Verification code');
}

async function verifyCode() {
  await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Verify code' }));
}

it('sends a trimmed email and signs a returning user in to the map', async () => {
  await requestCode();
  expect(mockSignIn.emailCode.sendCode).toHaveBeenCalledWith({ emailAddress: 'student@ufl.edu' });
  await verifyCode();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(mockSignIn.emailCode.verifyCode).toHaveBeenCalledWith({ code: '123456' });
});

it('creates an account and hands off to profile setup after verification', async () => {
  await requestCode(true);
  expect(mockSignUp.create).toHaveBeenCalledWith({ emailAddress: 'student@ufl.edu' });
  await verifyCode();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/profile'));
});

it('keeps an invalid code on screen and permits retry', async () => {
  await requestCode();
  mockSignIn.emailCode.verifyCode.mockResolvedValueOnce({ error: new Error('Code is incorrect or expired.') });
  await verifyCode();
  await screen.findByText('Code is incorrect or expired.');
  expect(mockSignIn.finalize).not.toHaveBeenCalled();
  await verifyCode();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

it('resends a sign-up code without creating the account again', async () => {
  await requestCode(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
  await waitFor(() => expect(mockSignUp.verifications.sendEmailCode).toHaveBeenCalledTimes(2));
  expect(mockSignUp.create).toHaveBeenCalledTimes(1);
});

it('allows changing email and clears the previous code', async () => {
  await requestCode();
  await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));
  expect(screen.getByLabelText('Email address')).toBeTruthy();
  expect(screen.queryByLabelText('Verification code')).toBeNull();
});

it('does not activate an incomplete sign-in', async () => {
  await requestCode();
  mockSignIn.status = 'needs_second_factor';
  await verifyCode();
  await screen.findByText('An additional sign-in step is required. Ask the project administrator for help.');
  expect(mockSignIn.finalize).not.toHaveBeenCalled();
});

it('validates email before contacting Clerk', async () => {
  await render(<EmailCodeAuth creatingAccount={false} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByText('Enter a valid email address.');
  expect(mockSignIn.emailCode.sendCode).not.toHaveBeenCalled();
});

it('shows network failures and allows requesting a code again', async () => {
  mockSignIn.emailCode.sendCode.mockRejectedValueOnce(new Error('Network unavailable'));
  await render(<EmailCodeAuth creatingAccount={false} />);
  await fireEvent.changeText(screen.getByLabelText('Email address'), 'student@ufl.edu');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByText('Network unavailable');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByLabelText('Verification code');
});

it('retries sending after sign-up creation succeeded without recreating the account', async () => {
  mockSignUp.verifications.sendEmailCode.mockResolvedValueOnce({ error: { message: 'Try sending again.' } });
  await render(<EmailCodeAuth creatingAccount />);
  await fireEvent.changeText(screen.getByLabelText('Email address'), 'student@ufl.edu');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByText('Try sending again.');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByLabelText('Verification code');
  expect(mockSignUp.create).toHaveBeenCalledTimes(1);
});

it('prevents duplicate requests while waiting for Clerk', async () => {
  let finish: ((value: { error: null }) => void) | undefined;
  mockSignIn.emailCode.sendCode.mockReturnValueOnce(new Promise<{ error: null }>((resolve) => { finish = resolve; }));
  await render(<EmailCodeAuth creatingAccount={false} />);
  await fireEvent.changeText(screen.getByLabelText('Email address'), 'student@ufl.edu');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Please wait…' }));
  expect(mockSignIn.emailCode.sendCode).toHaveBeenCalledTimes(1);
  finish?.({ error: null });
  await screen.findByLabelText('Verification code');
});

it('does not activate an incomplete sign-up', async () => {
  await requestCode(true);
  mockSignUp.status = 'missing_requirements';
  await verifyCode();
  await screen.findByText('Your account needs another step. Ask the project administrator to check the email-code sign-up settings.');
  expect(mockSignUp.finalize).not.toHaveBeenCalled();
});
