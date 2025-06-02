// lib/hooks/useFirebaseAuth.ts
import { useEffect } from 'react';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import toast from 'react-hot-toast';
import { useAccount } from 'wagmi';

export function useFirebaseAuth() {
  const { address, isConnected } = useAccount();

  useEffect(() => {
    async function authenticate() {
      if (isConnected && address) {
        try {
          const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: address.toLowerCase() }),
          });
          if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
          }
          const { customToken } = await response.json();
          if (customToken) {
            await signInWithCustomToken(getAuth(), customToken);
          } else {
            throw new Error('No custom token received');
          }
        } catch (err) {
          console.error('Authentication failed:', err);
          toast.error('Failed to authenticate wallet.');
        }
      }
    }
    authenticate();
  }, [isConnected, address]);
}