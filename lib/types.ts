export interface Campaign {
  id: string;
  author: string;
  title: string;
  content: string;
  date: string;
  image: string;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  contractProposalId: number;
  commentCount: number;
  likeCount: number;
  allowAbstain: boolean;
  status: 'Created' | 'Active' | 'Live' | 'Approved' | 'Ended';
  endDate?: string;
  socialLinks: {
    twitter?: string;
    discord?: string;
    website?: string;
  };
  invalid: boolean;
  deleted: boolean;
  likedByUser: boolean;
  votedByUser: 'yes' | 'no' | 'abstain' | null;
  isVotable: boolean;
  isExpanded?: boolean;
  isLiking?: boolean;
  isVoting?: boolean;
}

export interface Comment {
  id: string;
  text: string;
  user: string;
  timestamp: string;
  likeCount: number;
  likedByUser: boolean;
}