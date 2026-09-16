import React, { useState } from 'react';
import { X, UserPlus, Mail, Check, Copy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const InviteModal: React.FC = () => {
  const { isInviteOpen, setIsInviteOpen, currentTenant } = useApp();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Member');
  const [success, setSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isInviteOpen) return null;

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    await api.inviteUser(email.trim(), role);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setIsInviteOpen(false);
      setEmail('');
    }, 1500);
  };

  const inviteLink = `${window.location.origin}/join/${currentTenant?.slug || 'workspace'}?token=inv-corp-991`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none text-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-slate-100 text-sm">Invitar miembros al equipo</h3>
          </div>
          <button onClick={() => setIsInviteOpen(false)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-slate-400 leading-relaxed">
            Invita a colaboradores para unirse a <strong className="text-slate-200">{currentTenant?.name}</strong>.
            Tendrán acceso inmediato a canales públicos y llamadas de equipo.
          </p>

          <form onSubmit={handleSendInvite} className="space-y-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Correo electrónico empresarial</label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Rol de acceso (RBAC)</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
              >
                <option value="Member">Miembro Estándar (Acceso a canales y tareas)</option>
                <option value="Admin">Administrador (Gestión de usuarios y canales)</option>
                <option value="Guest">Invitado (Canales específicos únicamente)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md shadow-indigo-600/30 transition-colors flex items-center justify-center gap-1.5"
            >
              {success ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>¡Invitación enviada con éxito!</span>
                </>
              ) : (
                <span>Enviar Invitación</span>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-medium text-slate-400">O comparte el enlace directo de acceso:</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-400 font-mono text-[11px] select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={copyInviteLink}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
