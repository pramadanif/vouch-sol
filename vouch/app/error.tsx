'use client';

import { useEffect } from 'react';
import Button from '@/components/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-brand-surfaceHighlight">
      <div className="bg-white p-8 rounded-3xl shadow-2xl border border-brand-border max-w-md text-center">
        <h2 className="text-2xl font-bold text-brand-primary mb-4">Something went wrong!</h2>
        <p className="text-brand-secondary mb-8 font-light">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <Button onClick={() => reset()} variant="primary" size="lg" className="w-full">
          Try again
        </Button>
      </div>
    </div>
  );
}
