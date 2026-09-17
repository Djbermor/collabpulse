import React, { useState, useEffect, useRef } from 'react';
import {
  Hash,
  Lock,
  Pin,
  Phone,
  Video,
  Users,
  Smile,
  Paperclip,
  Send,
  MoreVertical,
  Reply,
  Edit2,
  Trash2,
  Code,
  Bold,
  Italic,
  List,
  Check,
  CheckCheck,
  Download,
  FileText,
  Bookmark,
  Search,
  Copy,
  Clock,
  MessageSquare,
  Image as ImageIcon
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCall } from '../../context/CallContext';
import { Message, MessageAttachment, SavedItem } from '../../types';
import { api } from '../../services/api';
import { signalR } from '../../services/signalr';
import { ConversationSettingsModal } from './ConversationSettingsModal';
import { ChannelMembersModal } from '../modals/ChannelMembersModal';

export const ChatArea: React.FC = () => {

  const {
    currentChannel,
    currentConversation,
    activeView,
    currentUser,
    openThread,
    startOrJoinMeeting,
    setIsPinnedOpen,
    setIsSearchOpen,
    typingText,
    saveItem,
    unsaveItem,
    isItemSaved,
    userSettings,
    addToast,
    channels,
    selectChannel,
    setIsStartDmOpen,
    features
  } = useApp();

  const [messages, setMessages] = useState<Message[]>([]);
  const { startCall } = useCall();
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const [pinnedCount, setPinnedCount] = useState<number>(0);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [isConvSettingsOpen, setIsConvSettingsOpen] = useState<boolean>(false);
  const [isChannelMembersOpen, setIsChannelMembersOpen] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<any>(null);

  const channelId = activeView === 'channel' ? currentChannel?.id : undefined;
  const conversationId = activeView === 'conversation' ? currentConversation?.id : undefined;

  // Load messages
  const loadMessages = async () => {
    if (!channelId && !conversationId) return;
    const res = await api.getMessages({ channelId, conversationId });
    if (res.success && res.data) {
      setMessages(res.data);
      const pins = res.data.filter((m: Message) => m.isPinned);
      setPinnedCount(pins.length);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [channelId, conversationId]);

  // Real-time SignalR group subscription
  useEffect(() => {
    const activeGroup = channelId ? `channel:${channelId}` : conversationId ? `conversation:${conversationId}` : null;
    if (activeGroup && currentUser?.id) {
      signalR.joinGroup(activeGroup, currentUser.id);
    }
    return () => {
      if (activeGroup && currentUser?.id) {
        signalR.leaveGroup(activeGroup, currentUser.id);
      }
    };
  }, [channelId, conversationId, currentUser?.id]);

  // Real-time event listeners
  useEffect(() => {
    const handleMsgCreated = (msg: Message) => {
      if (!msg) return;
      if (
        (channelId && msg.channelId === channelId) ||
        (conversationId && msg.conversationId === conversationId)
      ) {
        if (!msg.parentMessageId) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      }
    };

    const handleMsgUpdated = (msg: Message) => {
      if (!msg) return;
      setMessages(prev => {
        const updated = prev.map(m => (m.id === msg.id ? msg : m));
        setPinnedCount(updated.filter(m => m.isPinned).length);
        return updated;
      });
    };

    const handleMsgDeleted = ({ id }: { id: string }) => {
      setMessages(prev => prev.filter(m => m.id !== id));
    };

    const handleReactionAdded = ({ messageId, reaction, reactions }: any) => {
      setMessages(prev =>
        prev.map(m => {
          if (m.id === messageId) {
            if (Array.isArray(reactions)) {
              return { ...m, reactions };
            }
            if (reaction) {
              const exists = m.reactions.some(r => r.id === reaction.id);
              if (!exists) {
                return { ...m, reactions: [...m.reactions, reaction] };
              }
            }
          }
          return m;
        })
      );
    };

    const handleReactionRemoved = ({ messageId, userId, emoji, reactions }: any) => {
      setMessages(prev =>
        prev.map(m => {
          if (m.id === messageId) {
            if (Array.isArray(reactions)) {
              return { ...m, reactions };
            }
            return {
              ...m,
              reactions: m.reactions.filter(r => !(r.userId === userId && r.emoji === emoji))
            };
          }
          return m;
        })
      );
    };

    signalR.on('MessageCreated', handleMsgCreated);
    signalR.on('MessageReceived', handleMsgCreated);
    signalR.on('MessageUpdated', handleMsgUpdated);
    signalR.on('MessageDeleted', handleMsgDeleted);
    signalR.on('ReactionAdded', handleReactionAdded);
    signalR.on('MessageReactionAdded', handleReactionAdded);
    signalR.on('ReactionRemoved', handleReactionRemoved);
    signalR.on('MessageReactionRemoved', handleReactionRemoved);

    return () => {
      signalR.off('MessageCreated', handleMsgCreated);
      signalR.off('MessageReceived', handleMsgCreated);
      signalR.off('MessageUpdated', handleMsgUpdated);
      signalR.off('MessageDeleted', handleMsgDeleted);
      signalR.off('ReactionAdded', handleReactionAdded);
      signalR.off('MessageReactionAdded', handleReactionAdded);
      signalR.off('ReactionRemoved', handleReactionRemoved);
      signalR.off('MessageReactionRemoved', handleReactionRemoved);
    };
  }, [channelId, conversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Typing event emission
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    api.sendTyping({ channelId, conversationId, isTyping: true });

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      api.sendTyping({ channelId, conversationId, isTyping: false });
    }, 2000);
  };

  // Send message
  const handleSendMessage = async () => {
    if (!inputText.trim() && pendingAttachments.length === 0) return;

    const payload = {
      channelId,
      conversationId,
      content: inputText.trim(),
      attachments: pendingAttachments
    };

    setInputText('');
    setPendingAttachments([]);

    const res = await api.sendMessage(payload);
    if (res.success && res.data) {
      setMessages(prev => {
        if (prev.some(m => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
    } else {
      addToast('Error al enviar el mensaje', 'error');
    }
  };

  // Edit message
  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    const res = await api.editMessage(messageId, editContent.trim());
    if (res.success && res.data) {
      setMessages(prev => prev.map(m => (m.id === messageId ? res.data : m)));
      setEditingMessageId(null);
      addToast('Mensaje actualizado', 'success');
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    const res = await api.deleteMessage(messageId);
    if (res.success) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      addToast('Mensaje eliminado', 'info');
    }
  };

  // Toggle Pin
  const handleTogglePin = async (messageId: string) => {
    const res = await api.togglePinMessage(messageId);
    if (res.success) {
      const isPinned = (res as any).isPinned ?? res.data?.isPinned ?? false;
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, isPinned } : m)));
      setPinnedCount(prev => (isPinned ? prev + 1 : Math.max(0, prev - 1)));
      addToast(isPinned ? 'Mensaje fijado al canal' : 'Mensaje desfijado', 'info');
    }
  };

  // Save / Bookmark item
  const handleToggleBookmark = (msg: Message) => {
    if (isItemSaved(msg.id)) {
      unsaveItem(msg.id);
    } else {
      const item: SavedItem = {
        id: msg.id,
        type: 'message',
        title: `${msg.senderName} en ${activeView === 'channel' ? `#${currentChannel?.name}` : 'Chat Directo'}`,
        subtitle: new Date(msg.createdAt).toLocaleDateString(),
        content: msg.content,
        createdAt: new Date().toISOString()
      };
      saveItem(item);
    }
  };

  // Toggle Reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await api.toggleReaction(messageId, emoji);
      if (res.success && res.data) {
        setMessages(prev =>
          prev.map(m => {
            if (m.id === messageId) {
              const newReactions = Array.isArray(res.data) ? res.data : [...m.reactions, res.data];
              return { ...m, reactions: newReactions };
            }
            return m;
          })
        );
      }
    } catch (e) {
      console.error(e);
    }
    setShowEmojiPickerFor(null);
  };

  // Attach real file
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name);
        const res = await api.uploadFile(formData);
        if (res.success && res.data) {
          setPendingAttachments(prev => [
            ...prev,
            {
              id: res.data.id,
              name: res.data.name,
              fileType: res.data.fileType,
              size: res.data.size,
              url: res.data.url
            }
          ]);
          addToast(`Archivo "${file.name}" adjuntado exitosamente`, 'success');
        } else {
          addToast(res.message || 'Error al subir archivo adjunto', 'error');
        }
      } catch (err: any) {
        addToast(err.message || 'Error al subir archivo', 'error');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Quick formatting insert
  const insertFormatting = (prefix: string, suffix: string) => {
    setInputText(prev => `${prev}${prefix}${suffix}`);
  };

  const availableEmojis = ['👍', '❤️', '🚀', '👀', '🎉', '🔥', '👏', '✅'];

  // Render markdown helper
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    let insideCodeBlock = false;
    let codeBuffer: string[] = [];

    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        if (insideCodeBlock) {
          elements.push(
            <div key={`code-${index}`} className="relative my-2 rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-xs overflow-x-auto text-emerald-400">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeBuffer.join('\n'));
                  addToast('Código copiado al portapapeles', 'success');
                }}
                className="absolute top-2 right-2 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Copiar código"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <pre>{codeBuffer.join('\n')}</pre>
            </div>
          );
          codeBuffer = [];
          insideCodeBlock = false;
        } else {
          insideCodeBlock = true;
        }
        return;
      }

      if (insideCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      let formattedText: React.ReactNode = line;

      if (line.startsWith('- ')) {
        formattedText = (
          <li key={index} className="ml-4 list-disc text-slate-300">
            {line.substring(2)}
          </li>
        );
      } else if (line.trim().length > 0) {
        // Simple bold / code formatting
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        formattedText = (
          <p key={index} className="min-h-[1.25rem] text-slate-200 leading-relaxed font-sans">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={pIdx} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-mono text-[11px]">{part.slice(1, -1)}</code>;
              }
              return part;
            })}
          </p>
        );
      } else {
        formattedText = <div key={index} className="h-2" />;
      }

      elements.push(formattedText);
    });

    return elements;
  };

  // Group reactions
  const renderReactions = (msg: Message) => {
    if (!msg.reactions || msg.reactions.length === 0) return null;

    const grouped = msg.reactions.reduce((acc: any, r) => {
      acc[r.emoji] = acc[r.emoji] || { count: 0, userIds: [] };
      acc[r.emoji].count += 1;
      acc[r.emoji].userIds.push(r.userId);
      return acc;
    }, {});

    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {Object.entries(grouped).map(([emoji, data]: [string, any]) => {
          const hasReacted = data.userIds.includes(currentUser?.id);
          return (
            <button
              key={emoji}
              onClick={() => handleToggleReaction(msg.id, emoji)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                hasReacted
                  ? 'bg-indigo-950/70 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <span>{emoji}</span>
              <span className="text-[10px] font-semibold">{data.count}</span>
            </button>
          );
        })}
      </div>
    );
  };

  if (!channelId && !conversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-slate-900/40">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4">
          <MessageSquare className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-200 mb-1">Sin conversación seleccionada</h3>
        <p className="text-xs max-w-sm text-slate-400 mb-5">
          Selecciona un canal en la barra lateral o inicia un mensaje directo con un colaborador.
        </p>
        <div className="flex items-center gap-2.5">
          {channels && channels.length > 0 && (
            <button
              onClick={() => {
                const gen = channels.find(c => c.name === 'general') || channels[0];
                selectChannel(gen.id);
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
            >
              Ir a #{channels.find(c => c.name === 'general')?.name || channels[0]?.name}
            </button>
          )}
          <button
            onClick={() => setIsStartDmOpen(true)}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
          >
            Nuevo Mensaje Directo
          </button>
        </div>
      </div>
    );
  }

  const title = activeView === 'channel' ? currentChannel?.name || 'canal' : (currentConversation as any)?.displayName || 'Conversación';
  const isPrivate = activeView === 'channel' && currentChannel?.isPrivate;

  const handleStartCall = (isVideo: boolean) => {
    if (activeView === 'conversation') {
      const otherUser = (currentConversation as any)?.otherUser;
      if (otherUser?.id) {
        startCall({
          targetUserId: otherUser.id,
          conversationId,
          callType: isVideo ? 'video' : 'audio',
          isVideo,
          title: otherUser.displayName || otherUser.firstName || title
        });
      } else {
        startCall({
          conversationId,
          callType: isVideo ? 'video' : 'audio',
          isVideo,
          title: title || 'Grupo'
        });
      }
    } else if (activeView === 'channel' && currentChannel?.id) {
      startCall({
        channelId: currentChannel.id,
        callType: isVideo ? 'video' : 'audio',
        isVideo,
        title: `#${currentChannel.name}`
      });
    }
  };

  return (
    <div id="chat-area-container" className="flex-1 flex flex-col h-full bg-slate-900/60 overflow-hidden select-none">
      {/* Hidden File Input for Real Attachments */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Channel / DM Header */}
      <div className="h-14 bg-slate-950/70 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-slate-100 text-sm">
            {activeView === 'channel' ? (
              isPrivate ? <Lock className="w-4 h-4 text-slate-400 shrink-0" /> : <Hash className="w-4 h-4 text-indigo-400 shrink-0" />
            ) : null}
            <span className="truncate">{title}</span>
          </div>

          {currentChannel?.topic && (
            <span className="hidden md:inline text-xs text-slate-400 truncate max-w-sm pl-2 border-l border-slate-800">
              {currentChannel.topic}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Search in Conversation */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors cursor-pointer"
            title="Buscar en esta conversación (⌘K)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Pinned Messages Button */}
          <button
            onClick={() => setIsPinnedOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors cursor-pointer"
            title="Ver mensajes fijados"
          >
            <Pin className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Fijados ({pinnedCount})</span>
          </button>

          {/* Channel Members Management */}
          {activeView === 'channel' && currentChannel && (
            <button
              onClick={() => setIsChannelMembersOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors cursor-pointer"
              title="Gestionar miembros del canal"
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Miembros ({currentChannel.memberIds?.length || 0})</span>
            </button>
          )}

          {/* Conversation Settings (Members & Group Management) */}
          {activeView === 'conversation' && currentConversation && (
            <button
              onClick={() => setIsConvSettingsOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition-colors cursor-pointer"
              title="Ajustes de la conversación y miembros"
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Miembros ({currentConversation.memberIds?.length || 2})</span>
            </button>
          )}

          {/* Voice Call Trigger (guarded) */}
          {features.calls && (
            <button
              onClick={() => handleStartCall(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
              title="Iniciar llamada de voz"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voz</span>
            </button>
          )}

          {/* Video Call Trigger (guarded) */}
          {features.videoCalls && (
            <button
              onClick={() => handleStartCall(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer"
              title="Iniciar videollamada"
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Video</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center mb-3 text-slate-400">
              {activeView === 'channel' ? <Hash className="w-6 h-6" /> : <Users className="w-6 h-6" />}
            </div>
            <p className="font-semibold text-slate-300">
              {activeView === 'channel' ? `Este es el inicio del canal #${title}` : `Conversación directa con ${title}`}
            </p>
            <p className="text-slate-500 mt-1">Escribe el primer mensaje para comenzar la conversación.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === currentUser?.id;
            const isEditing = editingMessageId === msg.id;
            const bookmarked = isItemSaved(msg.id);

            return (
              <div
                key={msg.id}
                id={`message-${msg.id}`}
                className={`group relative flex items-start ${
                  userSettings.compactMode ? 'p-1.5 gap-2' : 'p-2.5 gap-3'
                } rounded-xl hover:bg-slate-800/40 transition-colors`}
              >
                {/* Avatar */}
                <img
                  src={msg.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={msg.senderName}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shrink-0 mt-0.5 ring-1 ring-slate-800"
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-100">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Delivery Status indicator for own messages */}
                    {isMe && (
                      <span className="inline-flex items-center text-indigo-400" title="Mensaje entregado">
                        <CheckCheck className="w-3 h-3" />
                      </span>
                    )}

                    {msg.isEdited && (
                      <span className="text-[10px] text-slate-500 italic">(editado)</span>
                    )}

                    {msg.isPinned && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-950/30 px-1.5 py-0.2 rounded border border-amber-800/40">
                        <Pin className="w-2.5 h-2.5" /> Fijado
                      </span>
                    )}

                    {bookmarked && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-semibold bg-cyan-950/30 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        <Bookmark className="w-2.5 h-2.5" /> Guardado
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 mt-1">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full bg-slate-950 border border-indigo-500 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveEdit(msg.id)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-200">
                      {renderMessageContent(msg.content)}
                    </div>
                  )}

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att: MessageAttachment) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 max-w-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                            {att.fileType.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-200 truncate">{att.name}</div>
                            <div className="text-[10px] text-slate-500">{(att.size / 1024).toFixed(1)} KB</div>
                          </div>
                          {att.url && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                              title="Descargar o ver"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Emoji Reactions */}
                  {renderReactions(msg)}

                  {/* Thread Replies Button */}
                  {msg.repliesCount > 0 ? (
                    <button
                      onClick={() => openThread(msg)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors bg-indigo-950/30 hover:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-800/40 cursor-pointer"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      <span>{msg.repliesCount} {msg.repliesCount === 1 ? 'respuesta' : 'respuestas'}</span>
                      {msg.lastReplyAt && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          • Última a las {new Date(msg.lastReplyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => openThread(msg)}
                      className="mt-1 opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                    >
                      <Reply className="w-3 h-3" />
                      <span>Responder en hilo</span>
                    </button>
                  )}
                </div>

                {/* Hover Action Bar */}
                <div className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-lg flex items-center gap-0.5 z-10 transition-opacity">
                  {/* Quick Reactions */}
                  <div className="flex items-center px-1 border-r border-slate-800 gap-0.5">
                    {['👍', '❤️', '🚀'].map(em => (
                      <button
                        key={em}
                        onClick={() => handleToggleReaction(msg.id, em)}
                        className="p-1 hover:bg-slate-800 rounded text-xs transition-transform hover:scale-125 cursor-pointer"
                        title={`Reaccionar con ${em}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>

                  {/* Full Emoji Picker Trigger */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msg.id ? null : msg.id)}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title="Más reacciones"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>

                    {showEmojiPickerFor === msg.id && (
                      <div className="absolute right-0 bottom-full mb-1 bg-slate-900 border border-slate-800 rounded-xl p-2 shadow-2xl flex items-center gap-1 z-50">
                        {availableEmojis.map(em => (
                          <button
                            key={em}
                            onClick={() => handleToggleReaction(msg.id, em)}
                            className="p-1 text-base hover:scale-125 transition-transform cursor-pointer"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reply in thread */}
                  <button
                    onClick={() => openThread(msg)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Responder en hilo"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>

                  {/* Bookmark / Save */}
                  <button
                    onClick={() => handleToggleBookmark(msg)}
                    className={`p-1.5 rounded hover:bg-slate-800 cursor-pointer ${
                      bookmarked ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={bookmarked ? 'Quitar de guardados' : 'Guardar para después'}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>

                  {/* Pin / Unpin */}
                  <button
                    onClick={() => handleTogglePin(msg.id)}
                    className={`p-1.5 rounded hover:bg-slate-800 cursor-pointer ${msg.isPinned ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                    title={msg.isPinned ? 'Desfijar mensaje' : 'Fijar mensaje'}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit (if sender or admin) */}
                  {(isMe || currentUser?.role === 'Owner' || currentUser?.role === 'Admin') && (
                    <button
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setEditContent(msg.content);
                      }}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title="Editar mensaje"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete (if sender or admin) */}
                  {(isMe || currentUser?.role === 'Owner' || currentUser?.role === 'Admin') && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="p-1.5 rounded hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 cursor-pointer"
                      title="Eliminar mensaje"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingText && (
        <div className="px-4 py-1 text-[11px] text-slate-400 italic flex items-center gap-1.5 bg-slate-950/40">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          {typingText}
        </div>
      )}

      {/* Composer Toolbar & Input */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 shrink-0">
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAttachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300"
              >
                <Paperclip className="w-3 h-3 text-indigo-400" />
                <span className="truncate max-w-[150px]">{att.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">({(att.size / 1024).toFixed(0)}KB)</span>
                <button
                  onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-slate-500 hover:text-rose-400 text-xs font-bold ml-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl focus-within:border-indigo-500/70 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
          {/* Formatting Bar */}
          <div className="px-3 py-1.5 border-b border-slate-800 flex items-center gap-1 text-slate-400">
            <button
              onClick={() => insertFormatting('**', '**')}
              className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              title="Negrita (**texto**)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('*', '*')}
              className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              title="Cursiva (*texto*)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('```ts\n', '\n```')}
              className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              title="Bloque de código (```código```)"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('\n- ', '')}
              className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              title="Lista de viñetas"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 flex items-center gap-1 text-[11px] cursor-pointer"
              title="Adjuntar archivo o imagen desde tu equipo"
            >
              <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-medium">Adjuntar</span>
            </button>
          </div>

          {/* Textarea */}
          <textarea
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={e => {
              if (userSettings.enterSendsMessage) {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              } else {
                if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }
            }}
            placeholder={`Enviar un mensaje a #${title}... (${userSettings.enterSendsMessage ? 'Enter para enviar, Shift+Enter para salto de línea' : 'Shift+Enter para enviar'})`}
            rows={2}
            className="w-full bg-transparent px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
          />

          {/* Bottom actions inside composer */}
          <div className="px-3 py-1.5 flex items-center justify-between border-t border-slate-800/40">
            <div className="flex items-center gap-2 text-slate-500 text-[10px]">
              <span>Markdown habilitado</span>
              <span>•</span>
              <span>Arrastra archivos o adjunta arriba</span>
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() && pendingAttachments.length === 0}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                inputText.trim() || pendingAttachments.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title="Enviar mensaje"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Conversation Settings Modal */}
      {currentConversation && (
        <ConversationSettingsModal
          conversation={currentConversation}
          isOpen={isConvSettingsOpen}
          onClose={() => setIsConvSettingsOpen(false)}
        />
      )}

      {/* Channel Members Modal */}
      {currentChannel && (
        <ChannelMembersModal
          channel={currentChannel}
          isOpen={isChannelMembersOpen}
          onClose={() => setIsChannelMembersOpen(false)}
        />
      )}
    </div>
  );
};

