// components/LikeButton.tsx
import Loader from './Loader';
import { theme } from './../app/styles/theme';

interface LikeButtonProps {
  likedByUser: boolean;
  isLiking?: boolean;
  totalLikes: number;
  onLike: () => void;
}

export default function LikeButton({
  likedByUser,
  isLiking = false,
  totalLikes,
  onLike,
}: LikeButtonProps) {
  return (
    <button
      onClick={onLike}
      disabled={likedByUser || isLiking}
      className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium text-white ${
        likedByUser
          ? 'bg-purple-600 cursor-not-allowed'
          : isLiking
          ? 'bg-purple-700 animate-pulse'
          : `bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary}`
      }`}
      aria-label="Like Proposal"
    >
      {isLiking ? (
        <>
          <Loader size={16} />
          <span>Liking...</span>
        </>
      ) : (
        <>
          <span>❤️</span>
          <span>{totalLikes}</span>
        </>
      )}
    </button>
  );
}
