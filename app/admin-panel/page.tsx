// app/admin-panel/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  doc,
  getDocs,
  setDoc,
  collection,
  query,
  orderBy,
  Timestamp,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { toast, Toaster } from 'react-hot-toast';
import Image from 'next/image';
import { JsonRpcProvider, Contract } from 'ethers';
import {
  CONTRACT_ADDRESS,
  contractAbi,
  ADMIN_ADDRESS,
  MONAD_EXPLORER_URL,
  monadTestnet,
} from '@/lib/constants';
import { Campaign } from '@/lib/types';
import { shortenAddress, isValidUrl } from '@/lib/utils';
import { theme } from '@/app/styles/theme';
import { useFirebaseAuth } from '@/lib/hooks/useFirebaseAuth';
import { FaClock, FaEdit, FaSync, FaTrash, FaArrowLeft } from 'react-icons/fa';
import { useAppKit } from '@reown/appkit/react';
import { useRouter } from 'next/navigation';

//
// Define the on‐chain “Campaign” tuple shape returned by `contract.getCampaign(...)`.
//
interface OnChainCampaign {
  id: bigint;
  title: string;
  status: bigint;
  yesVotes: bigint;
  noVotes: bigint;
  abstainVotes: bigint;
  startTime: bigint;
  endTime: bigint;
  allowAbstain: boolean;
  isDeleted: boolean;
}

