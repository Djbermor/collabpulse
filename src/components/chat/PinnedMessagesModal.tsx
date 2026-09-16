import React, { useState, useEffect } from 'react';
import { X, Pin, PinOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Message } from '../../types';
import { api } from '../../services/api';

export const PinnedMessagesModal: React.FC = () => {
  const { isPinnedOpen, setIsPinnedOpen, currentChannel } = useApp();
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (isPinnedOpen && currentChannel) {
      api.getMessages({ channelId: currentChannel.id }).then(res => {
        if (res.success && res.data) {
          setPinnedMessages(res.data.filter((m: Message) => m.isPinned));
        }
      });
    }
  }, [isPinnedOpen, currentChannel?.id]);

  const handleUnpin = async (id: string) => {
    await api.togglePin(id);
    setPinnedMessages(prev => prev.filter(m => m.id !== id));
  };

  if (!isPinnedOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-slate-100 text-sm">
              Mensajes fijados en #{currentChannel?.name}
            </h3>
          </div>
          <button
            onClick={() => setIsPinnedOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {pinnedMessages.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No hay mensajes fijados en este canal.
            </div>
          ) : (
            pinnedMessages.map(msg => (
              <div
                key={msg.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={msg.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={msg.senderName}
                      className="w-6 h-6 rounded-lg object-cover"
                    />
                    <span className="font-semibold text-slate-200">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnpin(msg.id)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400"
                    title="Desfijar mensaje"
                  >
                    <PinOff className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-slate-300 whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
