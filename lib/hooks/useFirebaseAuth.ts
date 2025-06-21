import { useEffect, useState } from 'react';
import { getAuth, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import { useAccount } from 'wagmi';

export function useFirebaseAuth() {
  const { address, isConnected } = useAccount();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted) return;
      const authenticated = !!user;
      setIsAuthenticated(authenticated);
      console.log('Firebase auth state:', {
        isAuthenticated: authenticated,
        uid: user?.uid || 'Not authenticated',
        timestamp: new Date().toISOString(),
      });
    });

    async function authenticate() {
      if (!isConnected || !address) {
        if (auth.currentUser) {
          await signOut(auth);
          console.log('Signed out due to wallet disconnection');
          setIsAuthenticated(false);
        }
        return;
      }

      if (isAuthenticating || isAuthenticated) return;

      setIsAuthenticating(true);
      console.log('Attempting to authenticate:', address.toLowerCase());
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: address.toLowerCase() }),
        });
        const responseData = await response.json();
        console.log('Auth API response:', responseData);
        if (!response.ok) {
          throw new Error(`Auth API error: ${responseData.error || response.statusText}`);
        }
        const { customToken } = responseData;
        if (customToken) {
          await signInWithCustomToken(auth, customToken);
          console.log('Firebase authentication successful:', {
            address: address.toLowerCase(),
            userId: auth.currentUser?.uid,
          });
          setIsAuthenticated(true);
        } else {
          throw new Error('No custom token received');
        }
      } catch (err) {
        console.error('Authentication failed:', {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        toast.error('Failed to authenticate wallet.');
        setIsAuthenticated(false);
      } finally {
        setIsAuthenticating(false);
      }
    }

    authenticate();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isConnected, address, isAuthenticating, isAuthenticated]);

  return { isAuthenticated, isAuthenticating };
}