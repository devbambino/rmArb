// FILE: components/LoginButton.tsx (NEW)
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

// Extends the standard ButtonProps to allow passing any button-related props
interface LoginButtonProps extends Omit<ButtonProps, 'onClick'> {
  children?: React.ReactNode;
}

export function LoginButton({ children, ...props }: LoginButtonProps) {
  const { login } = usePrivy();

  return (
    <Button
      onClick={login}
      {...props} // Pass down any other props like size, className, etc.
    >
      <Wallet className="h-4 w-4 text-[#50e2c3] hover:text-white" />
      {children || 'Sign In'}
    </Button>
  );
}