// File: components/CampaignCard.tsx
import Image from 'next/image';
import Link from 'next/link';
import { Campaign } from '@/lib/types';
import { getRandomCatEmoji, shortenAddress } from '@/lib/utils';
import { theme } from '@/app/styles/theme';
import { FaHeart, FaComment } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface CampaignCardProps {
  campaign: Campaign;
  onLike: () => void;
}

export default function CampaignCard({
  campaign,
  onLike,
}: CampaignCardProps) {
  const {
    id,
    title,
    author,
    image,
    yesVotes,
    noVotes,
    likedByUser,
    contractProposalId,
    commentCount,
    likeCount,
    status,
  } = campaign;

  const totalVotes = yesVotes + noVotes;
  const shareLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/proposal/${id}`
      : '';

  const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
  const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;

  const isLive = status === 'Live';

  return (
    <div
      className={`${theme.bg.primary} rounded-xl border ${theme.border} ${theme.shadow} hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300 overflow-hidden flex flex-col`}
    >
      {image && (
        <Image
          src={image}
          alt={title}
          width={600}
          height={192}
          className="w-full h-40 sm:h-48 object-cover"
          onError={(e) => (e.currentTarget.src = '/campaigns/placeholder.png')}
        />
      )}
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center text-xl md:text-2xl">
              {getRandomCatEmoji(author)}
            </div>
            <div>
              <h3 className={`text-base md:text-lg font-semibold ${theme.colors.text.primary}`}>
                Proposal ID: {contractProposalId}
              </h3>
              <p className={`text-xs md:text-sm ${theme.colors.text.accent} italic`}>
                By {shortenAddress(author)}
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
        <h4 className={`text-md font-medium ${theme.colors.text.primary} mb-3`}>{title}</h4>
        <div className="mb-4 bg-gray-800/50 rounded-lg p-3 text-center">
          <p className={`text-xl md:text-2xl font-bold ${theme.colors.text.accent} drop-shadow-md`}>
            Total Votes: {totalVotes}
          </p>
        </div>
        <div className="space-y-3 mb-4">
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Yes: {yesVotes}</span>
              <span>{yesPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-teal-400 h-full transition-all duration-500 ease-in-out"
                style={{ width: `${yesPercentage}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>No: {noVotes}</span>
              <span>{noPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-red-500 to-orange-400 h-full transition-all duration-500 ease-in-out"
                style={{ width: `${noPercentage}%` }}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <button
            onClick={() => onLike()}
            disabled={likedByUser}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
              likedByUser
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200'
            }`}
          >
            <FaHeart className={`text-lg ${likedByUser ? 'text-red-200' : 'text-red-400'} ${likedByUser ? '' : 'group-hover:animate-pulse'}`} />
            <p className={`text-sm font-semibold ${theme.colors.text.secondary}`}>
              <span className={theme.colors.text.accent}>{likeCount}</span> {likeCount === 1 ? 'Like' : 'Likes'}
            </p>
          </button>
          <div
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 cursor-pointer group`}
          >
            <FaComment className={`text-lg text-blue-400 group-hover:animate-pulse`} />
            <p className={`text-sm font-semibold ${theme.colors.text.secondary}`}>
              <span className={theme.colors.text.accent}>{commentCount}</span> {commentCount === 1 ? 'Comment' : 'Comments'}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareLink);
              toast.success('Link copied to clipboard!');
            }}
            className={`w-full px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary} transition-all duration-300`}
            aria-label="Share Proposal"
          >
            Share
          </button>
          <Link
            href={`/proposal/${id}`}
            className={`block w-full px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary} text-center transition-all duration-300`}
          >
            View Proposal
          </Link>
        </div>
      </div>
    </div>
  );
}