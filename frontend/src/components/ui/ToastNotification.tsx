import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";

export interface ToastProps {
  show: boolean;
  type?: "warning" | "error" | "info" | "success";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  duration?: number; // ms, default 6000
}

export function ToastNotification({
  show,
  type = "warning",
  title,
  message,
  actionLabel,
  onAction,
  onClose,
  duration = 6000,
}: ToastProps) {
  const [progress, setProgress] = useState(100);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!show) {
      return;
    }

    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;
    let current = 100;

    const timer = setInterval(() => {
      current -= step;
      if (current <= 0) {
        clearInterval(timer);
        setProgress(0);
        onCloseRef.current();
      } else {
        setProgress(current);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [show, title, message, duration]);

  if (!show) return null;

  const config = {
    warning: {
      border: "border-amber-300 ring-4 ring-amber-500/10",
      bg: "bg-white/95 backdrop-blur-md",
      iconBg: "bg-amber-100 text-amber-700",
      icon: AlertTriangle,
      titleColor: "text-amber-950",
      progressBar: "bg-amber-500",
      badge: "bg-amber-100 text-amber-800 border-amber-300",
      badgeText: "Batas Kuota",
    },
    error: {
      border: "border-rose-300 ring-4 ring-rose-500/10",
      bg: "bg-white/95 backdrop-blur-md",
      iconBg: "bg-rose-100 text-rose-700",
      icon: ShieldAlert,
      titleColor: "text-rose-950",
      progressBar: "bg-rose-500",
      badge: "bg-rose-100 text-rose-800 border-rose-300",
      badgeText: "Akses Dibatasi",
    },
    info: {
      border: "border-blue-300 ring-4 ring-blue-500/10",
      bg: "bg-white/95 backdrop-blur-md",
      iconBg: "bg-blue-100 text-blue-700",
      icon: Info,
      titleColor: "text-blue-950",
      progressBar: "bg-blue-600",
      badge: "bg-blue-100 text-blue-800 border-blue-300",
      badgeText: "Informasi",
    },
    success: {
      border: "border-emerald-300 ring-4 ring-emerald-500/10",
      bg: "bg-white/95 backdrop-blur-md",
      iconBg: "bg-emerald-100 text-emerald-700",
      icon: CheckCircle2,
      titleColor: "text-emerald-950",
      progressBar: "bg-emerald-600",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      badgeText: "Berhasil",
    },
  }[type];

  const IconComponent = config.icon;

  return (
    /* Bottom-right fixed notification container */
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-[100] w-[calc(100vw-3rem)] sm:w-full sm:max-w-md pointer-events-auto animate-in slide-in-from-bottom-5 fade-in duration-300"
    >
      <div
        className={`relative overflow-hidden rounded-2xl border-2 ${config.border} ${config.bg} p-5 sm:p-6 shadow-2xl shadow-slate-900/15 transition-all`}
      >
        {/* Top Header Row with Icon, Badges, and Close Button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${config.iconBg} shadow-xs`}
            >
              <IconComponent className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${config.badge}`}
              >
                {config.badgeText}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Peringatan Sistem IKK
              </span>
            </div>
          </div>

          {/* Close button with ample target size */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup notifikasi"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-3.5 pl-0 sm:pl-[52px]">
          <h4 className={`text-base font-bold ${config.titleColor} leading-snug`}>
            {title}
          </h4>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={() => {
                  onAction();
                  onClose();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-xs hover:shadow transition-all"
              >
                <span>{actionLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              Tutup
            </button>
          </div>
        </div>

        {/* Shrinking Auto-Dismiss Progress Bar at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-100 overflow-hidden">
          <div
            style={{ width: `${progress}%` }}
            className={`h-full ${config.progressBar} transition-all duration-75 ease-linear`}
          />
        </div>
      </div>
    </div>
  );
}
