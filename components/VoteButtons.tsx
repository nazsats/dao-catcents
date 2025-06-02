// components/VoteButtons.tsx
interface VoteButtonsProps {
  campaignId: string;
  isVotable: boolean;
  votedByUser: 'yes' | 'no' | null;
  isVoting?: boolean;
  onVote: (vote: 'yes' | 'no') => void;
}

export default function VoteButtons({
  isVotable,
  votedByUser,
  isVoting,
  onVote,
}: VoteButtonsProps) {
  return (
    <div className="flex gap-4">
      <button
        onClick={() => onVote('yes')}
        disabled={!isVotable || isVoting || votedByUser !== null}
        className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold text-white ${
          !isVotable || isVoting || votedByUser !== null
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-green-500 to-teal-600 hover:bg-gradient-to-r hover:from-green-600 hover:to-teal-700'
        }`}
      >
        {isVoting && votedByUser === 'yes' ? 'Voting...' : 'Vote Yes'}
      </button>
      <button
        onClick={() => onVote('no')}
        disabled={!isVotable || isVoting || votedByUser !== null}
        className={`flex-1 px-4 py-2 rounded-full text-sm font-semibold text-white ${
          !isVotable || isVoting || votedByUser !== null
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-red-500 to-orange-600 hover:bg-gradient-to-r hover:from-red-600 hover:to-orange-700'
        }`}
      >
        {isVoting && votedByUser === 'no' ? 'Voting...' : 'Vote No'}
      </button>
    </div>
  );
}
