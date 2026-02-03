
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
  Lock,
  LogOut,
  Menu,
  X,
  Wallet,
  Monitor,
  Bell,
  Check,
  CheckCircle,
  Sparkles,
  Info,
  User as UserIcon,
  Save,
  Eye,
  EyeOff,
  MessageSquareWarning,
  CheckCircle2,
  XCircle,
  Download,
  Globe
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

// Simple Beep Sound
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
    className={`flex items-center space-x-3 px-4 py-2.5 mx-2 transition-all duration-200 group ${active ? 'sidebar-item-active font-black shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-white hover:bg-slate-800 rounded-xl'}`}
  >
    <div className={`transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as any, { size: 16 }) : icon}
    </div>
    <span className="text-[12px] font-bold tracking-tight">{label}</span>
  </Link>
);

const AppContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Profile Form State
  const [editUsername, setEditUsername] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [activeToast, setActiveToast] = useState<{message: string, type: 'success' | 'error' | 'warning' | 'info'} | null>(null);
  const [isBellShaking, setIsBellShaking] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser: user, setCurrentUser: setUser, settings, notifications, markNotificationsAsRead, updateUserProfile, globalPopup, closeGlobalPopup, triggerPopup, connectionStatus, residents, addNotification, language, setLanguage, t } = useApp();
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
      if (Array.isArray(user.permissions)) {
          return user.permissions.includes(permissionId);
      }
      if (user.role === UserRole.ADMIN) return true;
      if (user.role === UserRole.OPERATOR) {
          if (permissionId === 'setup') return false;
          if (permissionId === 'transactions') return false; 
          return true;
      }
      return false;
  };

  useEffect(() => {
      if (user && !hasAccess(location.pathname)) {
          addNotification("Akses Ditolak: Anda tidak memiliki izin untuk menu ini.", "error");
          navigate('/');
      }
  }, [location.pathname, user]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isMobile && sidebarOpen) setSidebarOpen(false);
        if (showNotifications) setShowNotifications(false);
        if (showProfileModal) setShowProfileModal(false);
        if (globalPopup) closeGlobalPopup();
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isMobile, sidebarOpen, showNotifications, showProfileModal, globalPopup, closeGlobalPopup]);

  useEffect(() => {
      if (notifications.length > 0) {
          const latest = notifications[0];
          const now = new Date().getTime();
          const notifTime = new Date(latest.timestamp).getTime();
          if (now - notifTime < 2000) {
              setActiveToast({ message: latest.message, type: latest.type });
              if (latest.message.toLowerCase().includes('aduan') || latest.message.toLowerCase().includes('respon')) {
                  setIsBellShaking(true);
                  if (audioRef.current) audioRef.current.play().catch(() => {});
                  setTimeout(() => setIsBellShaking(false), 2000); 
              }
              const timer = setTimeout(() => setActiveToast(null), 4000); 
              return () => clearTimeout(timer);
          }
      }
  }, [notifications]);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved && !user) setUser(JSON.parse(saved));
  }, [user, setUser]);

  if (!user) return <Login onLogin={setUser} />;

  const isResident = user.role === UserRole.RESIDENT;
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = () => {
      setShowNotifications(!showNotifications);
      if (!showNotifications && unreadCount > 0) markNotificationsAsRead();
  };

  const handleOpenProfile = () => {
      setEditUsername(user.username);
      setNewPass('');
      setConfirmPass('');
      setShowProfileModal(true);
      if(isMobile) setSidebarOpen(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).+$/;
      if (newPass && !passwordRegex.test(newPass)) { alert("Password harus mengandung minimal 1 huruf dan 1 angka."); return; }
      const success = await updateUserProfile(user.id, editUsername, newPass);
      if (success) setShowProfileModal(false);
  };

  const handleSidebarLinkClick = () => { if (isMobile) setSidebarOpen(false); };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 3 && hour < 11) return t('greeting_morning');
    if (hour >= 11 && hour < 15) return t('greeting_afternoon');
    if (hour >= 15 && hour < 18) return t('greeting_evening');
    return t('greeting_night');
  };

  const getPageTitle = () => {
      if (location.pathname === '/') return `${getGreeting()}, ${user?.username}`;
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
    <div className="flex h-full bg-[#F8FAFC] overflow-hidden">
      <style>{`
        @keyframes shake {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(15deg); }
          50% { transform: rotate(-15deg); }
          75% { transform: rotate(10deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        .bell-shake { animation: shake 0.5s ease-in-out infinite; }
        .blinking-text { animation: blink 1s infinite; }
      `}</style>

      {isMobile && sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed top-0 left-0 z-50 h-full bg-[#1e293b] text-white transition-transform duration-300 ease-in-out flex flex-col border-r border-slate-700/50 shadow-2xl lg:shadow-none lg:static w-60 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 mb-2 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-[#10B981] rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0"><Wallet size={18} /></div>
            <div className="overflow-hidden">
              <h2 className="text-white font-black text-[13px] tracking-tight leading-tight uppercase line-clamp-2">{settings.location_name}</h2>
              <p className="text-[7px] font-bold text-slate-400 tracking-[0.1em] uppercase mt-0.5 leading-tight">WARGA SYSTEM</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-0.5 px-2 custom-scrollbar">
          <SidebarItem to="/" icon={<LayoutGrid />} label={t('menu_dashboard')} active={location.pathname === '/'} onClick={handleSidebarLinkClick} />
          {!isResident && (
            <>
                {(hasAccess('/setup') || hasAccess('/user-management')) && (
                    <div className="mb-2">
                        {hasAccess('/setup') && <SidebarItem to="/setup" icon={<SettingsIcon />} label={t('menu_setup')} active={location.pathname === '/setup'} onClick={handleSidebarLinkClick} />}
                        {hasAccess('/user-management') && <SidebarItem to="/user-management" icon={<UserCog />} label={t('menu_users')} active={location.pathname === '/user-management'} onClick={handleSidebarLinkClick} />}
                        <div className="my-2 mx-6 h-px bg-slate-700/30" />
                    </div>
                )}
                {hasAccess('/residents') && <SidebarItem to="/residents" icon={<Users />} label={t('menu_residents')} active={location.pathname === '/residents'} onClick={handleSidebarLinkClick} />}
                {hasAccess('/meter') && <SidebarItem to="/meter" icon={<Droplets />} label={t('menu_meter')} active={location.pathname === '/meter'} onClick={handleSidebarLinkClick} />}
            </>
          )}
          <div className="my-2 mx-6 h-px bg-slate-700/30" />
          {hasAccess('/billing') && <SidebarItem to="/billing" icon={<FileText />} label={t('menu_billing')} active={location.pathname === '/billing'} onClick={handleSidebarLinkClick} />}
          {hasAccess('/arrears') && <SidebarItem to="/arrears" icon={<AlertCircle />} label={t('menu_arrears')} active={location.pathname === '/arrears'} onClick={handleSidebarLinkClick} />}
          {hasAccess('/complaints') && <SidebarItem to="/complaints" icon={<MessageSquareWarning />} label={t('menu_complaints')} active={location.pathname === '/complaints'} onClick={handleSidebarLinkClick} />}
          {!isResident && (
            <>
                <div className="my-2 mx-6 h-px bg-slate-700/30" />
                {hasAccess('/bank-mutation') && <SidebarItem to="/bank-mutation" icon={<Landmark />} label={t('menu_bank')} active={location.pathname === '/bank-mutation'} onClick={handleSidebarLinkClick} />}
                {hasAccess('/transactions') && <SidebarItem to="/transactions" icon={<ArrowRightLeft />} label={t('menu_transactions')} active={location.pathname === '/transactions'} onClick={handleSidebarLinkClick} />}
                {hasAccess('/balance-sheet') && <SidebarItem to="/balance-sheet" icon={<Scale />} label={t('menu_balance')} active={location.pathname === '/balance-sheet'} onClick={handleSidebarLinkClick} />}
            </>
          )}
        </div>

        <div className="p-4 space-y-1 shrink-0 bg-[#1e293b] border-t border-slate-700/30">
          <button onClick={handleOpenProfile} className="w-full flex items-center space-x-3 px-4 py-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-[11px] font-bold">
            <UserIcon size={14} /> <span>{t('lbl_profile')}</span>
          </button>
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all text-[11px] font-bold">
            <LogOut size={14} /> <span>{t('lbl_logout')}</span>
          </button>
          <div className="pt-2 flex items-center justify-center space-x-2 text-slate-600/50">
            <Monitor size={10} /> <a href="https://wa.me/6281973314675" target="_blank" rel="noreferrer" className="text-[8px] font-black tracking-widest uppercase hover:text-emerald-500 transition-colors">GNOME COMP</a>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 h-12 lg:h-14 flex items-center px-4 lg:px-6 justify-between shrink-0 sticky top-0 z-30 shadow-sm lg:shadow-none">
          <div className="flex items-center space-x-3 overflow-hidden">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 text-slate-500 hover:bg-slate-100 rounded-xl transition-all lg:hidden active:scale-95 shrink-0"><Menu size={18} /></button>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[7px] font-black text-emerald-600 uppercase tracking-[0.15em] lg:hidden truncate leading-none mb-0.5">{settings.location_name}</span>
              <h1 className="text-slate-800 font-extrabold text-[13px] lg:text-base truncate leading-tight uppercase tracking-tight">{getPageTitle()}</h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 lg:space-x-3">
            {activeToast && (
                <div className={`hidden md:flex items-center gap-2 px-2 py-1 rounded-lg shadow-sm border animate-in slide-in-from-top-2 fade-in duration-300 ${activeToast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                    {activeToast.type === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <p className="text-[10px] font-bold truncate max-w-[100px]">{activeToast.message}</p>
                </div>
            )}
            <div className={`hidden md:flex items-center space-x-2 px-3 py-1 rounded-full border transition-all ${connectionStatus === 'SYNCING' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-slate-900 border-slate-800 text-white'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'SYNCING' ? 'bg-amber-500 animate-pulse' : 'bg-[#10B981]'}`}></div>
              <span className="text-[8px] font-black tracking-widest uppercase">{connectionStatus === 'SYNCING' ? 'Syncing...' : 'Connected'}</span>
            </div>
            <div className="relative">
                <button onClick={handleNotificationClick} className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all relative active:scale-95">
                    <div className={isBellShaking ? 'bell-shake text-emerald-500' : ''}><Bell size={18} /></div>
                    {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>}
                </button>
            </div>
            <div className="h-5 w-[1px] bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-2 pl-1 cursor-pointer" onClick={handleOpenProfile}>
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-[9px] shadow-sm ring-1 ring-white uppercase">{user.username.substring(0, 2)}</div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 lg:p-4 relative z-0 scroll-smooth custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full">
            <Routes>
                <Route path="/" element={<Dashboard />} />
                {hasAccess('/billing') && <Route path="/billing" element={<Billing />} />}
                {hasAccess('/arrears') && <Route path="/arrears" element={<Arrears />} />}
                {hasAccess('/complaints') && <Route path="/complaints" element={<Complaints />} />}
                {!isResident && (
                <>
                    {hasAccess('/residents') && <Route path="/residents" element={<Residents />} />}
                    {hasAccess('/meter') && <Route path="/meter" element={<MeterInput user={user} />} />}
                    {hasAccess('/bank-mutation') && <Route path="/bank-mutation" element={<BankMutationPage />} />}
                    {hasAccess('/balance-sheet') && <Route path="/balance-sheet" element={<BalanceSheet />} />}
                    {hasAccess('/user-management') && <Route path="/user-management" element={<UserManagement />} />}
                    {hasAccess('/setup') && <Route path="/setup" element={<Setup />} />}
                    {hasAccess('/transactions') && <Route path="/transactions" element={<Transactions />} />}
                </>
                )}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        {/* REFINED GLOBAL POPUP COMPONENT (Exact match to screenshot) */}
        {globalPopup && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 relative animate-in zoom-in-95 duration-200 flex flex-col items-center">
                    <button onClick={closeGlobalPopup} className="absolute top-5 right-5 p-1.5 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                        <X size={16} />
                    </button>
                    
                    <div className="w-20 h-20 rounded-[1.75rem] bg-[#ebf3ff] flex items-center justify-center mb-8 shadow-sm">
                         <FileText size={32} className="text-[#3b82f6]" strokeWidth={2.5} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-[#1e293b] mb-2 tracking-tight">{globalPopup.title}</h3>
                    <p className="text-sm font-medium text-slate-400 mb-10 text-center leading-relaxed px-4">{globalPopup.message}</p>
                    
                    <button 
                        onClick={closeGlobalPopup}
                        className="w-full py-4.5 bg-[#0f172a] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95"
                    >
                        MENGERTI
                    </button>
                </div>
            </div>
        )}
      </div>

      {showProfileModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="bg-slate-800 p-5 flex justify-between items-center text-white">
                      <div><h3 className="font-black text-base">Profil Saya</h3></div>
                      <button onClick={() => setShowProfileModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={16} /></button>
                  </div>
                  <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
                      <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Username</label><input type="text" required value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:bg-white" /></div>
                      <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password Baru</label><input type="password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:bg-white" placeholder="Min 1 huruf & angka" /></div>
                      <div><label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Konfirmasi Password</label><input type="password" required value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:bg-white" /></div>
                      <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2"><Save size={14} /> Simpan Perubahan</button>
                  </form>
              </div>
          </div>
      )}
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
