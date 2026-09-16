import React from 'react';
import { useApp } from '../../context/AppContext';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { realtimeConnected } = useApp();

  if (realtimeConnected) return null;

  return (
    <div
      id="collabpulse-offline-banner"
      role="alert"
      className="bg-amber-600/90 text-amber-50 px-4 py-1.5 text-xs flex items-center justify-between z-40 border-b border-amber-500/50 backdrop-blur-xs font-medium"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-3.5 h-3.5 animate-pulse" />
        <span>Conectando con el hub de tiempo real (SignalR / Redis)... Los mensajes se sincronizarán al reconectar.</span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 text-[11px] font-semibold bg-amber-700/80 hover:bg-amber-700 px-2 py-0.5 rounded transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
        Reintentar ahora
      </button>
    </div>
  );
};
