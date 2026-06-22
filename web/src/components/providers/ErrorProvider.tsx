"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { ErrorModal } from "@/components/ui/ErrorModal";

interface ErrorContextType {
  showError: (err: unknown) => void;
}

const ErrorContext = createContext<ErrorContextType>({
  showError: () => {},
});

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : JSON.stringify(err));
}

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null);

  const showError = useCallback((err: unknown) => {
    setError(toError(err));
  }, []);

  return (
    <ErrorContext.Provider value={{ showError }}>
      {children}
      <ErrorModal error={error} onClose={() => setError(null)} />
    </ErrorContext.Provider>
  );
}

export function useError() {
  return useContext(ErrorContext);
}
