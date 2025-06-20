import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { register } from '../api/auth'; // Import backend register
import { Spacing, Colors, Radii, Shadows } from '../constants/designTokens';
import Typography from './common/Typography';
import Input from './common/Input';
import Button from './common/Button';

const SignUp = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      // Create user with email and password using Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Send email verification
      await sendEmailVerification(user);

      // Sign out the user immediately after sending verification email to prevent automatic login
      await auth.signOut();

      // Register user in your backend
      await register(firstName, lastName, email, password, zipCode);

      setMessage('Registration successful! A verification email has been sent to your email address. Please verify your email before logging in.');
      navigate('/login'); // Redirect to login page after successful registration and email sent
    } catch (err) {
      console.error('Registration error:', err);
      let errorMessage = 'An error occurred during registration.';
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'That email address is already in use!';
            break;
          case 'auth/invalid-email':
            errorMessage = 'That email address is invalid!';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Please enable them in the Firebase console.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The password is too weak.';
            break;
          default:
            errorMessage = err.message;
            break;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.formContainer}>
        <Typography variant="h3" style={styles.header}>Sign Up</Typography>
        <Typography variant="subtitle1" style={styles.subtitle}>
          Join RateDeed to connect with top contractors and manage your projects.
        </Typography>
        <form onSubmit={handleSignUp} style={styles.form}>
          <Input
            label="First Name"
            type="text"
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoCapitalize="words"
            style={styles.inputField}
          />
          <Input
            label="Last Name"
            type="text"
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoCapitalize="words"
            style={styles.inputField}
          />
          <Input
            label="Email"
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.inputField}
          />
          <Input
            label="Password"
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            secureTextEntry
            style={styles.inputField}
          />
          <Input
            label="Confirm Password"
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            secureTextEntry
            style={styles.inputField}
          />
          <Input
            label="Zip Code (Optional)"
            type="text"
            id="zipCode"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            keyboardType="numeric"
            style={styles.inputField}
          />
          {error && <Typography variant="body" style={styles.error}>{error}</Typography>}
          {message && <Typography variant="body" style={styles.message}>{message}</Typography>}
          <Button type="submit" title="Sign Up" onPress={handleSignUp} loading={loading} style={styles.registerButton} />
        </form>
        <Typography variant="body" style={styles.linkText}>
          Already have an account? <span style={styles.link} onClick={() => navigate('/login')}>Login</span>
        </Typography>
        <Typography variant="body" style={styles.linkText}>
          Are you a contractor? <span style={styles.link} onClick={() => navigate('/contractor-signup')}>Sign Up as a Contractor</span>
        </Typography>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: Colors.neutral100,
    padding: Spacing.lg,
    fontFamily: 'Arial, sans-serif',
  },
  formContainer: {
    backgroundColor: Colors.neutral50,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    boxShadow: Shadows.md.boxShadow,
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    marginBottom: Spacing.xs,
    color: Colors.neutral900,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: Spacing.xl,
    color: Colors.neutral600,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  form: {
    width: '100%',
  },
  inputField: {
    marginBottom: Spacing.md,
  },
  registerButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    width: '100%',
  },
  error: {
    color: Colors.error500,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  message: {
    color: Colors.success500,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  linkText: {
    marginTop: Spacing.md,
    color: Colors.neutral700,
  },
  link: {
    color: Colors.primary500,
    cursor: 'pointer',
    textDecoration: 'underline',
    fontWeight: '700',
  },
};

export default SignUp;