
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Complaint, UserRole } from '../types';
import { 
  MessageSquareWarning, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  ChevronRight, 
  AlertTriangle,
  User,
  Plus,
  X,
  Loader2,
  Info
} from 'lucide-react';

const Complaints: React.FC = () => {
  const { complaints, addComplaint, updateComplaint, deleteComplaint, residents, currentUser, addNotification } = useApp();
  const [activeTab, setActiveTab] = useState<'LIST' | 'FORM'>('LIST');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PROCESSED' | 'DONE'>('ALL');
  
  // Form State
  const [newComplaint, setNewComplaint] = useState({ title: '', category: 'KELUHAN', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Response Modal State
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [adminStatus, setAdminStatus] = useState<'PENDING' | 'PROCESSED' | 'DONE'>('PENDING');

  const isResident = currentUser?.role === UserRole.RESIDENT;

  // Filter Logic
  const filteredComplaints = complaints.filter(c => {
      // Filter by Resident (Own Complaints)
      if (isResident && c.resident_id !== currentUser?.residentId) return false;
      
      // Filter by Status
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      
      return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isResident || !currentUser?.residentId) return;
      if (!newComplaint.title || !newComplaint.description) {
          addNotification("Mohon lengkapi judul dan deskripsi", "warning");
          return;
      }

      setIsSubmitting(true);
      try {
          const payload: Complaint = {
              id: `comp-${Date.now()}-${Math.random()}`,
              resident_id: currentUser.residentId,
              title: newComplaint.title,
              description: newComplaint.description,
              category: newComplaint.category as any,
              status: 'PENDING',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
          };
          await addComplaint(payload);
          setNewComplaint({ title: '', category: 'KELUHAN', description: '' });
          setActiveTab('LIST');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleAdminUpdate = async () => {
      if (!selectedComplaint) return;
      
      try {
          const updated: Complaint = {
              ...selectedComplaint,
              status: adminStatus,
              admin_response: adminResponseText,
              updated_at: new Date().toISOString()
          };
          await updateComplaint(updated);
          setSelectedComplaint(null);
      } catch(e) {
          addNotification("Gagal update aduan", "error");
      }
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("Hapus aduan ini?")) {
          await deleteComplaint(id);
      }
  };

  const openAdminModal = (c: Complaint) => {
      setSelectedComplaint(c);
      setAdminResponseText(c.admin_response || '');
      setAdminStatus(c.status);
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'PENDING': return <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> Menunggu</span>;
          case 'PROCESSED': return <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Proses</span>;
          case 'DONE': return <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={10} /> Selesai</span>;
          default: return null;
      }
  };

  const getCategoryIcon = (cat: string) => {
      switch(cat) {
          case 'KELUHAN': return <AlertTriangle size={16} className="text-rose-500" />;
          case 'MASUKAN': return <MessageSquareWarning size={16} className="text-blue-500" />;
          default: return <Info size={16} className="text-slate-500" />;
      }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Layanan Aduan</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                    {isResident ? 'Sampaikan Keluhan & Masukan' : 'Manajemen Laporan Warga'}
                </p>
            </div>
            
            {isResident && (
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button onClick={() => setActiveTab('LIST')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'LIST' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Riwayat</button>
                    <button onClick={() => setActiveTab('FORM')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'FORM' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Buat Aduan</button>
                </div>
            )}
        </div>

        {/* Resident Form View */}
        {isResident && activeTab === 'FORM' && (
            <div className="card p-6 md:p-8 max-w-2xl mx-auto border border-slate-100 shadow-lg">
                <h3 className="font-black text-lg text-slate-800 mb-6">Formulir Aduan Baru</h3>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kategori</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setNewComplaint({...newComplaint, category: 'KELUHAN'})} className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${newComplaint.category === 'KELUHAN' ? 'bg-rose-50 border-rose-200 text-rose-600 ring-2 ring-rose-500/20' : 'bg-white border-slate-200 text-slate-400'}`}>
                                <AlertTriangle size={16} /> <span className="text-xs font-bold">Keluhan</span>
                            </button>
                            <button type="button" onClick={() => setNewComplaint({...newComplaint, category: 'MASUKAN'})} className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${newComplaint.category === 'MASUKAN' ? 'bg-blue-50 border-blue-200 text-blue-600 ring-2 ring-blue-500/20' : 'bg-white border-slate-200 text-slate-400'}`}>
                                <MessageSquareWarning size={16} /> <span className="text-xs font-bold">Masukan</span>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Judul Laporan</label>
                        <input 
                            type="text" 
                            required 
                            placeholder="Contoh: Lampu Jalan Mati" 
                            value={newComplaint.title} 
                            onChange={e => setNewComplaint({...newComplaint, title: e.target.value})} 
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Detail Deskripsi</label>
                        <textarea 
                            required 
                            rows={5} 
                            placeholder="Jelaskan detail permasalahan..." 
                            value={newComplaint.description} 
                            onChange={e => setNewComplaint({...newComplaint, description: e.target.value})} 
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all resize-none text-sm"
                        />
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        <span>Kirim Laporan</span>
                    </button>
                </form>
            </div>
        )}

        {/* List View */}
        {(activeTab === 'LIST' || !isResident) && (
            <div className="space-y-4">
                {/* Filter Bar */}
                <div className="flex overflow-x-auto pb-2 gap-2">
                    {['ALL', 'PENDING', 'PROCESSED', 'DONE'].map(status => (
                        <button 
                            key={status} 
                            onClick={() => setStatusFilter(status as any)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border whitespace-nowrap transition-all ${statusFilter === status ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                        >
                            {status === 'ALL' ? 'Semua' : status === 'PENDING' ? 'Menunggu' : status === 'PROCESSED' ? 'Diproses' : 'Selesai'}
                        </button>
                    ))}
                </div>

                {filteredComplaints.length === 0 ? (
                    <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-200">
                        <MessageSquareWarning size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-sm font-bold text-slate-400">Belum ada data aduan.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredComplaints.map(c => {
                            const resident = residents.find(r => r.id === c.resident_id);
                            return (
                                <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${c.status === 'DONE' ? 'bg-emerald-500' : c.status === 'PROCESSED' ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                                    
                                    <div className="flex justify-between items-start mb-3 pl-3">
                                        <div className="flex items-center gap-2">
                                            {getCategoryIcon(c.category)}
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.category}</span>
                                        </div>
                                        {getStatusBadge(c.status)}
                                    </div>

                                    <div className="pl-3 mb-4">
                                        <h4 className="font-bold text-slate-800 text-lg leading-tight mb-1">{c.title}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{c.description}</p>
                                    </div>

                                    <div className="pl-3 pt-3 border-t border-slate-50 flex justify-between items-end">
                                        <div>
                                            {!isResident && (
                                                <div className="flex items-center gap-1 mb-1">
                                                    <User size={12} className="text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-600">{resident?.houseNo}</span>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-slate-400">{new Date(c.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        
                                        {!isResident ? (
                                            <button onClick={() => openAdminModal(c)} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors">
                                                Respon
                                            </button>
                                        ) : (
                                            <button onClick={() => handleDelete(c.id)} className="text-rose-400 hover:text-rose-600 transition-colors p-1">
                                                <XCircle size={18} />
                                            </button>
                                        )}
                                    </div>

                                    {c.admin_response && (
                                        <div className="mt-4 mx-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tanggapan Admin</p>
                                            <p className="text-xs text-slate-700 font-medium italic">"{c.admin_response}"</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        {/* Admin Response Modal */}
        {!isResident && selectedComplaint && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-black text-slate-800">Tindak Lanjut Aduan</h3>
                        <button onClick={() => setSelectedComplaint(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{selectedComplaint.category}</p>
                            <p className="font-bold text-slate-800">{selectedComplaint.title}</p>
                            <p className="text-xs text-slate-600 mt-2">{selectedComplaint.description}</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Update Status</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button onClick={() => setAdminStatus('PENDING')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${adminStatus === 'PENDING' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400'}`}>Pending</button>
                                <button onClick={() => setAdminStatus('PROCESSED')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${adminStatus === 'PROCESSED' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Proses</button>
                                <button onClick={() => setAdminStatus('DONE')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${adminStatus === 'DONE' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>Selesai</button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tanggapan / Catatan Admin</label>
                            <textarea 
                                rows={4}
                                value={adminResponseText}
                                onChange={e => setAdminResponseText(e.target.value)}
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium text-sm text-slate-700 outline-none focus:border-slate-400"
                                placeholder="Tulis tanggapan untuk warga..."
                            />
                        </div>

                        <button onClick={handleAdminUpdate} className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-slate-900 transition-all">
                            Simpan Perubahan
                        </button>
                        
                        <div className="text-center">
                            <button onClick={() => { handleDelete(selectedComplaint.id); setSelectedComplaint(null); }} className="text-xs font-bold text-rose-500 hover:underline">
                                Hapus Aduan Ini
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Complaints;
