import { useEffect } from "react";
import "./Toast.css";

export interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
    duration?: number;
}

interface ToastProps {
    toast: Toast;
    onClose: () => void;
}

export function ToastComponent({ toast, onClose }: ToastProps) {
    useEffect(() => {
        const duration = toast.duration ?? 3000;
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [toast.duration, onClose]);

    return (
        <div className={`toast toast-${toast.type}`} onClick={onClose}>
            <span className="toast-message">{toast.message}</span>
            <button type="button" className="toast-close" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
        </div>
    );
}