export default function AdminPage() {
  // ─── Hooks & State ───────────────────────────────────────────────────────────
  const { address, isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const { open } = useAppKit();
  const router = useRouter();

  // 1) Read on‐chain campaignCount (refetch every 2 minutes)
  const { data: campaignCount, error: campaignCountError } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: 'campaignCount',
    chainId: monadTestnet.id,
    query: {
      staleTime: 60_000,
      refetchInterval: 120_000,
    },
  });

  // 2) Read on‐chain admin address
  const { data: contractAdmin } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: contractAbi,
    functionName: 'admin',
    chainId: monadTestnet.id,
  });

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    image: '',
    allowAbstain: false,
    endDate: '',
    status: 'Created' as 'Created' | 'Active' | 'Live' | 'Approved' | 'Ended',
    twitter: '',
    discord: '',
    website: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFirebaseAuth();

  // ─── Warn if on‐chain admin ≠ ADMIN_ADDRESS ────────────────────────────────────
  useEffect(() => {
    if (
      typeof contractAdmin === 'string' &&
      contractAdmin.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()
    ) {
      console.error(
        'Admin address mismatch. Expected:',
        ADMIN_ADDRESS,
        'Got:',
        contractAdmin
      );
      toast.error('Admin address mismatch. Please check contract configuration.');
    }
  }, [contractAdmin]);

  // ─── If campaignCountError, show toast ───────────────────────────────────────
  useEffect(() => {
    if (campaignCountError) {
      console.error('Failed to fetch campaign count:', campaignCountError);
      toast.error('Failed to fetch campaign count.');
    }
  }, [campaignCountError]);

  // ─── Fetch Firestore campaigns (limit 50) ────────────────────────────────────
  useEffect(() => {
    async function fetchCampaigns() {
      setIsLoading(true);
      try {
        const campQuery = query(
          collection(db, 'campaigns'),
          orderBy('date', 'desc'),
          limit(50)
        );
        const campSnapshot = await getDocs(campQuery);
        const fetchedCampaigns: (Campaign | null)[] = await Promise.all(
          campSnapshot.docs.map(async (campDoc) => {
            const campData = campDoc.data();
            if (campData.deleted) return null;

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
              image: (campData.image as string) || '/campaigns/placeholder.png',
              yesVotes: (campData.yesVotes as number) || 0,
              noVotes: (campData.noVotes as number) || 0,
              abstainVotes: (campData.abstainVotes as number) || 0,
              contractProposalId: Number(campData.contractProposalId) || 0,
              commentCount: (campData.commentCount as number) || 0,
              allowAbstain: (campData.allowAbstain as boolean) || false,
              status:
                (campData.status as
                  | 'Created'
                  | 'Active'
                  | 'Live'
                  | 'Approved'
                  | 'Ended') || 'Created',
              endDate: campData.endDate
                ? campData.endDate instanceof Timestamp
                  ? campData.endDate.toDate().toISOString()
                  : (campData.endDate as string)
                : null,
              socialLinks:
                (campData.socialLinks as {
                  twitter?: string;
                  discord?: string;
                  website?: string;
                }) || { twitter: '', discord: '', website: '' },
              invalid: (campData.invalid as boolean) || false,
              deleted: (campData.deleted as boolean) || false,
            } as Campaign;
          })
        );
        setCampaigns(fetchedCampaigns.filter((c): c is Campaign => c !== null));
      } catch (error: unknown) {
        console.error('Failed to fetch campaigns:', error);
        toast.error('Failed to fetch campaigns.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleInputChange = useCallback(
    (field: string, value: string | boolean) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const validateInputs = () => {
    if (form.title.length < 3 || form.title.length > 100) {
      toast.error('Title must be between 3 and 100 characters.');
      return false;
    }
    // Remove upper‐bound check on description; only enforce a minimum length:
    if (form.description.length < 10) {
      toast.error('Description must be at least 10 characters.');
      return false;
    }
    // No longer enforcing `form.description.length <= 1000`
    if (
      imageFile &&
      !['image/jpeg', 'image/png', 'image/gif'].includes(imageFile.type)
    ) {
      toast.error('Please upload a JPEG, PNG, or GIF image.');
      return false;
    }
    if (imageFile && imageFile.size > 5 * 1024 * 1024) {
      toast.error('Image size exceeds 5MB limit.');
      return false;
    }
    const socialLinks = [form.twitter, form.discord, form.website].filter(Boolean);
    for (const url of socialLinks) {
      if (
        typeof url === 'string' &&
        (!isValidUrl(url) || !url.match(/^(https?:\/\/)/))
      ) {
        toast.error(
          'Social media links must be valid URLs starting with http:// or https://'
        );
        return false;
      }
    }
    return true;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error('Please upload a JPEG, PNG, or GIF image.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size exceeds 5MB limit.');
        return;
      }
      setImageFile(file);
      setForm({ ...form, image: URL.createObjectURL(file) });
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title,
      description: campaign.content,
      image: campaign.image || '',
      allowAbstain: campaign.allowAbstain,
      endDate: campaign.endDate
        ? new Date(campaign.endDate).toISOString().split('T')[0]
        : '',
      status: campaign.status,
      twitter: campaign.socialLinks?.twitter || '',
      discord: campaign.socialLinks?.discord || '',
      website: campaign.socialLinks?.website || '',
    });
    setImageFile(null);
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    const pendingToast = toast.loading('Deleting campaign...');
    try {
      await setDoc(
        doc(db, 'campaigns', campaignId),
        { deleted: true },
        { merge: true }
      );
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      toast.dismiss(pendingToast);
      toast.success('Campaign marked as deleted.');
    } catch (error: unknown) {
      console.error('Failed to delete campaign:', error);
      toast.dismiss(pendingToast);
      toast.error('Failed to delete campaign.');
    }
  };

  // ─── Create / Update Campaign ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !isConnected ||
      !address ||
      address.toLowerCase() !== ADMIN_ADDRESS.toLowerCase() ||
      isPending
    ) {
      toast.error('Unauthorized or action pending.');
      return;
    }

    if (!validateInputs()) return;

    const pendingToast = toast.loading(
      editingId ? 'Updating campaign...' : 'Creating campaign...'
    );
    try {
      // 1) Possibly upload image
      let imageUrl = form.image;
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Image upload failed:', {
            status: response.status,
            statusText: response.statusText,
            error: (errorData as { error?: string }).error || 'Unknown error',
            details: (errorData as { details?: string }).details || 'No details provided',
          });
          throw new Error(
            `Image upload failed: ${
              (errorData as { error?: string }).error || response.statusText
            }`
          );
        }
        const { imageUrl: uploadedImageUrl } = await response.json();
        imageUrl = uploadedImageUrl;
      }

      // 2) Compute durationSeconds
      let durationSeconds: number;
      if (form.endDate) {
        const endMS = new Date(form.endDate).getTime();
        if (endMS <= Date.now()) {
          toast.error('End date must be in the future.');
          toast.dismiss(pendingToast);
          return;
        }
        durationSeconds = Math.floor((endMS - Date.now()) / 1000);
      } else {
        durationSeconds = 7 * 24 * 60 * 60; // default 7 days
      }

      if (!editingId) {
        // ─── Create New Campaign ─────────────────────────────────────────────────
        await writeContract(
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: contractAbi,
            functionName: 'createCampaign',
            args: [form.title, BigInt(durationSeconds), form.allowAbstain],
            chainId: monadTestnet.id,
          },
          {
            onSuccess: async (txHash: `0x${string}`) => {
              // Chain has created the new campaign at index (campaignCount – 1).
              // We can skip calling readContract again—just reuse `campaignCount`.
              if (campaignCount !== undefined) {
                try {
                  const newOnChainId = Number(campaignCount) - 1;

                  // Write new document in Firestore
                  const newDocId = doc(collection(db, 'campaigns')).id;
                  const campaignDataObj = {
                    author: address.toLowerCase(),
                    title: form.title,
                    content: form.description,
                    image: imageUrl || '/campaigns/placeholder.png',
                    date: Timestamp.fromDate(new Date()),
                    yesVotes: 0,
                    noVotes: 0,
                    abstainVotes: 0,
                    contractProposalId: newOnChainId,
                    commentCount: 0,
                    allowAbstain: form.allowAbstain,
                    status: 'Live' as const,
                    endDate: Timestamp.fromDate(
                      new Date(Date.now() + durationSeconds * 1000)
                    ),
                    socialLinks: {
                      twitter: form.twitter || '',
                      discord: form.discord || '',
                      website: form.website || '',
                    },
                    invalid: false,
                    deleted: false,
                  };
                  await setDoc(doc(db, 'campaigns', newDocId), campaignDataObj);

                  // Insert into React state (convert endDate → ISO string)
                  setCampaigns((prev) => [
                    {
                      id: newDocId,
                      author: campaignDataObj.author,
                      title: campaignDataObj.title,
                      content: campaignDataObj.content,
                      date: new Date().toISOString(),
                      image: campaignDataObj.image,
                      yesVotes: campaignDataObj.yesVotes,
                      noVotes: campaignDataObj.noVotes,
                      abstainVotes: campaignDataObj.abstainVotes,
                      contractProposalId: campaignDataObj.contractProposalId,
                      commentCount: campaignDataObj.commentCount,
                      allowAbstain: campaignDataObj.allowAbstain,
                      status: campaignDataObj.status,
                      endDate: campaignDataObj.endDate.toDate().toISOString(),
                      socialLinks: campaignDataObj.socialLinks,
                      invalid: false,
                      deleted: false,
                      // Required fields from Campaign interface:
                      likedByUser: false,
                      votedByUser: null,
                      isVotable: true,
                    },
                    ...prev,
                  ]);

                  // Reset form
                  setForm({
                    title: '',
                    description: '',
                    image: '',
                    allowAbstain: false,
                    endDate: '',
                    status: 'Created',
                    twitter: '',
                    discord: '',
                    website: '',
                  });
                  setImageFile(null);

                  toast.dismiss(pendingToast);
                  toast.success(
                    <div>
                      Campaign created &amp; set live!{' '}
                      <a
                        href={`${MONAD_EXPLORER_URL}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-cyan-400"
                      >
                        View on Monad Explorer
                      </a>
                    </div>,
                    { duration: 5000 }
                  );
                } catch (firestoreErr) {
                  console.error('Firestore write after createCampaign failed:', firestoreErr);
                  toast.dismiss(pendingToast);
                  toast.error('Chain created the campaign but Firestore update failed.');
                }
              } else {
                // campaignCount was undefined—in practice this rarely happens since the hook populates it,
                // but we’ll handle it gracefully:
                toast.dismiss(pendingToast);
                toast.error('Chain created the campaign, but campaignCount is undefined.');
              }
            },
            onError: (error: unknown) => {
              toast.dismiss(pendingToast);
              console.error('Error creating campaign:', error);
              let errorMessage = 'Failed to create campaign.';
              if (
                error instanceof Error &&
                error.message.includes('insufficient funds')
              ) {
                errorMessage =
                  'Insufficient MON balance. Please claim testnet tokens from the Monad faucet.';
              } else if (
                error instanceof Error &&
                error.message.includes('Only admin can access')
              ) {
                errorMessage = 'Only the admin can create campaigns.';
              } else if (
                error instanceof Error &&
                error.message.includes('User rejected the request')
              ) {
                errorMessage = 'Transaction rejected by user.';
              } else if (error instanceof Error) {
                errorMessage = `Failed to create campaign: ${error.message}`;
              }
              toast.error(errorMessage, { duration: 5000 });
            },
          }
        );
      } else {
        // ─── Update Existing Campaign ─────────────────────────────────────────────
        const statusEnum = {
          Created: 0,
          Active: 1,
          Live: 2,
          Approved: 3,
          Ended: 4,
        }[form.status];

        await writeContract(
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: contractAbi,
            functionName: 'updateCampaignStatus',
            args: [
              BigInt(
                campaigns.find((c) => c.id === editingId)?.contractProposalId || 0
              ),
              BigInt(statusEnum),
            ],
            chainId: monadTestnet.id,
          },
          {
            onSuccess: async (txHash: `0x${string}`) => {
              // Wait for the transaction to be mined, then update Firestore
              const provider = new JsonRpcProvider(
                monadTestnet.rpcUrls.default.http[0]
              );
              await provider.waitForTransaction(txHash);

              const campaignRef = doc(db, 'campaigns', editingId!);
              const old = campaigns.find((c) => c.id === editingId) as Campaign;
              const updatedDataObj = {
                author: address.toLowerCase(),
                title: form.title,
                content: form.description,
                image: form.image || '/campaigns/placeholder.png',
                date: Timestamp.fromDate(new Date()),
                yesVotes: old.yesVotes,
                noVotes: old.noVotes,
                abstainVotes: old.abstainVotes,
                contractProposalId: old.contractProposalId,
                commentCount: old.commentCount,
                allowAbstain: form.allowAbstain,
                status: form.status as Campaign['status'],
                endDate: form.endDate
                  ? Timestamp.fromDate(new Date(form.endDate))
                  : Timestamp.fromDate(
                      new Date(Date.now() + durationSeconds * 1000)
                    ),
                socialLinks: {
                  twitter: form.twitter || '',
                  discord: form.discord || '',
                  website: form.website || '',
                },
                invalid: false,
                deleted: false,
              };
              await setDoc(campaignRef, updatedDataObj, { merge: true });

              // Update React state (convert endDate → ISO string)
              setCampaigns((prev) =>
                prev.map((c) =>
                  c.id === editingId
                    ? ({
                        id: editingId!,
                        author: updatedDataObj.author,
                        title: updatedDataObj.title,
                        content: updatedDataObj.content,
                        image: updatedDataObj.image,
                        date: new Date().toISOString(),
                        yesVotes: updatedDataObj.yesVotes,
                        noVotes: updatedDataObj.noVotes,
                        abstainVotes: updatedDataObj.abstainVotes,
                        contractProposalId: updatedDataObj.contractProposalId,
                        commentCount: updatedDataObj.commentCount,
                        allowAbstain: updatedDataObj.allowAbstain,
                        status: updatedDataObj.status,
                        endDate: updatedDataObj.endDate.toDate().toISOString(),
                        socialLinks: updatedDataObj.socialLinks,
                        invalid: false,
                        deleted: false,
                        likedByUser: false,
                        votedByUser: null,
                        isVotable: true,
                      } as Campaign)
                    : c
                )
              );

              // Reset form
              setForm({
                title: '',
                description: '',
                image: '',
                allowAbstain: false,
                endDate: '',
                status: 'Created',
                twitter: '',
                discord: '',
                website: '',
              });
              setImageFile(null);
              setEditingId(null);

              toast.dismiss(pendingToast);
              toast.success(
                <div>
                  Campaign updated!{' '}
                  <a
                    href={`${MONAD_EXPLORER_URL}/tx/${txHash}`}
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
              toast.dismiss(pendingToast);
              console.error('Error updating campaign:', error);
              let errorMessage = 'Failed to update campaign.';
              if (
                error instanceof Error &&
                error.message.includes('insufficient funds')
              ) {
                errorMessage =
                  'Insufficient MON balance. Please claim testnet tokens from the Monad faucet.';
              } else if (
                error instanceof Error &&
                error.message.includes('Only admin can access')
              ) {
                errorMessage = 'Only the admin can update campaigns.';
              } else if (
                error instanceof Error &&
                error.message.includes('User rejected the request')
              ) {
                errorMessage = 'Transaction rejected by user.';
              } else if (error instanceof Error) {
                errorMessage = `Failed to update campaign: ${error.message}`;
              }
              toast.error(errorMessage, { duration: 5000 });
            },
          }
        );
      }
    } catch (error: unknown) {
      toast.dismiss(pendingToast);
      console.error('Error creating/updating campaign:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error(
        `Failed to ${editingId ? 'update' : 'create'} campaign: ${errMsg}`,
        {
          duration: 5000,
        }
      );
    }
  };

  // ─── Sync Campaigns with Blockchain ─────────────────────────────────────────
  const handleSyncCampaigns = async () => {
    const pendingToast = toast.loading('Syncing campaigns...');
    try {
      const campQuery = query(collection(db, 'campaigns'));
      const campSnapshot = await getDocs(campQuery);
      const batch = writeBatch(db);

      // 1) Read on-chain campaignCount (reuse the hook result)
      const currentCampaignCount =
        campaignCount !== undefined ? Number(campaignCount) : 0;

      // 2) Instantiate a JsonRpcProvider & Contract once, then reuse:
      const provider = new JsonRpcProvider(monadTestnet.rpcUrls.default.http[0]);
      const contract = new Contract(CONTRACT_ADDRESS, contractAbi, provider);

      for (const campDoc of campSnapshot.docs) {
        const campData = campDoc.data();
        if (campData.deleted) continue;

        const proposalId = Number(campData.contractProposalId) || 0;
        if (proposalId >= currentCampaignCount) {
          batch.set(
            doc(db, 'campaigns', campDoc.id),
            { invalid: true, status: 'Ended' },
            { merge: true }
          );
          continue;
        }

        try {
          // Call `getCampaign(proposalId)` on‐chain:
          const onChainRaw = (await contract.getCampaign(
            BigInt(proposalId)
          )) as OnChainCampaign;

          const statusMap = [
            'Created',
            'Active',
            'Live',
            'Approved',
            'Ended',
            'Deleted',
          ] as const;
          const contractStatusIndex = Number(onChainRaw.status);
          const contractStatus = statusMap[contractStatusIndex] as Campaign['status'];

          const onChainEndSec = Number(onChainRaw.endTime);
          const nowSec = Math.floor(Date.now() / 1000);
          const isEnded =
            (onChainEndSec > 0 && onChainEndSec < nowSec) ||
            contractStatusIndex === 4 ||
            contractStatusIndex === 5;

          batch.set(
            doc(db, 'campaigns', campDoc.id),
            {
              yesVotes: Number(onChainRaw.yesVotes) || 0,
              noVotes: Number(onChainRaw.noVotes) || 0,
              abstainVotes: Number(onChainRaw.abstainVotes) || 0,
              status: isEnded ? 'Ended' : contractStatus,
              endDate:
                onChainEndSec > 0
                  ? Timestamp.fromDate(new Date(onChainEndSec * 1000))
                  : campData.endDate,
              invalid: false,
            },
            { merge: true }
          );
        } catch (error: unknown) {
          console.error(`Failed to sync campaign ${campDoc.id}:`, error);
          if (
            error instanceof Error &&
            error.message.includes('Invalid campaign ID')
          ) {
            batch.set(
              doc(db, 'campaigns', campDoc.id),
              { invalid: true, status: 'Ended' },
              { merge: true }
            );
          }
        }
      }

      await batch.commit();
      toast.dismiss(pendingToast);
      toast.success('Campaigns synced successfully!');
    } catch (error: unknown) {
      console.error('Failed to sync campaigns:', error);
      toast.dismiss(pendingToast);
      toast.error('Failed to sync campaigns.');
    }
  };

  // ─── Access Control: Only allow when connected to correct ADMIN_ADDRESS ─────
  if (!isConnected) {
    // If not connected, show “Connect Wallet” button and prevent further actions
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <p className="text-gray-200">Please connect your admin wallet to proceed.</p>
          <button
            onClick={() => open()}
            className={`px-6 py-3 rounded-full text-white bg-gradient-to-r ${theme.colors.primary} hover:bg-gradient-to-r hover:${theme.colors.secondary} font-semibold`}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (address?.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <p className="text-red-200">
          Access denied. Please connect with the admin wallet.
        </p>
      </div>
    );
  }

  // ─── Loading Spinner ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black to-purple-950 text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-black to-purple-950 text-white">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #fff' },
        }}
      />
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-cyan-500 text-transparent bg-clip-text mb-6">
            Admin Panel
          </h1>

          {/* ─── Back to Landing Page ───────────────────────────────────── */}
          <button
            onClick={() => router.push('/')}
            className={`flex items-center space-x-2 text-sm mb-6 ${theme.colors.text.primary} hover:text-purple-300`}
          >
            <FaArrowLeft />
            <span>Back to Proposals</span>
          </button>

          {/* ─── Create / Edit Campaign Form ─────────────────────────────────── */}
          <div className="mb-8 p-6 rounded-xl bg-gray-900/70 border border-gray-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">
              {editingId ? 'Edit Campaign' : 'Create New Campaign'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="title">
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="Campaign title"
                  required
                  aria-required="true"
                />
              </div>

              {/* Description (no upper‐bound restriction) */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="Campaign description"
                  rows={6}
                  required
                  aria-required="true"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="image">
                  Image
                </label>
                <input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
                {form.image && (
                  <div className="mt-2 relative w-32 h-32">
                    <Image
                      src={form.image}
                      alt="Preview"
                      fill
                      className="object-cover rounded-md"
                      onError={(e) => (e.currentTarget.src = '/campaigns/placeholder.png')}
                    />
                  </div>
                )}
              </div>

              {/* Allow Abstain */}
              <div className="flex items-center">
                <input
                  id="allowAbstain"
                  type="checkbox"
                  checked={form.allowAbstain}
                  onChange={(e) => handleInputChange('allowAbstain', e.target.checked)}
                  className="mr-2"
                />
                <label className="text-sm font-medium" htmlFor="allowAbstain">
                  Allow Abstain
                </label>
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="endDate">
                  End Date
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                />
              </div>

              {/* Status (only enabled when editing) */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  disabled={!editingId}
                  aria-disabled={!editingId}
                >
                  {['Created', 'Active', 'Live', 'Approved', 'Ended'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Social Links */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="twitter">
                  Twitter URL
                </label>
                <input
                  id="twitter"
                  type="url"
                  value={form.twitter}
                  onChange={(e) => handleInputChange('twitter', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="https://x.com/username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="discord">
                  Discord URL
                </label>
                <input
                  id="discord"
                  type="url"
                  value={form.discord}
                  onChange={(e) => handleInputChange('discord', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="https://discord.gg/invite"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="website">
                  Website URL
                </label>
                <input
                  id="website"
                  type="url"
                  value={form.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  placeholder="https://example.com"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending}
                aria-disabled={isPending}
                className={`w-full px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${
                  theme.colors.primary
                } hover:bg-gradient-to-r hover:${theme.colors.secondary} disabled:bg-gray-600 disabled:cursor-not-allowed`}
              >
                {editingId ? 'Update Campaign' : 'Create Campaign'}
              </button>
            </form>
          </div>

          {/* ─── Sync Button ─────────────────────────────────────────────────────── */}
          <div className="mb-6">
            <button
              onClick={handleSyncCampaigns}
              className={`px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${
                theme.colors.primary
              } hover:bg-gradient-to-r hover:${theme.colors.secondary} flex items-center space-x-2`}
              aria-label="Sync Campaigns with Blockchain"
            >
              <FaSync />
              <span>Sync Campaigns with Blockchain</span>
            </button>
          </div>

          {/* ─── Existing Campaigns List ─────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Existing Campaigns</h2>
            {campaigns.length === 0 ? (
              <p className="text-gray-400">No campaigns found.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {campaigns.map((campaign) => {
                  const endDate = campaign.endDate
                    ? new Date(campaign.endDate)
                    : null;
                  const isLive = endDate && endDate.getTime() > Date.now();
                  return (
                    <div
                      key={campaign.id}
                      className="p-4 rounded-lg bg-gray-900/70 border border-gray-700 shadow-lg hover:scale-105 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold truncate">
                          {campaign.title}
                        </h3>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(campaign)}
                            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700"
                            aria-label={`Edit campaign ${campaign.title}`}
                          >
                            <FaEdit className="text-cyan-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(campaign.id)}
                            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700"
                            aria-label={`Delete campaign ${campaign.title}`}
                          >
                            <FaTrash className="text-red-400" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                        {campaign.content}
                      </p>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-400">
                          By: {shortenAddress(campaign.author)}
                        </span>
                        <span className="text-sm text-gray-400">
                          ID: {campaign.contractProposalId}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            isLive ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-200'
                          }`}
                        >
                          {isLive ? 'Live' : 'Ended'}
                        </span>
                        {isLive && <FaClock className="text-green-400" />}
                      </div>
                      <div className="text-sm text-gray-400">
                        <p>
                          Votes: Yes {campaign.yesVotes} | No {campaign.noVotes} | Abstain{' '}
                          {campaign.abstainVotes}
                        </p>
                        <p>Comments: {campaign.commentCount}</p>
                        <p>End: {endDate ? endDate.toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

