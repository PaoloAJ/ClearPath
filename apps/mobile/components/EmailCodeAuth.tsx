import { useSignIn, useSignUp } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { colors, MIN_TAP_TARGET, spacing } from '@/lib/theme';

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unable to complete the request. Check your connection and try again.';
}

export function EmailCodeAuth({ creatingAccount }: { creatingAccount: boolean }) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const createdEmail = useRef<string | null>(null);

  useEffect(() => {
    // Live regions announce on Android; iOS needs an explicit announcement.
    if (Platform.OS === 'ios' && (error || notice)) AccessibilityInfo.announceForAccessibility(error || notice);
  }, [error, notice]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); } catch (err: unknown) { setError(errorMessage(err)); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function send(resend = false) {
    await run(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.');
      if (creatingAccount) {
        if (!resend && createdEmail.current !== email.trim()) {
          const result = await signUp.create({ emailAddress: email.trim() });
          if (result.error) throw result.error;
          createdEmail.current = email.trim();
        }
        const result = await signUp.verifications.sendEmailCode();
        if (result.error) throw result.error;
      } else {
        const result = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
        if (result.error) throw result.error;
      }
      setSent(true);
      setCode('');
      setNotice(`Code sent to ${email.trim()}. Check your inbox and spam folder.`);
    });
  }

  async function verify() {
    await run(async () => {
      if (!code.trim()) throw new Error('Enter the verification code from your email.');
      if (creatingAccount) {
        const result = await signUp.verifications.verifyEmailCode({ code: code.trim() });
        if (result.error) throw result.error;
        if (signUp.status !== 'complete') throw new Error('Your account needs another step. Ask the project administrator to check the email-code sign-up settings.');
        const final = await signUp.finalize({ navigate: () => { router.replace('/profile'); } });
        if (final.error) throw final.error;
      } else {
        const result = await signIn.emailCode.verifyCode({ code: code.trim() });
        if (result.error) throw result.error;
        if (signIn.status !== 'complete') throw new Error('An additional sign-in step is required. Ask the project administrator for help.');
        const final = await signIn.finalize({ navigate: () => { router.replace('/'); } });
        if (final.error) throw final.error;
      }
    });
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{creatingAccount ? 'Create account' : 'Sign in'}</Text>
        <Text style={styles.text}>Get a verification code by email. No password needed.</Text>
        <Text style={styles.text}>{sent ? `Enter the code sent to ${email.trim()}.` : 'Email address'}</Text>
        {sent ? (
          <TextInput key="code" accessibilityLabel="Verification code" style={styles.input} value={code} onChangeText={setCode}
            editable={!busy} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
            autoFocus onSubmitEditing={() => { void verify(); }} />
        ) : (
          <TextInput key="email" accessibilityLabel="Email address" style={styles.input} value={email} onChangeText={setEmail}
            editable={!busy} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            autoComplete="email" textContentType="emailAddress" onSubmitEditing={() => { void send(); }} />
        )}
        <BigButton label={busy ? 'Please wait…' : sent ? 'Verify code' : 'Send code'} disabled={busy}
          accessibilityState={{ disabled: busy, busy }} onPress={() => { if (sent) void verify(); else void send(); }} />
        {sent && <>
          <BigButton label="Send a new code" variant="secondary" disabled={busy} onPress={() => { void send(true); }} />
          <BigButton label="Use a different email" variant="secondary" disabled={busy}
            onPress={() => { setSent(false); setCode(''); setError(''); setNotice(''); }} />
        </>}
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text> : null}
        {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        <BigButton label={creatingAccount ? 'Already have an account? Sign in' : 'Create an account'} variant="secondary"
          disabled={busy} onPress={() => router.replace(creatingAccount ? '/sign-in' : '/sign-up')} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  text: { fontSize: 18, color: colors.text },
  input: { minHeight: MIN_TAP_TARGET, minWidth: MIN_TAP_TARGET, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: spacing.md, fontSize: 18, color: colors.text, backgroundColor: colors.background },
  error: { fontSize: 18, color: colors.statusOut },
});
