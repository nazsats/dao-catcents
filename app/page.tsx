// File: app/page.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';
import {
  useAccount,
  useReadContracts,
  useDisconnect,
  useBalance,
} from 'wagmi';
import type { Abi } from 'abitype';
import { monadTestnet } from '@reown/appkit/networks';
import { useAppKit } from '@reown/appkit/react';
import Image from 'next/image';
import CampaignCard from '@/components/CampaignCard';
import Profile from '@/components/Profile';
import Loader from '@/components/Loader';
import { theme } from './styles/theme';
import { CONTRACT_ADDRESS, contractAbi } from '@/lib/constants';
import { Campaign } from '@/lib/types';

export default function Home() {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const { data: balanceData } = useBalance({
    address,
    chainId: monadTestnet.id,
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 20;

  // State for mobile menu toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const votingPower = balanceData
    ? Math.floor(Number(balanceData.formatted))
    : 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Firebase Authentication (custom token)
  // ─────────────────────────────────────────────────────────────────────────────
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
          setError('Failed to authenticate wallet.');
          toast.error('Failed to authenticate wallet.');
        }
      }
    }
    authenticate();
  }, [isConnected, address]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Fetch campaigns (excluding deleted) + user metadata
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchCampaignsAndUserData(userAddress: string) {
      setIsLoading(true);
      setError(null);

      try {
        // 1) Query Firestore for all campaigns ordered by date desc
        const campQuery = query(
          collection(db, 'campaigns'),
          orderBy('date', 'desc')
        );
        const campSnapshot = await getDocs(campQuery);

        // 2) Build array of Campaign objects
        const fetchedCampaigns: (Campaign | null)[] = await Promise.all(
          campSnapshot.docs.map(async (campDoc) => {
            const campData = campDoc.data() as any;

            // Skip if deleted
            if (campData.deleted) {
              return null;
            }

            // (A) Check if user has liked
            let userLiked = false;
            if (userAddress) {
              const likesCollection = collection(
                db,
                'campaigns',
                campDoc.id,
                'likes'
              );
              const likesSnap = await getDocs(likesCollection);
              userLiked = likesSnap.docs.some(
                (d) => d.id === userAddress.toLowerCase()
              );
            }

            // (B) Check if user has voted
            let userVote: 'yes' | 'no' | null = null;
            if (userAddress) {
              const voteDocRef = doc(
                db,
                'campaigns',
                campDoc.id,
                'votes',
                userAddress.toLowerCase()
              );
              const voteDocSnap = await getDoc(voteDocRef);
              if (voteDocSnap.exists()) {
                userVote = voteDocSnap.data().vote as 'yes' | 'no';
              }
            }

            // (C) Count comments
            const commentsCollection = collection(
              db,
              'campaigns',
              campDoc.id,
              'comments'
            );
            const commentsSnapshot = await getDocs(commentsCollection);
            const commentCount = commentsSnapshot.size;

            // (D) Normalize date
            const date =
              campData.date instanceof Timestamp
                ? campData.date.toDate()
                : new Date(campData.date || Date.now());

            return {
              id: campDoc.id,
              author: (campData.author as string).toLowerCase(),
              title: campData.title as string,
              content: campData.content as string,
              date: date.toISOString(),
              image:
                (campData.image as string) ||
                '/campaigns/placeholder.png',
              yesVotes: (campData.yesVotes as number) || 0,
              noVotes: (campData.noVotes as number) || 0,
              likedByUser: userLiked,
              votedByUser: userVote,
              isExpanded: false,
              isLiking: false,
              isVoting: false,
              contractProposalId:
                Number(campData.contractProposalId) || 0,
              isVotable: false, // will set below
              commentCount,
            } as Campaign;
          })
        );

        // Filter out nulls (deleted campaigns)
        const filteredCampaigns = fetchedCampaigns.filter(
          (c): c is Campaign => c !== null
        );

        // Determine isVotable: only if user hasn’t voted AND status === 'Live'
        const updatedCampaigns = filteredCampaigns.map((camp) => {
          const isVotableNow =
            camp.votedByUser === null && camp.status === 'Live';
          return { ...camp, isVotable: isVotableNow };
        });

        setCampaigns(updatedCampaigns);
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
        setError('Failed to load campaigns: ' + (error as Error).message);
        toast.error('Failed to load campaigns.');
      } finally {
        setIsLoading(false);
      }
    }

    if (isConnecting) return;

    if (address) {
      fetchCampaignsAndUserData(address);
    } else {
      fetchCampaignsAndUserData('');
    }
  }, [address, isConnecting]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Fetch on-chain vote counts in batch (wagmi useReadContracts)
  // ─────────────────────────────────────────────────────────────────────────────

  const campaignAbi = contractAbi as unknown as Abi;

  const voteCountQueries = useMemo(
    () =>
      campaigns.map((campaign) => ({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: campaignAbi,
        functionName: 'getVoteCount',
        args: [BigInt(campaign.contractProposalId)],
        chainId: monadTestnet.id,
      })),
    [campaigns, campaignAbi]
  );

  const { data: voteCountsData } = useReadContracts({
    contracts: voteCountQueries,
    query: { enabled: campaigns.length > 0 },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Handle “Like” clicks
  // ─────────────────────────────────────────────────────────────────────────────
  const handleLike = async (campId: string) => {
    if (!address) return;
    const index = campaigns.findIndex((p) => p.id === campId);
    if (index === -1 || campaigns[index].likedByUser) return;

    setCampaigns((prev) =>
      prev.map((camp, i) =>
        i === index ? { ...camp, isLiking: true } : camp
      )
    );

    try {
      const likeRef = doc(
        db,
        'campaigns',
        campId,
        'likes',
        address.toLowerCase()
      );
      // Use getDoc here (not getDocs) to fetch a single document
      const likeSnap = await getDoc(likeRef);
      if (!likeSnap.exists()) {
        await setDoc(likeRef, {
          likedAt: new Date().toISOString(),
        });
        setCampaigns((prev) =>
          prev.map((camp, i) =>
            i === index
              ? { ...camp, likedByUser: true, isLiking: false }
              : camp
          )
        );
        toast.success('Liked proposal!');
      } else {
        setCampaigns((prev) =>
          prev.map((camp, i) =>
            i === index ? { ...camp, isLiking: false } : camp
          )
        );
      }
    } catch (error) {
      console.error('Failed to like proposal:', error);
      toast.error('Failed to like proposal.');
      setCampaigns((prev) =>
        prev.map((camp, i) =>
          i === index ? { ...camp, isLiking: false } : camp
        )
      );
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Paginate and render loading/error states
  // ─────────────────────────────────────────────────────────────────────────────
  if (isConnecting || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <Loader size={48} />
      </div>
    );
  }

  const totalPages = Math.ceil(campaigns.length / cardsPerPage);
  const startIndex = (currentPage - 1) * cardsPerPage;
  const paginatedCampaigns = campaigns.slice(
    startIndex,
    startIndex + cardsPerPage
  );

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #9333ea',
          },
        }}
      />

      {/* ─────────── Top Header with Logo + Menu ─────────── */}
      <header className="w-full bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 justify-between">
            {/* Left side: Logo */}
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="Logo"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex space-x-6 ml-8">
              <button
                disabled
                className="text-gray-400 hover:text-gray-300 cursor-not-allowed px-2 py-1 text-sm font-medium"
                aria-label="Dashboard (coming soon)"
              >
                Dashboard
              </button>
              <button
                disabled
                className="text-gray-400 hover:text-gray-300 cursor-not-allowed px-2 py-1 text-sm font-medium"
                aria-label="Trade (coming soon)"
              >
                Trade
              </button>
              <button
                disabled
                className="text-gray-400 hover:text-gray-300 cursor-not-allowed px-2 py-1 text-sm font-medium"
                aria-label="Stake (coming soon)"
              >
                Stake
              </button>
              <button
                disabled
                className="text-gray-400 hover:text-gray-300 cursor-not-allowed px-2 py-1 text-sm font-medium"
                aria-label="Vote (coming soon)"
              >
                Vote
              </button>
            </nav>

            {/* Right side: empty spacer */}
            <div className="flex-1"></div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle menu"
                className="p-2 text-gray-300 hover:text-white focus:outline-none"
              >
                {mobileMenuOpen ? (
                  // X icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  // Hamburger icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile nav items */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-gray-900/90">
              <nav className="flex flex-col space-y-2 py-2 px-4">
                <button
                  disabled
                  className="text-gray-400 hover:text-gray-300 cursor-not-allowed px-2 py-1 text-base font-medium text-left"
                  aria-label="Dashboard (coming soon)"
                >
                  Dashboard
                </button>
                <button
                  disabled
                  className="text-gray-400 hover:text-gray-300 cursor-not-allowed px-2 py-1 text-base font-medium text-left"
                  aria-label="Trade (coming soon)"
                >
                  Trade
                </button>
                <button
                  disabled
                  className="text-gray-400 hover:text-gray-300 cursor-not-allowed px-2 py-1 text-base font-medium text-left"
                  aria-label="Stake (coming soon)"
                >
                  Stake
                </button>
                <button
                  disabled
                  className="text-gray-400 hover:text-gray-300 cursor-not-allowed px-2 py-1 text-base font-medium text-left"
                  aria-label="Vote (coming soon)"
                >
                  Vote
                </button>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* ─────────── Enhanced Hero Section ─────────── */}
      <section className="relative flex items-center justify-center h-[70vh] bg-gradient-to-br from-purple-900 to-indigo-800 overflow-hidden">
        {/* Animated blurred blobs in background */}
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-purple-700 rounded-full filter blur-3xl opacity-50 animate-pulse"></div>
        <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-indigo-600 rounded-full filter blur-3xl opacity-50 animate-pulse"></div>

        <div className="relative z-10 text-center px-6">
          {/* Gradient-text headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-blue-500 mb-4">
            Decentralized Demeowcracy
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-gray-200 mb-6">
            Discover, discuss, and decide on on‐chain proposals. Connect your wallet to vote and make your voice heard.
          </p>

          <div className="mt-8 flex flex-col items-center space-y-4">
            {!isConnected ? (
              <button
                onClick={() => open()}
                className={`flex items-center space-x-2 bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary} text-white px-6 py-3 rounded-full text-lg font-semibold shadow-lg transition-transform transform hover:scale-105`}
              >
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                {/* Profile + Disconnect */}
                <div className="flex items-center space-x-4">
                  <Profile
                    account={address!}
                    onCopyAddress={() =>
                      navigator.clipboard
                        .writeText(address!)
                        .then(() => toast.success('Address copied!'))
                    }
                    onDisconnect={disconnect}
                  />
                  <button
                    onClick={() => disconnect()}
                    className={`bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-2 rounded-full font-semibold shadow-lg transition-transform transform hover:scale-105`}
                  >
                    Disconnect Wallet
                  </button>
                </div>
                {/* Voting Power Display */}
                <div className="bg-gray-900/70 rounded-full px-6 py-2">
                  <p className={`text-xl font-bold ${theme.colors.text.accent} drop-shadow-md`}>
                    Voting Power: {votingPower}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────── Campaign Cards Section ─────────── */}
      <main className="flex-1 px-4 py-8 md:px-8 md:py-12">
        {error && (
          <div className="p-4 mb-6 bg-red-900/80 text-red-200 border border-red-500 rounded-lg text-center">
            {error}
          </div>
        )}

        {campaigns.length === 0 ? (
          <p className="text-center text-gray-300">
            No proposals available.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedCampaigns.map((campaign) => {
              const raw = voteCountsData?.[campaigns.indexOf(campaign)]?.result;
              const voteCounts = Array.isArray(raw)
                ? (raw as [bigint, bigint])
                : undefined;

              const yesVotes = voteCounts
                ? Number(voteCounts[0])
                : campaign.yesVotes;
              const noVotes = voteCounts
                ? Number(voteCounts[1])
                : campaign.noVotes;

              return (
                <CampaignCard
                  key={campaign.id}
                  campaign={{ ...campaign, yesVotes, noVotes }}
                  onLike={() => handleLike(campaign.id)}
                />
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-4 mt-8">
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.max(prev - 1, 1))
              }
              disabled={currentPage === 1}
              className={`${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : `bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500`
              } text-white px-4 py-2 rounded-full font-medium transition-transform transform hover:scale-105`}
            >
              Previous
            </button>
            <span className="text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className={`${
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : `bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500`
              } text-white px-4 py-2 rounded-full font-medium transition-transform transform hover:scale-105`}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
