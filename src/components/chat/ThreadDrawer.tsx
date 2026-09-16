import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Reply, Hash, Smile, Paperclip } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Message } from '../../types';
import { api } from '../../services/api';
import { signalR } from '../../services/signalr';

export const ThreadDrawer: React.FC = () => {
  const { activeThreadParent, closeThread, currentUser, userSettings } = useApp();
  const [replies, setReplies] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const parentId = activeThreadParent?.id;

  const loadReplies = async () => {
    if (!parentId) return;
    const res = await api.getMessages({ parentMessageId: parentId });
    if (res.success && res.data) {
      setReplies(res.data);
    }
  };

  useEffect(() => {
    loadReplies();
  }, [parentId]);

  // Realtime updates for thread
  useEffect(() => {
    if (!parentId) return;

    const handleMsgCreated = (msg: Message) => {
      if (msg && msg.parentMessageId === parentId) {
        setReplies(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    signalR.on('MessageCreated', handleMsgCreated);
    signalR.on('ThreadReplyCreated', handleMsgCreated);
    return () => {
      signalR.off('MessageCreated', handleMsgCreated);
      signalR.off('ThreadReplyCreated', handleMsgCreated);
    };
  }, [parentId]);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeThreadParent) return;

    const contentToSend = replyText.trim();
    setReplyText('');

    const res = await api.sendMessage({
      channelId: activeThreadParent.channelId,
      conversationId: activeThreadParent.conversationId,
      parentMessageId: activeThreadParent.id,
      content: contentToSend
    });

    if (res.success && res.data) {
      setReplies(prev => {
        if (prev.some(m => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
    }
  };

  if (!activeThreadParent) return null;

  return (
    <aside aria-label="Hilo de discusión" className="w-full sm:w-96 fixed sm:relative inset-y-0 right-0 bg-slate-950 border-l border-slate-800 flex flex-col h-full z-30 select-none text-xs shadow-2xl">
      {/* Header */}
      <div className="h-14 border-b border-slate-800 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Reply className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-slate-100 text-sm">Hilo de discusión</span>
        </div>
        <button
          onClick={closeThread}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent Message Card */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-start gap-2.5">
          <img
            src={activeThreadParent.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={activeThreadParent.senderName}
            className="w-8 h-8 rounded-lg object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-slate-100">{activeThreadParent.senderName}</span>
              <span className="text-[10px] text-slate-500">
                {new Date(activeThreadParent.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
              {activeThreadParent.content}
            </p>
          </div>
        </div>
      </div>

      {/* Replies Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          {replies.length} {replies.length === 1 ? 'Respuesta' : 'Respuestas'}
        </div>

        {replies.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            Aún no hay respuestas en este hilo. Sé el primero en responder.
          </div>
        ) : (
          replies.map(reply => (
            <div key={reply.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
              <img
                src={reply.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={reply.senderName}
                className="w-7 h-7 rounded-lg object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-slate-200">{reply.senderName}</span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-300 mt-0.5 whitespace-pre-wrap leading-relaxed">
                  {reply.content}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply Composer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 focus-within:border-indigo-500/70">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => {
              if (userSettings.enterSendsMessage) {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              } else {
                if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendReply();
                }
              }
            }}
            placeholder={`Responder en el hilo... (${userSettings.enterSendsMessage ? 'Enter para enviar' : 'Shift+Enter para enviar'})`}
            rows={2}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs focus:outline-none resize-none"
          />
          <div className="flex items-center justify-end mt-1">
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim()}
              className={`p-1.5 rounded-lg transition-colors ${
                replyText.trim()
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
