import { useSignIn } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BigButton } from '@/components/BigButton';
import { colors, spacing } from '@/lib/theme';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (!isLoaded || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({ identifier: emailAddress, password });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/');
      } else {
        setError('Could not complete sign-in. Please try again.');
      }
    } catch (err) {
      setError(firstClerkError(err) ?? 'Sign-in failed. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Sign in
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={emailAddress}
          onChangeText={setEmailAddress}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          accessibilityLabel="Email"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          accessibilityLabel="Password"
        />
      </View>

      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      <BigButton
        label={submitting ? 'Signing in…' : 'Sign in'}
        onPress={onSubmit}
        disabled={submitting}
      />

      <Link href="/sign-up" style={styles.link}>
        <Text style={styles.linkText}>Need an account? Create one</Text>
      </Link>
    </View>
  );
}

function firstClerkError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'errors' in err) {
    const errors = (err as { errors?: { message?: string }[] }).errors;
    return errors?.[0]?.message;
  }
  return undefined;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  field: { gap: spacing.xs },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  error: { fontSize: 16, fontWeight: '600', color: colors.statusOut },
  link: { marginTop: spacing.sm, minHeight: 48, justifyContent: 'center' },
  linkText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
});
