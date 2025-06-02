// lib/types.ts
export interface Campaign {
  id: string;
  author: string;
  title: string;
  content: string;
  date: string;
  image?: string;
  yesVotes: number;
  noVotes: number;
  abstainVotes?: number;
  likedByUser: boolean;
  votedByUser: 'yes' | 'no' | 'abstain' | null;
  contractProposalId: number;
  isVotable: boolean;
  isLiking?: boolean;
  isVoting?: boolean;
  isExpanded?: boolean;
  commentCount: number;
  allowAbstain: boolean;
  status: 'Created' | 'Active' | 'Live' | 'Approved' | 'Ended';
  endDate?: string;
  socialLinks?: {
    twitter?: string;
    discord?: string;
    website?: string;
  };
  invalid?: boolean;
  deleted?: boolean; // New field
}

export interface Comment {
  id: string;
  text: string;
  user: string;
  timestamp: string;
  likeCount: number;
  likedByUser: boolean;
}