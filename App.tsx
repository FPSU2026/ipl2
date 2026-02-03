
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate, HashRouter } from 'react-router-dom';
import { 
  LayoutGrid, 
  Users, 
  AlertCircle,
  Droplets,
  FileText,
  ArrowRightLeft,
  Landmark,
  Scale,
  UserCog,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Wallet,
  Monitor,
  Bell,
  User as UserIcon,
  MessageSquareWarning,
  CheckCircle2,
  XCircle,
  Info,
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  UserCheck,
  Loader2
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Residents from './pages/Residents';
import MeterInput from './pages/MeterInput';
import Billing from './pages/Billing';
import Setup from './pages/Setup';
import Transactions from './pages/Transactions';
import BankMutationPage from './pages/BankMutation';
import Arrears from './pages/Arrears';
import BalanceSheet from './pages/BalanceSheet';
import UserManagement from './pages/UserManagement';
import Login from './pages/Login';
import Complaints from './pages/Complaints';
import { User, UserRole } from './types';
import { AppProvider, useApp } from './context/AppContext';

const NOTIFICATION_SOUND = 'data:audio/mp3;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAbXA0MgBUWFhYAAAAEQAAA21pbm9yX3ZlcnNpb24AMABUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzb21tcDQyAFRTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWgAAAA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//uQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVEFHAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sQZBAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

const SidebarItem: React.FC<{ 
  to: string, 
  icon: React.ReactNode, 
  label: string, 
  active: boolean,
  onClick?: () => void 
}> = ({ to, icon, label, active, onClick }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-2 mx-2 transition-all duration-200 group leading-[1.5] ${active ? 'sidebar-item-active font-bold shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg'}`}
  >
    <div className={`transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as any, { size: 14 }) : icon}
    </div>
    <span className="text-[11px] font-bold tracking-tight uppercase">{label}</span>
  </Link>
);

const SidebarHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-6 pt-3 pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">
    {label}
  </div>
);

const AppContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isBellShaking, setIsBellShaking] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser: user, setCurrentUser: setUser, settings, notifications, markNotificationsAsRead, globalPopup, closeGlobalPopup, connectionStatus, t, updateUserProfile } = useApp();
  
  // Profile Update State
  const [profileName, setProfileName] = useState('');
  const [profilePass, setProfilePass] = useState('');
  const [showProfilePass, setShowProfilePass] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.username);
      setProfilePass((user as any).password || '');
    }
  }, [user, showProfileModal]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    const success = await updateUserProfile(user.id, profileName, profilePass);
    if (success) setShowProfileModal(false);
    setIsUpdatingProfile(false);
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasAccess = (path: string) => {
    if (!user) return false;
    if (path === '/') return true; 
    if (user.id === '0') return true;
    if (user.role === UserRole.RESIDENT) {
      const allowedResidentPaths = ['/billing', '/arrears', '/complaints'];
      return allowedResidentPaths.some(p => path.startsWith(p));
    }
    const pathToPermissionMap: Record<string, string> = {
      '/residents': 'residents',
      '/meter': 'meter',
      '/billing': 'billing',
      '/arrears': 'arrears',
      '/complaints': 'complaints',
      '/bank-mutation': 'bank-mutation',
      '/transactions': 'transactions',
      '/balance-sheet': 'balance-sheet',
      '/setup': 'setup',
      '/user-management': 'user-management'
    };
    const requiredPermission = Object.keys(pathToPermissionMap).find(key => path.startsWith(key));
    if (!requiredPermission) return true;
    const permissionId = pathToPermissionMap[requiredPermission];
    if (Array.isArray(user.permissions)) return user.permissions.includes(permissionId);
    if (user.role === UserRole.ADMIN) return true;
    return false;
  };

  useEffect(() => {
    if (user && !hasAccess(location.pathname)) {
      navigate('/');
    }
  }, [location.pathname, user]);

  if (!user) return <Login onLogin={setUser} />;

  const isResident = user.role === UserRole.RESIDENT;
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) markNotificationsAsRead();
  };

  const getPageTitle = () => {
    if (location.pathname === '/') return `${t('menu_dashboard')}, ${user?.username}`;
    const path = location.pathname.split('/')[1];
    switch(path) {
      case 'residents': return t('title_residents');
      case 'meter': return t('title_meter');
      case 'billing': return t('title_billing');
      case 'arrears': return t('title_arrears');
      case 'complaints': return t('title_complaints');
      case 'bank-mutation': return t('title_bank');
      case 'transactions': return t('title_transactions');
      case 'balance-sheet': return t('title_balance');
      case 'setup': return t('title_setup');
      case 'user-management': return t('title_users');
      default: return path.toUpperCase().replace('-', ' ');
    }
  };

  return (
    <div className="flex h-full w-full bg-[#F8FAFC] overflow-hidden">
      <style>{`
        @keyframes shake {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          50% { transform: rotate(-15deg); }
          75% { transform: rotate(10deg); }
          100% { transform: rotate(0deg); }
        }
        .bell-shake { animation: shake 0.5s ease-in-out infinite; }
      `}</style>

      {isMobile && sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed top-0 left-0 z-50 h-full bg-[#1e293b] text-white transition-transform duration-300 ease-in-out flex flex-col border-r border-slate-700/50 shadow-2xl lg:shadow-none lg:static w-56 shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 mb-1 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-[#10B981] rounded-lg flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0"><Wallet size={18} /></div>
            <div className="overflow-hidden">
              <h2 className="text-white font-black text-[12px] tracking-tight leading-tight uppercase truncate">{settings.location_name}</h2>
              <p className="text-[6px] font-bold text-slate-400 tracking-[0.1em] uppercase mt-0.5 leading-tight">WARGA SYSTEM</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-0.5 pb-4 custom-scrollbar">
          <SidebarHeader label="Menu Utama" />
          <SidebarItem to="/" icon={<LayoutGrid />} label={t('menu_dashboard')} active={location.pathname === '/'} onClick={() => isMobile && setSidebarOpen(false)} />
          
          {!isResident && (
            <>
                <SidebarHeader label="Konfigurasi" />
                {hasAccess('/setup') && <SidebarItem to="/setup" icon={<SettingsIcon />} label={t('menu_setup')} active={location.pathname === '/setup'} onClick={() => isMobile && setSidebarOpen(false)} />}
                {hasAccess('/user-management') && <SidebarItem to="/user-management" icon={<UserCog />} label={t('menu_users')} active={location.pathname === '/user-management'} onClick={() => isMobile && setSidebarOpen(false)} />}
                
                <SidebarHeader label="Operasional" />
                {hasAccess('/residents') && <SidebarItem to="/residents" icon={<Users />} label={t('menu_residents')} active={location.pathname === '/residents'} onClick={() => isMobile && setSidebarOpen(false)} />}
                {hasAccess('/meter') && <SidebarItem to="/meter" icon={<Droplets />} label={t('menu_meter')} active={location.pathname === '/meter'} onClick={() => isMobile && setSidebarOpen(false)} />}
            </>
          )}

          <SidebarHeader label="Administrasi" />
          {hasAccess('/billing') && <SidebarItem to="/billing" icon={<FileText />} label={t('menu_billing')} active={location.pathname === '/billing'} onClick={() => isMobile && setSidebarOpen(false)} />}
          {hasAccess('/arrears') && <SidebarItem to="/arrears" icon={<AlertCircle />} label={t('menu_arrears')} active={location.pathname === '/arrears'} onClick={() => isMobile && setSidebarOpen(false)} />}
          {hasAccess('/complaints') && <SidebarItem to="/complaints" icon={<MessageSquareWarning />} label={t('menu_complaints')} active={location.pathname === '/complaints'} onClick={() => isMobile && setSidebarOpen(false)} />}
          
          {!isResident && (
            <>
                <SidebarHeader label="Keuangan" />
                {hasAccess('/bank-mutation') && <SidebarItem to="/bank-mutation" icon={<Landmark />} label={t('menu_bank')} active={location.pathname === '/bank-mutation'} onClick={() => isMobile && setSidebarOpen(false)} />}
                {hasAccess('/transactions') && <SidebarItem to="/transactions" icon={<ArrowRightLeft />} label={t('menu_transactions')} active={location.pathname === '/transactions'} onClick={() => isMobile && setSidebarOpen(false)} />}
                {hasAccess('/balance-sheet') && <SidebarItem to="/balance-sheet" icon={<Scale />} label={t('menu_balance')} active={location.pathname === '/balance-sheet'} onClick={() => isMobile && setSidebarOpen(false)} />}
            </>
          )}
        </div>

        <div className="p-3 space-y-1 shrink-0 bg-[#1e293b] border-t border-slate-700/30">
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all text-[11px] font-bold">
            <LogOut size={14} /> <span>{t('lbl_logout')}</span>
          </button>
          <div className="pt-2 flex items-center justify-center space-x-2 text-slate-600/50">
            <Monitor size={8} /> <a href="https://wa.me/6281973314675" target="_blank" rel="noreferrer" className="text-[7px] font-black tracking-widest uppercase hover:text-emerald-500 transition-colors">GNOME COMP</a>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 h-12 flex items-center px-4 justify-between shrink-0 sticky top-0 z-30 shadow-sm lg:shadow-none">
          <div className="flex items-center space-x-3 overflow-hidden">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 text-slate-500 hover:bg-slate-100 rounded-xl transition-all lg:hidden active:scale-95 shrink-0"><Menu size={18} /></button>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[7px] font-black text-emerald-600 uppercase tracking-[0.15em] lg:hidden truncate leading-none mb-0.5">{settings.location_name}</span>
              <h1 className="text-slate-800 font-extrabold text-xs lg:text-sm truncate leading-tight uppercase tracking-tight">{getPageTitle()}</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full border transition-all ${connectionStatus === 'SYNCING' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-slate-900 border-slate-800 text-white'}`}>
              <div className={`w-1 h-1 rounded-full ${connectionStatus === 'SYNCING' ? 'bg-amber-500 animate-pulse' : 'bg-[#10B981]'}`}></div>
              <span className="text-[7px] font-black tracking-widest uppercase">{connectionStatus === 'SYNCING' ? 'Syncing' : 'Connected'}</span>
            </div>
            <button onClick={handleNotificationClick} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all relative active:scale-95">
                <div className={isBellShaking ? 'bell-shake text-emerald-500' : ''}><Bell size={18} /></div>
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>}
            </button>
            <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>
            <button 
              onClick={() => setShowProfileModal(true)}
              className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[10px] shadow-sm ring-1 ring-white uppercase hover:scale-105 transition-all"
              title="Update Profil"
            >
              {user.username.substring(0, 2)}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 relative z-0 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full h-full">
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/arrears" element={<Arrears />} />
                <Route path="/complaints" element={<Complaints />} />
                {!isResident && (
                <>
                    <Route path="/residents" element={<Residents />} />
                    <Route path="/meter" element={<MeterInput user={user} />} />
                    <Route path="/bank-mutation" element={<BankMutationPage />} />
                    <Route path="/balance-sheet" element={<BalanceSheet />} />
                    <Route path="/user-management" element={<UserManagement />} />
                    <Route path="/setup" element={<Setup />} />
                    <Route path="/transactions" element={<Transactions />} />
                </>
                )}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        {/* Global Popup (Instructions & Alerts) */}
        {globalPopup && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[6px] animate-in fade-in duration-300">
                <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 relative animate-in zoom-in-95 duration-200 flex flex-col items-center border border-slate-100">
                    <button onClick={closeGlobalPopup} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-all hover:rotate-90 active:scale-90 shadow-sm">
                        <X size={18} />
                    </button>
                    <div className="w-20 h-20 rounded-3xl bg-[#ebf3ff] flex items-center justify-center mb-6 shadow-inner ring-4 ring-blue-50/50">
                         <Info size={40} className="text-[#3b82f6]" strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-black text-[#1e293b] mb-3 tracking-tight text-center uppercase">{globalPopup.title}</h3>
                    <p className="text-[11px] font-bold text-slate-400 mb-10 text-center leading-relaxed px-4 uppercase tracking-widest">{globalPopup.message}</p>
                    <button 
                        onClick={closeGlobalPopup}
                        className="w-full py-5 bg-[#0f172a] text-white rounded-2xl font-black text-[13px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-[0_20px_40px_-10px_rgba(15,23,42,0.4)] active:scale-[0.96] outline-none ring-offset-4 focus:ring-4 focus:ring-slate-900/10 group relative overflow-hidden"
                    >
                        <span className="relative z-10">MENGERTI</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </button>
                </div>
            </div>
        )}

        {/* Update Profile Modal */}
        {showProfileModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[6px] animate-in fade-in duration-300">
                <div className="bg-white rounded-[3rem] shadow-2xl max-w-lg w-full overflow-hidden relative animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col">
                    <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <UserCheck size={28} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Update Profil</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Atur Data Pengguna Sistem</p>
                            </div>
                        </div>
                        <button onClick={() => setShowProfileModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="p-8 space-y-6 bg-white overflow-y-auto max-h-[70vh] custom-scrollbar">
                        {/* Section: Informasi Dasar */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <UserIcon size={16} className="text-blue-500" />
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Dasar</label>
                            </div>
                            <div className="space-y-4">
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                                        <UserIcon size={18} />
                                    </span>
                                    <input 
                                        type="text" 
                                        required
                                        value={profileName}
                                        onChange={e => setProfileName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-sm"
                                        placeholder="Nama Lengkap"
                                    />
                                    <p className="mt-2 ml-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Gunakan nama yang mudah dikenali oleh warga.</p>
                                </div>
                            </div>
                        </div>

                        {/* Section: Keamanan */}
                        <div className="pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-2 mb-4">
                                <ShieldCheck size={16} className="text-rose-500" />
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keamanan & Password</label>
                            </div>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors">
                                    <Key size={18} />
                                </span>
                                <input 
                                    type={showProfilePass ? "text" : "password"}
                                    required
                                    value={profilePass}
                                    onChange={e => setProfilePass(e.target.value)}
                                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:bg-white focus:border-rose-500 transition-all shadow-sm"
                                    placeholder="Password Baru"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowProfilePass(!showProfilePass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showProfilePass ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                type="submit"
                                disabled={isUpdatingProfile}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[13px] uppercase tracking-[0.25em] shadow-xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isUpdatingProfile ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                                Simpan Perubahan Profil
                            </button>
                            <p className="mt-4 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">Perubahan akan langsung diterapkan pada login berikutnya.</p>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <HashRouter>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </HashRouter>
  );
};
