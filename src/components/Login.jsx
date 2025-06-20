import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { backendLoginFirebase, syncEmailVerificationStatus } from '../api/auth';
import { Spacing, Colors, Radii, Shadows } from '../constants/designTokens'; // Import design tokens
import Typography from './common/Typography'; // Assuming a Typography component exists
import Input from './common/Input'; // Assuming an Input component exists
import Button from './common/Button'; // Assuming a Button component exists

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        console.log('Login.jsx: User logged in via Firebase. user.emailVerified:', user.emailVerified);
        const idToken = await user.getIdToken();
        const backendResponse = await backendLoginFirebase(idToken, email);

        if (backendResponse) {
          if (user.emailVerified) {
            setMessage('Login successful! Email is verified.');
            await syncEmailVerificationStatus(idToken, email, true);
            navigate('/dashboard');
          } else {
            setMessage('Login successful, but your email is not verified. Please check your inbox for a verification email.');
            await sendEmailVerification(user);
            await syncEmailVerificationStatus(idToken, email, false);
            // Optionally, navigate to a page that prompts for verification
            // navigate('/verify-email-prompt');
          }
        } else {
          setError('Backend login failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Firebase login error:', err);
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setError('Invalid email or password.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email format.');
          break;
        case 'auth/too-many-requests':
          setError('Too many login attempts. Please try again later.');
          break;
        default:
          setError('Failed to login. Please check your credentials and try again.');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.formContainer}>
        <Typography variant="h3" style={styles.header}>Login</Typography>
        <Typography variant="subtitle1" style={styles.subtitle}>
          Access your RateDeed account to manage your projects.
        </Typography>
        <form onSubmit={handleLogin} style={styles.form}>
          <Input
            label="Email"
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.inputField}
          />
          <Input
            label="Password"
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.inputField}
          />
          {error && <Typography variant="body" style={styles.error}>{error}</Typography>}
          {message && <Typography variant="body" style={styles.message}>{message}</Typography>}
          <Button type="submit" title="Login" onPress={handleLogin} loading={loading} style={styles.loginButton} />
        </form>
        <Typography variant="body" style={styles.linkText}>
          Don't have an account? <span style={styles.link} onClick={() => navigate('/signup')}>Sign Up</span>
        </Typography>
        <Typography variant="body" style={styles.linkText}>
          <span style={styles.link} onClick={() => navigate('/forgot-password')}>Forgot Password?</span>
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
    boxShadow: Shadows.md.boxShadow, // Adjust for web
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
  loginButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    width: '100%', // Ensure button takes full width
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

export default Login;