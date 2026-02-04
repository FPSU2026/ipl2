
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  UserPlus, 
  Edit, 
  Trash2, 
  Search, 
  Upload, 
  Save,
  MessageCircle,
  Phone,
  Loader2,
  Trash,
  HeartHandshake,
  Check,
  List,
  X,
  Info,
  Droplets,
  Coins,
  Download,
  PiggyBank
} from 'lucide-react';
import { Resident, UserRole } from '../types';
import * as XLSX from 'xlsx';

const Residents: React.FC = () => {
  const { 
    residents, 
    addResident,
    addResidentsImport, 
    updateResident, 
    deleteResident, 
    deleteAllResidents,
    bills, 
    settings, 
    addNotification, 
    currentUser 
  } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRT, setFilterRT] = useState('Semua RT');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detail Popups State
  const [selectedDispensation, setSelectedDispensation] = useState<Resident | null>(null);
  const [selectedExtraFeesDetail, setSelectedExtraFeesDetail] = useState<Resident | null>(null);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Form State
  const [formData, setFormData] = useState<Partial<Resident>>({
    houseNo: '',
    rt: settings.rtList[0] || 'RT 01',
    rw: settings.rwList[0] || 'RW 15',
    phone: '',
    initialMeter: 0,
    initialArrears: 0,
    deposit: 0,
    status: 'PEMILIK',
    name: '',
    isDispensation: false,
    dispensationNote: '',
    exemptions: [],
    activeCustomFees: []
  });

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showImportModal) setShowImportModal(false);
        if (showFormModal) setShowFormModal(false);
        if (selectedDispensation) setSelectedDispensation(null);
        if (selectedExtraFeesDetail) setSelectedExtraFeesDetail(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showImportModal, showFormModal, selectedDispensation, selectedExtraFeesDetail]);

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (window.confirm(`Yakin ingin menghapus data warga "${name}"? Semua riwayat tagihan akan tetap ada.`)) {
      try {
        await deleteResident(id);
        addNotification("Data warga berhasil dihapus", "success");
      } catch(e) {
        addNotification("Gagal menghapus data.", "error");
      }
    }
  };

  const handleDeleteAll = async () => {
    if (!isAdmin) return;
    const confirmation = window.prompt('PERINGATAN: Seluruh data warga akan dihapus selamanya. Ketik "HAPUS" untuk melanjutkan:');
    if (confirmation === 'HAPUS') {
      try {
        await deleteAllResidents();
        addNotification("Seluruh data warga telah dihapus", "success");
      } catch (e) {
        addNotification("Gagal menghapus semua data.", "error");
      }
    } else if (confirmation !== null) {
      alert('Konfirmasi salah. Penghapusan dibatalkan.');
    }
  };

  const handleOpenEdit = (res: Resident) => {
    if (!isAdmin) return;
    setEditingResident(res);
    setFormData({ ...res, isDispensation: res.isDispensation ?? false });
    setShowFormModal(true);
  };

  const handleOpenAdd = () => {
    if (!isAdmin) return;
    setEditingResident(null);
    setFormData({
      houseNo: '',
      rt: settings.rtList[0] || 'RT 01',
      rw: settings.rwList[0] || 'RW 15',
      phone: '',
      initialMeter: 0,
      initialArrears: 0,
      deposit: 0,
      status: 'PEMILIK',
      name: '',
      isDispensation: false,
      dispensationNote: '',
      exemptions: [],
      activeCustomFees: []
    });
    setShowFormModal(true);
  };

  const handleExemptionToggle = (id: string) => {
      const current = formData.exemptions || [];
      if (current.includes(id)) {
          setFormData({ ...formData, exemptions: current.filter(x => x !== id) });
      } else {
          setFormData({ ...formData, exemptions: [...current, id] });
      }
  };

  const handleCustomFeeToggle = (id: string) => {
      const current = formData.activeCustomFees || [];
      if (current.includes(id)) {
          setFormData({ ...formData, activeCustomFees: current.filter(x => x !== id) });
      } else {
          setFormData({ ...formData, activeCustomFees: [...current, id] });
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);
    try {
        const payload = {
            ...formData,
            name: formData.name || formData.houseNo || 'Warga Baru',
            dispensationNote: formData.isDispensation ? formData.dispensationNote : '',
            exemptions: formData.isDispensation ? formData.exemptions : []
        };

        if (editingResident) {
          await updateResident({ ...editingResident, ...payload } as Resident);
          addNotification(`Data Unit ${formData.houseNo} berhasil diperbarui`, "success");
        } else {
          const newRes: Resident = {
            ...payload,
            id: Math.random().toString(36).substr(2, 9),
          } as Resident;
          await addResident(newRes);
          addNotification(`Unit baru ${formData.houseNo} berhasil ditambahkan`, "success");
        }
        setShowFormModal(false);
    } catch (e) {
        addNotification("Terjadi kesalahan saat menyimpan data.", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    return residents.filter(r => {
      const matchesSearch = r.houseNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRT = filterRT === 'Semua RT' || r.rt === filterRT;
      return matchesSearch && matchesRT;
    });
  }, [residents, searchTerm, filterRT]);

  const downloadTemplate = () => {
    const data = [
        { "nomor_rumah": "A-01", "nama_warga": "Bapak Budi", "rt": "RT 01", "rw": "RW 15", "no_hp": "08123456789", "meter_awal": 0, "status": "PEMILIK" },
        { "nomor_rumah": "A-02", "nama_warga": "Ibu Siti", "rt": "RT 01", "rw": "RW 15", "no_hp": "08987654321", "meter_awal": 100, "status": "PENYEWA" }
    ];
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_data_warga.xlsx");
  };

  const normalizeKeys = (row: any) => {
      const newRow: any = {};
      Object.keys(row).forEach(key => {
          const cleanKey = key.toLowerCase().trim().replace(/[\.\s_-]/g, '');
          if (cleanKey.includes('no') && cleanKey.includes('rumah')) newRow.nomor_rumah = row[key];
          else if (cleanKey.includes('nama')) newRow.nama_warga = row[key];
          else if (cleanKey === 'rt') newRow.rt = row[key];
          else if (cleanKey === 'rw') newRow.rw = row[key];
          else if (cleanKey.includes('hp') || cleanKey.includes('telp') || cleanKey.includes('phone')) newRow.no_hp = row[key];
          else if (cleanKey.includes('meter')) newRow.meter_awal = row[key];
          else if (cleanKey === 'status') newRow.status = row[key];
      });
      return newRow;
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
          
          const residentsBatch: Resident[] = [];

          for (const row of jsonData) {
              const norm = normalizeKeys(row);
              if (norm.nomor_rumah) {
                  const statusRaw = norm.status ? String(norm.status).toUpperCase() : 'PEMILIK';
                  const newRes: Resident = {
                      id: Math.random().toString(36).substr(2, 9),
                      houseNo: String(norm.nomor_rumah),
                      name: norm.nama_warga ? String(norm.nama_warga) : String(norm.nomor_rumah),
                      rt: norm.rt || settings.rtList[0],
                      rw: norm.rw || settings.rwList[0],
                      phone: norm.no_hp ? String(norm.no_hp) : '',
                      initialMeter: parseInt(norm.meter_awal) || 0,
                      initialArrears: 0,
                      deposit: 0,
                      status: statusRaw.includes('SEWA') ? 'PENYEWA' : 'PEMILIK',
                      isDispensation: false,
                      exemptions: [],
                      activeCustomFees: []
                  };
                  residentsBatch.push(newRes);
              }
          }

          if (residentsBatch.length > 0) {
              await addResidentsImport(residentsBatch);
          } else {
              addNotification("Tidak ada data valid ditemukan dalam file. Pastikan kolom 'Nomor Rumah' ada.", "warning");
          }
          setShowImportModal(false);
      } catch (error) {
          console.error(error);
          addNotification("Gagal membaca file Excel. Pastikan format benar.", "error");
      } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleNumberChange = (field: keyof Resident, value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const numValue = cleanValue === '' ? 0 : parseInt(cleanValue);
    setFormData({ ...formData, [field]: numValue });
  };

  const getExemptionDetails = (exemptionId: string) => {
      switch(exemptionId) {
          case 'IPL': return { name: 'IPL Dasar', amount: settings.ipl_base };
          case 'KAS_RT': return { name: 'Kas RT', amount: settings.kas_rt_base };
          case 'WATER_ABODEMEN': return { name: 'Abodemen Air', amount: settings.water_abodemen };
          case 'WATER_USAGE': return { name: 'Pemakaian Air', amount: 'Sesuai Meter' };
          default: return { name: exemptionId, amount: 0 };
      }
  };

  if (!isAdmin) {
    return <div>Akses Ditolak</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] space-y-4 pb-0 animate-in fade-in duration-500">
      <div className="shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
            <h1 className="text-3xl font-bold text-[#1e293b]">Data Warga</h1>
            <p className="text-gray-500 text-sm mt-1 uppercase tracking-widest font-black text-[10px]">Master Database Penghuni & Saldo Awal</p>
            </div>
            
            <div className="flex gap-2 mt-4 md:mt-0 flex-wrap">
            <button 
                onClick={() => setShowImportModal(true)}
                className="bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl shadow-sm border border-blue-100 flex items-center hover:bg-blue-100 transition font-black text-[10px] uppercase tracking-widest"
            >
                <Upload className="w-4 h-4 mr-2" /> Impor Excel
            </button>
            <button 
                onClick={handleDeleteAll}
                disabled={residents.length === 0}
                className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl shadow-sm border border-red-100 flex items-center hover:bg-red-100 transition font-black text-[10px] uppercase tracking-widest disabled:opacity-30"
            >
                <Trash className="w-4 h-4 mr-2" /> Hapus Semua
            </button>
            
            <button 
                onClick={handleOpenAdd}
                className="bg-[#0f9675] text-white px-5 py-2.5 rounded-xl shadow-lg shadow-teal-500/20 flex items-center hover:bg-[#0d8265] transition font-black text-[10px] uppercase tracking-widest"
            >
                <UserPlus className="w-4 h-4 mr-2" /> Tambah Warga
            </button>
            </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
            <input 
                type="text" 
                placeholder="Cari nomor rumah atau nama..." 
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:bg-white transition-all text-sm font-bold outline-none border"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
            <div className="w-full md:w-48">
            <select 
                value={filterRT}
                onChange={(e) => setFilterRT(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:bg-white transition-all text-sm font-bold appearance-none outline-none border cursor-pointer"
            >
                <option value="Semua RT">Semua RT</option>
                {settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}
            </select>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="hidden md:flex flex-col h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-[0.15em] border-b border-slate-100 sticky top-0 z-20">
                <tr>
                    <th className="p-5 text-left bg-slate-50">No. Rumah</th>
                    <th className="p-5 text-left bg-slate-50">Kontak (WA)</th>
                    <th className="p-5 text-left bg-slate-50">Meter Awal</th>
                    <th className="p-5 text-center bg-slate-50">Status</th>
                    <th className="p-5 text-center bg-slate-50">Deposit</th>
                    <th className="p-5 text-center bg-slate-50">Dispensasi</th>
                    <th className="p-5 text-center bg-slate-50">Biaya Lain</th>
                    <th className="p-5 text-center bg-slate-50">Aksi</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filtered.map((r, idx) => {
                    const activeExtraFees = settings.extra_fees.filter(f => r.activeCustomFees?.includes(f.id));
                    return (
                    <tr key={r.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-5">
                        <div className="flex flex-col">
                            <span className="font-black text-[#1e293b] text-base">{r.houseNo}</span>
                            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{r.rt} / {r.rw}</span>
                        </div>
                        </td>
                        <td className="p-5">
                            {r.phone ? (
                                <a 
                                    href={`https://wa.me/${r.phone.replace(/^0/, '62').replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 group cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-50 group-hover:text-white transition-all">
                                        <Phone size={14} />
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm group-hover:text-emerald-600 underline decoration-dotted decoration-slate-300">{r.phone}</span>
                                </a>
                            ) : (
                                <span className="text-slate-400 text-xs italic">Tidak ada kontak</span>
                            )}
                        </td>
                        <td className="p-5">
                        <div className="flex items-center gap-2 text-slate-600 font-bold">
                            <Droplets size={14} className="text-blue-400"/>
                            {r.initialMeter} m³
                        </div>
                        </td>
                        <td className="p-5 text-center">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${r.status === 'PEMILIK' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>{r.status || 'PEMILIK'}</span>
                        </td>
                        <td className="p-5 text-center">
                            <span className="text-emerald-600 font-black text-xs bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                Rp {(r.deposit || 0).toLocaleString('id-ID')}
                            </span>
                        </td>
                        <td className="p-5 text-center">
                            {r.isDispensation ? (
                                <button 
                                    onClick={() => setSelectedDispensation(r)}
                                    className="px-3 py-1 bg-purple-100 text-purple-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-purple-200 transition-colors flex items-center justify-center gap-1 mx-auto"
                                    title="Lihat detail dispensasi"
                                >
                                    <Check size={12} strokeWidth={3} /> Aktif
                                </button>
                            ) : (
                                <span className="text-slate-300 font-bold text-xs">-</span>
                            )}
                        </td>
                        <td className="p-5 text-center">
                            {activeExtraFees.length > 0 ? (
                                <button 
                                    onClick={() => setSelectedExtraFeesDetail(r)}
                                    className="flex flex-col items-center mx-auto hover:scale-105 transition-transform"
                                >
                                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-blue-100 flex items-center gap-1">
                                        <Coins size={10} /> {activeExtraFees.length} Item
                                    </span>
                                </button>
                            ) : <span className="text-slate-300 font-black">-</span>}
                        </td>
                        <td className="p-5">
                        <div className="flex justify-center gap-2">
                            <button onClick={() => handleOpenEdit(r)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(r.id, r.name)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        </div>

        <div className="md:hidden h-full overflow-y-auto space-y-4 pb-20">
            {filtered.map((r, idx) => {
                const activeExtraFees = settings.extra_fees.filter(f => r.activeCustomFees?.includes(f.id));
                return (
                    <div key={r.id || idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex flex-col">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit mb-2">{r.houseNo}</span>
                                {r.phone ? (
                                    <a 
                                        href={`https://wa.me/${r.phone.replace(/^0/, '62').replace(/\D/g, '')}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-extrabold text-emerald-600 text-lg leading-tight flex items-center gap-2"
                                    >
                                        <Phone size={18} /> {r.phone}
                                    </a>
                                ) : (
                                    <span className="font-bold text-slate-400 text-sm">Tidak ada kontak</span>
                                )}
                                <p className="text-xs text-slate-400 mt-1">{r.rt} / {r.rw}</p>
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${r.status === 'PEMILIK' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                    {r.status || 'PEMILIK'}
                                </span>
                                {r.isDispensation && (
                                    <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1">
                                        <HeartHandshake size={10} /> Dispensasi
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-slate-50">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Meter Awal</p>
                                <p className="text-sm font-black text-slate-700 flex items-center gap-1">
                                    <Droplets size={12} className="text-blue-400" /> {r.initialMeter} m³
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Deposit</p>
                                <p className="text-sm font-black text-emerald-600 flex items-center gap-1">
                                    <PiggyBank size={12} /> Rp {(r.deposit || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleOpenEdit(r)}
                                className="flex-1 py-3 bg-slate-50 text-blue-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                            >
                                <Edit size={14} /> Ubah
                            </button>
                            <button 
                                onClick={() => handleDelete(r.id, r.name)}
                                className="flex-1 py-3 bg-slate-50 text-red-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                            >
                                <Trash2 size={14} /> Hapus
                            </button>
                        </div>
                    </div>
                );
            })}
            
            {filtered.length === 0 && (
                <div className="text-center p-10 bg-white rounded-3xl border border-dashed border-slate-200">
                    <p className="text-sm font-bold text-slate-400">Tidak ada data warga ditemukan.</p>
                </div>
            )}
        </div>
      </div>

      {selectedDispensation && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={() => setSelectedDispensation(null)}>
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <div className="bg-purple-50 p-6 border-b border-purple-100 flex justify-between items-start">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                              <HeartHandshake size={24} />
                          </div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Detail Dispensasi</h3>
                              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">{selectedDispensation.houseNo} - {selectedDispensation.name}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedDispensation(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Catatan</p>
                          <p className="text-sm font-bold text-slate-700 italic">"{selectedDispensation.dispensationNote || 'Tidak ada catatan'}"</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Biaya yang Digratiskan</p>
                          <div className="space-y-2">
                              {selectedDispensation.exemptions && selectedDispensation.exemptions.length > 0 ? (
                                  selectedDispensation.exemptions.map(exId => {
                                      const details = getExemptionDetails(exId);
                                      return (
                                          <div key={exId} className="flex justify-between items-center text-sm">
                                              <span className="font-bold text-slate-600">{details.name}</span>
                                              <span className="font-black text-purple-600 line-through decoration-purple-600/50">
                                                  {typeof details.amount === 'number' ? `Rp ${details.amount.toLocaleString()}` : details.amount}
                                              </span>
                                          </div>
                                      )
                                  })
                              ) : (
                                  <p className="text-xs text-slate-400">Tidak ada pengecualian biaya spesifik.</p>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {selectedExtraFeesDetail && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={() => setSelectedExtraFeesDetail(null)}>
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <div className="bg-blue-50 p-6 border-b border-blue-100 flex justify-between items-start">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                              <Coins size={24} />
                          </div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800">Detail Biaya Lain</h3>
                              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{selectedExtraFeesDetail.houseNo} - {selectedExtraFeesDetail.name}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedExtraFeesDetail(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Daftar Biaya Aktif</p>
                          <div className="space-y-3">
                              {settings.extra_fees.filter(f => selectedExtraFeesDetail.activeCustomFees?.includes(f.id)).length > 0 ? (
                                  settings.extra_fees.filter(f => selectedExtraFeesDetail.activeCustomFees?.includes(f.id)).map(fee => (
                                      <div key={fee.id} className="flex justify-between items-center text-sm border-b border-dashed border-slate-200 pb-2 last:border-0">
                                          <span className="font-bold text-slate-600">{fee.name}</span>
                                          <span className="font-black text-blue-600">Rp {fee.amount.toLocaleString()}</span>
                                      </div>
                                  ))
                              ) : (
                                  <p className="text-xs text-slate-400">Tidak ada biaya tambahan aktif.</p>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 text-center p-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload size={32} />
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-2">Impor Data Warga</h3>
                <p className="text-xs font-bold text-slate-400 mb-6">
                    Silakan unduh templat Excel di bawah ini, isi data pada kolom yang tersedia, lalu unggah kembali.
                </p>
                <input 
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImport}
                />
                <div className="space-y-3">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <span>{isImporting ? 'Mengimpor...' : 'Pilih File Excel'}</span>
                    </button>
                    <button 
                        onClick={downloadTemplate}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <Download size={14} /> Unduh Templat
                    </button>
                    <button 
                        onClick={() => setShowImportModal(false)}
                        disabled={isImporting}
                        className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600"
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>
      )}

      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-3xl w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
               <div>
                  <h3 className="text-xl font-black text-[#1e293b]">{editingResident ? 'Ubah Data Warga' : 'Registrasi Warga Baru'}</h3>
               </div>
               <button onClick={() => setShowFormModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-all"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto">
                <div className={`p-5 rounded-3xl border transition-all space-y-4 ${formData.isDispensation ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-slate-700">
                            <HeartHandshake size={20} className={formData.isDispensation ? "text-purple-600" : "text-slate-400"} />
                            <div>
                                <p className={`font-black text-sm uppercase tracking-tight ${formData.isDispensation ? "text-purple-700" : "text-slate-500"}`}>Status Dispensasi</p>
                                <p className="text-[10px] text-slate-400">Peringanan/Pembebasan Biaya Rutin</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={!!formData.isDispensation} 
                                onChange={() => setFormData({...formData, isDispensation: !formData.isDispensation})} 
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    {formData.isDispensation && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300 pt-2 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 ml-1">Keterangan Dispensasi</label>
                                <input 
                                    type="text" 
                                    placeholder="Contoh: Janda / Yatim / Tokoh Masyarakat"
                                    value={formData.dispensationNote}
                                    onChange={(e) => setFormData({...formData, dispensationNote: e.target.value})}
                                    className="w-full p-3 bg-white border border-purple-200 rounded-xl font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20"
                                />
                            </div>
                            <div>
                                <p className="block text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 ml-1">Pilih Biaya yang DIGRATISKAN</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${formData.exemptions?.includes('IPL') ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-purple-100 text-slate-500'}`}>
                                        <input type="checkbox" className="hidden" checked={formData.exemptions?.includes('IPL')} onChange={() => handleExemptionToggle('IPL')} />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 ${formData.exemptions?.includes('IPL') ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'}`}>
                                            {formData.exemptions?.includes('IPL') && <Check size={10} />}
                                        </div>
                                        <span className="text-xs font-bold">IPL (Dasar)</span>
                                    </label>
                                    <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${formData.exemptions?.includes('KAS_RT') ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-purple-100 text-slate-500'}`}>
                                        <input type="checkbox" className="hidden" checked={formData.exemptions?.includes('KAS_RT')} onChange={() => handleExemptionToggle('KAS_RT')} />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 ${formData.exemptions?.includes('KAS_RT') ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'}`}>
                                            {formData.exemptions?.includes('KAS_RT') && <Check size={10} />}
                                        </div>
                                        <span className="text-xs font-bold">Kas RT</span>
                                    </label>
                                    <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${formData.exemptions?.includes('WATER_ABODEMEN') ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-purple-100 text-slate-500'}`}>
                                        <input type="checkbox" className="hidden" checked={formData.exemptions?.includes('WATER_ABODEMEN')} onChange={() => handleExemptionToggle('WATER_ABODEMEN')} />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 ${formData.exemptions?.includes('WATER_ABODEMEN') ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'}`}>
                                            {formData.exemptions?.includes('WATER_ABODEMEN') && <Check size={10} />}
                                        </div>
                                        <span className="text-xs font-bold">Abodemen Air</span>
                                    </label>
                                    <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${formData.exemptions?.includes('WATER_USAGE') ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-purple-100 text-slate-500'}`}>
                                        <input type="checkbox" className="hidden" checked={formData.exemptions?.includes('WATER_USAGE')} onChange={() => handleExemptionToggle('WATER_USAGE')} />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center mr-2 ${formData.exemptions?.includes('WATER_USAGE') ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'}`}>
                                            {formData.exemptions?.includes('WATER_USAGE') && <Check size={10} />}
                                        </div>
                                        <span className="text-xs font-bold">Biaya Pemakaian Air</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Rumah / Unit</label>
                        <input 
                          required
                          type="text" 
                          value={formData.houseNo}
                          onChange={(e) => setFormData({...formData, houseNo: e.target.value})}
                          placeholder="Contoh: A-12"
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-teal-500 transition-all"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Wilayah RT</label>
                        <select 
                          value={formData.rt}
                          onChange={(e) => setFormData({...formData, rt: e.target.value})}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-teal-500 transition-all"
                        >
                          {settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Wilayah RW</label>
                        <select 
                          value={formData.rw}
                          onChange={(e) => setFormData({...formData, rw: e.target.value})}
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-teal-500 transition-all"
                        >
                          {settings.rwList.map(rw => <option key={rw} value={rw}>{rw}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Meter Air Awal</label>
                        <input 
                          type="number" 
                          value={formData.initialMeter}
                          onChange={(e) => handleNumberChange('initialMeter', e.target.value)}
                          placeholder="0"
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-teal-500 transition-all"
                        />
                        <p className="text-[9px] text-slate-400 ml-1 italic">*Digunakan untuk perhitungan pemakaian bulan pertama</p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nomor WhatsApp</label>
                        <input 
                          required
                          type="text" 
                          value={formData.phone}
                          onChange={(e) => handleNumberChange('phone', e.target.value)}
                          placeholder="08..."
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:bg-white focus:border-teal-500 transition-all"
                        />
                    </div>

                    {/* Deposit Field */}
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deposit (Lebih Bayar)</label>
                        <div className="relative">
                            <input 
                              type="number" 
                              value={formData.deposit}
                              onChange={(e) => handleNumberChange('deposit', e.target.value)}
                              placeholder="0"
                              className="w-full pl-10 pr-4 py-4 bg-emerald-50 border border-emerald-100 rounded-2xl font-black text-emerald-700 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                <PiggyBank size={16} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <div className="flex items-center space-x-2 text-slate-700">
                        <List size={20} className="text-blue-500" />
                        <div>
                            <p className="font-black text-sm uppercase tracking-tight text-slate-700">Biaya Tambahan / Lain-lain</p>
                            <p className="text-[10px] text-slate-400">Centang biaya yang <strong>DITERAPKAN</strong> ke warga ini</p>
                        </div>
                    </div>
                    
                    {settings.extra_fees.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {settings.extra_fees.map(fee => (
                                <label key={fee.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${formData.activeCustomFees?.includes(fee.id) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-center">
                                        <input type="checkbox" className="hidden" checked={formData.activeCustomFees?.includes(fee.id)} onChange={() => handleCustomFeeToggle(fee.id)} />
                                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center mr-3 transition-colors ${formData.activeCustomFees?.includes(fee.id) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-slate-50'}`}>
                                            {formData.activeCustomFees?.includes(fee.id) && <Check size={12} />}
                                        </div>
                                        <span className={`text-xs font-bold ${formData.activeCustomFees?.includes(fee.id) ? 'text-blue-700' : 'text-slate-600'}`}>{fee.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-700">Rp {fee.amount.toLocaleString()}</span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Belum ada biaya tambahan diatur di Pengaturan.</p>
                    )}
                </div>

                <div className="pt-2 flex gap-3">
                   <button 
                     type="submit" 
                     disabled={isSubmitting}
                     className="flex-1 bg-teal-500 hover:bg-teal-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                   >
                     {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                     <span>Simpan Data</span>
                   </button>
                   <button 
                     type="button" 
                     onClick={() => setShowFormModal(false)}
                     className="flex-1 bg-slate-100 text-slate-500 hover:bg-slate-200 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                   >
                     Batal
                   </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Residents;
