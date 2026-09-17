import React, { useState, useMemo } from 'react';
import { ParticipantTile, ParticipantTileProps } from './ParticipantTile';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ParticipantGridProps {
  localParticipant: ParticipantTileProps;
  remoteParticipants: ParticipantTileProps[];
  isScreenSharingActive?: boolean;
}

const PAGE_SIZE = 12; // Max tiles per page to maintain clean, crisp rendering

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  localParticipant,
  remoteParticipants,
  isScreenSharingActive = false
}) => {
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Combine local and remote participants
  const allParticipants = useMemo(() => {
    return [localParticipant, ...remoteParticipants];
  }, [localParticipant, remoteParticipants]);

  // Check if anyone is sharing screen (spotlight mode)
  const screenSharer = useMemo(() => {
    return allParticipants.find(p => p.isScreenSharing);
  }, [allParticipants]);

  const totalCount = allParticipants.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const effectivePage = Math.min(currentPage, Math.max(0, totalPages - 1));

  const paginatedParticipants = useMemo(() => {
    const start = effectivePage * PAGE_SIZE;
    return allParticipants.slice(start, start + PAGE_SIZE);
  }, [allParticipants, effectivePage]);

  // Deterministic Grid Layout Classes based on participant count (Inconsistency #15)
  const getGridClass = (count: number): string => {
    if (count === 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2 grid-rows-1';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3 grid-rows-2';
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-3 md:grid-cols-4 grid-rows-3';
  };

  // SPOTLIGHT MODE (Screen Share active)
  if (screenSharer) {
    const otherParticipants = allParticipants.filter(p => p.id !== screenSharer.id);

    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-3 p-3 overflow-hidden bg-slate-950">
        {/* Main Screen Share Spotlight Stage */}
        <div className="flex-1 h-full min-h-[300px] rounded-xl overflow-hidden border border-slate-800 bg-black">
          <ParticipantTile {...screenSharer} />
        </div>

        {/* Side Carousel for Webcams */}
        <div className="w-full md:w-64 h-36 md:h-full flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-800">
          {otherParticipants.map((participant) => (
            <div key={participant.id} className="min-w-[160px] md:min-w-0 h-32 md:h-40 flex-shrink-0">
              <ParticipantTile {...participant} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STANDARD GRID MODE
  const displayCount = paginatedParticipants.length;
  const gridClass = getGridClass(displayCount);

  return (
    <div className="relative w-full h-full flex flex-col p-3 overflow-hidden bg-slate-950">
      {/* Grid Canvas */}
      <div className={`flex-1 grid ${gridClass} gap-3 w-full h-full min-h-0`}>
        {paginatedParticipants.map((participant) => (
          <div key={participant.id} className="w-full h-full min-h-0 min-w-0">
            <ParticipantTile {...participant} />
          </div>
        ))}
      </div>

      {/* Pagination Controls when exceeding 12 participants (Inconsistency #15) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={effectivePage === 0}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 font-medium">
            Página {effectivePage + 1} de {totalPages} ({totalCount} participantes)
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={effectivePage >= totalPages - 1}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
