import React, { useEffect, type ReactNode } from "react";
import { XIcon } from "@heroicons/react/solid";

export interface BottomSheetProps {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  title,
  onClose,
  children,
  className = "",
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={
          "relative w-full bg-background text-text rounded-t-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up pb-[env(safe-area-inset-bottom)] " +
          className
        }
      >
        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
          <span
            className="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20"
            aria-hidden="true"
          />
        </div>
        {(title || showCloseButton) && (
          <div className="flex-shrink-0 px-5 pb-3 flex items-center justify-between border-b border-gray-100 dark:border-white/10">
            {title ? (
              <h3 className="text-lg font-semibold">{title}</h3>
            ) : (
              <span />
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};
