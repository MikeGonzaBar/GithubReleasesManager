/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown, defaultMessage: string = "An unknown error occurred"): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return defaultMessage;
}

