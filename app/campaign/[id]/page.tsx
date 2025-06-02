/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAccount, useReadContract } from 'wagmi';
import { useParams, useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Image from 'next/image'; // ← Re-add Image import (line 909 error)
import Loader from '@/components/Loader';
import LikeButton from '@/components/LikeButton';
import VoteButtons from '@/components/VoteButtons';
import { monadTestnet } from '@reown/appkit/networks';
import {
  CONTRACT_ADDRESS,
  contractAbi,
} from '@/lib/constants';
import { Campaign, Comment } from '@/lib/types';
import {
  getRandomCatEmoji,
  shortenAddress,
  isValidUrl,
} from '@/lib/utils';
import { theme } from '@/app/styles/theme';
import { useFirebaseAuth } from '@/lib/hooks/useFirebaseAuth';
import { useVote } from '@/lib/hooks/useVotes';
import {
  FaTwitter,
  FaDiscord,
  FaGlobe,
  FaHeart,
  FaComment,
  FaCheckCircle,
  FaClock,
} from 'react-icons/fa';

export default function CampaignDetail() {
  const { id } = useParams();
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Track total likes and “is liking” state
  const [totalLikes, setTotalLikes] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  // Re-use our Voting hook
  const { handleVote, isPending: isVoting, votingPower } = useVote(
    id as string,
    campaign?.contractProposalId || 0,
    address
  );

  useFirebaseAuth();

  // Build shareable link
  const shareLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/campaign/${id}`
      : '';

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FETCH Firestore data for this campaign (including total likes & vote status)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchCampaignData() {
      setIsLoading(true);

      try {
        // 1.a) Fetch the campaign document
        const docRef = doc(db, 'campaigns', id as string);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setError('Proposal not found.');
          toast.error('Proposal not found.');
          setIsLoading(false);
          return;
        }
        const campData = docSnap.data() as any;

        if (campData.deleted) {
          setError('This campaign has been deleted.');
          toast.error('This campaign has been deleted.');
          setIsLoading(false);
          return;
        }

        // 1.b) Fetch all “likes” for this campaign
        const likesCol = collection(db, 'campaigns', id as string, 'likes');
        const likesSnap = await getDocs(likesCol);

        // Determine if the **current user** has liked it
        const userFavourite = address
          ? likesSnap.docs.some(
              (d) => d.id === address.toLowerCase()
            )
          : false;

        // Set the **totalLikes** to the size of the likes snapshot
        setTotalLikes(likesSnap.size);

        // 1.c) Check if the **current user** has already voted (Firestore “votes” subcollection)
        let userVote: 'yes' | 'no' | null = null;
        if (address) {
          const voteDocSnap = await getDoc(
            doc(db, 'campaigns', id as string, 'votes', address.toLowerCase())
          );
          if (voteDocSnap.exists()) {
            userVote = voteDocSnap.data().vote as 'yes' | 'no';
          }
        }

        // 1.d) Fetch all comments
        const commentsQuery = query(
          collection(db, 'campaigns', id as string, 'comments'),
          orderBy('timestamp', 'desc')
        );
        const commentsSnap = await getDocs(commentsQuery);
        const commentsData: Comment[] = await Promise.all(
          commentsSnap.docs.map(async (commentDoc) => {
            const commentId = commentDoc.id;
            const commentData = commentDoc.data() as any;

            // For each comment, gather its “likes” subcollection
            const commentLikesCol = collection(
              db,
              'campaigns',
              id as string,
              'comments',
              commentId,
              'likes'
            );
            const commentLikesSnap = await getDocs(commentLikesCol);
            const likeCount = commentLikesSnap.size;
            const commentLikedByUser = address
              ? commentLikesSnap.docs.some(
                  (likeDoc) =>
                    likeDoc.id === address.toLowerCase()
                )
              : false;

            return {
              id: commentId,
              text: commentData.text,
              user: commentData.user,
              timestamp: commentData.timestamp,
              likeCount,
              likedByUser: commentLikedByUser,
            } as Comment;
          })
        );

        // 1.e) Normalize Firestore fields into our `Campaign` shape
        const date =
          campData.date instanceof Timestamp
            ? campData.date.toDate()
            : new Date(campData.date || Date.now());
        const proposalId = Number(campData.contractProposalId) || 0;

        const endDateStr = campData.endDate
          ? campData.endDate instanceof Timestamp
            ? campData.endDate.toDate().toISOString()
            : (campData.endDate as string)
          : null;

        // Determine on-chain status (“Live” if endDate > now)
        let isLive = false;
        if (endDateStr) {
          isLive = new Date(endDateStr).getTime() > Date.now();
        }

        // 1.f) Compute isVotable (on-chain “Live” && userVote is null && not invalid)
        const isVotable =
          isLive && !(campData.invalid as boolean) && userVote === null;

        setCampaign({
          id: docSnap.id,
          author: (campData.author as string).toLowerCase(),
          title: campData.title as string,
          content: campData.content as string,
          date: date.toISOString(),
          image: (campData.image as string) || '/campaigns/placeholder.png',
          yesVotes: (campData.yesVotes as number) || 0,
          noVotes: (campData.noVotes as number) || 0,
          abstainVotes: (campData.abstainVotes as number) || 0,
          likedByUser: userFavourite,
          votedByUser: userVote, // <─ populated from Firestore “votes”
          contractProposalId: proposalId,
          isVotable, // <─ computed above
          commentCount: commentsSnap.size,
          allowAbstain: (campData.allowAbstain as boolean) || false,
          status: isLive
            ? 'Live'
            : (campData.status as
                | 'Created'
                | 'Active'
                | 'Live'
                | 'Approved'
                | 'Ended'),
          endDate: endDateStr,
          socialLinks:
            (campData.socialLinks as {
              twitter?: string
              discord?: string
              website?: string
            }) || { twitter: '', discord: '', website: '' },
          invalid: (campData.invalid as boolean) || false,
          deleted: (campData.deleted as boolean) || false,
        });

        setComments(commentsData);
      } catch (err) {
        console.error('Failed to load campaign:', err);
        setError('Failed to load campaign.');
        toast.error('Failed to load campaign.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCampaignData();
  }, [id, address]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. FETCH on-chain data and keep Firestore in sync (if needed)
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: contractData, error: contractError } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractAbi,
    functionName: 'getCampaign',
    args: [BigInt(campaign?.contractProposalId || 0)],
    chainId: monadTestnet.id,
    query: {
      enabled:
        typeof campaign?.contractProposalId === 'number' &&
        campaign.contractProposalId >= 0 &&
        !campaign.invalid &&
        !campaign.deleted,
      staleTime: 60_000,
      refetchInterval: 120_000,
    },
  });

  useEffect(() => {
    if (contractError) {
      console.error('Failed to fetch contract data:', contractError);
      const errorMessage =
        typeof contractError === 'object' &&
        'message' in contractError &&
        typeof (contractError as any).message === 'string'
          ? ( (contractError as any).message as string ).includes('Invalid campaign ID')
            ? 'Invalid campaign ID. This campaign does not exist on the blockchain.'
            : 'Failed to fetch contract data.'
          : 'Failed to fetch contract data.';
      setError(errorMessage);
      toast.error(errorMessage);

      if (
        campaign &&
        typeof contractError === 'object' &&
        'message' in contractError &&
        (contractError as any).message.includes('Invalid campaign ID') &&
        !campaign.invalid
      ) {
        // Mark Firestore doc as invalid
        setDoc(doc(db, 'campaigns', campaign.id), { invalid: true }, { merge: true }).catch((err) => {
          console.error('Failed to mark campaign as invalid:', err);
        });
        setCampaign((prev) =>
          prev ? { ...prev, invalid: true, isVotable: false } : prev
        );
      }
      return;
    }

    if (
      contractData &&
      campaign &&
      !campaign.invalid &&
      !campaign.deleted
    ) {
      // Narrow contractData as { yesVotes, noVotes, abstainVotes, status, endTime }
      if (
        typeof contractData === 'object' &&
        contractData !== null &&
        'yesVotes' in contractData &&
        'noVotes' in contractData &&
        'abstainVotes' in contractData &&
        'status' in contractData &&
        'endTime' in contractData
      ) {
        const data = contractData as {
          yesVotes: bigint;
          noVotes: bigint;
          abstainVotes: bigint;
          status: bigint;
          startTime: bigint;
          endTime: bigint;
          allowAbstain: boolean;
          isDeleted: boolean;
        };

        const yesVotes = Number(data.yesVotes) || 0;
        const noVotes = Number(data.noVotes) || 0;
        const abstainVotes = Number(data.abstainVotes) || 0;

        const statusMap = [
          'Created',
          'Active',
          'Live',
          'Approved',
          'Ended',
        ] as const;
        const onChainStatusIndex = Number(data.status);
        const onChainStatus: Campaign['status'] =
          statusMap[onChainStatusIndex] || 'Ended';

        const onChainEndSec = Number(data.endTime);
        const nowSec = Math.floor(Date.now() / 1000);
        const isStillLive =
          onChainStatusIndex === 2 && onChainEndSec > nowSec;

        // Determine if user already has “voted” in Firestore (cached as campaign.votedByUser)
        const userAlreadyVoted = campaign.votedByUser !== null;

        const updatedCampaign: Campaign = {
          ...campaign,
          yesVotes,
          noVotes,
          abstainVotes,
          status: isStillLive ? 'Live' : onChainStatus,
          endDate:
  onChainEndSec > 0
    ? new Date(onChainEndSec * 1000).toISOString()
    : campaign.endDate ?? undefined,

          isVotable:
            isStillLive && !campaign.invalid && !userAlreadyVoted,
        };

        // Only update state + Firestore if something changed
        if (
          campaign.yesVotes !== yesVotes ||
          campaign.noVotes !== noVotes ||
          campaign.abstainVotes !== abstainVotes ||
          campaign.status !== updatedCampaign.status ||
          campaign.isVotable !== updatedCampaign.isVotable
        ) {
          setCampaign(updatedCampaign);

          setDoc(
            doc(db, 'campaigns', campaign.id),
            {
              yesVotes,
              noVotes,
              abstainVotes,
              status: updatedCampaign.status,
              endDate:
                onChainEndSec > 0
                  ? Timestamp.fromDate(new Date(onChainEndSec * 1000))
                  : null,
              invalid: false,
            },
            { merge: true }
          ).catch((err) => {
            console.error('Failed to sync Firestore:', err);
          });
        }
      }
    }
  }, [contractData, contractError, campaign, address]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. HANDLE “Like” button clicks (optimistically update totalLikes + likedByUser)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleLike = async () => {
    if (
      !isConnected ||
      !address ||
      !campaign ||
      campaign.likedByUser ||
      campaign.deleted
    ) {
      return;
    }
    setIsLiking(true);

    const likeRef = doc(
      db,
      'campaigns',
      id as string,
      'likes',
      address.toLowerCase()
    );
    try {
      const likeSnap = await getDoc(likeRef);
      if (!likeSnap.exists()) {
        await setDoc(likeRef, { likedAt: new Date().toISOString() });
        // Immediately bump totalLikes
        setTotalLikes((prev) => prev + 1);
        // Mark that this user has liked
        setCampaign((prev) =>
          prev ? { ...prev, likedByUser: true } : prev
        );
      }
    } catch (err) {
      console.error('Failed to like campaign:', err);
      toast.error('Failed to like campaign.');
    } finally {
      setIsLiking(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. HANDLE “Vote” clicks (optimistically disable Vote buttons on success)
  // ─────────────────────────────────────────────────────────────────────────────
  const onVote = useCallback(
    async (vote: 'yes' | 'no') => {
      if (!campaign) return;
      try {
        await handleVote(vote);
        // As soon as on-chain vote is successful, disable voting here
        setCampaign((prev) =>
          prev ? { ...prev, votedByUser: vote, isVotable: false } : prev
        );
      } catch (err) {
        console.error('Vote failed, not updating local state:', err);
      }
    },
    [campaign, handleVote]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. RENDER LOGIC
  // ─────────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <Loader size={64} />
      </div>
    );
  }

  if (!campaign || error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <p className="text-red-200">{error || 'Proposal not found.'}</p>
      </div>
    );
  }

  // Compute votes / like counts
  const yesVotes = campaign.yesVotes;
  const noVotes = campaign.noVotes;
  const totalVotes = yesVotes + noVotes;

  const descriptionPreviewLength = 200;
  const needsShowMore = campaign.content.length > descriptionPreviewLength;
  const descriptionPreview = needsShowMore
    ? campaign.content.slice(0, descriptionPreviewLength) + '...'
    : campaign.content;

  const statusStages: Campaign['status'][] = [
    'Created',
    'Active',
    'Live',
    'Approved',
    'Ended',
  ];
  const currentStatusIndex = statusStages.indexOf(campaign.status);
  const isLive = campaign.endDate
    ? new Date(campaign.endDate).getTime() > Date.now()
    : false;

  const campaignDate = new Date(campaign.date);
  const startDate = campaignDate.toLocaleDateString();
  const endDate = campaign.endDate
    ? new Date(campaign.endDate).toLocaleDateString()
    : new Date(campaignDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();

  const socialLinks = campaign.socialLinks || {
    twitter: '',
    discord: '',
    website: '',
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #fff' },
        }}
      />
      <main className="flex-1 p-4 md:p-8 flex flex-col md:flex-row gap-4">
        {/* ─────────── Left-side (Information & Status) ─────────── */}
        <div className="w-full md:w-1/3 flex flex-col gap-4">
          <div className="flex justify-center space-x-6">
            {socialLinks.twitter && isValidUrl(socialLinks.twitter) && (
              <a
                href={socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl text-gray-300 hover:text-cyan-400 hover:scale-110 transition-all duration-200"
                aria-label="X Profile"
              >
                <FaTwitter />
              </a>
            )}
            {socialLinks.discord && isValidUrl(socialLinks.discord) && (
              <a
                href={socialLinks.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl text-gray-300 hover:text-cyan-400 hover:scale-110 transition-all duration-200"
                aria-label="Discord Server"
              >
                <FaDiscord />
              </a>
            )}
            {socialLinks.website && isValidUrl(socialLinks.website) && (
              <a
                href={socialLinks.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl text-gray-300 hover:text-cyan-400 hover:scale-110 transition-all duration-200"
                aria-label="Website"
              >
                <FaGlobe />
              </a>
            )}
          </div>

          <div className="relative w-full aspect-square">
            <Image
  src={campaign.image ?? '/campaigns/placeholder.png'}
  alt={campaign.title}
  fill
  sizes="(max-width: 768px) 100vw, 33vw"
  className="object-cover rounded-md shadow-lg"
  onError={(e) =>
    (e.currentTarget.src = '/campaigns/placeholder.png')
  }
/>

          </div>

          <div className="p-4 rounded-lg bg-gray-900/70 border border-gray-700 shadow-lg hover:scale-105 transition-all duration-300">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-cyan-500 text-transparent bg-clip-text mb-2">
              Campaign Information
            </h3>
            <p className={`text-sm ${theme.colors.text.secondary}`}>
              Created By:{' '}
              <span className={`font-bold ${theme.colors.text.accent}`}>
                {shortenAddress(campaign.author)}
              </span>
            </p>
            <p className={`text-sm ${theme.colors.text.secondary}`}>
              Start Date:{' '}
              <span className={`font-bold ${theme.colors.text.accent}`}>
                {startDate}
              </span>
            </p>
            <p className={`text-sm ${theme.colors.text.secondary}`}>
              End Date:{' '}
              <span className={`font-bold ${theme.colors.text.accent}`}>
                {endDate}
              </span>
            </p>
          </div>

          <div
            className="p-4 rounded-lg bg-gray-900/70 border border-gray-700 shadow-lg hover:scale-105 transition-all duration-300 overflow-hidden"
            role="progressbar"
            aria-valuenow={currentStatusIndex + 1}
            aria-valuemin={1}
            aria-valuemax={statusStages.length}
          >
            <h3 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-cyan-500 text-transparent bg-clip-text mb-4">
              Status
            </h3>
            <div className="relative flex flex-col gap-4">
              <div className="absolute left-6 top-0 bottom-0 w-1 bg-gray-700">
                <div
                  className="w-full bg-gradient-to-b from-green-500 to-teal-600"
                  style={{
                    height: `${
                      (currentStatusIndex + 1) *
                      (100 / statusStages.length)
                    }%`,
                  }}
                />
              </div>
              {statusStages.map((stage, index) => (
                <div
                  key={stage}
                  className="flex items-center group relative animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md hover:animate-gradient ${
                      index <= currentStatusIndex
                        ? 'bg-gradient-to-r from-green-500 to-teal-600'
                        : index === currentStatusIndex + 1
                        ? 'bg-gradient-to-r from-purple-600 to-cyan-500 animate-pulse ring-2 ring-cyan-400'
                        : 'bg-gray-600'
                    }`}
                  >
                    {index <= currentStatusIndex ? (
                      <FaCheckCircle className="text-white" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="ml-4">
                    <span
                      className={`text-sm capitalize ${
                        index <= currentStatusIndex ||
                        index === currentStatusIndex + 1
                          ? 'font-bold bg-gradient-to-r from-purple-600 to-cyan-500 text-transparent bg-clip-text'
                          : theme.colors.text.secondary
                      }`}
                    >
                      {stage}
                    </span>
                  </div>
                  <div className="absolute left-0 top-12 hidden group-hover:block bg-black/90 backdrop-blur-sm text-white text-xs p-2 rounded shadow-lg z-10 flex items-center space-x-2">
                    {stage === 'Live' ? <FaClock /> : <FaCheckCircle />}
                    <span>
                      {{
                        Created: 'Proposal submitted',
                        Active: 'Proposal activated for voting',
                        Live: `Voting in progress${
                          campaign.endDate
                            ? ` until ${new Date(
                                campaign.endDate
                              ).toLocaleDateString()}`
                            : ''
                        }`,
                        Approved: 'Proposal approved',
                        Ended: 'Proposal ended',
                      }[stage]}
                    </span>
                  </div>
                  {index < statusStages.length - 1 && (
                    <svg
                      className="absolute left-10 top-12 w-4 h-8"
                      viewBox="0 0 16 32"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M8 0 L8 28 L12 24 L8 32 L4 24 L8 28 Z"
                        fill={
                          index < currentStatusIndex
                            ? '#34d399'
                            : '#4b5563'
                        }
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─────────── Right-side (Voting, Likes & Comments) ─────────── */}
        <div className="flex-1 flex flex-col">
          {/* If user is not connected, show “Back to Proposals” → Connect Wallet */}
          {!isConnected ? (
            <button
              onClick={() => router.push('/')}
              className={`${theme.colors.text.primary} hover:text-purple-300 text-sm mb-4`}
            >
              ← Back to Proposals
            </button>
          ) : null}

          <div
            className={`${theme.bg.primary} rounded-xl border ${theme.border} ${theme.shadow} p-6 flex-1`}
          >
            {/* Header: Proposal ID & Author */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-2xl">
                  {getRandomCatEmoji(campaign.author)}
                </div>
                <div>
                  <h1
                    className={`text-2xl md:text-3xl font-bold ${theme.colors.text.primary}`}
                  >
                    Proposal ID: {campaign.contractProposalId}
                  </h1>
                  <p
                    className={`text-sm ${theme.colors.text.accent} italic`}
                  >
                    By {shortenAddress(campaign.author)}
                  </p>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                  isLive
                    ? 'bg-gradient-to-r from-green-400 to-teal-300 animate-pulse'
                    : 'bg-gray-600'
                }`}
              >
                {isLive ? 'Live' : 'Ended'}
              </div>
            </div>

            {/* Title */}
            <h2
              className={`text-2xl md:text-4xl font-bold ${theme.colors.text.primary} drop-shadow-md mb-2 relative`}
            >
              {campaign.title}
              <span className="absolute bottom-0 left-0 w-1/2 h-1 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full" />
            </h2>

            {/* Description Box */}
            <div className="p-6 rounded-lg bg-black/20 backdrop-blur-md border border-purple-900/50 hover:border-purple-500 transition-all duration-300 mb-4">
              <p className={`text-base ${theme.colors.text.secondary}`}>
                {showFullDescription || !needsShowMore
                  ? campaign.content
                  : descriptionPreview}
              </p>
              {needsShowMore && (
                <button
                  onClick={() =>
                    setShowFullDescription((prev) => !prev)
                  }
                  className={`mt-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary} hover:scale-105 transition-all duration-300`}
                >
                  {showFullDescription ? 'Show Less' : 'Show More'}
                </button>
              )}
            </div>

            {/* Voting Power Display */}
            {isConnected && (
              <div className="bg-gray-900/70 rounded-lg p-4 text-center mb-4">
                <h3
                  className={`text-lg font-semibold ${theme.colors.text.primary} mb-2`}
                >
                  Your Voting Power
                </h3>
                <p
                  className={`text-2xl font-bold ${theme.colors.text.accent} drop-shadow-md`}
                >
                  {votingPower}
                </p>
              </div>
            )}

            {/* Invalid / Deleted notice */}
            {(campaign.invalid || campaign.deleted) && (
              <div className="bg-red-900/50 border border-red-700 p-4 rounded-lg mb-4">
                <p className="text-red-200">
                  {campaign.deleted
                    ? 'This campaign has been deleted.'
                    : 'This campaign is invalid.'}
                </p>
                <p className="text-sm text-red-300 mt-2">
                  This campaign does not exist on the blockchain or has
                  been deleted. Please contact the admin.
                </p>
              </div>
            )}

            {/* Vote Buttons */}
            {!campaign.invalid && !campaign.deleted && (
              <div className="flex flex-col gap-4 mb-4">
                <VoteButtons
  campaignId={id as string}
  isVotable={campaign.isVotable}
  votedByUser={
    campaign.votedByUser === 'abstain'
      ? null
      : (campaign.votedByUser as 'yes' | 'no' | null)
  }
  isVoting={isVoting}
  onVote={onVote}
/>

              </div>
            )}

            {/* Like / Comment / Share Buttons */}
            <div className="flex gap-4 mb-4">
              <LikeButton
                likedByUser={campaign.likedByUser}
                isLiking={isLiking}
                totalLikes={totalLikes}
                onLike={handleLike}
              />

              <button
                onClick={() =>
                  document.getElementById('comment-input')?.focus()
                }
                disabled={campaign.deleted}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-900/70 hover:bg-gray-800/70 transition-all duration-200 group ${
                  campaign.deleted ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FaComment className="text-lg text-blue-400 group-hover:animate-pulse" />
                <span className={`text-sm font-semibold ${theme.colors.text.accent}`}>
                  {campaign.commentCount}
                </span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  toast.success('Link copied to clipboard!');
                }}
                className={`px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary} transition-all duration-300`}
                aria-label="Share Proposal"
              >
                Share
              </button>
            </div>

            {/* Vote Progress Bars */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Yes: {yesVotes}</span>
                  <span>
                    {totalVotes > 0
                      ? ((yesVotes / totalVotes) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-teal-600 h-full transition-all duration-500 ease-in-out"
                    style={{
                      width: `${
                        totalVotes > 0
                          ? (yesVotes / totalVotes) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>No: {noVotes}</span>
                  <span>
                    {totalVotes > 0
                      ? ((noVotes / totalVotes) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-900 to-orange-400 h-full transition-all duration-500 ease-in-out"
                    style={{
                      width: `${
                        totalVotes > 0
                          ? (noVotes / totalVotes) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div>
              <h2 className={`text-xl font-bold ${theme.colors.text} mb-4`}>
                Comments
              </h2>
              <textarea
                id="comment-input"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className={`w-full p-2 ${theme.bg.secondary} text-white border ${theme.border} rounded-lg mb-2`}
                placeholder="Add a comment..."
                disabled={!isConnected || campaign.deleted}
                rows={4}
              />
              <button
                onClick={async () => {
                  if (
                    !commentText ||
                    !isConnected ||
                    !address ||
                    campaign.deleted
                  )
                    return;
                  try {
                    const commentRef = await addDoc(
                      collection(
                        db,
                        'campaigns',
                        id as string,
                        'comments'
                      ),
                      {
                        text: commentText,
                        user: address.toLowerCase(),
                        timestamp: new Date().toISOString(),
                      }
                    );
                    await updateDoc(
                      doc(db, 'campaigns', id as string),
                      {
                        commentCount: increment(1),
                      }
                    );
                    setComments((prev) => [
                      {
                        id: commentRef.id,
                        text: commentText,
                        user: address.toLowerCase(),
                        timestamp: new Date().toISOString(),
                        likeCount: 0,
                        likedByUser: false,
                      },
                      ...prev,
                    ]);
                    setCampaign((prev) =>
                      prev
                        ? {
                            ...prev,
                            commentCount: prev.commentCount + 1,
                          }
                        : prev
                    );
                    setCommentText('');
                    toast.success('Comment added!');
                  } catch (err) {
                    console.error('Failed to add comment:', err);
                    toast.error('Failed to add comment.');
                  }
                }}
                disabled={
                  !isConnected || !commentText || campaign.deleted
                }
                className={`w-full px-4 py-2 rounded-full text-sm font-semibold text-white ${
                  !isConnected || !commentText || campaign.deleted
                    ? 'bg-gray-600 cursor-not-allowed'
                    : `bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary}`
                } mb-4`}
              >
                Submit Comment
              </button>

              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`${theme.bg.secondary} p-4 rounded-lg border ${theme.border} mb-2 animate-fade-in`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-xl">
                        {getRandomCatEmoji(comment.user)}
                      </div>
                      <p className={`text-sm ${theme.colors.text.accent}`}>
                        {shortenAddress(comment.user)}
                      </p>
                    </div>
                    <p className={theme.colors.text.secondary}>
                      {comment.text}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <button
                        onClick={async () => {
                          if (
                            !isConnected ||
                            !address ||
                            comment.likedByUser ||
                            campaign.deleted
                          )
                            return;
                          try {
                            const likeRef = doc(
                              db,
                              'campaigns',
                              id as string,
                              'comments',
                              comment.id,
                              'likes',
                              address.toLowerCase()
                            );
                            const likeSnap = await getDoc(likeRef);
                            if (!likeSnap.exists()) {
                              await setDoc(likeRef, {
                                likedAt: new Date().toISOString(),
                              });
                              setComments((prev) =>
                                prev.map((c) =>
                                  c.id === comment.id
                                    ? {
                                        ...c,
                                        likeCount: c.likeCount + 1,
                                        likedByUser: true,
                                      }
                                    : c
                                )
                              );
                              toast.success('Comment liked!');
                            }
                          } catch (err) {
                            console.error('Failed to like comment:', err);
                            toast.error('Failed to like comment.');
                          }
                        }}
                        disabled={
                          comment.likedByUser ||
                          !isConnected ||
                          campaign.deleted
                        }
                        className={`flex items-center space-x-1 text-sm ${
                          comment.likedByUser
                            ? 'text-red-400'
                            : 'text-gray-400'
                        } hover:text-red-300 transition-colors duration-300`}
                      >
                        <FaHeart className="text-sm" />
                        <span>
                          {comment.likeCount}{' '}
                          {comment.likeCount === 1
                            ? 'Like'
                            : 'Likes'}
                        </span>
                      </button>
                      <p className="text-xs text-gray-400">
                        {new Date(
                          comment.timestamp
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
