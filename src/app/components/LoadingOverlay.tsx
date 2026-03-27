import React from 'react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function LoadingOverlay({ isVisible, message = 'Processing...' }: LoadingOverlayProps) {
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-0 bg-[rgba(36,51,81,0.4)] backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="loading-card">
        <div className="dot-animation !w-3 !h-3" style={{ animationDuration: '0.8s' }} />
        <div className="text-center">
          <p className="font-medium text-[14px] text-[var(--sc-text-primary)] mb-1">{message}</p>
          <p className="text-[12px] text-[var(--sc-text-secondary)]">This may take a moment...</p>
        </div>
      </div>
    </div>
  );
}
