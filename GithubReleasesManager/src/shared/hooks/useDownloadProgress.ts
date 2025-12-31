import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";

export interface DownloadProgress {
    file_name: string;
    downloaded: number;
    total: number;
    progress: number;
}

interface UseDownloadProgressReturn {
    downloading: string | null;
    setDownloading: (fileName: string | null) => void;
    downloadProgress: { [key: string]: DownloadProgress };
    setDownloadProgress: React.Dispatch<React.SetStateAction<{ [key: string]: DownloadProgress }>>;
    clearProgress: (fileName: string) => void;
}

export function useDownloadProgress(): UseDownloadProgressReturn {
    const [downloading, setDownloading] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: DownloadProgress }>({});

    useEffect(() => {
        let unlistenFn: (() => void) | undefined;
        let isMounted = true;

        const setupListener = async () => {
            const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
                if (isMounted) {
                    setDownloadProgress((prev) => ({
                        ...prev,
                        [event.payload.file_name]: event.payload,
                    }));
                }
            });
            unlistenFn = unlisten;
        };

        setupListener();

        return () => {
            isMounted = false;
            if (unlistenFn) {
                unlistenFn();
            }
        };
    }, []);

    const clearProgress = useCallback((fileName: string) => {
        setDownloadProgress((prev) => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
        });
    }, []);

    return {
        downloading,
        setDownloading,
        downloadProgress,
        setDownloadProgress,
        clearProgress,
    };
}

