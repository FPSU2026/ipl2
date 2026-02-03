
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
  Globe,
  FilePieChart
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Residents from './pages/Residents';
import MeterInput from './pages/MeterInput';
import Billing from './pages/Billing';
import Setup from './pages/Setup';
import Transactions from './pages/Transactions';
import ExpenseRecap from './pages/ExpenseRecap';
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
    className={`flex items-center space-x-4 px-4 py-3 mx-2 transition-all duration-200 group ${active ? 'sidebar-item-active font-bold shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-white hover:bg-slate-800 rounded-xl'}`}
  >
    <div className={`transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
      {icon}
    </div>
    <span className="text-sm tracking-wide">{label}</span>
  </Link>
);

const AppContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [editUsername, setEditUsername] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [activeToast, setActiveToast] = useState<{message: string, type: 'success' | 'error' | 'warning' | 'info'} | null>(null);
  const [isBellShaking, setIsBellShaking] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

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

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!sessionStorage.getItem('installBannerDismissed')) {
          setShowInstallPrompt(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
      });
    }
  };

  const handleDismissInstall = () => {
      setShowInstallPrompt(false);
      sessionStorage.setItem('installBannerDismissed', 'true');
  };

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
          '/expense-recap': 'transactions', // Akses rekap mengikuti izin transaksi
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
      if (connectionStatus === 'CONNECTED' && user?.role === UserRole.RESIDENT && residents.length > 0) {
          const isValid = residents.some(r => r.id === user.residentId);
          if (!isValid) {
              logout();
              alert("Sesi Anda telah berakhir karena perubahan data database (ID Warga tidak ditemukan). Silakan login kembali.");
          }
      }
  }, [connectionStatus, user, residents]);

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
                  if (audioRef.current) {
                      audioRef.current.play().catch(e => console.log("Audio play blocked", e));
                  }
                  setTimeout(() => setIsBellShaking(false), 2000); 
              }

              const timer = setTimeout(() => {
                  setActiveToast(null);
              }, 4000); 
              return () => clearTimeout(timer);
          }
      }
  }, [notifications]);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved && !user) {
      setUser(JSON.parse(saved));
    }
  }, [user, setUser]);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const isAdmin = user.role === UserRole.ADMIN;
  const isResident = user.role === UserRole.RESIDENT;

  const unreadCount = notifications.filter(n => !n.read).length;
  const showRedDot = unreadCount > 0 && !activeToast;

  const handleNotificationClick = () => {
      setShowNotifications(!showNotifications);
      if (!showNotifications && unreadCount > 0) {
          markNotificationsAsRead();
      }
  };

  const handleOpenProfile = () => {
      setEditUsername(user.username);
      setNewPass('');
      setConfirmPass('');
      setShowNewPass(false);
      setShowConfirmPass(false);
      setShowProfileModal(true);
      if(isMobile) setSidebarOpen(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!editUsername) {
          alert("Username tidak boleh kosong");
          return;
      }

      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).+$/;
      
      if (newPass) {
          if (!passwordRegex.test(newPass)) {
              alert("Password harus mengandung minimal 1 huruf dan 1 angka.");
              return;
          }
          if (newPass !== confirmPass) {
              alert("Konfirmasi password tidak cocok!");
              return;
          }
      }

      if (!newPass) {
          alert("Masukkan password baru untuk konfirmasi perubahan.");
          return;
      }

      const success = await updateUserProfile(user.id, editUsername, newPass);
      if (success) {
          setShowProfileModal(false);
      }
  };

  const handleSidebarLinkClick = () => {
      if (isMobile) setSidebarOpen(false);
  };

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
          case 'expense-recap': return t('title_recap');
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
        .bell-shake {
          animation: shake 0.5s ease-in-out infinite;
        }
      `}</style>

      {isMobile && sidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside 
        className={`
            fixed top-0 left-0 z-50 h-full bg-[#1e293b] text-white transition-transform duration-300 ease-in-out
            flex flex-col border-r border-slate-700/50 shadow-2xl lg:shadow-none lg:static w-72
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-6 mb-2 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#10B981] rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
              <Wallet size={20} />
            </div>
            <div className="overflow-hidden">
              <h2 className="text-white font-black text-sm tracking-tight leading-tight uppercase line-clamp-2">{settings.location_name}</h2>
              <p className="text-[9px] font-bold text-slate-400 tracking-[0.1em] uppercase mt-1 leading-tight">WARGA MANAGEMENT SYSTEM</p>
            </div>
            {isMobile && (
                <button onClick={() => setSidebarOpen(false)} className="ml-auto text-slate-400">
                    <X size={20} />
                </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1 px-2 custom-scrollbar">
          
          <SidebarItem to="/" icon={<LayoutGrid size={20} />} label={t('menu_dashboard')} active={location.pathname === '/'} onClick={handleSidebarLinkClick} />
          
          {!isResident && (
            <>
                {(hasAccess('/setup') || hasAccess('/user-management')) && (
                    <div className="mb-2">
                        {hasAccess('/setup') && <SidebarItem to="/setup" icon={<SettingsIcon size={20} />} label={t('menu_setup')} active={location.pathname === '/setup'} onClick={handleSidebarLinkClick} />}
                        {hasAccess('/user-management') && <SidebarItem to="/user-management" icon={<UserCog size={20} />} label={t('menu_users')} active={location.pathname === '/user-management'} onClick={handleSidebarLinkClick} />}
                        <div className="my-4 mx-6 h-px bg-slate-700/50" />
                    </div>
                )}

                {hasAccess('/residents') && <SidebarItem to="/residents" icon={<Users size={20} />} label={t('menu_residents')} active={location.pathname === '/residents'} onClick={handleSidebarLinkClick} />}
                {hasAccess('/meter') && <SidebarItem to="/meter" icon={<Droplets size={20} />} label={t('menu_meter')} active={location.pathname === '/meter'} onClick={handleSidebarLinkClick} />}
            </>
          )}

          <div className="my-4 mx-6 h-px bg-slate-700/50" />

          {hasAccess('/billing') && <SidebarItem to="/billing" icon={<FileText size={20} />} label={t('menu_billing')} active={location.pathname === '/billing'} onClick={handleSidebarLinkClick} />}
          {hasAccess('/arrears') && <SidebarItem to="/arrears" icon={<AlertCircle size={20} />} label={t('menu_arrears')} active={location.pathname === '/arrears'} onClick={handleSidebarLinkClick} />}
          {hasAccess('/complaints') && <SidebarItem to="/complaints" icon={<MessageSquareWarning size={20} />} label={t('menu_complaints')} active={location.pathname === '/complaints'} onClick={handleSidebarLinkClick} />}

          {!isResident && (
            <>
                <div className="my-4 mx-6 h-px bg-slate-700/50" />

                {hasAccess('/bank-mutation') && <SidebarItem to="/bank-mutation" icon={<Landmark size={20} />} label={t('menu_bank')} active={location.pathname === '/bank-mutation'} onClick={handleSidebarLinkClick} />}
                {hasAccess('/transactions') && <SidebarItem to="/transactions" icon={<ArrowRightLeft size={20} />} label={t('menu_transactions')} active={location.pathname === '/transactions'} onClick={handleSidebarLinkClick} />}
                {hasAccess('/expense-recap') && <SidebarItem to="/expense-recap" icon={<FilePieChart size={20} />} label={t('menu_recap')} active={location.pathname === '/expense-recap'} onClick={handleSidebarLinkClick} />}
                {hasAccess('/balance-sheet') && <SidebarItem to="/balance-sheet" icon={<Scale size={20} />} label={t('menu_balance')} active={location.pathname === '/balance-sheet'} onClick={handleSidebarLinkClick} />}
            </>
          )}
        </div>

        <div className="p-4 space-y-2 shrink-0 bg-[#1e293b]">
          <button 
            onClick={handleOpenProfile}
            className="w-full flex items-center space-x-4 px-4 py-3 text-gray-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-sm font-medium"
          >
            <UserIcon size={18} />
            <span>{t('lbl_profile')}</span>
          </button>
          
          <button onClick={logout} className="w-full flex items-center space-x-4 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all text-sm font-medium">
            <LogOut size={18} />
            <span>{t('lbl_logout')}</span>
          </button>

          <div className="px-4 py-2 flex justify-center">
              <button 
                onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-300 transition-colors border border-slate-700"
              >
                  <Globe size={12} />
                  <span>{language === 'id' ? 'BAHASA INDONESIA' : 'ENGLISH'}</span>
              </button>
          </div>

          <div className="pt-2 flex items-center justify-center space-x-2 text-slate-600/50">
            <Monitor size={10} />
            <a 
              href="https://wa.me/6281973314675" 
              target="_blank" 
              rel="noreferrer" 
              className="text-[9px] font-black tracking-[0.2em] uppercase hover:text-emerald-500 transition-colors"
            >
              {t('footer_text')}
            </a>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 lg:h-20 flex items-center px-4 lg:px-8 justify-between shrink-0 sticky top-0 z-30 shadow-sm lg:shadow-none">
          <div className="flex items-center space-x-3 overflow-hidden">
            <button 
                onClick={() => setSidebarOpen(!sidebarOpen)} 
                className="p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all lg:hidden active:scale-95 shrink-0"
            >
              <Menu size={22} />
            </button>
            
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em] lg:hidden truncate leading-none mb-1">
                {settings.location_name}
              </span>
              <h1 className="text-slate-800 font-extrabold text-sm lg:text-xl truncate leading-tight">
                {getPageTitle()}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 lg:space-x-4">
            
            {activeToast && (
                <div className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg border animate-in slide-in-from-top-5 fade-in duration-300 max-w-xs ${
                    activeToast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 
                    activeToast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' : 
                    activeToast.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' : 
                    'bg-blue-50 border-blue-100 text-blue-800'
                }`}>
                    {activeToast.type === 'success' ? <CheckCircle2 size={14} /> : activeToast.type === 'error' ? <XCircle size={14} /> : <Info size={14} />}
                    <p className="text-[10px] font-bold leading-tight truncate max-w-[150px]">{activeToast.message}</p>
                </div>
            )}

            <div className={`hidden md:flex items-center space-x-2 px-4 py-2 rounded-full shadow-sm transition-all duration-500 ${
                connectionStatus === 'SYNCING' ? 'bg-amber-100 text-amber-700' : 
                connectionStatus === 'DISCONNECTED' ? 'bg-rose-100 text-rose-700' : 
                'bg-[#1e293b]'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${
                  connectionStatus === 'SYNCING' ? 'bg-amber-500 animate-spin' : 
                  connectionStatus === 'DISCONNECTED' ? 'bg-rose-500' : 
                  'bg-[#10B981] shadow-[0_0_8px_#10B981]'
              }`}></div>
              <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${connectionStatus === 'CONNECTED' ? 'text-white' : ''}`}>
                  {connectionStatus === 'SYNCING' ? 'Menyimpan...' : 
                   connectionStatus === 'DISCONNECTED' ? 'Terputus' : 
                   'CLOUD TERHUBUNG'}
              </span>
            </div>

            <div className="relative">
                <button 
                    onClick={handleNotificationClick}
                    className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-xl transition-all relative active:scale-95"
                >
                    <div className={isBellShaking ? 'bell-shake text-emerald-500' : ''}>
                        <Bell size={20} />
                    </div>
                    {showRedDot && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                    )}
                </button>

                {showNotifications && (
                    <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Notifikasi</h3>
                            <button onClick={() => setShowNotifications(false)}><X size={14} className="text-slate-400 hover:text-slate-600"/></button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length > 0 ? (
                                notifications.slice(0, 10).map((n) => (
                                    <div key={n.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}>
                                        <div className="flex gap-3">
                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.type === 'success' ? 'bg-emerald-500' : n.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 leading-snug">{n.message}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{new Date(n.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-xs italic">
                                    Tidak ada notifikasi baru
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-3 pl-1 cursor-pointer" onClick={handleOpenProfile}>
                <div className="text-right hidden sm:block">
                    <p className="text-xs font-black text-slate-700 leading-none">{user.username}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user.role}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-md ring-2 ring-white">
                    {user.username.substring(0, 2).toUpperCase()}
                </div>
            </div>

          </div>
        </header>

        {activeToast && (
            <div className={`md:hidden fixed top-20 left-4 right-4 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-5 fade-in duration-300 border ${
                activeToast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 
                activeToast.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' : 
                activeToast.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' : 
                'bg-blue-50 border-blue-100 text-blue-800'
            }`}>
                <div className={`p-2 rounded-full shrink-0 ${
                    activeToast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                    activeToast.type === 'error' ? 'bg-red-100 text-red-600' : 
                    'bg-blue-100 text-blue-600'
                }`}>
                    {activeToast.type === 'success' ? <CheckCircle2 size={18} /> : 
                     activeToast.type === 'error' ? <XCircle size={18} /> : 
                     <Info size={18} />}
                </div>
                <p className="text-xs font-bold leading-tight">{activeToast.message}</p>
            </div>
        )}

        {showInstallPrompt && (
            <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
                <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between border border-slate-700/50 max-w-lg mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                            <Wallet size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-bold">Install Aplikasi</p>
                            <p className="text-[10px] text-slate-400">Akses lebih cepat & mudah</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleDismissInstall}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                        <button 
                            onClick={handleInstallClick}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                        >
                            <Download size={14} /> Install
                        </button>
                    </div>
                </div>
            </div>
        )}

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8 relative z-0 scroll-smooth">
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
                    {hasAccess('/expense-recap') && <Route path="/expense-recap" element={<ExpenseRecap />} />}
                </>
                )}
                
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        {globalPopup && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-6 relative animate-in zoom-in-95 duration-200">
                    <button onClick={closeGlobalPopup} className="absolute top-4 right-4 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X size={18} />
                    </button>
                    
                    <div className="flex flex-col items-center text-center">
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl ${
                            globalPopup.type === 'PAYMENT' ? 'bg-emerald-100 text-emerald-600 shadow-emerald-500/20' :
                            globalPopup.type === 'FEATURE' ? 'bg-indigo-100 text-indigo-600 shadow-indigo-500/20' :
                            globalPopup.type === 'DATA' ? 'bg-blue-100 text-blue-600 shadow-blue-500/20' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                            {globalPopup.type === 'PAYMENT' && <CheckCircle size={40} />}
                            {globalPopup.type === 'FEATURE' && <Sparkles size={40} />}
                            {globalPopup.type === 'DATA' && <FileText size={40} />}
                            {globalPopup.type === 'INFO' && <Info size={40} />}
                        </div>
                        
                        <h3 className="text-xl font-black text-slate-800 mb-2">{globalPopup.title}</h3>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">
                            {globalPopup.message}
                        </p>
                        
                        <button 
                            onClick={closeGlobalPopup}
                            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-slate-900 text-white hover:bg-black transition-all shadow-lg active:scale-95"
                        >
                            Mengerti
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>

      {showProfileModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
                      <div>
                          <h3 className="font-black text-lg">Profil Saya</h3>
                          <p className="text-[10px] uppercase tracking-widest opacity-60">Ubah akun anda</p>
                      </div>
                      <button onClick={() => setShowProfileModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all">
                          <X size={18} />
                      </button>
                  </div>
                  <form onSubmit={handleUpdateProfile} className="p-8 space-y-5">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nama Pengguna</label>
                          <input 
                              type="text"
                              required
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                          />
                      </div>
                      <div className="border-t border-slate-100 my-2"></div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kata Sandi Baru</label>
                          <div className="relative">
                            <input 
                                type={showNewPass ? "text" : "password"}
                                required
                                value={newPass}
                                onChange={(e) => setNewPass(e.target.value)}
                                className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                                placeholder="Kombinasi Huruf & Angka"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPass(!showNewPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Konfirmasi Kata Sandi</label>
                          <div className="relative">
                            <input 
                                type={showConfirmPass ? "text" : "password"}
                                required
                                value={confirmPass}
                                onChange={(e) => setConfirmPass(e.target.value)}
                                className="w-full pl-3 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPass(!showConfirmPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                      </div>
                      <div className="text-[10px] text-slate-400 italic">
                          *Kata sandi wajib mengandung huruf dan angka.
                      </div>
                      <button 
                          type="submit"
                          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                      >
                          <Save size={14} /> Simpan Perubahan
                      </button>
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
