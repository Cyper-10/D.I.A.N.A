'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-8 text-center text-gray-900">
      <h2 className="mb-4 text-2xl font-bold">Something went wrong!</h2>
      <p className="mb-8 text-gray-600">{error.message}</p>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition"
      >
        Try again
      </button>
    </div>
  );
}
