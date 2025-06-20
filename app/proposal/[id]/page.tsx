// File: app/proposal/[id]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  Timestamp,
  updateDoc,
  addDoc,
  increment,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';
import { useAccount, useReadContract, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Loader from '@/components/Loader';
import LikeButton from '@/components/LikeButton';
import VoteButtons from '@/components/VoteButtons';
import { monadTestnet } from '@reown/appkit/networks';
import { CONTRACT_ADDRESS, contractAbi } from '@/lib/constants';
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

export default function ProposalDetail() {
  const { id } = useParams();
  const proposalId = Array.isArray(id) ? id[0] : id;
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { handleVote, isPending: isVoting, votingPower } = useVote(
    proposalId || '',
    campaign?.contractProposalId || 0,
    address || undefined
  );

  useFirebaseAuth();

  const shareLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/proposal/${proposalId}`
      : '';

  useEffect(() => {
    if (!proposalId) {
      setError('Invalid proposal ID.');
      setIsLoading(false);
      return;
    }

    async function fetchProposalData() {
      setIsLoading(true);

      try {
        const docRef = doc(db, 'campaigns', proposalId!);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setError('Proposal not found.');
          toast.error('Proposal not found.');
          setIsLoading(false);
          return;
        }

        const rawData = docSnap.data() as Record<string, unknown>;

        if (rawData.deleted === true) {
          setError('This proposal has been deleted.');
          toast.error('This proposal has been deleted.');
          setIsLoading(false);
          return;
        }

        const likesCol = collection(db, 'campaigns', proposalId!, 'likes');
        const likesSnap = await getDocs(likesCol);
        const likeCount = likesSnap.size; // Get likeCount from likes subcollection

        const userFavourite = address
          ? likesSnap.docs.some((d) => d.id === address.toLowerCase())
          : false;

        let userVote: 'yes' | 'no' | 'abstain' | null = null;
        if (address) {
          const voteDocSnap = await getDoc(
            doc(db, 'campaigns', proposalId!, 'votes', address.toLowerCase())
          );
          if (voteDocSnap.exists()) {
            const voteData = voteDocSnap.data() as Record<string, unknown>;
            if (['yes', 'no', 'abstain'].includes(voteData.vote as string)) {
              userVote = voteData.vote as 'yes' | 'no' | 'abstain';
            }
          }
        }

        const commentsQuery = query(
          collection(db, 'campaigns', proposalId!, 'comments'),
          orderBy('timestamp', 'desc')
        );
        const commentsSnap = await getDocs(commentsQuery);
        const commentsData: Comment[] = await Promise.all(
          commentsSnap.docs.map(async (commentDoc) => {
            const commentId = commentDoc.id;
            const commentRaw = commentDoc.data() as Record<string, unknown>;

            const commentLikesCol = collection(
              db,
              'campaigns',
              proposalId!,
              'comments',
              commentId,
              'likes'
            );
            const commentLikesSnap = await getDocs(commentLikesCol);
            const commentLikeCount = commentLikesSnap.size;
            const commentLikedByUser = address
              ? commentLikesSnap.docs.some(
                  (likeDoc) => likeDoc.id === address.toLowerCase()
                )
              : false;

            return {
              id: commentId,
              text:
                typeof commentRaw.text === 'string'
                  ? commentRaw.text
                  : '',
              user:
                typeof commentRaw.user === 'string'
                  ? commentRaw.user
                  : 'unknown',
              timestamp:
                typeof commentRaw.timestamp === 'string'
                  ? commentRaw.timestamp
                  : new Date().toISOString(),
              likeCount: commentLikeCount,
              likedByUser: commentLikedByUser,
            } as Comment;
          })
        );

        const date =
          rawData.date instanceof Timestamp
            ? rawData.date.toDate()
            : new Date(
                typeof rawData.date === 'string'
                  ? rawData.date
                  : Date.now()
              );

        const proposalIdNum =
          typeof rawData.contractProposalId === 'number'
            ? rawData.contractProposalId
            : Number(rawData.contractProposalId) || 0;

        const endDateStr =
          rawData.endDate instanceof Timestamp
            ? rawData.endDate.toDate().toISOString()
            : typeof rawData.endDate === 'string'
            ? rawData.endDate
            : undefined;

        let isLive = false;
        if (endDateStr) {
          isLive = new Date(endDateStr).getTime() > Date.now();
        }

        const invalidFlag = rawData.invalid === true;
        const isVotable = isLive && !invalidFlag && userVote === null;

        const campaignData: Campaign = {
          id: docSnap.id,
          author:
            typeof rawData.author === 'string'
              ? rawData.author.toLowerCase()
              : '',
          title:
            typeof rawData.title === 'string' ? rawData.title : '',
          content:
            typeof rawData.content === 'string' ? rawData.content : '',
          date: date.toISOString(),
          image:
            typeof rawData.image === 'string'
              ? rawData.image
              : '/campaigns/placeholder.png',
          yesVotes:
            typeof rawData.yesVotes === 'number' ? rawData.yesVotes : 0,
          noVotes:
            typeof rawData.noVotes === 'number' ? rawData.noVotes : 0,
          abstainVotes:
            typeof rawData.abstainVotes === 'number'
              ? rawData.abstainVotes
              : 0,
          likedByUser: userFavourite,
          votedByUser: userVote,
          contractProposalId: proposalIdNum,
          isVotable,
          commentCount: commentsSnap.size,
          likeCount, // Added likeCount
          allowAbstain: rawData.allowAbstain === true,
          status: isLive
            ? 'Live'
            : (['Created', 'Active', 'Live', 'Approved', 'Ended'] as const).includes(
                rawData.status as unknown as Campaign['status']
              )
            ? (rawData.status as Campaign['status'])
            : 'Created',
          endDate: endDateStr,
          socialLinks:
            typeof rawData.socialLinks === 'object' &&
            rawData.socialLinks !== null
              ? (rawData.socialLinks as {
                  twitter?: string;
                  discord?: string;
                  website?: string;
                })
              : { twitter: '', discord: '', website: '' },
          invalid: invalidFlag,
          deleted: false,
        };

        console.log('Fetched campaign:', campaignData.id, 'likeCount:', campaignData.likeCount); // Debug

        setCampaign(campaignData);
        setComments(commentsData);
      } catch (err) {
        console.error('Failed to load proposal:', err);
        setError('Failed to load proposal.');
        toast.error('Failed to load proposal.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProposalData();
  }, [proposalId, address]);

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

      const errMsg =
        typeof contractError === 'object' &&
        contractError !== null &&
        'message' in contractError &&
        typeof (contractError as { message: unknown }).message === 'string'
          ? (contractError as { message: string }).message
          : '';

      const message = errMsg.includes('Invalid campaign ID')
        ? 'Invalid proposal ID. This proposal does not exist on‐chain.'
        : 'Failed to fetch contract data.';

      setError(message);
      toast.error(message);

      if (
        campaign &&
        errMsg.includes('Invalid campaign ID') &&
        !campaign.invalid
      ) {
        setDoc(
          doc(db, 'campaigns', campaign.id),
          { invalid: true },
          { merge: true }
        ).catch((e) => console.error('Failed to mark invalid:', e));

        setCampaign((prev) =>
          prev ? { ...prev, invalid: true, isVotable: false } : prev
        );
      }
      return;
    }

    if (contractData && campaign && !campaign.invalid && !campaign.deleted) {
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

      const statusMap = ['Created', 'Active', 'Live', 'Approved', 'Ended'] as const;
      const onChainStatusIndex = Number(data.status);
      const onChainStatus: Campaign['status'] =
        statusMap[onChainStatusIndex] || 'Ended';

      const onChainEndSec = Number(data.endTime);
      const nowSec = Math.floor(Date.now() / 1000);
      const isStillLive =
        onChainStatusIndex === 2 && onChainEndSec > nowSec;

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
        isVotable: isStillLive && !campaign.invalid && !userAlreadyVoted,
      };

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
        ).catch((e) => console.error('Failed to sync Firestore:', e));
      }
    }
  }, [contractData, contractError, campaign]);

  const [totalLikes, setTotalLikes] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  useEffect(() => {
    if (!proposalId) return;
    (async () => {
      try {
        const likesCol = collection(db, 'campaigns', proposalId!, 'likes');
        const likesSnap = await getDocs(likesCol);
        setTotalLikes(likesSnap.size);
      } catch (e) {
        console.error('Failed to fetch initial likes count:', e);
      }
    })();
  }, [proposalId]);

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
      proposalId!,
      'likes',
      address.toLowerCase()
    );
    try {
      const likeSnap = await getDoc(likeRef);
      if (!likeSnap.exists()) {
        await setDoc(likeRef, { likedAt: new Date().toISOString() });
        setTotalLikes((prev) => prev + 1);
        setCampaign((prev) =>
          prev ? { ...prev, likedByUser: true, likeCount: prev.likeCount + 1 } : prev
        );
      }
    } catch (err) {
      console.error('Failed to like proposal:', err);
      toast.error('Failed to like proposal.');
    } finally {
      setIsLiking(false);
    }
  };

  const onVote = useCallback(
    async (vote: 'yes' | 'no') => {
      if (!campaign) return;
      try {
        await handleVote(vote);
        setCampaign((prev) =>
          prev ? { ...prev, votedByUser: vote, isVotable: false } : prev
        );
      } catch (err) {
        console.error('Vote failed:', err);
      }
    },
    [campaign, handleVote]
  );

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

  const yesVotes = campaign.yesVotes;
  const noVotes = campaign.noVotes;
  const totalVotes = yesVotes + noVotes;

  const statusStages: Campaign['status'][] = [
    'Created',
    'Active',
    'Live',
    'Approved',
    'Ended',
  ];
  const currentStatusIndex = statusStages.indexOf(campaign.status);
  const isLive =
    campaign.endDate &&
    new Date(campaign.endDate).getTime() > Date.now();

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
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white overflow-x-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #fff' },
        }}
      />
      <main className="flex-1 p-4 xs:p-6 sm:p-8 flex flex-col gap-4 xs:gap-6 max-w-7xl mx-auto w-full box-border">
        {/* Header Section */}
        <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-4 xs:gap-6">
          <button
            onClick={() => router.push('/')}
            className={`${theme.colors.text.primary} hover:text-purple-300 text-sm xs:text-base font-medium`}
          >
            ← Back to Proposals
          </button>
          {!isConnected ? (
            <button
              onClick={() => open()}
              className={`w-full xs:w-auto min-h-12 bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary} text-white px-4 py-3 rounded-full text-sm xs:text-base font-medium transition-transform transform hover:scale-105`}
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={() => disconnect()}
              className={`w-full xs:w-auto min-h-12 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-3 rounded-full text-sm xs:text-base font-medium transition-transform transform hover:scale-105`}
            >
              Disconnect Wallet
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="flex flex-col xl:flex-row gap-4 xs:gap-6">
          {/* Sidebar (Image, Info, Status) */}
          <div className="w-full xl:w-1/3 flex flex-col gap-4 xs:gap-6">
            {/* Social Links */}
            <div className="flex justify-center gap-4 xs:gap-6 py-2 xs:py-4">
              {socialLinks.twitter && isValidUrl(socialLinks.twitter) && (
                <a
                  href={socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl xs:text-2xl text-gray-300 hover:text-cyan-400 hover:scale-110 transition-all duration-200"
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
                  className="text-xl xs:text-2xl text-gray-300 hover:text-cyan-400 hover:scale-110 transition-all duration-200"
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
                  className="text-xl xs:text-2xl text-gray-300 hover:text-cyan-400 hover:scale-110 transition-all duration-200"
                  aria-label="Website"
                >
                  <FaGlobe />
                </a>
              )}
            </div>

            {/* Image */}
            <div className="relative w-full aspect-[3/2] xs:aspect-[4/3] sm:aspect-square max-h-64">
              <Image
                src={campaign.image ?? '/campaigns/placeholder.png'}
                alt={campaign.title}
                fill
                sizes="(max-width: 480px) 100vw, (max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-cover rounded-md shadow-lg"
                onError={(e) => (e.currentTarget.src = '/campaigns/placeholder.png')}
              />
            </div>

            {/* Proposal Information */}
            <div className="p-4 xs:p-6 rounded-lg bg-gray-900/70 border border-gray-700 shadow-lg hover:scale-105 transition-all duration-300">
              <h3 className="text-base xs:text-lg sm:text-xl font-semibold bg-gradient-to-r from-purple-600 to-cyan-500 text-transparent bg-clip-text mb-2">
                Proposal Information
              </h3>
              <p className={`text-sm xs:text-base ${theme.colors.text.secondary}`}>
                Created By:{' '}
                <span className={`font-bold ${theme.colors.text.accent}`}>
                  {shortenAddress(campaign.author)}
                </span>
              </p>
              <p className={`text-sm xs:text-base ${theme.colors.text.secondary}`}>
                Start Date:{' '}
                <span className={`font-bold ${theme.colors.text.accent}`}>
                  {startDate}
                </span>
              </p>
              <p className={`text-sm xs:text-base ${theme.colors.text.secondary}`}>
                End Date:{' '}
                <span className={`font-bold ${theme.colors.text.accent}`}>
                  {endDate}
                </span>
              </p>
            </div>

            {/* Status Progress Bar */}
            <div
              className="p-4 xs:p-6 rounded-lg bg-gray-900/70 border border-gray-700 shadow-lg hover:scale-105 transition-all duration-300 overflow-hidden"
              role="progressbar"
              aria-valuenow={currentStatusIndex + 1}
              aria-valuemin={1}
              aria-valuemax={statusStages.length}
            >
              <h3 className="text-base xs:text-lg sm:text-xl font-semibold bg-gradient-to-r from-purple-600 to-cyan-500 text-transparent bg-clip-text mb-4">
                Status
              </h3>
              <div className="relative flex flex-col gap-4">
                <div className="absolute left-4 xs:left-5 top-0 bottom-0 w-1 bg-gray-700">
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
                      className={`w-8 h-8 xs:w-10 xs:h-10 rounded-full flex items-center justify-center shadow-md hover:animate-gradient ${
                        index <= currentStatusIndex
                          ? 'bg-gradient-to-r from-green-500 to-teal-600'
                          : index === currentStatusIndex + 1
                          ? 'bg-gradient-to-r from-purple-600 to-cyan-500 animate-pulse ring-2 ring-cyan-400'
                          : 'bg-gray-600'
                      }`}
                    >
                      {index <= currentStatusIndex ? (
                        <FaCheckCircle className="text-white text-xs xs:text-sm" />
                      ) : (
                        <span className="text-xs xs:text-sm">{index + 1}</span>
                      )}
                    </div>
                    <div className="ml-3 xs:ml-4">
                      <span
                        className={`text-xs xs:text-sm sm:text-base capitalize ${
                          index <= currentStatusIndex ||
                          index === currentStatusIndex + 1
                            ? 'font-bold bg-gradient-to-r from-purple-600 to-cyan-500 text-transparent bg-clip-text'
                            : theme.colors.text.secondary
                        }`}
                      >
                        {stage}
                      </span>
                    </div>
                    <div className="absolute left-auto right-2 top-10 xs:top-12 hidden group-hover:block bg-black/90 backdrop-blur-sm text-white text-xs p-2 rounded shadow-lg z-10 flex items-center space-x-2 max-w-[80vw] w-48">
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
                        className="absolute left-6 xs:left-7 top-8 xs:top-10 w-3 xs:w-4 h-6 xs:h-8"
                        viewBox="0 0 16 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M8 0 L8 28 L12 24 L8 32 L4 24 L8 28 Z"
                          fill={index < currentStatusIndex ? '#34d399' : '#4b5563'}
                        />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            <div
              className={`${theme.bg.primary} rounded-xl border ${theme.border} ${theme.shadow} p-4 xs:p-6 flex-1`}
            >
              <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between mb-4 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 xs:w-10 xs:h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-lg xs:text-xl">
                    {getRandomCatEmoji(campaign.author)}
                  </div>
                  <div>
                    <h1
                      className={`text-base xs:text-lg sm:text-xl md:text-2xl font-bold ${theme.colors.text.primary}`}
                    >
                      Proposal ID: {campaign.contractProposalId}
                    </h1>
                    <p
                      className={`text-xs xs:text-sm ${theme.colors.text.accent} italic`}
                    >
                      By {shortenAddress(campaign.author)}
                    </p>
                  </div>
                </div>
                <div
                  className={`px-2 xs:px-3 py-1 rounded-full text-xs font-semibold text-white self-start xs:self-center ${
                    isLive
                      ? 'bg-gradient-to-r from-green-400 to-teal-300 animate-pulse'
                      : 'bg-gray-600'
                  }`}
                >
                  {isLive ? 'Live' : 'Ended'}
                </div>
              </div>

              <h2
                className={`text-base xs:text-lg sm:text-xl md:text-2xl font-bold ${theme.colors.text.primary} drop-shadow-md mb-2 relative`}
              >
                {campaign.title}
                <span className="absolute bottom-0 left-0 w-1/2 h-1 bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full" />
              </h2>

              <div className="p-4 xs:p-6 rounded-lg bg-black/20 backdrop-blur-md border border-purple-900/50 hover:border-purple-500 transition-all duration-300 mb-4">
                <p className={`text-sm xs:text-base ${theme.colors.text.secondary}`}>
                  {campaign.content}
                </p>
              </div>

              {isConnected && (
                <div className="bg-gray-900/70 rounded-lg p-4 text-center mb-4">
                  <h3
                    className={`text-sm xs:text-base sm:text-lg font-semibold ${theme.colors.text.primary} mb-2`}
                  >
                    Your Voting Power
                  </h3>
                  <p
                    className={`text-base xs:text-lg sm:text-xl font-bold ${theme.colors.text.accent} drop-shadow-md`}
                  >
                    {votingPower}
                  </p>
                </div>
              )}

              {(campaign.invalid || campaign.deleted) && (
                <div className="bg-red-900/50 border border-red-700 p-4 rounded-lg mb-4">
                  <p className="text-red-200 text-sm xs:text-base">
                    {campaign.deleted
                      ? 'This proposal has been deleted.'
                      : 'This proposal is invalid.'}
                  </p>
                  <p className="text-xs xs:text-sm text-red-300 mt-2">
                    This proposal does not exist on‐chain or has been deleted.
                    Please contact the admin.
                  </p>
                </div>
              )}

              {!campaign.invalid && !campaign.deleted && (
                <div className="flex flex-col gap-4 mb-4">
                  <VoteButtons
                    campaignId={proposalId!}
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

              <div className="flex flex-wrap gap-3 xs:gap-4 mb-4">
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
                  className={`flex items-center space-x-2 px-3 xs:px-4 py-2 min-h-10 rounded-lg bg-gray-900/70 hover:bg-gray-800/70 transition-all duration-200 group ${
                    campaign.deleted ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <FaComment className="text-base xs:text-lg text-blue-400 group-hover:animate-pulse" />
                  <span className={`text-sm xs:text-base font-semibold ${theme.colors.text.accent}`}>
                    {campaign.commentCount}
                  </span>
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    toast.success('Link copied to clipboard!');
                  }}
                  className={`w-full xs:w-auto min-h-10 px-3 xs:px-4 py-2 rounded-full text-sm xs:text-base font-semibold text-white bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary} transition-all duration-300`}
                  aria-label="Share Proposal"
                >
                  Share
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between text-xs xs:text-sm text-gray-300 mb-1">
                    <span>Yes: {yesVotes}</span>
                    <span>
                      {totalVotes > 0
                        ? ((yesVotes / totalVotes) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 xs:h-3 overflow-hidden">
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
                  <div className="flex justify-between text-xs xs:text-sm text-gray-300 mb-1">
                    <span>No: {noVotes}</span>
                    <span>
                      {totalVotes > 0
                        ? ((noVotes / totalVotes) * 100).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 xs:h-3 overflow-hidden">
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

              <div>
                <h2 className={`text-base xs:text-lg sm:text-xl font-bold ${theme.colors.text} mb-4`}>
                  Comments
                </h2>
                <textarea
                  id="comment-input"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className={`w-full p-2 xs:p-3 ${theme.bg.secondary} text-white border ${theme.border} rounded-lg mb-2 text-sm xs:text-base`}
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
                          proposalId!,
                          'comments'
                        ),
                        {
                          text: commentText,
                          user: address.toLowerCase(),
                          timestamp: new Date().toISOString(),
                        }
                      );
                      await updateDoc(
                        doc(db, 'campaigns', proposalId!),
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
                  className={`w-full min-h-12 px-3 xs:px-4 py-2 rounded-full text-sm xs:text-base font-semibold text-white ${
                    !isConnected || !commentText || campaign.deleted
                      ? 'bg-gray-600 cursor-not-allowed'
                      : `bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary}`
                  } mb-4`}
                >
                  Submit Comment
                </button>

                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`${theme.bg.secondary} p-3 xs:p-4 rounded-lg border ${theme.border} mb-2 animate-fade-in`}
                    >
                      <div className="flex items-center space-x-2 xs:space-x-3 mb-2">
                        <div className="w-6 h-6 xs:w-8 xs:h-8 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-base xs:text-lg">
                          {getRandomCatEmoji(comment.user)}
                        </div>
                        <p className={`text-xs xs:text-sm ${theme.colors.text.accent}`}>
                          {shortenAddress(comment.user)}
                        </p>
                      </div>
                      <p className={`text-sm xs:text-base ${theme.colors.text.secondary}`}>
                        {comment.text}
                      </p>
                      <div className="flex items-center space-x-2 xs:space-x-3 mt-2">
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
                                proposalId!,
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
                          className={`flex items-center space-x-1 text-xs xs:text-sm ${
                            comment.likedByUser
                              ? 'text-red-400'
                              : 'text-gray-400'
                          } hover:text-red-300 transition-colors duration-300 min-h-8 px-2`}
                        >
                          <FaHeart className="text-xs xs:text-sm" />
                          <span>
                            {comment.likeCount}{' '}
                            {comment.likeCount === 1
                              ? 'Like'
                              : 'Likes'}
                          </span>
                        </button>
                        <p className="text-xs xs:text-sm text-gray-400">
                          {new Date(comment.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}