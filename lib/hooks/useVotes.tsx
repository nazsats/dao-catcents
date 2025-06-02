// lib/hooks/useVotes.tsx
import { useWriteContract, useSwitchChain } from 'wagmi';
import { useBalance } from 'wagmi';
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import { monadTestnet } from '@reown/appkit/networks';
import { CONTRACT_ADDRESS, contractAbi, MONAD_EXPLORER_URL } from '@/lib/constants';

export function useVote(
  campaignId: string,
  contractProposalId: number,
  address?: string
) {
  const { writeContract, isPending } = useWriteContract();
  const { switchChain } = useSwitchChain();

  // ─── Cast address so that useBalance sees a `0x…`-literal instead of plain string
  const wagmiAddress = address as `0x${string}` | undefined;
  const { data: balanceData } = useBalance({
    address: wagmiAddress,
    chainId: monadTestnet.id,
  });

  const votingPower = balanceData ? Math.floor(Number(balanceData.formatted)) : 0;

  const handleVote = async (vote: 'yes' | 'no') => {
    if (!address || isPending || votingPower === 0) {
      toast.error('Please connect wallet or ensure you have MON tokens.');
      return;
    }

    const pendingToast = toast.loading(`Processing ${vote} vote…`);
    try {
      // 1) Make sure the user is on Monad Testnet
      await switchChain({ chainId: monadTestnet.id });

      const voteType = vote === 'yes' ? 0 : 1;
      await writeContract(
        {
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: contractAbi,
          functionName: 'vote',
          args: [
            BigInt(contractProposalId),
            BigInt(voteType),
            BigInt(votingPower),
          ],
          chainId: monadTestnet.id,
        },
        {
          onSuccess: async (txHash: unknown) => {
            // 2) Once the on‐chain vote goes through, write to Firestore:

            // Record that this user voted
            const campRef = doc(db, 'campaigns', campaignId);
            const voteRef = doc(
              db,
              'campaigns',
              campaignId,
              'votes',
              address.toLowerCase()
            );
            await setDoc(voteRef, {
              vote,
              user: address.toLowerCase(),
              votedAt: new Date().toISOString(),
              txHash,
            });

            // 3) Also increment the appropriate on‐chain tally in Firestore
            await updateDoc(campRef, {
              [vote === 'yes' ? 'yesVotes' : 'noVotes']: increment(votingPower),
            });

            toast.dismiss(pendingToast);
            const txStr = typeof txHash === 'string' ? txHash : String(txHash);
            toast.success(
              <div>
                Voted {vote} successfully!{' '}
                <a
                  href={`${MONAD_EXPLORER_URL}/tx/${txStr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-cyan-400"
                >
                  View on Monad Explorer
                </a>
              </div>,
              { duration: 5000 }
            );
          },
          onError: (error: unknown) => {
            // Bubble the error to the outer catch
            throw error;
          },
        }
      );
    } catch (error: unknown) {
      toast.dismiss(pendingToast);
      // Pull out a .message if it exists
      const msg =
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message
          : String(error);

      let errorMessage = 'Failed to vote.';
      if (msg.includes('insufficient funds') || msg.includes('Insufficient MON balance')) {
        errorMessage = 'Insufficient MON balance. Please claim testnet tokens from the Monad faucet.';
      } else if (msg.includes('Campaign is not live')) {
        errorMessage = 'This campaign is not currently open for voting.';
      } else if (msg.includes('Voting period has ended')) {
        errorMessage = 'The voting period for this campaign has ended.';
      } else if (msg.includes('User already voted')) {
        errorMessage = 'You have already voted on this campaign.';
      } else if (msg.includes('User rejected the request')) {
        errorMessage = 'Transaction rejected by user.';
      } else {
        errorMessage = `Failed to vote: ${msg}`;
      }
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  return { handleVote, isPending, votingPower };
}
