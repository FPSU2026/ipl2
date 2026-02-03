
import React, { useState, useRef, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Upload, 
  Download, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Key, 
  FileText, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Filter,
  Phone
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Resident, UserRole } from '../types';
import * as XLSX from 'xlsx';

const Residents: React.FC = () => {
  const { residents, addResident, updateResident, deleteResident, addResidentsImport, settings, addNotification, currentUser } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRT, setFilterRT] = useState('ALL');
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  // Form State
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [formData, setFormData] = useState<Partial<Resident>>({
    houseNo: '',
    name: '',
    rt: settings.rtList[0] || 'RT 01',
    rw: settings.rwList[0] || 'RW 15',
    phone: '',
    status: 'PEMILIK',
    initialMeter: 0,
    initialArrears: 0,
    isDispensation: false,
    dispensationNote: '',
    activeCustomFees: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isOperator = currentUser?.role === UserRole.OPERATOR;
  const canEdit = isAdmin || isOperator;

  // Reset form when modal opens/closes
  const handleOpenAdd = () => {
    setEditingResident(null);
    setFormData({
        houseNo: '',
        name: '',
        rt: settings.rtList[0] || 'RT 01',
        rw: settings.rwList[0] || 'RW 15',
        phone: '',
        status: 'PEMILIK',
        initialMeter: 0,
        initialArrears: 0,
        isDispensation: false,
        dispensationNote: '',
        activeCustomFees: []
    });
    setShowModal(true);
  };

  const handleOpenEdit = (resident: Resident) => {
    setEditingResident(resident);
    setFormData({
        houseNo: resident.houseNo,
        name: resident.name,
        rt: resident.rt,
        rw: resident.rw,
        phone: resident.phone,
        status: resident.status,
        initialMeter: resident.initialMeter,
        initialArrears: resident.initialArrears,
        isDispensation: resident.isDispensation,
        dispensationNote: resident.dispensationNote,
        activeCustomFees: resident.activeCustomFees
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        if (editingResident) {
            await updateResident({ ...editingResident, ...formData } as Resident);
        } else {
            const newId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            await addResident({ id: newId, ...formData } as Resident);
        }
        setShowModal(false);
    } catch (error) {
        // Error handling is done in context
    }
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("Apakah Anda yakin ingin menghapus data warga ini? Data tagihan dan riwayat terkait mungkin akan terpengaruh.")) {
          await deleteResident(id);
      }
  };

  const handleResetPassword = async (resident: Resident) => {
      if (window.confirm(`Reset password untuk ${resident.name} (Unit ${resident.houseNo})? Password akan kembali ke default (No HP).`)) {
          // Logic handled in backend usually, or just update resident password field
          const defaultPass = resident.phone.replace(/\D/g, '');
          await updateResident({ ...resident, password: defaultPass });
          addNotification("Password berhasil direset ke No HP.", "success");
      }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      setImportProgress(0);
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
        
        const newResidents: Resident[] = [];
        let processed = 0;
        const total = jsonData.length;

        for (const row of jsonData) {
            if (row.NO_RUMAH && row.NAMA) {
                // Check if exists
                const exists = residents.some(r => r.houseNo.toLowerCase() === String(row.NO_RUMAH).toLowerCase());
                if (!exists) {
                    newResidents.push({
                        id: `res-imp-${Date.now()}-${processed}`,
                        houseNo: String(row.NO_RUMAH),
                        name: row.NAMA,
                        rt: row.RT || settings.rtList[0],
                        rw: row.RW || settings.rwList[0],
                        phone: row.HP ? String(row.HP) : '',
                        status: row.STATUS || 'PEMILIK',
                        initialMeter: Number(row.METER_AWAL) || 0,
                        initialArrears: Number(row.TUNGGAKAN_AWAL) || 0,
                        isDispensation: false,
                        activeCustomFees: []
                    });
                }
            }
            processed++;
            setImportProgress(Math.round((processed / total) * 100));
        }

        if (newResidents.length > 0) {
            await addResidentsImport(newResidents);
        } else {
            addNotification("Tidak ada data baru yang valid atau semua data sudah ada.", "info");
        }
        setShowImportModal(false);
      } catch (error) {
        addNotification("Gagal membaca file Excel.", "error");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const data = [
        { "NO_RUMAH": "A-01", "NAMA": "Budi Santoso", "RT": "RT 01", "RW": "RW 15", "HP": "08123456789", "STATUS": "PEMILIK", "METER_AWAL": 100, "TUNGGAKAN_AWAL": 0 },
        { "NO_RUMAH": "B-02", "NAMA": "Siti Aminah", "RT": "RT 02", "RW": "RW 15", "HP": "08129876543", "STATUS": "PENYEWA", "METER_AWAL": 50, "TUNGGAKAN_AWAL": 150000 }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Warga");
    XLSX.writeFile(wb, "template_data_warga.xlsx");
  };

  const filteredResidents = residents.filter(r => {
      if (filterRT !== 'ALL' && r.rt !== filterRT) return false;
      const term = searchTerm.toLowerCase();
      return r.name.toLowerCase().includes(term) || r.houseNo.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-4 pb-0 animate-in fade-in duration-500 flex flex-col h-[calc(100vh-140px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Data Warga</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manajemen Penghuni & Unit Rumah</p>
        </div>
        
        {canEdit && (
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                >
                    <Upload size={14} /> Import
                </button>
                <button 
                    onClick={handleOpenAdd}
                    className="px-4 py-3 bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-slate-500/20"
                >
                    <Plus size={14} /> Tambah Warga
                </button>
            </div>
        )}
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 shrink-0">
             <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                      type="text" 
                      placeholder="Cari Nama / No Rumah..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                   />
                </div>
                <div className="relative w-full sm:w-40">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select 
                        value={filterRT}
                        onChange={(e) => setFilterRT(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-200 cursor-pointer appearance-none"
                    >
                        <option value="ALL">Semua RT</option>
                        {settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                    </select>
                </div>
             </div>
             
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                 Total: {filteredResidents.length} Unit
             </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto relative">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-6 py-4 bg-slate-50">Unit / Rumah</th>
                          <th className="px-6 py-4 bg-slate-50">Nama Penghuni</th>
                          <th className="px-6 py-4 bg-slate-50">RT / RW</th>
                          <th className="px-6 py-4 bg-slate-50">Kontak</th>
                          <th className="px-6 py-4 bg-slate-50 text-center">Status</th>
                          {canEdit && <th className="px-6 py-4 bg-slate-50 text-center">Aksi</th>}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredResidents.length > 0 ? filteredResidents.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-black text-xs group-hover:bg-white group-hover:shadow-sm transition-all border border-slate-200">
                                          {r.houseNo}
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-slate-700">{r.name}</p>
                                  {r.isDispensation && <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">DISPENSASI</span>}
                              </td>
                              <td className="px-6 py-4">
                                  <span className="text-xs font-medium text-slate-500">{r.rt} / {r.rw}</span>
                              </td>
                              <td className="px-6 py-4">
                                  {r.phone ? (
                                      <a href={`https://wa.me/${r.phone.replace(/\D/g,'').replace(/^0/,'62')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline">
                                          <Phone size={12} /> {r.phone}
                                      </a>
                                  ) : <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === 'PEMILIK' ? 'bg-blue-50 text-blue-600' : r.status === 'PENYEWA' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                                      {r.status}
                                  </span>
                              </td>
                              {canEdit && (
                                  <td className="px-6 py-4">
                                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => handleOpenEdit(r)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Edit"><Edit size={14}/></button>
                                          <button onClick={() => handleResetPassword(r)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100" title="Reset Password"><Key size={14}/></button>
                                          <button onClick={() => handleDelete(r.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100" title="Hapus"><Trash2 size={14}/></button>
                                      </div>
                                  </td>
                              )}
                          </tr>
                      )) : (
                          <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic text-xs">Data tidak ditemukan</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                      <div>
                          <h3 className="font-black text-lg text-slate-800">{editingResident ? 'Edit Warga' : 'Tambah Warga'}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{settings.location_name}</p>
                      </div>
                      <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X size={20}/></button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">No. Rumah / Unit</label>
                              <input required type="text" value={formData.houseNo} onChange={e => setFormData({...formData, houseNo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-400" />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nama Lengkap</label>
                              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-400" />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">RT</label>
                              <select value={formData.rt} onChange={e => setFormData({...formData, rt: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                                  {settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">RW</label>
                              <select value={formData.rw} onChange={e => setFormData({...formData, rw: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                                  {settings.rwList.map(rw => <option key={rw} value={rw}>{rw}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">No. HP (WhatsApp)</label>
                              <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-400" placeholder="08..." />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Status Penghuni</label>
                              <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none cursor-pointer">
                                  <option value="PEMILIK">PEMILIK</option>
                                  <option value="PENYEWA">PENYEWA</option>
                                  <option value="NONAKTIF">NONAKTIF / KOSONG</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Meter Awal Air</label>
                              <input type="number" value={formData.initialMeter} onChange={e => setFormData({...formData, initialMeter: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-400" />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Saldo Tunggakan Awal</label>
                              <input type="number" value={formData.initialArrears} onChange={e => setFormData({...formData, initialArrears: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-400" />
                          </div>
                      </div>

                      {/* Biaya Tambahan Section */}
                      <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-xs font-black text-slate-600 mb-3 uppercase tracking-widest">Biaya Tambahan (Opsional)</p>
                          <div className="grid grid-cols-2 gap-3">
                              {settings.extra_fees.map(fee => (
                                  <label key={fee.id} className="flex items-center gap-2 cursor-pointer">
                                      <input 
                                          type="checkbox" 
                                          checked={formData.activeCustomFees?.includes(fee.id)}
                                          onChange={(e) => {
                                              const current = formData.activeCustomFees || [];
                                              if (e.target.checked) setFormData({...formData, activeCustomFees: [...current, fee.id]});
                                              else setFormData({...formData, activeCustomFees: current.filter(id => id !== fee.id)});
                                          }}
                                          className="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
                                      />
                                      <span className="text-xs font-bold text-slate-700">{fee.name} (+{fee.amount.toLocaleString()})</span>
                                  </label>
                              ))}
                              {settings.extra_fees.length === 0 && <span className="text-xs text-slate-400 italic">Tidak ada biaya tambahan di pengaturan.</span>}
                          </div>
                      </div>

                      {/* Dispensasi Toggle */}
                      <div className="flex items-center gap-3 mb-4">
                          <input 
                              type="checkbox" 
                              checked={formData.isDispensation} 
                              onChange={e => setFormData({...formData, isDispensation: e.target.checked})} 
                              id="dispensation"
                              className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500"
                          />
                          <label htmlFor="dispensation" className="text-xs font-bold text-slate-700 cursor-pointer">Aktifkan Status Dispensasi (Gratis Iuran)</label>
                      </div>
                      
                      {formData.isDispensation && (
                          <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                              <textarea 
                                  placeholder="Catatan dispensasi (opsional)" 
                                  value={formData.dispensationNote} 
                                  onChange={e => setFormData({...formData, dispensationNote: e.target.value})} 
                                  className="w-full p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs font-medium text-amber-800 outline-none"
                              />
                          </div>
                      )}

                      <button type="submit" className="w-full py-4 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 active:scale-95 transition-all">Simpan Data</button>
                  </form>
              </div>
          </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 text-center p-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <FileText size={32} />
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-2">Impor Data Warga</h3>
                <p className="text-xs font-bold text-slate-400 mb-6">
                    Silakan unduh templat Excel di bawah ini, isi data pada kolom yang tersedia (termasuk <strong>METER_AWAL</strong> untuk saldo Januari), lalu unggah kembali.
                </p>
                
                <input 
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImport}
                />
                
                {/* PROGRESS BAR */}
                {isImporting && (
                    <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
                        <div 
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out flex items-center justify-center" 
                            style={{ width: `${importProgress}%` }}
                        >
                        </div>
                        <p className="text-[10px] font-black text-blue-600 mt-1 text-center">{importProgress}% Selesai</p>
                    </div>
                )}

                <div className="space-y-3">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 hover:bg-slate-900 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <span>{isImporting ? 'Memproses...' : 'Pilih File Excel'}</span>
                    </button>
                    <button 
                        onClick={downloadTemplate}
                        disabled={isImporting}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Download size={14} /> Download Template
                    </button>
                    <button 
                        onClick={() => setShowImportModal(false)}
                        disabled={isImporting}
                        className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 disabled:opacity-50"
                    >
                        Batal
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Residents;
