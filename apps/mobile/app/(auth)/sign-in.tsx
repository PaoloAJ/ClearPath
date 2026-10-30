import { EmailCodeAuth } from '@/components/EmailCodeAuth';

// TODO(frontend): optional Google sign-in with UF accounts.
export default function SignInScreen() {
  return <EmailCodeAuth creatingAccount={false} />;
}
