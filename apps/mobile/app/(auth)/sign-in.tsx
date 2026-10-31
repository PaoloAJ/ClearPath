import { useSignIn } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { FormError } from '@/components/FormError';
import { FormStatus } from '@/components/FormStatus';
import { firstClerkErrorMessage } from '@/lib/clerkError';
import { authStyles } from '@/lib/authStyles';

type Stage = 'identify' | 'verify';

/** What Clerk needs next, in words a user can act on (none of these are dead ends). */
function describeStatus(status: string | null): string {
  switch (status) {
    case 'needs_second_factor':
      return 'This account needs a second verification step that this app does not support yet. Contact support.';
    case 'needs_new_password':
      return 'Your password needs to be reset. Use the web app to reset it, then try again.';
    case 'needs_client_trust':
      return "We don't recognize this device. Check your email for a verification link, then try again.";
    default:
      return 'Could not complete sign-in. Please try again.';
  }
}

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('identify');
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmitIdentifier() {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({ identifier: emailAddress.trim() });
      const emailFactor = attempt.supportedFirstFactors?.find(
        (factor): factor is typeof factor & { emailAddressId: string } =>
          factor.strategy === 'email_code' && 'emailAddressId' in factor,
      );
      if (!emailFactor) {
        setError('Email code sign-in is not available for this account.');
        return;
      }
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailFactor.emailAddressId });
      setEmailAddressId(emailFactor.emailAddressId);
      setStage('verify');
    } catch (err) {
      setError(firstClerkErrorMessage(err) ?? 'Could not find that account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerify() {
    if (!isLoaded || submitting) return;
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.attemptFirstFactor({ strategy: 'email_code', code: code.trim() });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/');
        return;
      }
      setError(describeStatus(attempt.status));
    } catch (err) {
      setError(firstClerkErrorMessage(err) ?? 'That code did not work. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (!isLoaded || submitting || !emailAddressId) return;
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId });
      setStatus(`We sent a new code to ${emailAddress}.`);
    } catch (err) {
      setError(firstClerkErrorMessage(err) ?? 'Could not resend the code. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function onEditEmail() {
    setStage('identify');
    setCode('');
    setError(null);
    setStatus(null);
  }

  if (stage === 'verify') {
    return (
      <View style={authStyles.container}>
        <Text accessibilityRole="header" style={authStyles.title}>
          Check your email
        </Text>
        <Text style={authStyles.body}>We sent a code to {emailAddress}.</Text>

        <View style={authStyles.field}>
          <Text style={authStyles.label}>Verification code</Text>
          <TextInput
            style={authStyles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            accessibilityLabel="Verification code"
          />
        </View>

        <FormError message={error} />
        <FormStatus message={error ? null : status} />

        <BigButton label={submitting ? 'Signing in…' : 'Sign in'} onPress={onVerify} disabled={submitting} />
        <BigButton
          label="Resend code"
          variant="secondary"
          onPress={onResend}
          disabled={submitting}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use a different email"
          onPress={onEditEmail}
          style={authStyles.link}
        >
          <Text style={authStyles.linkText}>Use a different email</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={authStyles.container}>
      <Text accessibilityRole="header" style={authStyles.title}>
        Sign in
      </Text>

      <View style={authStyles.field}>
        <Text style={authStyles.label}>Email</Text>
        <TextInput
          style={authStyles.input}
          value={emailAddress}
          onChangeText={setEmailAddress}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          accessibilityLabel="Email"
        />
      </View>

      <FormError message={error} />

      <BigButton
        label={submitting ? 'Sending code…' : 'Continue'}
        onPress={onSubmitIdentifier}
        disabled={submitting}
      />

      <Link href="/sign-up" style={authStyles.link}>
        <Text style={authStyles.linkText}>Need an account? Create one</Text>
      </Link>
    </View>
  );
}
