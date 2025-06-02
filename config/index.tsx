// config/index.tsx
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { cookieStorage, createStorage } from "wagmi";
import { monadTestnet } from '@reown/appkit/networks';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error("Project ID is not defined");

export const networks = [monadTestnet];

// Debug monadTestnet
console.log('monadTestnet in config:', monadTestnet);

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  networks,
  projectId
});

export const config = wagmiAdapter.wagmiConfig;