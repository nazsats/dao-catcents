// File: lib/hooks/useFirebaseAuth.ts
import { useEffect } from 'react';
import { getAuth, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import toast from 'react-hot-toast';
import { useAccount } from 'wagmi';

export function useFirebaseAuth() {
  const { address, isConnected } = useAccount();

  useEffect(() => {
    const auth = getAuth();

    // Log auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Firebase auth state:', {
        isAuthenticated: !!user,
        uid: user?.uid || 'Not authenticated',
        email: user?.email || 'N/A',
        timestamp: new Date().toISOString(),
      });
    });

    async function authenticate() {
      if (isConnected && address) {
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
            const userCredential = await signInWithCustomToken(auth, customToken);
            console.log('Firebase authentication successful:', {
              address: address.toLowerCase(),
              userId: userCredential.user.uid,
            });
          } else {
            throw new Error('No custom token received');
          }
        } catch (err) {
          console.error('Authentication failed:', {
            error: err,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          toast.error('Failed to authenticate wallet.');
        }
      } else {
        console.log('No authentication attempted:', {
          isConnected,
          address: address || 'None',
        });
      }
    }

    authenticate();

    return () => unsubscribe();
  }, [isConnected, address]);
}