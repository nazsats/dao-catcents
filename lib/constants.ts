// lib/constants.ts

export const CONTRACT_ADDRESS = '0x6e8ABF0e93B09aC375F57403E207B1dDfEACAC90';
export const ADMIN_ADDRESS       = '0x6D54EF5Fa17d69717Ff96D2d868e040034F26024'; 
export const MONAD_EXPLORER_URL  = 'https://testnet.monadscan.com';
export const MONAD_TESTNET_CHAIN_ID = 10143;

export const monadTestnet = {
  id: MONAD_TESTNET_CHAIN_ID,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://monad-testnet-rpc.drpc.org'] },
    public:  { http: ['https://monad-testnet-rpc.drpc.org'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: MONAD_EXPLORER_URL },
  },
};

// ----------------------------------------------------------------
// ‖  FRONTEND‐ONLY “whitelist” OF ADMIN ADDRESSES (all lowercase)  ‖
// ‖  Add as many extra addresses here as you like.                 ‖
// ‖  You can still compare the on‐chain `admin()` call to          ‖
// ‖  ADMIN_ADDRESS, but this array gives you a quick way to        ‖
// ‖  say “these are all the wallets allowed to see the Admin UI.”  ‖
// ----------------------------------------------------------------
export const ADMIN_WHITELIST: string[] = [
  ADMIN_ADDRESS.toLowerCase(),
  '0x6D54EF5Fa17d69717Ff96D2d868e040034F26024'.toLowerCase(),
  '0xE5De1D605ea68A661aF5a22FDFeFB8E5fa4a021a'.toLowerCase(),
  // …add more “front‐end” admins here, all in lowercase.
];

// ----------------------------------------------------------------
// ‖  ABI remains unchanged                                      
// ----------------------------------------------------------------
export const contractAbi = [
  {
    inputs: [],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'campaignId',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'title',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'enum GovernanceDAO.Status',
        name: 'status',
        type: 'uint8',
      },
    ],
    name: 'CampaignCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'campaignId',
        type: 'uint256',
      },
    ],
    name: 'CampaignDeleted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'campaignId',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'enum GovernanceDAO.Status',
        name: 'status',
        type: 'uint8',
      },
    ],
    name: 'CampaignStatusUpdated',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: '_title',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: '_duration',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: '_allowAbstain',
        type: 'bool',
      },
    ],
    name: 'createCampaign',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_campaignId',
        type: 'uint256',
      },
    ],
    name: 'deleteCampaign',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_campaignId',
        type: 'uint256',
      },
      {
        internalType: 'enum GovernanceDAO.Status',
        name: '_status',
        type: 'uint8',
      },
    ],
    name: 'updateCampaignStatus',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_campaignId',
        type: 'uint256',
      },
      {
        internalType: 'enum GovernanceDAO.VoteType',
        name: '_voteType',
        type: 'uint8',
      },
      {
        internalType: 'uint256',
        name: '_votingPower',
        type: 'uint256',
      },
    ],
    name: 'vote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'campaignId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'voter',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'enum GovernanceDAO.VoteType',
        name: 'voteType',
        type: 'uint8',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'votes',
        type: 'uint256',
      },
    ],
    name: 'Voted',
    type: 'event',
  },
  {
    inputs: [],
    name: 'activeCampaignCount',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'admin',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'campaignCount',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'campaigns',
    outputs: [
      {
        internalType: 'uint256',
        name: 'id',
        type: 'uint256',
      },
      {
        internalType: 'string',
        name: 'title',
        type: 'string',
      },
      {
        internalType: 'enum GovernanceDAO.Status',
        name: 'status',
        type: 'uint8',
      },
      {
        internalType: 'uint256',
        name: 'yesVotes',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'noVotes',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'abstainVotes',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'startTime',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'endTime',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'allowAbstain',
        type: 'bool',
      },
      {
        internalType: 'bool',
        name: 'isDeleted',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveCampaignIds',
    outputs: [
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_campaignId',
        type: 'uint256',
      },
    ],
    name: 'getCampaign',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'id',
            type: 'uint256',
          },
          {
            internalType: 'string',
            name: 'title',
            type: 'string',
          },
          {
            internalType: 'enum GovernanceDAO.Status',
            name: 'status',
            type: 'uint8',
          },
          {
            internalType: 'uint256',
            name: 'yesVotes',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'noVotes',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'abstainVotes',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'startTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'endTime',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'allowAbstain',
            type: 'bool',
          },
          {
            internalType: 'bool',
            name: 'isDeleted',
            type: 'bool',
          },
        ],
        internalType: 'struct GovernanceDAO.Campaign',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'hasVotedByUser',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'isCampaignActive',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];
