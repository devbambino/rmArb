import { type PrivyClientConfig } from '@privy-io/react-auth';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

export const privyConfig: PrivyClientConfig = {
  // All your existing Privy settings are correct
  appearance: {
    theme: 'dark',
    accentColor: '#6CB5AB',
    logo: '/logo-sm.png',
    //showWalletLoginFirst: true
  },
  loginMethods: ['email'],
  // This tells Privy's UI which chains to show as options
  supportedChains: [arbitrumSepolia], 
  // This sets the default chain for new logins
  //defaultChain: process.env.NODE_ENV === 'production' ? arbitrum : arbitrumSepolia,
  defaultChain: arbitrumSepolia,
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
  },
};