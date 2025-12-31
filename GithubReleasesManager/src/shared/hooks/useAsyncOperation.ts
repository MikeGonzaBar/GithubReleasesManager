import { useState, useCallback } from "react";

interface UseAsyncOperationReturn<T, Args extends any[]> {
    execute: (...args: Args) => Promise<T>;
    loading: boolean;
    error: string | null;
}

export function useAsyncOperation<T, Args extends any[]>(
    operation: (...args: Args) => Promise<T>
): UseAsyncOperationReturn<T, Args> {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (...args: Args): Promise<T> => {
        try {
            setLoading(true);
            setError(null);
            const result = await operation(...args);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Operation failed";
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [operation]);

    return { execute, loading, error };
}

