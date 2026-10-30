import { EmailCodeAuth } from '@/components/EmailCodeAuth';

export default function SignInScreen() {
  return <EmailCodeAuth creatingAccount={false} />;
}
