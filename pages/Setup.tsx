
import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, 
  MapPin, 
  DollarSign, 
  List, 
  Save, 
  Image as ImageIcon, 
  Sparkles, 
  Gauge, 
  Plus, 
  Trash2, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  X, 
  Repeat, 
  AlertTriangle, 
  Upload, 
  MessageCircle, 
  Database,
  FileDown,
  RotateCcw,
  Calculator,
  Filter,
  Loader2,
  HardDriveDownload,
  HardDriveUpload,
  Globe,
  Share2,
  // Added missing Download icon import
  Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TransactionCategory, ExtraFee, UserRole } from '../types';
import * as XLSX from 'xlsx';

// Interfaces for Regional API
interface Region {
  id: string;
  name: string;
}

const Setup: React.FC = () => {
  const { settings: globalSettings, updateSettings, addNotification, currentUser, resetDatabase, exportDatabase, importDatabase } = useApp();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(globalSettings);

  // Modal State for Categories
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [newExpenseSubType, setNewExpenseSubType] = useState<'RUTIN' | 'NON_RUTIN'>('RUTIN');

  // Account Import
  const accountImportRef = useRef<HTMLInputElement>(null);
  
  // Database Import
  const dbImportRef = useRef<HTMLInputElement>(null);
  const [isDbImporting, setIsDbImporting] = useState(false);
  const [isDbExporting, setIsDbExporting] = useState(false);

  // Logo Upload
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Custom Fee State
  const [newFeeName, setNewFeeName] = useState('');
  const [newFeeAmount, setNewFeeAmount] = useState('');

  // --- REGION STATE ---
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [regencies, setRegencies] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [villages, setVillages] = useState<Region[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(false);

  // Sync with global settings when context updates
  useEffect(() => {
    setSettings(globalSettings);
  }, [globalSettings]);

  // --- REGION API EFFECTS ---
  useEffect(() => {
    if (activeTab === 'general') {
        fetchProvinces();
    }
  }, [activeTab]);

  const fetchProvinces = async () => {
      try {
          const res = await fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json');
          const data = await res.json();
          setProvinces(data);
      } catch (e) { console.error("Failed to fetch provinces"); }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      const name = e.target.options[e.target.selectedIndex].text;
      setSettings({ ...settings, address_province: name, address_city: '', address_kecamatan: '', address_kelurahan: '' });
      
      setLoadingRegions(true);
      try {
          const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${id}.json`);
          const data = await res.json();
          setRegencies(data);
          setDistricts([]);
          setVillages([]);
      } finally { setLoadingRegions(false); }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      const name = e.target.options[e.target.selectedIndex].text;
      setSettings({ ...settings, address_city: name, address_kecamatan: '', address_kelurahan: '' });

      setLoadingRegions(true);
      try {
          const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${id}.json`);
          const data = await res.json();
          setDistricts(data);
          setVillages([]);
      } finally { setLoadingRegions(false); }
  };

  const handleDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      const name = e.target.options[e.target.selectedIndex].text;
      setSettings({ ...settings, address_kecamatan: name, address_kelurahan: '' });

      setLoadingRegions(true);
      try {
          const res = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${id}.json`);
          const data = await res.json();
          setVillages(data);
      } finally { setLoadingRegions(false); }
  };

  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const name = e.target.options[e.target.selectedIndex].text;
      setSettings({ ...settings, address_kelurahan: name });
  };


  const tabs = [
    { id: 'general', label: 'Lokasi & Profil', icon: <Building size={16} /> },
    { id: 'regional', label: 'Data RT / RW', icon: <MapPin size={16} /> },
    { id: 'tariff', label: 'Setting Tarif', icon: <DollarSign size={16} /> },
    { id: 'account', label: 'Kode Akun', icon: <List size={16} /> },
    { id: 'notification', label: 'Notifikasi WA', icon: <MessageCircle size={16} /> },
  ];

  // Access check: Database tools are available for all ADMIN roles
  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.id === '0';

  if (isAdmin) {
      tabs.push({ id: 'database', label: 'Database', icon: <Database size={16} /> });
  }
  
  if (currentUser?.id === '0') {
      tabs.push({ id: 'formula', label: 'Rumus & Logika', icon: <Calculator size={16} /> });
  }

  const handleSave = async () => {
    try {
      await updateSettings(settings);
    } catch (error) {
      addNotification('Gagal menyimpan pengaturan.', 'error');
    }
  };

  const handleResetDatabase = async () => {
      const confirm = window.confirm("PERINGATAN: Ini akan menghapus SELURUH DATA transaksi, tagihan, dan warga. Tindakan ini tidak dapat dibatalkan. Lanjutkan?");
      if (confirm) {
          const secondConfirm = window.prompt("Ketik 'RESET' untuk konfirmasi penghapusan database:");
          if (secondConfirm === 'RESET') {
              await resetDatabase();
          } else {
              alert("Konfirmasi salah. Batal.");
          }
      }
  };

  // --- LOGO UPLOAD LOGIC ---
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = reader.result as string;
          setSettings({ ...settings, logo_url: base64String });
          addNotification("Logo berhasil dimuat. Klik Simpan.", "success");
      };
      reader.readAsDataURL(file);
  };

  // --- DATABASE EXPORT & IMPORT ---
  const handleExportDatabase = async () => {
      setIsDbExporting(true);
      try {
          const data = await exportDatabase();
          const jsonStr = JSON.stringify(data, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `backup_fpsu_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          addNotification("Database berhasil diekspor!", "success");
      } catch (e) {
          addNotification("Gagal mengekspor database.", "error");
      } finally {
          setIsDbExporting(false);
      }
  };

  const handleImportDatabase = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const confirm = window.confirm("PERINGATAN: Proses Restore akan menimpa data yang ada saat ini dengan data dari file cadangan. Lanjutkan?");
      if (!confirm) {
          if (dbImportRef.current) dbImportRef.current.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
          setIsDbImporting(true);
          try {
              const jsonContent = JSON.parse(e.target?.result as string);
              await importDatabase(jsonContent);
          } catch (err) {
              addNotification("Gagal membaca file cadangan. Pastikan format file benar (.json).", "error");
              setIsDbImporting(false);
          }
      };
      reader.readAsText(file);
  };

  // --- KODE AKUN LOGIC ---
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      addNotification('Nama kategori tidak boleh kosong', 'warning');
      return;
    }
    const newCategory: TransactionCategory = {
      id: `cat-${Date.now()}`,
      name: newCategoryName,
      type: newCategoryType,
      expenseType: newCategoryType === 'EXPENSE' ? newExpenseSubType : undefined
    };
    const updatedCategories = [...(settings.transactionCategories || []), newCategory];
    setSettings({ ...settings, transactionCategories: updatedCategories });
    setNewCategoryName('');
    setShowCategoryModal(false);
    addNotification('Kategori akun ditambahkan (Klik Simpan untuk permanen)', 'info');
  };

  const handleDeleteCategory = (id: string) => {
    if (window.confirm('Hapus kategori akun ini?')) {
      const updatedCategories = settings.transactionCategories.filter(c => c.id !== id);
      setSettings({ ...settings, transactionCategories: updatedCategories });
      addNotification('Kategori akun dihapus (Klik Simpan untuk permanen)', 'info');
    }
  };

  const handleResetCategories = () => {
      const confirmation = window.prompt('PERINGATAN: Seluruh Kategori Akun akan dihapus. Ketik "RESET" untuk melanjutkan:');
      if (confirmation === 'RESET') {
          setSettings({ ...settings, transactionCategories: [] });
          addNotification("Daftar akun dikosongkan. Klik 'Simpan' untuk menerapkan.", "warning");
      }
  };

  const handleRemoveDuplicateAccounts = () => {
      const uniqueCategories: TransactionCategory[] = [];
      const seen = new Set();

      settings.transactionCategories.forEach(cat => {
          const key = `${cat.name.toLowerCase().trim()}-${cat.type}`;
          if (!seen.has(key)) {
              seen.add(key);
              uniqueCategories.push(cat);
          }
      });

      if (uniqueCategories.length < settings.transactionCategories.length) {
          const removedCount = settings.transactionCategories.length - uniqueCategories.length;
          setSettings({ ...settings, transactionCategories: uniqueCategories });
          addNotification(`Berhasil menandai ${removedCount} akun ganda untuk dihapus. Klik 'Simpan' untuk menerapkan.`, "success");
      } else {
          addNotification("Tidak ditemukan akun ganda.", "info");
      }
  };

  const downloadAccountTemplate = () => {
    const data = [
        { "nama_kategori": "Dana Darurat", "tipe": "INCOME", "sub_tipe": "" },
        { "nama_kategori": "Perbaikan Jalan", "tipe": "EXPENSE", "sub_tipe": "NON_RUTIN" }
    ];
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_akun.xlsx");
  };

  const handleImportAccounts = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
          
          let count = 0;
          const newCats: TransactionCategory[] = [];

          for (const row of jsonData) {
              if (row.nama_kategori) {
                  const typeRaw = row.tipe ? row.tipe.toUpperCase() : 'EXPENSE';
                  const type = typeRaw === 'INCOME' ? 'INCOME' : 'EXPENSE';
                  const subTypeRaw = row.sub_tipe ? row.sub_tipe.toUpperCase() : 'RUTIN';
                  const subType = subTypeRaw === 'NON_RUTIN' ? 'NON_RUTIN' : 'RUTIN';
                  
                  newCats.push({
                      id: `cat-imp-${Date.now()}-${Math.random()}`,
                      name: row.nama_kategori,
                      type: type,
                      expenseType: type === 'EXPENSE' ? subType : undefined
                  });
                  count++;
              }
          }
          
          if (count > 0) {
            setSettings({ ...settings, transactionCategories: [...settings.transactionCategories, ...newCats] });
            addNotification(`${count} akun berhasil diimpor (Klik Simpan untuk permanen)`, "success");
          } else {
            addNotification("Tidak ada data valid yang ditemukan.", "error");
          }
      } catch (error) {
          addNotification("Gagal membaca file Excel.", "error");
      }
      
      if (accountImportRef.current) accountImportRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };


  // --- BIAYA TAMBAHAN LOGIC ---
  const handleAddFee = () => {
      if (!newFeeName || !newFeeAmount) return;
      const newFee: ExtraFee = {
          id: `fee-${Date.now()}`,
          name: newFeeName,
          amount: parseInt(newFeeAmount) || 0
      };
      setSettings({...settings, extra_fees: [...settings.extra_fees, newFee]});
      setNewFeeName('');
      setNewFeeAmount('');
      addNotification(`Biaya tambahan "${newFeeName}" ditambahkan. Klik Simpan.`, 'info');
  };

  const handleDeleteFee = (id: string) => {
      if(window.confirm("Hapus biaya tambahan ini?")) {
        setSettings({...settings, extra_fees: settings.extra_fees.filter(f => f.id !== id)});
        addNotification("Biaya tambahan dihapus. Klik Simpan.", "info");
      }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#1E293B]">Pengaturan Sistem</h2>
          <p className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mt-1">Konfigurasi Global & Parameter Tarif</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* HORIZONTAL TABS (Scrollable) */}
        <div className="w-full overflow-x-auto no-scrollbar">
            <div className="flex space-x-2 p-1 bg-white rounded-[1.5rem] border border-slate-200 w-max md:w-full">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                >
                  <div className={`${activeTab === tab.id ? 'text-emerald-400' : ''}`}>
                    {tab.icon}
                  </div>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 md:p-10 overflow-hidden min-h-[600px]">
          
          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-6">
                  <div className="flex items-center space-x-3 text-[#1E293B]">
                    <Building size={24} className="text-emerald-500" />
                    <h3 className="text-xl font-black">Profil & Lokasi</h3>
                  </div>
                  <button 
                    onClick={handleSave}
                    className="flex items-center space-x-2 bg-[#1E293B] hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-slate-900/10 transition-all text-xs uppercase tracking-widest"
                  >
                    <Save size={18} />
                    <span>Simpan Perubahan</span>
                  </button>
              </div>

              {/* Logo Section */}
              <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="space-y-3 w-full md:w-auto">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logo Instansi</label>
                      <div className="flex items-center space-x-6">
                        <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center border-4 border-dashed border-slate-200 text-slate-300 overflow-hidden shrink-0">
                          {settings.logo_url ? (
                              <img src={settings.logo_url} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                              <ImageIcon size={32} />
                          )}
                        </div>
                        <div>
                            <input 
                                type="file" 
                                ref={logoInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleLogoUpload}
                            />
                            <button 
                                onClick={() => logoInputRef.current?.click()}
                                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                            >
                              Ganti Logo
                            </button>
                            <p className="text-[9px] text-slate-400 mt-2 max-w-[200px] leading-tight">Format: JPG, PNG. Max: 2MB. Disarankan rasio 1:1.</p>
                        </div>
                      </div>
                  </div>

                  <div className="flex-1 w-full space-y-4">
                      {/* Nama Perumahan */}
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nama Perumahan / Lingkungan</label>
                          <input 
                            type="text" 
                            value={settings.location_name}
                            onChange={(e) => setSettings({...settings, location_name: e.target.value})}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 text-lg" 
                          />
                      </div>

                      {/* Alamat Kantor & RW */}
                      <div className="flex gap-4">
                          <div className="flex-1">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Alamat Kantor / Sekretariat</label>
                              <input 
                                type="text" 
                                placeholder="Jalan Mawar No. 1..."
                                value={settings.office_address || ''}
                                onChange={(e) => setSettings({...settings, office_address: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" 
                              />
                          </div>
                          <div className="w-24 md:w-32">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">No. RW</label>
                              <input 
                                type="text" 
                                placeholder="15"
                                value={settings.address_rw || ''}
                                onChange={(e) => setSettings({...settings, address_rw: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 text-center outline-none focus:bg-white focus:border-blue-500 transition-all" 
                              />
                          </div>
                      </div>
                  </div>
              </div>

              <div className="border-t border-dashed border-slate-200 my-6"></div>

              <div className="flex items-center space-x-3 text-[#1E293B]">
                <MapPin size={24} className="text-emerald-500" />
                <h3 className="text-xl font-black">Detail Alamat Wilayah (Otomatis)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                 {loadingRegions && (
                     <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                         <Loader2 className="animate-spin text-emerald-500" />
                     </div>
                 )}
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Provinsi</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none"
                        onChange={handleProvinceChange}
                    >
                        <option value="">{settings.address_province || '-- Pilih Provinsi --'}</option>
                        {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kota / Kabupaten</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none"
                        onChange={handleCityChange}
                        disabled={!regencies.length}
                    >
                        <option value="">{settings.address_city || '-- Pilih Kota/Kab --'}</option>
                        {regencies.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kecamatan</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none"
                        onChange={handleDistrictChange}
                        disabled={!districts.length}
                    >
                        <option value="">{settings.address_kecamatan || '-- Pilih Kecamatan --'}</option>
                        {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kelurahan / Desa</label>
                    <select 
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none"
                        onChange={handleVillageChange}
                        disabled={!villages.length}
                    >
                        <option value="">{settings.address_kelurahan || '-- Pilih Kelurahan --'}</option>
                        {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kode Pos</label>
                        <input 
                        type="text" 
                        placeholder="XXXXX"
                        value={settings.address_zip || ''}
                        onChange={(e) => setSettings({...settings, address_zip: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" 
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Telp Admin</label>
                        <input 
                        type="text" 
                        placeholder="08..."
                        value={settings.admin_contact || ''}
                        onChange={(e) => setSettings({...settings, admin_contact: e.target.value})}
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" 
                        />
                    </div>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'regional' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-6">
                  <div className="flex items-center space-x-3 text-[#1E293B]">
                    <MapPin size={24} className="text-emerald-500" />
                    <h3 className="text-xl font-black">Struktur RT / RW</h3>
                  </div>
                  <button 
                    onClick={handleSave}
                    className="flex items-center space-x-2 bg-[#1E293B] hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-slate-900/10 transition-all text-xs uppercase tracking-widest"
                  >
                    <Save size={18} />
                    <span>Simpan Perubahan</span>
                  </button>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nomor RW (Sistem)</label>
                  <input 
                    type="text" 
                    value={settings.rwList[0]?.replace('RW ', '') || '15'} 
                    onChange={(e) => setSettings({...settings, rwList: [`RW ${e.target.value}`]})}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold text-slate-700" 
                  />
                  <p className="text-[9px] text-slate-400 mt-2 ml-1">Digunakan untuk dropdown di form warga.</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Total RT</label>
                  <input 
                    type="number" 
                    value={settings.rtList.length} 
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      const newList = Array.from({length: count}, (_, i) => {
                          const num = i + 1;
                          return `RT ${num.toString().padStart(2, '0')}`;
                      });
                      setSettings({...settings, rtList: newList});
                    }}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none font-bold text-slate-700" 
                  />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Daftar RT Aktif</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {settings.rtList.map((rt, i) => (
                    <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 text-center text-xs uppercase tracking-widest">
                      {rt}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tariff' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-6">
                  <div className="flex items-center space-x-3 text-[#1E293B]">
                    <DollarSign size={24} className="text-emerald-500" />
                    <h3 className="text-xl font-black">Konfigurasi Tarif & Biaya</h3>
                  </div>
                  <button 
                    onClick={handleSave}
                    className="flex items-center space-x-2 bg-[#1E293B] hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-slate-900/10 transition-all text-xs uppercase tracking-widest"
                  >
                    <Save size={18} />
                    <span>Simpan Perubahan</span>
                  </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* STANDARD FEES */}
                <div className="card bg-slate-50 border border-slate-100 p-6 space-y-4">
                    <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">Biaya Dasar</h4>
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Iuran IPL (Rutin/Dasar)</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">Rp</div>
                            <input 
                            type="number" 
                            value={settings.ipl_base}
                            onChange={(e) => setSettings({...settings, ipl_base: parseInt(e.target.value) || 0})}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-slate-700 transition-all" 
                            />
                        </div>
                    </div>
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Iuran Kas RT</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">Rp</div>
                            <input 
                            type="number" 
                            value={settings.kas_rt_base}
                            onChange={(e) => setSettings({...settings, kas_rt_base: parseInt(e.target.value) || 0})}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-slate-700 transition-all" 
                            />
                        </div>
                    </div>
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Abodemen Air</label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">Rp</div>
                            <input 
                            type="number" 
                            value={settings.water_abodemen}
                            onChange={(e) => setSettings({...settings, water_abodemen: parseInt(e.target.value) || 0})}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-bold text-slate-700 transition-all" 
                            />
                        </div>
                    </div>
                </div>

                {/* WATER RATE */}
                <div className="card bg-emerald-50/50 border border-emerald-100 p-6 space-y-6">
                    <div className="flex items-center space-x-2 text-emerald-700">
                        <Gauge size={18} />
                        <h4 className="text-sm font-black uppercase tracking-widest">Tarif Air Progresif</h4>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-emerald-100/50">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Batas Pemakaian Blok 1 (Threshold)</label>
                        <div className="flex items-center space-x-3">
                            <input 
                                type="number" 
                                value={settings.water_rate_threshold ?? 10}
                                onChange={(e) => setSettings({...settings, water_rate_threshold: parseInt(e.target.value) || 0})}
                                className="w-full bg-transparent font-black text-slate-700 text-lg outline-none" 
                            />
                            <span className="text-[10px] font-black text-slate-300">m³</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 italic">Pemakaian di atas ini akan dikenakan tarif Blok 2.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-xl border border-emerald-100/50">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tarif Blok 1 (≤ {settings.water_rate_threshold ?? 10} m³)</label>
                            <div className="flex items-center space-x-3">
                            <span className="text-slate-300 font-bold">Rp</span>
                            <input 
                                type="number" 
                                value={settings.water_rate_low}
                                onChange={(e) => setSettings({...settings, water_rate_low: parseInt(e.target.value) || 0})}
                                className="w-full bg-transparent font-black text-slate-700 text-lg outline-none" 
                            />
                            <span className="text-[10px] font-black text-slate-300">/m³</span>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-emerald-100/50">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tarif Blok 2 (&gt; {settings.water_rate_threshold ?? 10} m³)</label>
                            <div className="flex items-center space-x-3">
                            <span className="text-slate-300 font-bold">Rp</span>
                            <input 
                                type="number" 
                                value={settings.water_rate_high}
                                onChange={(e) => setSettings({...settings, water_rate_high: parseInt(e.target.value) || 0})}
                                className="w-full bg-transparent font-black text-slate-700 text-lg outline-none" 
                            />
                            <span className="text-[10px] font-black text-slate-300">/m³</span>
                            </div>
                        </div>
                    </div>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border-2 border-dashed border-slate-200 p-8 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Sparkles size={120} className="text-emerald-500" />
                </div>
                
                <div className="flex items-center space-x-3 mb-6 relative z-10">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <List size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-[#1E293B] text-lg">Biaya Tambahan Kustom</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daftar biaya lain yang akan ditagihkan (Opt-in per warga)</p>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                    <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex-1 w-full">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nama Biaya</label>
                            <input 
                                type="text"
                                placeholder="Contoh: Iuran Sampah / Dana Sosial"
                                value={newFeeName}
                                onChange={(e) => setNewFeeName(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none"
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Jumlah (Rp)</label>
                            <input 
                                type="number"
                                placeholder="0"
                                value={newFeeAmount}
                                onChange={(e) => setNewFeeAmount(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleAddFee}
                            className="bg-slate-800 text-white p-3 rounded-xl hover:bg-slate-900 transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {settings.extra_fees.map((fee) => (
                            <div key={fee.id} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl">
                                <div>
                                    <p className="font-bold text-slate-700">{fee.name}</p>
                                    <p className="text-xs font-black text-emerald-600">Rp {fee.amount.toLocaleString('id-ID')}</p>
                                </div>
                                <button 
                                    onClick={() => handleDeleteFee(fee.id)}
                                    className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notification' && (
            <div className="space-y-8 animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-6">
                    <div className="flex items-center space-x-3 text-[#1E293B]">
                        <MessageCircle size={24} className="text-emerald-500" />
                        <h3 className="text-xl font-black">Notifikasi WhatsApp</h3>
                    </div>
                    <button 
                        onClick={handleSave}
                        className="flex items-center space-x-2 bg-[#1E293B] hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-slate-900/10 transition-all text-xs uppercase tracking-widest"
                    >
                        <Save size={18} />
                        <span>Simpan Perubahan</span>
                    </button>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-700">
                    <p className="font-bold mb-2">Variabel yang dapat digunakan:</p>
                    <div className="flex flex-wrap gap-2">
                        {['{NAMA}', '{RUMAH}', '{PERIODE}', '{TOTAL}', '{RINCIAN}', '{TANGGAL}'].map(tag => (
                            <span key={tag} className="bg-white px-2 py-1 rounded border border-blue-200 font-mono text-[10px]">{tag}</span>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Pesan Tagihan (Bill)</label>
                        <textarea
                            value={settings.whatsappTemplates?.billMessage || ''}
                            onChange={(e) => setSettings({
                                ...settings, 
                                whatsappTemplates: { ...settings.whatsappTemplates, billMessage: e.target.value }
                            })}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700 text-sm h-40"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Pesan Bukti Bayar (Receipt)</label>
                        <textarea
                            value={settings.whatsappTemplates?.receiptMessage || ''}
                            onChange={(e) => setSettings({
                                ...settings, 
                                whatsappTemplates: { ...settings.whatsappTemplates, receiptMessage: e.target.value }
                            })}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700 text-sm h-40"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Pesan Pengingat Tunggakan</label>
                        <textarea
                            value={settings.whatsappTemplates?.arrearsMessage || ''}
                            onChange={(e) => setSettings({
                                ...settings, 
                                whatsappTemplates: { ...settings.whatsappTemplates, arrearsMessage: e.target.value }
                            })}
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700 text-sm h-40"
                        />
                    </div>
                </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                <div className="flex items-center space-x-3 text-[#1E293B]">
                  <List size={24} className="text-emerald-500" />
                  <div>
                    <h3 className="text-xl font-black">Kode Akun Transaksi</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Kategori Pemasukan & Pengeluaran</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <input 
                        type="file" 
                        ref={accountImportRef}
                        onChange={handleImportAccounts}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <button 
                        onClick={() => accountImportRef.current?.click()}
                        className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                        <Upload size={14} /> <span className="hidden sm:inline">Import</span>
                    </button>
                    <button 
                        onClick={downloadAccountTemplate}
                        className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                        <FileDown size={14} /> <span className="hidden sm:inline">Template</span>
                    </button>
                    <button 
                        onClick={handleRemoveDuplicateAccounts}
                        className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-amber-600 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all"
                        title="Hapus Akun Duplikat"
                    >
                        <Filter size={14} /> <span className="hidden sm:inline">Hapus Duplikat</span>
                    </button>
                    <button 
                        onClick={handleResetCategories}
                        className="px-4 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all"
                        title="Hapus Semua Kode Akun"
                    >
                        <RotateCcw size={14} /> <span className="hidden sm:inline">Reset</span>
                    </button>
                    <button 
                        onClick={() => setShowCategoryModal(true)}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                        <Plus size={14} />
                        <span>Akun Baru</span>
                    </button>
                    <div className="h-8 w-[1px] bg-slate-300 mx-1"></div>
                    <button 
                        onClick={handleSave}
                        className="flex items-center space-x-2 bg-[#1E293B] hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-slate-900/10 transition-all text-xs uppercase tracking-widest"
                    >
                        <Save size={18} />
                        <span>Simpan</span>
                    </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                       <ArrowUpCircle size={18} className="text-emerald-500" />
                       <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Akun Pemasukan (Income)</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                               <tr>
                                   <th className="px-4 py-3">Nama Akun</th>
                                   <th className="px-4 py-3 text-right">Aksi</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {(settings.transactionCategories || []).filter(c => c.type === 'INCOME').map((cat) => (
                                   <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                                       <td className="px-4 py-3 font-bold text-slate-700">{cat.name}</td>
                                       <td className="px-4 py-3 text-right">
                                           <button 
                                              onClick={() => handleDeleteCategory(cat.id)}
                                              className="text-slate-400 hover:text-rose-500 transition-colors"
                                           >
                                               <Trash2 size={14} />
                                           </button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                       <ArrowDownCircle size={18} className="text-rose-500" />
                       <span className="text-xs font-black text-rose-600 uppercase tracking-widest">Akun Pengeluaran (Expense)</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                               <tr>
                                   <th className="px-4 py-3">Nama Akun</th>
                                   <th className="px-4 py-3">Tipe</th>
                                   <th className="px-4 py-3 text-right">Aksi</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {(settings.transactionCategories || []).filter(c => c.type === 'EXPENSE').map((cat) => (
                                   <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                                       <td className="px-4 py-3 font-bold text-slate-700">{cat.name}</td>
                                       <td className="px-4 py-3">
                                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${cat.expenseType === 'RUTIN' ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {cat.expenseType === 'RUTIN' ? 'Rutin' : 'Non Rutin'}
                                            </span>
                                       </td>
                                       <td className="px-4 py-3 text-right">
                                           <button 
                                              onClick={() => handleDeleteCategory(cat.id)}
                                              className="text-slate-400 hover:text-rose-500 transition-colors"
                                           >
                                               <Trash2 size={14} />
                                           </button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && isAdmin && (
              <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex items-center space-x-3 text-slate-800 border-b border-slate-100 pb-6">
                      <Database size={24} className="text-slate-800" />
                      <h3 className="text-xl font-black">Manajemen & Cadangan Database</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* EXPORT / DOWNLOAD */}
                      <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] relative overflow-hidden group hover:shadow-lg transition-all">
                          <div className="relative z-10">
                              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm text-emerald-600 group-hover:scale-110 transition-transform">
                                  <HardDriveDownload size={28} />
                              </div>
                              <h4 className="text-lg font-black text-emerald-800 uppercase tracking-tight mb-2">Export Data (Backup)</h4>
                              <p className="text-xs font-medium text-emerald-600 mb-8 leading-relaxed">
                                  Gunakan fitur ini untuk mengunduh seluruh data aplikasi (Warga, Transaksi, Meteran, Tagihan) ke dalam satu file cadangan berformat JSON.
                              </p>
                              <button 
                                  onClick={handleExportDatabase}
                                  disabled={isDbExporting}
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70"
                              >
                                  {isDbExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                  {isDbExporting ? 'Mengekspor...' : 'Download Database'}
                              </button>
                          </div>
                      </div>

                      {/* IMPORT / UPLOAD */}
                      <div className="p-8 bg-blue-50 border border-blue-100 rounded-[2.5rem] relative overflow-hidden group hover:shadow-lg transition-all">
                          <div className="relative z-10">
                              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                  <HardDriveUpload size={28} />
                              </div>
                              <h4 className="text-lg font-black text-blue-800 uppercase tracking-tight mb-2">Restore Data (Upload)</h4>
                              <p className="text-xs font-medium text-blue-600 mb-8 leading-relaxed">
                                  Unggah file cadangan JSON yang pernah Anda unduh sebelumnya. <span className="text-rose-500 font-bold">PERHATIAN:</span> Proses ini akan menimpa data yang ada saat ini.
                              </p>
                              
                              <input 
                                  type="file" 
                                  accept=".json"
                                  ref={dbImportRef}
                                  className="hidden"
                                  onChange={handleImportDatabase}
                              />
                              
                              <button 
                                  onClick={() => dbImportRef.current?.click()}
                                  disabled={isDbImporting}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70"
                              >
                                  {isDbImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                  {isDbImporting ? 'Memproses...' : 'Upload Database'}
                              </button>
                          </div>
                      </div>
                  </div>

                  {currentUser?.id === '0' && (
                    <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Trash2 size={150} />
                        </div>
                        <h4 className="text-lg font-black uppercase tracking-widest mb-2">Reset Sistem Total</h4>
                        <p className="text-sm font-medium text-slate-400 max-w-lg leading-relaxed mb-8">
                            Tindakan ini akan menghapus <strong>seluruh data</strong> termasuk Warga, Tagihan, Transaksi, Meteran, dan Mutasi Bank. Akun Super Admin dan Pengaturan Dasar tidak akan dihapus.
                        </p>
                        
                        <button 
                            onClick={handleResetDatabase}
                            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-red-600/30 transition-all flex items-center gap-3 active:scale-95"
                        >
                            <Trash2 size={18} />
                            Kosongkan Database
                        </button>
                    </div>
                  )}
              </div>
          )}

          {activeTab === 'formula' && currentUser?.id === '0' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex items-center space-x-3 text-[#1E293B] border-b border-slate-100 pb-6">
                      <Calculator size={24} className="text-emerald-500" />
                      <h3 className="text-xl font-black">Rumus Perhitungan Tagihan</h3>
                  </div>
                  <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                          <Calculator size={150} />
                      </div>
                      
                      <div className="relative z-10 space-y-8">
                          <div>
                              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">Logika Dasar</h4>
                              <p className="text-2xl font-bold font-mono">Total Tagihan = (Biaya Tetap) + (Biaya Variabel) + (Biaya Tambahan) + Tunggakan</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm">
                                  <h5 className="font-black text-sm uppercase tracking-widest mb-4 border-b border-white/20 pb-2">1. Komponen Biaya</h5>
                                  <ul className="space-y-2 text-sm text-slate-300">
                                      <li className="flex justify-between"><span>IPL Dasar:</span> <span className="font-mono text-white">Rp {settings.ipl_base.toLocaleString()}</span></li>
                                      <li className="flex justify-between"><span>Kas RT:</span> <span className="font-mono text-white">Rp {settings.kas_rt_base.toLocaleString()}</span></li>
                                      <li className="flex justify-between"><span>Abodemen Air:</span> <span className="font-mono text-white">Rp {settings.water_abodemen.toLocaleString()}</span></li>
                                  </ul>
                              </div>

                              <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm">
                                  <h5 className="font-black text-sm uppercase tracking-widest mb-4 border-b border-white/20 pb-2">2. Perhitungan Air (Progresif)</h5>
                                  <div className="space-y-3 text-sm text-slate-300">
                                      <p>Jika Pemakaian &le; {settings.water_rate_threshold} m³:</p>
                                      <code className="block bg-black/30 p-2 rounded text-emerald-300 font-mono">Biaya = Pemakaian &times; {settings.water_rate_low}</code>
                                      
                                      <p>Jika Pemakaian &gt; {settings.water_rate_threshold} m³:</p>
                                      <code className="block bg-black/30 p-2 rounded text-emerald-300 font-mono">
                                          Biaya = ({settings.water_rate_threshold} &times; {settings.water_rate_low}) + ((Pemakaian - {settings.water_rate_threshold}) &times; {settings.water_rate_high})
                                      </code>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <div>
                    <h3 className="font-black text-slate-800">Tambah Akun Baru</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kategori Transaksi</p>
                 </div>
                 <button onClick={() => setShowCategoryModal(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all">
                    <X size={18} />
                 </button>
              </div>
              <div className="p-8 space-y-6">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Jenis Akun</label>
                    <div className="grid grid-cols-2 gap-3">
                       <button 
                         onClick={() => setNewCategoryType('INCOME')}
                         className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${newCategoryType === 'INCOME' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-400 hover:border-emerald-200'}`}
                       >
                         Pemasukan
                       </button>
                       <button 
                         onClick={() => setNewCategoryType('EXPENSE')}
                         className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${newCategoryType === 'EXPENSE' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'border-slate-200 text-slate-400 hover:border-rose-200'}`}
                       >
                         Pengeluaran
                       </button>
                    </div>
                 </div>

                 {newCategoryType === 'EXPENSE' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Tipe Pengeluaran</label>
                        <div className="grid grid-cols-2 gap-3">
                           <button 
                             onClick={() => setNewExpenseSubType('RUTIN')}
                             className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${newExpenseSubType === 'RUTIN' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 text-slate-400'}`}
                           >
                             <Repeat size={14} /> Rutin
                           </button>
                           <button 
                             onClick={() => setNewExpenseSubType('NON_RUTIN')}
                             className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${newExpenseSubType === 'NON_RUTIN' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'border-slate-200 text-slate-400'}`}
                           >
                             <AlertTriangle size={14} /> Non Rutin
                           </button>
                        </div>
                    </div>
                 )}
                 
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nama Kategori</label>
                    <input 
                      type="text" 
                      autoFocus
                      placeholder={newCategoryType === 'INCOME' ? "Contoh: Dana Sosial" : "Contoh: Gaji Satpam"}
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                    />
                 </div>

                 <button 
                   onClick={handleAddCategory}
                   className="w-full py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 active:scale-95 transition-all"
                 >
                   Simpan Akun
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Setup;
