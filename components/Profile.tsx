// components/Profile.tsx
'use client';
import { useState } from 'react';

interface ProfileProps {
  account: string;
  onCopyAddress: () => void;
  onDisconnect: () => void;
}

export default function Profile({ account, onCopyAddress, onDisconnect }: ProfileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shortAddress = `${account.slice(0, 6)}...${account.slice(-4)}`;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white px-4 py-2 rounded-full text-sm font-semibold"
      >
        {shortAddress}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-black/90 border border-purple-900 rounded-lg shadow-md shadow-purple-500/20 p-4">
          <p className="text-gray-300 text-sm mb-2">Wallet: {shortAddress}</p>
          <button
            onClick={onCopyAddress}
            className="w-full text-left text-gray-300 hover:text-purple-400 text-sm mb-2"
          >
            Copy Address
          </button>
          <button
            onClick={() => {
              onDisconnect();
              setIsOpen(false);
            }}
            className="w-full text-left text-gray-300 hover:text-purple-400 text-sm"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}