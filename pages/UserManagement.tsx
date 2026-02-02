
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole, User } from '../types';
import { 
  UserCog, 
  ShieldAlert, 
  Trash2, 
  Edit, 
  Plus, 
  Check, 
  X, 
  Lock, 
  User as UserIcon,
  ShieldCheck,
  Zap,
  Eye,
  EyeOff,
  List,
  CheckSquare
} from 'lucide-react';

// Define available menus for permissions
const AVAILABLE_MENUS = [
    { id: 'residents', label: 'Data Warga' },
    { id: 'meter', label: 'Input Meteran' },
    { id: 'billing', label: 'Tagihan & Pembayaran' },
    { id: 'arrears', label: 'Tunggakan' },
    { id: 'complaints', label: 'Layanan Aduan' },
    { id: 'bank-mutation', label: 'Mutasi Bank' },
    { id: 'transactions', label: 'Transaksi Harian' },
    { id: 'balance-sheet', label: 'Neraca Keuangan' },
    { id: 'setup', label: 'Pengaturan' },
    { id: 'user-management', label: 'Manajemen Pengguna' }
];

const UserManagement: React.FC = () => {
  const { systemUsers, currentUser, addSystemUser, updateSystemUser, deleteSystemUser, addNotification } = useApp();
  
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    role: UserRole.OPERATOR,
    password: '',
    permissions: [] as string[]
  });

  const isSuperAdmin = currentUser?.id === '0'; // Check if current user is Super Admin

  // Handle ESC Key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showModal) setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showModal]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({ 
        username: '', 
        role: UserRole.OPERATOR, 
        password: '',
        permissions: [] // Default empty
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      role: user.role as UserRole,
      password: (user as any).password || '',
      permissions: user.permissions || []
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handlePermissionToggle = (menuId: string) => {
      setFormData(prev => {
          if (prev.permissions.includes(menuId)) {
              return { ...prev, permissions: prev.permissions.filter(id => id !== menuId) };
          } else {
              return { ...prev, permissions: [...prev.permissions, menuId] };
          }
      });
  };

  const handleSelectAllPermissions = () => {
      if (formData.permissions.length === AVAILABLE_MENUS.length) {
          setFormData(prev => ({ ...prev, permissions: [] })); // Deselect All
      } else {
          setFormData(prev => ({ ...prev, permissions: AVAILABLE_MENUS.map(m => m.id) })); // Select All
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
      await updateSystemUser({
        id: editingUser.id,
        username: formData.username,
        role: formData.role,
        password: formData.password,
        permissions: formData.permissions
      } as User);
      addNotification("Data pengguna berhasil diperbarui", "success");
    } else {
      await addSystemUser({
        id: Math.random().toString(36).substr(2, 9),
        username: formData.username,
        role: formData.role,
        password: formData.password,
        permissions: formData.permissions
      } as User);
      addNotification("Pengguna baru berhasil ditambahkan", "success");
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus pengguna ini?")) {
      await deleteSystemUser(id);
      addNotification("Pengguna berhasil dihapus", "success");
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Manajemen Pengguna</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Konfigurasi Hak Akses Sistem</p>
        </div>

        {isSuperAdmin && (
             <div className="px-4 py-2 bg-slate-900 text-white rounded-xl flex items-center gap-2 shadow-lg shadow-slate-900/20">
                <Zap size={16} className="text-yellow-400" fill="currentColor" />
                <span className="text-[10px] font-black uppercase tracking-widest">Mode Super Admin</span>
             </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Info Card */}
         <div className="lg:col-span-1 space-y-6">
            <div className="card p-8 border border-slate-100 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-xl">
               <ShieldCheck size={48} className="mb-4 text-emerald-400" />
               <h3 className="text-xl font-black uppercase tracking-tight mb-2">Kontrol Akses</h3>
               <p className="text-xs font-medium text-slate-300 leading-relaxed">
                 Manajemen pengguna sistem (Admin & Operator). 
                 <br/><br/>
                 Anda dapat mengatur akses menu secara spesifik untuk setiap pengguna.
               </p>
               
               <button 
                 onClick={handleOpenAdd}
                 className="mt-8 w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                 title="Tambah User Baru"
               >
                 <Plus size={16} /> Tambah Pengguna
               </button>
            </div>
         </div>

         {/* User List */}
         <div className="lg:col-span-2">
            <div className="card border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Daftar Pengguna Sistem</h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                     <tr>
                       <th className="px-6 py-4">Nama Pengguna</th>
                       <th className="px-6 py-4">Peran / Jabatan</th>
                       <th className="px-6 py-4 text-center">Hak Akses</th>
                       <th className="px-6 py-4 text-center">Aksi</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {systemUsers.map((user) => {
                       const isUserAdmin = user.role === UserRole.ADMIN;
                       const canEdit = isSuperAdmin || (!isUserAdmin); // SuperAdmin can edit all, Admin can only edit Operator
                       const permissionCount = user.permissions ? user.permissions.length : (user.role === UserRole.ADMIN ? 'All' : 'Limited');
                       
                       return (
                         <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                  <UserIcon size={18} />
                               </div>
                               <span className="font-bold text-slate-700">{user.username}</span>
                             </div>
                           </td>
                           <td className="px-6 py-4">
                             <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${user.role === UserRole.ADMIN ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                               {user.role}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-center">
                             <span className="text-slate-500 text-xs font-bold bg-slate-100 px-2 py-1 rounded">
                                {Array.isArray(user.permissions) 
                                    ? `${user.permissions.length} Menu` 
                                    : (user.role === UserRole.ADMIN ? 'Akses Penuh' : 'Mode Lama')
                                }
                             </span>
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex justify-center gap-2">
                               {canEdit ? (
                                 <>
                                   <button 
                                     onClick={() => handleOpenEdit(user)}
                                     className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                                   >
                                     <Edit size={16} />
                                   </button>
                                   <button 
                                     onClick={() => handleDelete(user.id)}
                                     className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all"
                                   >
                                     <Trash2 size={16} />
                                   </button>
                                 </>
                               ) : (
                                 <div className="px-3 py-2 bg-slate-100 rounded-xl text-slate-400 flex items-center gap-2 cursor-not-allowed">
                                    <Lock size={12} />
                                    <span className="text-[9px] font-black uppercase">Terkunci</span>
                                 </div>
                               )}
                             </div>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
             <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div>
                   <h3 className="font-black text-lg text-slate-800">{editingUser ? 'Ubah Pengguna' : 'Tambah Pengguna'}</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelola kredensial & hak akses</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                   <X size={20} />
                </button>
             </div>
             
             <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nama Pengguna</label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input 
                                required
                                type="text" 
                                value={formData.username}
                                onChange={(e) => setFormData({...formData, username: e.target.value})}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                placeholder="nama pengguna"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kata Sandi</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input 
                                required
                                type={showPassword ? "text" : "password"}
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                                className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                placeholder="••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Peran / Jabatan</label>
                   <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, role: UserRole.ADMIN})}
                        className={`p-3 rounded-xl border font-black text-xs uppercase tracking-widest transition-all ${formData.role === UserRole.ADMIN ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 text-slate-400 hover:border-indigo-200'}`}
                      >
                        Administrator
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, role: UserRole.OPERATOR})}
                        className={`p-3 rounded-xl border font-black text-xs uppercase tracking-widest transition-all ${formData.role === UserRole.OPERATOR ? 'bg-orange-50 border-orange-200 text-orange-600' : 'border-slate-200 text-slate-400 hover:border-orange-200'}`}
                      >
                        Operator
                      </button>
                   </div>
                   {!isSuperAdmin && formData.role === UserRole.ADMIN && (
                      <p className="mt-2 text-[10px] font-bold text-rose-500 flex items-center">
                         <ShieldAlert size={12} className="mr-1" />
                         Perhatian: Anda tidak dapat mengubah pengguna Admin lain kecuali Super Admin.
                      </p>
                   )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <div className="flex justify-between items-center mb-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <List size={14} /> Hak Akses Menu
                        </label>
                        <button 
                            type="button" 
                            onClick={handleSelectAllPermissions}
                            className="text-[10px] font-bold text-blue-500 hover:text-blue-700"
                        >
                            {formData.permissions.length === AVAILABLE_MENUS.length ? 'Hapus Semua' : 'Pilih Semua'}
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {AVAILABLE_MENUS.map(menu => {
                            const isChecked = formData.permissions.includes(menu.id);
                            return (
                                <div 
                                    key={menu.id}
                                    onClick={() => handlePermissionToggle(menu.id)}
                                    className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${isChecked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                        {isChecked && <Check size={14} strokeWidth={3} />}
                                    </div>
                                    <span className={`text-xs font-bold ${isChecked ? 'text-emerald-700' : 'text-slate-600'}`}>{menu.label}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-3 text-[10px] text-slate-400 italic">
                        *Menu yang tidak dicentang akan disembunyikan dari pengguna ini.
                    </p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <button 
                    type="submit" 
                    disabled={!isSuperAdmin && formData.role === UserRole.ADMIN && editingUser !== null}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    Simpan Data
                    </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
