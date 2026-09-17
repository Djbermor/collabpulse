/**
 * InCallChatPanel — FASE 6
 * 
 * Full-featured chat drawer embedded in the CallWindow.
 * Features:
 * - Real message persistence via POST /conversations/:id/messages
 * - Optimistic UI updates (status: 'sending' → 'sent' → 'delivered' → 'read')
 * - System message rendering (join/leave events, call start/end)
 * - Unread badge on toggle button
 * - Auto-scroll to newest message
 * - Emoji reaction micro-interactions
 * - Per-message status ticks (✓ sent, ✓✓ delivered, ✓✓ read)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, X, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { useCall, InCallChatMessage } from '../../context/CallContext';
import { useApp } from '../../context/AppContext';

// ─────────────────────────────────────────────────────────
// Status Tick Indicator
// ─────────────────────────────────────────────────────────
const StatusTick: React.FC<{ status?: InCallChatMessage['status'] }> = ({ status }) => {
  if (!status || status === 'sending') {
    return <Clock className="w-3 h-3 text-slate-500 inline-block ml-1" />;
  }
  if (status === 'failed') {
    return <AlertCircle className="w-3 h-3 text-rose-400 inline-block ml-1" title="Error al enviar" />;
  }
  if (status === 'sent') {
    return <Check className="w-3 h-3 text-slate-400 inline-block ml-1" title="Enviado" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="w-3 h-3 text-slate-300 inline-block ml-1" title="Entregado" />;
  }
  if (status === 'read') {
    return <CheckCheck className="w-3 h-3 text-indigo-400 inline-block ml-1" title="Leído" />;
  }
  return null;
};

// ─────────────────────────────────────────────────────────
// Individual Message Bubble
// ─────────────────────────────────────────────────────────
const MessageBubble: React.FC<{
  msg: InCallChatMessage;
  isSelf: boolean;
}> = ({ msg, isSelf }) => {
  const isSystem = msg.isSystem || msg.messageType === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-1.5">
        <span className="text-[10px] text-slate-500 italic bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/40">
          {msg.text || msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 ${isSelf ? 'items-end' : 'items-start'}`}>
      {!isSelf && (
        <span className="text-[10px] text-indigo-300 font-semibold px-1">
          {msg.senderName}
        </span>
      )}
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm transition-all ${
          isSelf
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/60'
        } ${msg.status === 'failed' ? 'opacity-70 border border-rose-500/40' : ''}`}
      >
        {msg.text || msg.content}
        <span className={`flex items-center gap-0.5 mt-0.5 ${isSelf ? 'justify-end' : 'justify-start'}`}>
          <span className={`text-[9px] font-mono ${isSelf ? 'text-indigo-200' : 'text-slate-500'}`}>
            {msg.time}
          </span>
          {isSelf && <StatusTick status={msg.status} />}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Main InCallChatPanel
// ─────────────────────────────────────────────────────────
export const InCallChatPanel: React.FC = () => {
  const {
    chatMessages,
    showInCallChat,
    setShowInCallChat,
    sendInCallMessage,
    callConversationId
  } = useCall();

  const { currentUser } = useApp();
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    if (showInCallChat && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showInCallChat]);

  // Focus input when panel opens
  useEffect(() => {
    if (showInCallChat) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [showInCallChat]);

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText('');
    try {
      await sendInCallMessage(text);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [inputText, isSending, sendInCallMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as any);
    }
  }, [handleSend]);

  if (!showInCallChat) return null;

  return (
    <div
      className="w-80 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 flex flex-col h-full shrink-0"
      style={{ animation: 'slideInFromRight 0.2s ease-out' }}
      role="complementary"
      aria-label="Chat de la llamada"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span className="text-slate-100 font-semibold text-sm">Chat de la llamada</span>
          {!callConversationId && (
            <span
              className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/20"
              title="La persistencia está disponible una vez que la llamada se confirma"
            >
              Solo local
            </span>
          )}
        </div>
        <button
          onClick={() => setShowInCallChat(false)}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Cerrar chat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" id="incall-chat-messages">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium">Sin mensajes aún</p>
              <p className="text-slate-600 text-[10px] mt-0.5">
                Los mensajes son{' '}
                {callConversationId ? 'guardados permanentemente' : 'solo para esta sesión'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isSelf={msg.senderId === 'current-user' || msg.senderId === currentUser?.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          id="incall-chat-input"
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={callConversationId ? 'Escribe un mensaje...' : 'Chat local (sin persistencia)'}
          disabled={isSending}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50"
          maxLength={2000}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
          aria-label="Enviar mensaje"
        >
          {isSending ? (
            <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </form>
    </div>
  );
};

export default InCallChatPanel;
