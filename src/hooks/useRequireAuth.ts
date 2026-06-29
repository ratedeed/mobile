import { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

export function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>('do that');
  const [onAuthSuccess, setOnAuthSuccess] = useState<(() => void) | null>(null);

  const requireAuth = useCallback((action: string, onSuccess?: () => void) => {
    if (isAuthenticated) {
      onSuccess?.();
      return true;
    }
    setPendingAction(action);
    setOnAuthSuccess(() => onSuccess || null);
    setShowGuestPrompt(true);
    return false;
  }, [isAuthenticated]);

  const handleLogin = useCallback(() => {
    setShowGuestPrompt(false);
    // Navigate to auth stack — we'll add a param to know where to return
    (navigation as any).navigate('Login', { returnTo: 'Main' });
  }, [navigation]);

  const handleClose = useCallback(() => {
    setShowGuestPrompt(false);
    setOnAuthSuccess(null);
  }, []);

  return {
    requireAuth,
    showGuestPrompt,
    pendingAction,
    handleLogin,
    handleClose,
    onAuthSuccess,
  };
}
