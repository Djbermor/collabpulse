import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  FileText,
  Activity,
  Check,
  Building,
  Key,
  Database,
  Lock,
  Search,
  RefreshCw,
  Sliders,
  UserPlus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Mail,
  User,
  Briefcase,
  UserCheck,
  UserX
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuditLog, UserRole } from '../../types';
import { api } from '../../services/api';

export const AdminView: React.FC = () => {
  const { currentTenant, currentWorkspace, currentUser, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'audit' | 'settings'>('stats');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [wsName, setWsName] = useState(currentWorkspace?.name || '');
  const [wsDesc, setWsDesc] = useState(currentWorkspace?.description || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modals for CRUD
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);

  // Form states for user creation
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Member');
  const [newPassword, setNewPassword] = useState('');

  // Form states for editing
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Member');
  const [editStatus, setEditStatus] = useState<'Active' | 'Suspended' | 'Inactive'>('Active');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, usersRes, auditRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAuditLogs({ action: auditFilter || undefined })
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
      } else {
        // Fallback to getWorkspaceMembers
        const fallback = await api.getWorkspaceMembers();
        if (fallback.success && fallback.data) {
          setUsers(fallback.data.map((m: any) => ({
            id: m.user?.id || m.userId || m.id,
            memberId: m.id,
            firstName: m.user?.firstName || m.firstName || 'Usuario',
            lastName: m.user?.lastName || m.lastName || '',
            displayName: m.user?.displayName || (m.firstName ? `${m.firstName} ${m.lastName || ''}` : 'Usuario'),
            email: m.user?.email || m.email || '',
            role: m.role || m.user?.role || 'Member',
            jobTitle: m.user?.jobTitle || m.jobTitle || 'Miembro',
            avatarUrl: m.user?.avatarUrl || m.avatarUrl,
            status: m.user?.status || m.status || 'Offline',
            accountStatus: m.user?.accountStatus || (m.status === 'Active' ? 'Active' : 'Inactive'),
            isActive: m.user?.isActive !== false && m.status === 'Active'
          })));
        }
      }
      if (auditRes.success) setAuditLogs(auditRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [auditFilter]);

  const handleRoleChange = async (userId: string, targetRole: string) => {
    const res = await api.updateUserRole(userId, targetRole);
    if (res.success) {
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: targetRole } : u)));
      addToast(`Rol actualizado a ${targetRole}`, 'success');
      loadData();
    } else {
      addToast(res.message || 'Error al actualizar el rol', 'error');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'Active' | 'Suspended' | 'Inactive') => {
    const res = await api.updateAccountStatus(userId, newStatus);
    if (res.success) {
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, accountStatus: newStatus, isActive: newStatus === 'Active' } : u)));
      addToast(`Estado de cuenta actualizado a ${newStatus}`, 'success');
      loadData();
    } else {
      addToast(res.message || 'Error al actualizar el estado', 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newFirstName.trim() || !newLastName.trim()) {
      addToast('Por favor complete los campos obligatorios', 'warning');
      return;
    }

    try {
      const res = await api.adminCreateUser({
        email: newEmail.trim(),
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        jobTitle: newJobTitle.trim() || 'Colaborador',
        role: newRole,
        password: newPassword.trim() || undefined
      });

      if (res.success) {
        addToast(`Usuario ${newFirstName} ${newLastName} creado exitosamente`, 'success');
        setIsCreateModalOpen(false);
        setNewFirstName('');
        setNewLastName('');
        setNewEmail('');
        setNewJobTitle('');
        setNewRole('Member');
        setNewPassword('');
        loadData();
      } else {
        addToast(res.message || 'Error al crear usuario', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error de conexión', 'error');
    }
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditFirstName(user.firstName || '');
    setEditLastName(user.lastName || '');
    setEditJobTitle(user.jobTitle || '');
    setEditRole(user.role || 'Member');
    setEditStatus(user.accountStatus || (user.isActive ? 'Active' : 'Inactive'));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await api.adminUpdateUser(editingUser.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        jobTitle: editJobTitle.trim(),
        role: editRole,
        accountStatus: editStatus
      });

      if (res.success) {
        addToast('Usuario actualizado correctamente', 'success');
        setEditingUser(null);
        loadData();
      } else {
        addToast(res.message || 'Error al actualizar usuario', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error de conexión', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    if (currentUser?.id === deletingUser.id) {
      addToast('No puedes eliminar tu propia cuenta de administrador', 'warning');
      setDeletingUser(null);
      return;
    }

    try {
      const res = await api.adminDeleteUser(deletingUser.id);
      if (res.success) {
        addToast(`Usuario ${deletingUser.firstName || ''} ${deletingUser.lastName || ''} eliminado`, 'success');
        setUsers(prev => prev.filter(u => u.id !== deletingUser.id));
        setDeletingUser(null);
        loadData();
      } else {
        addToast(res.message || 'Error al eliminar usuario', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error de conexión', 'error');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.updateWorkspaceSettings({
      name: wsName,
      description: wsDesc
    });
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      addToast('Configuración del workspace guardada', 'success');
      loadData();
    } else {
      addToast(res.message || 'Error al guardar configuración', 'error');
    }
  };

  const availableRoles: UserRole[] = ['Owner', 'Admin', 'Member', 'Guest'];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/60 overflow-hidden text-xs relative">
      {/* Header */}
      <div className="h-14 bg-slate-950/70 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-slate-100 text-sm">Administración y Gobernanza del Tenant</h2>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'stats' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Métricas
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Usuarios y RBAC
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Auditoría
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Workspace
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Tab: Stats */}
        {activeTab === 'stats' && (
          <div className="space-y-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-sm">
                <div className="text-slate-400 font-medium text-xs">Total Usuarios</div>
                <div className="text-2xl font-bold text-slate-100 mt-1">{stats?.totalUsers ?? users.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">Con acceso al tenant actual</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-sm">
                <div className="text-slate-400 font-medium text-xs">Canales Activos</div>
                <div className="text-2xl font-bold text-indigo-400 mt-1">{stats?.totalChannels ?? '...'}</div>
                <div className="text-[11px] text-slate-500 mt-1">Públicos y Privados con aislamiento</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-sm">
                <div className="text-slate-400 font-medium text-xs">Mensajes Procesados</div>
                <div className="text-2xl font-bold text-cyan-400 mt-1">{stats?.totalMessages ?? '...'}</div>
                <div className="text-[11px] text-slate-500 mt-1">Indexados en tiempo real con SignalR</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-sm">
                <div className="text-slate-400 font-medium text-xs">Tareas del Sprint</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {stats?.completedTasks ?? 0} / {stats?.totalTasks ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {stats?.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}% completadas
                </div>
              </div>
            </div>

            {/* Architecture Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-slate-950 border border-indigo-500/20 space-y-3">
              <div className="flex items-center gap-2 font-bold text-indigo-300 text-sm">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>Arquitectura Multi-Tenant y Seguridad de Datos</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-xs">
                Todas las entidades (usuarios, canales, mensajes, tareas, archivos y logs) están estrictamente
                aisladas por el encabezado <code className="text-indigo-400 font-mono">X-Tenant-Id</code> del tenant{' '}
                <strong className="text-white">{currentTenant?.name}</strong> (<code className="text-slate-400 font-mono">{currentTenant?.id}</code>).
                Ninguna consulta ni conexión de SignalR puede cruzar datos entre distintas organizaciones.
              </p>
            </div>
          </div>
        )}

        {/* Tab: Users & RBAC */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="font-bold text-slate-200 text-sm">Gestión de Usuarios y RBAC ({users.length})</h3>
                <p className="text-slate-400 text-[11px]">Control de acceso basado en roles, estados de cuenta y credenciales</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  title="Actualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Refrescar</span>
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/30"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nuevo Usuario</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold text-[11px]">
                    <th className="p-3">Usuario</th>
                    <th className="p-3">Cargo</th>
                    <th className="p-3">Presencia</th>
                    <th className="p-3">Estado Cuenta</th>
                    <th className="p-3">Rol RBAC</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 flex items-center gap-2.5">
                        <img
                          src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={u.firstName}
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-800"
                        />
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <span>{u.firstName} {u.lastName}</span>
                            {currentUser?.id === u.id && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">Tú</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-300">{u.jobTitle || 'Miembro'}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-800">
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'Online' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={u.accountStatus || 'Active'}
                          onChange={e => handleStatusChange(u.id, e.target.value as any)}
                          className={`bg-slate-900 border rounded px-2 py-1 text-[11px] font-medium focus:outline-none ${
                            u.accountStatus === 'Suspended'
                              ? 'text-rose-400 border-rose-500/30'
                              : u.accountStatus === 'Inactive'
                              ? 'text-amber-400 border-amber-500/30'
                              : 'text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          <option value="Active">Activo</option>
                          <option value="Suspended">Suspendido</option>
                          <option value="Inactive">Inactivo</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                        >
                          {availableRoles.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {currentUser?.id !== u.id && (
                            <button
                              onClick={() => handleStatusChange(u.id, u.accountStatus === 'Active' ? 'Inactive' : 'Active')}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                u.accountStatus === 'Active'
                                  ? 'text-emerald-400 hover:text-amber-400 hover:bg-amber-500/10'
                                  : 'text-amber-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={u.accountStatus === 'Active' ? 'Desactivar usuario' : 'Activar usuario'}
                            >
                              {u.accountStatus === 'Active' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Editar usuario"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {currentUser?.id !== u.id && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-slate-200 text-sm">Registro Estructurado de Auditoría</h3>
              <select
                value={auditFilter}
                onChange={e => setAuditFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
              >
                <option value="">Todas las acciones</option>
                <option value="USER_CREATED">USER_CREATED</option>
                <option value="USER_UPDATED">USER_UPDATED</option>
                <option value="USER_DELETED">USER_DELETED</option>
                <option value="USER_STATUS_UPDATED">USER_STATUS_UPDATED</option>
                <option value="CHANNEL_CREATED">CHANNEL_CREATED</option>
                <option value="ROLE_CHANGED">ROLE_CHANGED</option>
                <option value="LOGIN">LOGIN</option>
                <option value="TASK_CREATED">TASK_CREATED</option>
                <option value="MEETING_STARTED">MEETING_STARTED</option>
                <option value="FILE_UPLOADED">FILE_UPLOADED</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold text-[11px]">
                    <th className="p-3">Acción</th>
                    <th className="p-3">Entidad</th>
                    <th className="p-3">Usuario</th>
                    <th className="p-3">Dirección IP</th>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 font-sans">
                        No hay registros para este filtro.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-900/40">
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/50 font-bold text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{log.entity}</td>
                        <td className="p-3 text-slate-200 font-sans font-medium">{log.userName}</td>
                        <td className="p-3 text-slate-400">{log.ipAddress}</td>
                        <td className="p-3 text-slate-500 font-sans">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 text-slate-400 font-sans max-w-xs truncate">
                          {log.metadata ? JSON.stringify(log.metadata) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Settings */}
        {activeTab === 'settings' && (
          <div className="max-w-xl space-y-6">
            <h3 className="font-bold text-slate-100 text-sm">Configuración de Organización y Workspace</h3>

            <form onSubmit={handleSaveSettings} className="space-y-4 p-5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Nombre del Workspace</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Descripción</label>
                <textarea
                  rows={2}
                  value={wsDesc}
                  onChange={e => setWsDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-emerald-400">
                  {saveSuccess && '✓ Configuración actualizada y registrada en auditoría'}
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">Crear Nuevo Usuario</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nombre</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={e => setNewFirstName(e.target.value)}
                    placeholder="Valeria"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Apellido</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={e => setNewLastName(e.target.value)}
                    placeholder="Ramos"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="valeria.ramos@empresa.com"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cargo / Puesto</label>
                  <input
                    type="text"
                    value={newJobTitle}
                    onChange={e => setNewJobTitle(e.target.value)}
                    placeholder="Tech Lead, QA..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rol RBAC</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Contraseña Inicial (Opcional)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Dejar en blanco para predeterminada"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">Editar Usuario: {editingUser.firstName} {editingUser.lastName}</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nombre</label>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Apellido</label>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Correo Electrónico (Solo lectura)</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cargo / Puesto</label>
                  <input
                    type="text"
                    value={editJobTitle}
                    onChange={e => setEditJobTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rol RBAC</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {availableRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Estado de la Cuenta</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="Active">Activo</option>
                  <option value="Suspended">Suspendido</option>
                  <option value="Inactive">Inactivo</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-slate-100 text-sm">Eliminar Usuario</h3>
            </div>
            <p className="text-slate-300 leading-relaxed">
              ¿Está seguro de que desea eliminar a <strong className="text-white">{deletingUser.firstName} {deletingUser.lastName}</strong> (<code className="text-slate-400">{deletingUser.email}</code>)?
              Esta acción revocará de inmediato sus accesos y se registrará en la auditoría.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md shadow-rose-600/30 cursor-pointer"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
