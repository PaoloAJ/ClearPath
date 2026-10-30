import { useSignUp } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { FormError } from '@/components/FormError';
import { FormStatus } from '@/components/FormStatus';
import { firstClerkErrorMessage } from '@/lib/clerkError';
import { authStyles } from '@/lib/authStyles';

type Stage = 'identify' | 'verify';
type SignUpResult = { status: string | null; createdSessionId: string | null };

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('identify');
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function finish(result: SignUpResult) {
    if (result.status !== 'complete' || !result.createdSessionId || !setActive) {
      setError('Could not complete sign-up. Please try again.');
      return;
    }
    await setActive({ session: result.createdSessionId });
    // TODO(frontend): route to profile setup (AGENT1 backlog, M1) once that screen
    // exists, instead of the map. No `profiles` row is created here yet.
    router.replace('/');
  }

  async function onSubmit() {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signUp.create({ emailAddress: emailAddress.trim() });
      if (attempt.status === 'complete') {
        await finish(attempt);
        return;
      }
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStage('verify');
    } catch (err) {
      setError(firstClerkErrorMessage(err) ?? 'Could not create account. Please try again.');
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
      const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      await finish(attempt);
    } catch (err) {
      setError(firstClerkErrorMessage(err) ?? 'Verification failed. Check the code and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (!isLoaded || submitting) return;
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
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

        <BigButton label={submitting ? 'Verifying…' : 'Verify'} onPress={onVerify} disabled={submitting} />
        <BigButton label="Resend code" variant="secondary" onPress={onResend} disabled={submitting} />
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
        Create account
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

      <BigButton label={submitting ? 'Creating…' : 'Create account'} onPress={onSubmit} disabled={submitting} />

      <Link href="/sign-in" style={authStyles.link}>
        <Text style={authStyles.linkText}>Already have an account? Sign in</Text>
      </Link>
    </View>
  );
}
