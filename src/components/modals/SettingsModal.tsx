import React, { useState } from 'react';
import {
  X,
  User,
  Moon,
  Sun,
  Bell,
  MessageSquare,
  Shield,
  Keyboard,
  Check,
  Globe,
  Sliders,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, userSettings, updateUserSettings, currentUser, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'messaging' | 'accessibility' | 'security'>('appearance');

  if (!isSettingsOpen) return null;

  return (
    <div
      id="settings-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none animate-in fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[560px] text-slate-100">
        {/* Left Navigation Tabs */}
        <aside className="w-full md:w-56 bg-slate-950/70 border-r border-slate-800/80 p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0 text-xs">
          <div className="px-3 py-2 hidden md:block">
            <h2 id="settings-title" className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Preferencias
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">CollabPulse Desktop</p>
          </div>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors text-left ${
              activeTab === 'appearance' ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>Apariencia</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors text-left ${
              activeTab === 'notifications' ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Notificaciones</span>
          </button>

          <button
            onClick={() => setActiveTab('messaging')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors text-left ${
              activeTab === 'messaging' ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Mensajería</span>
          </button>

          <button
            onClick={() => setActiveTab('accessibility')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors text-left ${
              activeTab === 'accessibility' ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <span>Accesibilidad & Atajos</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-colors text-left ${
              activeTab === 'security' ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-4 h-4 text-purple-400" />
            <span>Seguridad & Sesiones</span>
          </button>
        </aside>

        {/* Right Content Body */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden">
          {/* Top Bar Header */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold capitalize text-slate-200">
              {activeTab === 'appearance' && 'Personalización de Tema & Visual'}
              {activeTab === 'notifications' && 'Preferencias de Alertas & Sonidos'}
              {activeTab === 'messaging' && 'Comportamiento del Chat & Compositor'}
              {activeTab === 'accessibility' && 'Accesibilidad & Teclado (WCAG 2.2)'}
              {activeTab === 'security' && 'Dispositivos Activos & Cifrado'}
            </h3>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Tab Panels */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
            {/* Tab: Appearance */}
            {activeTab === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <h4 className="font-semibold text-slate-100 text-sm mb-1">Tema del Espacio de Trabajo</h4>
                  <p className="text-slate-400 text-xs mb-3">Elige entre una experiencia oscura para descanso visual o una interfaz clara de alto contraste.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        updateUserSettings({ theme: 'dark' });
                        addToast('Tema Oscuro activado', 'info');
                      }}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                        userSettings.theme === 'dark'
                          ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300 ring-2 ring-indigo-500/30'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <Moon className="w-6 h-6 text-indigo-400" />
                      <span className="font-semibold text-xs text-slate-100">Tema Oscuro (Dark Slate)</span>
                      <span className="text-[10px] text-slate-400">Diseñado para entornos profesionales</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateUserSettings({ theme: 'light' });
                        addToast('Tema Claro activado', 'info');
                      }}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                        userSettings.theme === 'light'
                          ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300 ring-2 ring-indigo-500/30'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <Sun className="w-6 h-6 text-amber-400" />
                      <span className="font-semibold text-xs text-slate-100">Tema Claro (Clean Light)</span>
                      <span className="text-[10px] text-slate-400">Óptimo para alta luminosidad</span>
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <h4 className="font-semibold text-slate-100 text-sm mb-2">Densidad de Información</h4>
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer hover:bg-slate-950/70">
                    <div>
                      <div className="font-medium text-slate-200">Modo compacto de mensajes</div>
                      <div className="text-[11px] text-slate-400">Reduce el espaciado vertical entre mensajes consecutivos.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={userSettings.compactMode}
                      onChange={e => updateUserSettings({ compactMode: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700"
                    />
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <h4 className="font-semibold text-slate-100 text-sm mb-2">Idioma de la Interfaz</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        updateUserSettings({ language: 'es' });
                        addToast('Idioma configurado a Español', 'success');
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        userSettings.language === 'es'
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400'
                      }`}
                    >
                      Español (ES)
                    </button>
                    <button
                      onClick={() => {
                        updateUserSettings({ language: 'en' });
                        addToast('Language set to English', 'success');
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        userSettings.language === 'en'
                          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                          : 'border-slate-800 bg-slate-950/40 text-slate-400'
                      }`}
                    >
                      English (US)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer">
                  <div>
                    <div className="font-medium text-slate-200">Sonido de mensajes y menciones</div>
                    <div className="text-[11px] text-slate-400">Reproduce un timbre sutil al recibir nuevos mensajes directos.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={userSettings.soundEnabled}
                    onChange={e => updateUserSettings({ soundEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer">
                  <div>
                    <div className="font-medium text-slate-200">Notificaciones nativas del navegador</div>
                    <div className="text-[11px] text-slate-400">Muestra banners en pantalla para llamadas entrantes y asignación de tareas.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={userSettings.desktopNotifications}
                    onChange={e => updateUserSettings({ desktopNotifications: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700"
                  />
                </label>
              </div>
            )}

            {/* Tab: Messaging */}
            {activeTab === 'messaging' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <h4 className="font-semibold text-slate-100 text-xs mb-2">Comportamiento de la tecla Enter</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="enterBehavior"
                        checked={userSettings.enterSendsMessage}
                        onChange={() => updateUserSettings({ enterSendsMessage: true })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span><strong>Enter envía el mensaje</strong> (Shift + Enter añade un salto de línea)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="enterBehavior"
                        checked={!userSettings.enterSendsMessage}
                        onChange={() => updateUserSettings({ enterSendsMessage: false })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span><strong>Shift + Enter envía el mensaje</strong> (Enter añade un salto de línea)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Accessibility */}
            {activeTab === 'accessibility' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <h4 className="font-semibold text-slate-100 text-xs mb-2 flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-cyan-400" />
                    Atajos de Teclado Globales
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-slate-300">Búsqueda rápida</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">Ctrl + K</kbd>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-slate-300">Cerrar modal/panel</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">Esc</kbd>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-slate-300">Colapsar barra lateral</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">Ctrl + B</kbd>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                      <span className="text-slate-300">Nueva tarea</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">Ctrl + T</kbd>
                    </div>
                  </div>
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer">
                  <div>
                    <div className="font-medium text-slate-200">Reducción de movimiento (Prefers Reduced Motion)</div>
                    <div className="text-[11px] text-slate-400">Minimiza las transiciones y animaciones de apertura.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={userSettings.reducedMotion}
                    onChange={e => updateUserSettings({ reducedMotion: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700"
                  />
                </label>
              </div>
            )}

            {/* Tab: Security */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-100">Sesión actual en navegador</div>
                      <div className="text-[11px] text-slate-400">Chrome en Linux / Cloud Workspace (IP: 10.128.0.4)</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
                      Activa ahora
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2">
                  <h4 className="font-semibold text-slate-100">Cifrado & Row Level Security (RLS)</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Las contraseñas de CollabPulse están hasheadas con <strong>Argon2id</strong> y todos los mensajes y archivos están aislados a nivel de base de datos PostgreSQL mediante directivas RLS por Tenant.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex justify-end gap-2 shrink-0">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
