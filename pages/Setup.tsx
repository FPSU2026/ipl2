
import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, 
  MapPin, 
  DollarSign, 
  List, 
  Save, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  X, 
  Repeat, 
  AlertTriangle, 
  MessageCircle,
  Database,
  Calculator,
  RefreshCw,
  Building2,
  ToggleLeft,
  ToggleRight,
  Wallet,
  Edit,
  Info,
  MessageSquareText,
  HeartHandshake,
  BellRing
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TransactionCategory, BankAccount } from '../types';

const Setup: React.FC = () => {
  const { 
    settings: globalSettings, 
    updateSettings, 
    addNotification, 
    currentUser, 
    bills, 
    recalculateBills, 
    loadingProgress, 
    connectionStatus, 
    bankAccounts, 
    addBankAccount,
    updateBankAccount, 
    deleteBankAccount 
  } = useApp();
  
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(globalSettings);

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [newExpenseSubType, setNewExpenseSubType] = useState<'RUTIN' | 'NON_RUTIN'>('RUTIN');

  // Bank Account Modal State
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankFormData, setBankFormData] = useState<Partial<BankAccount>>({
      bankName: '',
      accountNumber: '',
      accountHolder: '',
      balance: 0,
      isActive: true
  });

  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSettings(globalSettings); }, [globalSettings]);

  useEffect(() => {
      if (isRecalculating && connectionStatus === 'CONNECTED' && loadingProgress === 100) {
          setTimeout(() => setIsRecalculating(false), 800);
      }
  }, [isRecalculating, connectionStatus, loadingProgress]);

  const tabs = [
    { id: 'general', label: 'Lokasi & Profil', icon: <Building size={16} /> },
    { id: 'regional', label: 'Data RT / RW', icon: <MapPin size={16} /> },
    { id: 'tariff', label: 'Setting Tarif', icon: <DollarSign size={16} /> },
    { id: 'account', label: 'Kode Akun', icon: <List size={16} /> },
    { id: 'bank_account', label: 'Rekening & Saldo', icon: <Building2 size={16} /> },
    { id: 'notification', label: 'Notifikasi WA', icon: <MessageCircle size={16} /> },
  ];

  if (currentUser?.id === '0') {
      tabs.push({ id: 'database', label: 'Database', icon: <Database size={16} /> });
  }

  const handleSave = async () => {
    try {
      if (activeTab === 'tariff') setIsRecalculating(true);
      await updateSettings(settings);
      addNotification("Pengaturan berhasil disimpan", "success");
    } catch (error) { 
      addNotification('Gagal menyimpan pengaturan.', 'error'); 
      setIsRecalculating(false); 
    }
  };

  const handleRecalculate = async () => {
      if (window.confirm("Hitung ulang semua tagihan yang BELUM LUNAS menggunakan tarif saat ini?")) {
          setIsRecalculating(true);
          await recalculateBills();
      }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          setSettings({ ...settings, logo_url: reader.result as string });
          addNotification("Logo dimuat. Klik Simpan.", "success");
      };
      reader.readAsDataURL(file);
  };

  const handleOpenBankAdd = () => {
      setEditingBankId(null);
      setBankFormData({ bankName: '', accountNumber: '', accountHolder: '', balance: 0, isActive: true });
      setShowBankModal(true);
  };

  const handleOpenBankEdit = (acc: BankAccount) => {
      setEditingBankId(acc.id);
      setBankFormData({ ...acc });
      setShowBankModal(true);
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingBankId) {
          await updateBankAccount({ ...bankFormData, id: editingBankId } as BankAccount);
          addNotification("Data rekening diperbarui", "success");
      } else {
          await addBankAccount({ ...bankFormData, id: `bank-${Date.now()}` } as BankAccount);
          addNotification("Rekening baru ditambahkan", "success");
      }
      setShowBankModal(false);
  };

  const handleDeleteBank = async (id: string) => {
      if (window.confirm("Hapus rekening ini?")) {
          await deleteBankAccount(id);
      }
  };

  const handleToggleBank = async (bankId: string, currentStatus: boolean) => {
      const bank = bankAccounts.find(b => b.id === bankId);
      if (bank) await updateBankAccount({ ...bank, isActive: !currentStatus });
  };

  const handleAddCategory = () => {
      if (!newCategoryName) return;
      const newCat: TransactionCategory = {
          id: `cat-${Date.now()}`,
          name: newCategoryName,
          type: newCategoryType,
          expenseType: newCategoryType === 'EXPENSE' ? newExpenseSubType : undefined
      };
      setSettings({
          ...settings,
          transactionCategories: [...settings.transactionCategories, newCat]
      });
      setNewCategoryName('');
      setShowCategoryModal(false);
  };

  const handleDeleteCategory = (categoryId: string) => {
      if (window.confirm("Hapus kategori transaksi ini?")) {
          setSettings({
              ...settings,
              transactionCategories: settings.transactionCategories.filter(c => c.id !== categoryId)
          });
          addNotification("Kategori dihapus. Klik Simpan untuk memperbarui database.", "info");
      }
  };

  const updateWAPlate = (key: keyof typeof settings.whatsappTemplates, value: string) => {
    setSettings({
        ...settings,
        whatsappTemplates: {
            ...settings.whatsappTemplates,
            [key]: value
        }
    });
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Pengaturan Sistem</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Konfigurasi Global & Parameter Tarif</p>
        </div>
        <button onClick={handleSave} className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-slate-900/10 transition-all text-sm uppercase tracking-widest">
            <Save size={20} />
            <span>Simpan Semua Pengaturan</span>
        </button>
      </div>

      <div className="flex flex-col gap-6">
        <div className="w-full overflow-x-auto no-scrollbar">
            <div className="flex space-x-2 p-1.5 bg-white rounded-3xl border border-slate-200 w-max md:w-full">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center space-x-3 px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
        </div>

        <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-8 md:p-12 min-h-[600px]">
          
          {activeTab === 'general' && (
            <div className="space-y-12 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row gap-12 items-start">
                  <div className="space-y-4 w-full md:w-auto">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logo Instansi</label>
                      <div className="flex items-center space-x-8">
                        <div className="w-32 h-32 bg-slate-50 rounded-[2.5rem] flex items-center justify-center border-4 border-dashed border-slate-200 text-slate-300 overflow-hidden shrink-0 shadow-inner">
                            {settings.logo_url ? <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <ImageIcon size={48} />}
                        </div>
                        <div>
                            <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload}/>
                            <button onClick={() => logoInputRef.current?.click()} className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm">Ganti Logo</button>
                        </div>
                      </div>
                  </div>
                  <div className="flex-1 w-full space-y-6">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nama Perumahan / Lingkungan</label>
                          <input type="text" value={settings.location_name} onChange={(e) => setSettings({...settings, location_name: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-black text-slate-700 text-xl" />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Alamat Kantor / Sekretariat</label>
                          <textarea value={settings.office_address || ''} onChange={(e) => setSettings({...settings, office_address: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white transition-all min-h-[100px]" placeholder="Masukkan alamat lengkap..." />
                      </div>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'bank_account' && (
              <div className="space-y-10 animate-in fade-in duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-blue-50 p-10 rounded-[3rem] border border-blue-100 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-10 text-blue-600"><Wallet size={120} /></div>
                      <div className="relative z-10 flex-1">
                          <h3 className="text-xl font-black text-blue-900 mb-2 flex items-center gap-2">Saldo Tunai Awal <Wallet size={20} /></h3>
                          <p className="text-xs font-bold text-blue-600/70 mb-6 uppercase tracking-widest leading-relaxed">
                            Tentukan saldo uang tunai di tangan (Cash on Hand) <br/> 
                            sebelum pencatatan transaksi sistem dimulai.
                          </p>
                          <div className="relative max-w-sm">
                              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-400 font-black text-xl">Rp</div>
                              <input 
                                type="number" 
                                value={settings.cash_initial_balance || 0} 
                                onChange={(e) => setSettings({...settings, cash_initial_balance: parseInt(e.target.value) || 0})} 
                                className="w-full pl-16 pr-6 py-6 bg-white border-2 border-blue-200 rounded-[2rem] font-black text-blue-800 text-3xl outline-none focus:ring-8 focus:ring-blue-500/10 shadow-xl shadow-blue-900/5" 
                              />
                          </div>
                      </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-8">
                          <div>
                              <h3 className="text-xl font-black text-slate-800">Daftar Rekening Bank</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kelola rekening untuk transaksi transfer</p>
                          </div>
                          <button onClick={handleOpenBankAdd} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                              <Plus size={18} /> Tambah Rekening
                          </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {bankAccounts.length > 0 ? bankAccounts.map((acc) => (
                              <div key={acc.id} className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group relative overflow-hidden">
                                  {!acc.isActive && <div className="absolute inset-0 bg-slate-50/60 backdrop-blur-[1px] z-10 flex items-center justify-center font-black text-[10px] text-slate-400 uppercase tracking-[0.3em]">NON-AKTIF</div>}
                                  <div className="flex justify-between items-start mb-6">
                                      <div className="flex items-center gap-4">
                                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${acc.isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-300'}`}>
                                              <Building2 size={28} />
                                          </div>
                                          <div>
                                              <h4 className="font-black text-slate-800 text-base uppercase leading-none mb-1">{acc.bankName}</h4>
                                              <p className="font-mono text-xs font-bold text-slate-400">{acc.accountNumber}</p>
                                          </div>
                                      </div>
                                      <div className="flex gap-1 z-20">
                                          <button onClick={() => handleOpenBankEdit(acc)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"><Edit size={16}/></button>
                                          <button onClick={() => handleDeleteBank(acc.id)} className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                                  <div className="space-y-4">
                                      <div className="p-4 bg-slate-50 rounded-2xl">
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Pemilik</p>
                                          <p className="text-sm font-black text-slate-700 truncate">{acc.accountHolder}</p>
                                      </div>
                                      <div className="flex justify-between items-center pt-2">
                                          <div>
                                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status / Saldo Berjalan</p>
                                              <p className="text-xl font-black text-slate-800">Rp {acc.balance.toLocaleString('id-ID')}</p>
                                          </div>
                                          <button onClick={() => handleToggleBank(acc.id, acc.isActive ?? true)} className="focus:outline-none transition-transform active:scale-95 z-20" title="Aktifkan/Matikan Rekening untuk Pembayaran">
                                              {acc.isActive ? <ToggleRight size={48} className="text-emerald-500 fill-emerald-50" /> : <ToggleLeft size={48} className="text-slate-300" />}
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          )) : (
                              <div className="col-span-full text-center py-24 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100 text-slate-300">
                                  <Building2 size={64} className="mx-auto mb-4 opacity-20" />
                                  <p className="text-sm font-black uppercase tracking-widest">Belum ada data rekening bank</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'notification' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex items-center space-x-3 mb-6">
                      <MessageCircle size={28} className="text-emerald-500" />
                      <h3 className="text-2xl font-black">Templat Notifikasi WhatsApp</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-8">
                      {/* NEW BILL */}
                      <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><MessageSquareText size={18} /></div>
                              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">1. Templat Tagihan Baru</label>
                          </div>
                          <textarea 
                            rows={6}
                            value={settings.whatsappTemplates.billMessage}
                            onChange={(e) => updateWAPlate('billMessage', e.target.value)}
                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-slate-700 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all"
                            placeholder="Tulis templat pesan tagihan..."
                          />
                          <p className="text-[10px] text-slate-400 font-bold px-4 italic">Gunakan keyword: {'{NAMA}, {RUMAH}, {PERIODE}, {RINCIAN}, {TOTAL}'}</p>
                      </div>

                      {/* ARREARS */}
                      <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle size={18} /></div>
                              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">2. Templat Tunggakan</label>
                          </div>
                          <textarea 
                            rows={6}
                            value={settings.whatsappTemplates.arrearsMessage}
                            onChange={(e) => updateWAPlate('arrearsMessage', e.target.value)}
                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-slate-700 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-rose-500/5 transition-all"
                          />
                          <p className="text-[10px] text-slate-400 font-bold px-4 italic">Gunakan keyword: {'{NAMA}, {RUMAH}, {RINCIAN}, {TOTAL}'}</p>
                      </div>

                      {/* REMINDER */}
                      <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><BellRing size={18} /></div>
                              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">3. Reminder Tagihan & Tunggakan</label>
                          </div>
                          <textarea 
                            rows={6}
                            value={settings.whatsappTemplates.reminderMessage}
                            onChange={(e) => updateWAPlate('reminderMessage', e.target.value)}
                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-slate-700 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-amber-500/5 transition-all"
                          />
                          <p className="text-[10px] text-slate-400 font-bold px-4 italic">Gunakan keyword: {'{NAMA}, {RUMAH}, {RINCIAN}, {TOTAL}'}</p>
                      </div>

                      {/* THANK YOU */}
                      <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><HeartHandshake size={18} /></div>
                              <label className="text-xs font-black text-slate-700 uppercase tracking-widest">4. Terima Kasih Pembayaran (Tagihan/Tunggakan)</label>
                          </div>
                          <textarea 
                            rows={6}
                            value={settings.whatsappTemplates.thanksMessage}
                            onChange={(e) => updateWAPlate('thanksMessage', e.target.value)}
                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-slate-700 text-sm outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all"
                          />
                          <p className="text-[10px] text-slate-400 font-bold px-4 italic">Gunakan keyword: {'{NAMA}, {RUMAH}, {PERIODE}, {TOTAL}, {TANGGAL}'}</p>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'tariff' && (
            <div className="space-y-12 animate-in fade-in duration-300">
               <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-3 text-[#1E293B]"><DollarSign size={28} className="text-emerald-500" /><h3 className="text-2xl font-black">Konfigurasi Tarif & Biaya</h3></div>
                  <button onClick={handleRecalculate} className="bg-white border-2 border-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center gap-2 transition-all">
                      <RefreshCw size={18} /> Hitung Ulang Tagihan
                  </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="card bg-slate-50 p-8 space-y-6 rounded-[2.5rem] border border-slate-100">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">IPL Dasar (Kebersihan & Keamanan)</label>
                          <input type="number" value={settings.ipl_base} onChange={(e) => setSettings({...settings, ipl_base: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-2xl border border-slate-200 font-black text-slate-700 text-lg shadow-sm" />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Iuran Kas RT</label>
                          <input type="number" value={settings.kas_rt_base} onChange={(e) => setSettings({...settings, kas_rt_base: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-2xl border border-slate-200 font-black text-slate-700 text-lg shadow-sm" />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Abodemen Air Tetap</label>
                          <input type="number" value={settings.water_abodemen} onChange={(e) => setSettings({...settings, water_abodemen: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-2xl border border-slate-200 font-black text-slate-700 text-lg shadow-sm" />
                      </div>
                  </div>
                  <div className="card bg-emerald-50/50 p-8 space-y-6 rounded-[2.5rem] border border-emerald-100">
                      <div>
                          <label className="block text-[10px] font-black text-emerald-600 uppercase mb-3 ml-1">Batas Kuota Blok 1 (m³)</label>
                          <input type="number" value={settings.water_rate_threshold} onChange={(e) => setSettings({...settings, water_rate_threshold: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-2xl border border-emerald-200 font-black text-emerald-700 text-lg shadow-sm" />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-emerald-600 uppercase mb-3 ml-1">Tarif Blok 1 (Rp/m³)</label>
                          <input type="number" value={settings.water_rate_low} onChange={(e) => setSettings({...settings, water_rate_low: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-2xl border border-emerald-200 font-black text-emerald-700 text-lg shadow-sm" />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-emerald-600 uppercase mb-3 ml-1">Tarif Blok 2 (Kelebihan) (Rp/m³)</label>
                          <input type="number" value={settings.water_rate_high} onChange={(e) => setSettings({...settings, water_rate_high: parseInt(e.target.value) || 0})} className="w-full p-4 rounded-2xl border border-emerald-200 font-black text-emerald-700 text-lg shadow-sm" />
                      </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-10 animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">Kode Akun Transaksi</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kategorisasi laporan buku kas harian</p>
                    </div>
                    <button onClick={() => setShowCategoryModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2">
                        <Plus size={20} /> Tambah Akun
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                        <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-6 bg-emerald-50 inline-block px-4 py-2 rounded-full border border-emerald-100">Pemasukan (Inflow)</p>
                        <div className="space-y-3">
                            {settings.transactionCategories.filter(c => c.type === 'INCOME').map(c => (
                                <div key={c.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100 group shadow-sm">
                                    <span className="font-bold text-slate-700">{c.name}</span>
                                    <button onClick={() => handleDeleteCategory(c.id)} className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-6 bg-rose-50 inline-block px-4 py-2 rounded-full border border-rose-100">Pengeluaran (Outflow)</p>
                        <div className="space-y-3">
                            {settings.transactionCategories.filter(c => c.type === 'EXPENSE').map(c => (
                                <div key={c.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100 group shadow-sm">
                                    <div>
                                        <span className="font-bold text-slate-700">{c.name}</span>
                                        <span className="ml-3 text-[9px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded uppercase tracking-tighter">{c.expenseType}</span>
                                    </div>
                                    <button onClick={() => handleDeleteCategory(c.id)} className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Bank Modal */}
      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="bg-slate-900 p-8 flex justify-between items-center text-white shrink-0">
                      <div>
                          <h3 className="font-black text-xl">{editingBankId ? 'Edit Rekening' : 'Tambah Rekening'}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Masukkan rincian akun bank</p>
                      </div>
                      <button onClick={() => setShowBankModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleBankSubmit} className="p-10 space-y-6">
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Nama Bank</label><input required type="text" value={bankFormData.bankName} onChange={e => setBankFormData({...bankFormData, bankName: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:bg-white" placeholder="Contoh: BCA / MANDIRI" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Nomor Rekening</label><input required type="text" value={bankFormData.accountNumber} onChange={e => setBankFormData({...bankFormData, accountNumber: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:bg-white font-mono" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Atas Nama Pemilik</label><input required type="text" value={bankFormData.accountHolder} onChange={e => setBankFormData({...bankFormData, accountHolder: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:bg-white" /></div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Saldo {editingBankId ? 'Sekarang' : 'Awal'}</label>
                          <input required type="number" value={bankFormData.balance} onChange={e => setBankFormData({...bankFormData, balance: parseInt(e.target.value) || 0})} className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-2xl font-black text-emerald-700 text-2xl outline-none" />
                      </div>
                      <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all">Simpan Data Rekening</button>
                  </form>
              </div>
          </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="bg-blue-600 p-8 flex justify-between items-center text-white shrink-0">
                      <h3 className="font-black text-xl tracking-tight">Akun Baru</h3>
                      <button onClick={() => setShowCategoryModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><X size={18} /></button>
                  </div>
                  <div className="p-10 space-y-6">
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                          <button onClick={() => setNewCategoryType('INCOME')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newCategoryType === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Pemasukan</button>
                          <button onClick={() => setNewCategoryType('EXPENSE')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newCategoryType === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Pengeluaran</button>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Nama Kategori / Akun</label>
                          <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-700 outline-none focus:bg-white" placeholder="Misal: Gaji Karyawan" />
                      </div>
                      {newCategoryType === 'EXPENSE' && (
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Tipe Pengeluaran</label>
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setNewExpenseSubType('RUTIN')} className={`p-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${newExpenseSubType === 'RUTIN' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400'}`}>Rutin</button>
                                  <button onClick={() => setNewExpenseSubType('NON_RUTIN')} className={`p-3 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${newExpenseSubType === 'NON_RUTIN' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-100 text-slate-400'}`}>Non-Rutin</button>
                              </div>
                          </div>
                      )}
                      <button onClick={handleAddCategory} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Simpan Kategori</button>
                  </div>
              </div>
          </div>
      )}

      {isRecalculating && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] p-12 w-full max-w-md text-center shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100"><div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div></div>
                  <div className="mb-8 flex justify-center"><div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center animate-pulse"><RefreshCw size={40} className={loadingProgress < 100 ? "animate-spin" : ""} /></div></div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">{loadingProgress < 100 ? 'Sedang Menghitung...' : 'Selesai!'}</h3>
                  <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-widest">Sistem menyinkronkan tarif tagihan warga.</p>
                  <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden mb-2 shadow-inner"><div className="bg-emerald-500 h-full flex items-center justify-center" style={{ width: `${loadingProgress}%` }}>{loadingProgress > 10 && <span className="text-[10px] font-black text-white">{loadingProgress}%</span>}</div></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Setup;
