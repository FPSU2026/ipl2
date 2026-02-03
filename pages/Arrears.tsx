
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
    AlertCircle, 
    Search, 
    MessageCircle, 
    Calendar, 
    Check, 
    X, 
    Plus, 
    Upload, 
    FileText, 
    Save, 
    Building, 
    Eye, 
    Wallet, 
    Banknote, 
    CreditCard, 
    Send, 
    Printer, 
    Share2, 
    ChevronRight, 
    Layers, 
    Download, 
    Loader2, 
    Trash2, 
    Edit, 
    AlertOctagon, 
    Users, 
    Filter,
    MessageSquare,
    ChevronDown,
    CheckCircle2
} from 'lucide-react';
import { MONTHS, DEFAULT_SETTINGS } from '../constants';
import { Bill, UserRole, Transaction } from '../types';
import * as XLSX from 'xlsx';

const Arrears: React.FC = () => {
  const { residents, bills, addBill, updateBill, addNotification, settings, currentUser, payBill, bankAccounts, addTransaction, deleteBill } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentYear = new Date().getFullYear();
  const startYear = 2023;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);
  
  const [selectedYear, setSelectedYear] = useState<number>(-1); 
  const [filterRT, setFilterRT] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('UNPAID');
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResidentDetail, setSelectedResidentDetail] = useState<{id: string, name: string, houseNo: string, phone: string, items: Bill[]} | null>(null);
  
  // Arrears Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isResident = currentUser?.role === UserRole.RESIDENT;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { 
        setShowDetailModal(false); 
        setShowPaymentModal(false); 
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const calculateTotalArrears = (residentId: string) => {
    let unpaidBills = bills.filter(b => b.residentId === residentId && b.status === 'UNPAID');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYearNum = now.getFullYear();
    unpaidBills = unpaidBills.filter(b => {
        if (b.period_year > currentYearNum) return false;
        if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false;
        return true;
    });
    if (selectedYear !== -1) unpaidBills = unpaidBills.filter(b => b.period_year === selectedYear);
    return unpaidBills.reduce((bSum, b) => bSum + (b.total - (b.paid_amount || 0)), 0);
  };

  const filteredResidents = useMemo(() => {
    return residents.filter(r => {
        if (isResident && r.id !== currentUser?.residentId) return false;
        if (filterRT !== 'ALL' && r.rt !== filterRT) return false;
        const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.houseNo.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        
        const totalArrears = calculateTotalArrears(r.id);
        
        // Status Filter Logic
        if (statusFilter === 'UNPAID') return totalArrears > 0;
        if (statusFilter === 'PAID') return totalArrears === 0;
        return true; // ALL
    });
  }, [residents, isResident, currentUser, filterRT, searchTerm, bills, selectedYear, statusFilter]);

  const totalArrearsFiltered = useMemo(() => {
      return filteredResidents.reduce((acc, r) => acc + calculateTotalArrears(r.id), 0);
  }, [filteredResidents, bills, selectedYear]);

  const getArrearsDescription = (residentId: string) => {
      let unpaidBills = bills.filter(b => b.residentId === residentId && b.status === 'UNPAID');
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearNum = now.getFullYear();
      unpaidBills = unpaidBills.filter(b => {
          if (b.period_year > currentYearNum) return false;
          if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false;
          return true;
      });
      if (selectedYear !== -1) unpaidBills = unpaidBills.filter(b => b.period_year === selectedYear);
      if (unpaidBills.length === 0) return 'LUNAS / TIDAK ADA TUNGGAKAN';
      const billsByYear: Record<number, number[]> = {};
      unpaidBills.forEach(b => {
          if (!billsByYear[b.period_year]) billsByYear[b.period_year] = [];
          billsByYear[b.period_year].push(b.period_month);
      });
      const sortedYears = Object.keys(billsByYear).map(Number).sort((a,b) => a - b);
      return sortedYears.map(year => year === 2023 ? "2023" : `${billsByYear[year].sort((a,b)=>a-b).map(m=>MONTHS[m-1].substring(0,3)).join(',')}/${year}`).join('; ');
  };

  const handleDeleteAllArrears = async (residentId: string) => {
      if (window.confirm("Apakah Anda yakin ingin menghapus SEMUA tagihan belum lunas untuk warga ini? Tindakan ini tidak dapat dibatalkan.")) {
          const unpaid = bills.filter(b => b.residentId === residentId && b.status === 'UNPAID');
          for (const bill of unpaid) {
              await deleteBill(bill.id);
          }
          addNotification("Semua tunggakan warga telah dihapus.", "success");
      }
  };

  const sendWhatsAppReminder = (resident: {id: string, name: string, houseNo: string, phone: string}, total: number) => {
      const template = settings.whatsappTemplates.arrearsMessage || "Halo {NAMA}, anda memiliki tunggakan sebesar Rp {TOTAL}.";
      const message = template
          .replace(/{NAMA}/g, resident.name)
          .replace(/{RUMAH}/g, resident.houseNo)
          .replace(/{TOTAL}/g, total.toLocaleString('id-ID'))
          .replace(/{RINCIAN}/g, getArrearsDescription(resident.id));
      
      const phone = resident.phone.replace(/\D/g,'').replace(/^0/,'62');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedBill) return;
      setIsSubmitting(true);
      try {
          await payBill(
            selectedBill.id, 
            parseInt(paymentAmount), 
            paymentMethod, 
            selectedBankId, 
            undefined, 
            undefined, 
            false, 
            paymentDate, 
            'PENERIMAAN TUNGGAKAN'
          );
          setShowPaymentModal(false);
          if (selectedResidentDetail) {
              const updatedItems = selectedResidentDetail.items.filter(i => i.id !== selectedBill.id);
              if (updatedItems.length === 0) setShowDetailModal(false);
              else setSelectedResidentDetail({...selectedResidentDetail, items: updatedItems});
          }
      } catch (err) {
          addNotification("Gagal memproses pembayaran.", "error");
      } finally {
          setIsSubmitting(false);
      }
  };

  return (
    <div className="space-y-4 pb-0 animate-in fade-in duration-500 h-full flex flex-col">
      <style>{`
        @keyframes text-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }
        .animate-blink {
            animation: text-blink 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Data Tunggakan</h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Monitoring Pembayaran Tertunggak</p>
        </div>
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="p-3 border-b border-slate-100 flex flex-col xl:flex-row gap-3 justify-between items-center bg-slate-50/30 shrink-0">
            <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                <div className="relative w-full sm:w-48">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder="Cari unit..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" />
                </div>
                {!isResident && (
                    <div className="relative w-32">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                        <select value={filterRT} onChange={(e) => setFilterRT(e.target.value)} className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black appearance-none cursor-pointer">
                            <option value="ALL">Semua RT</option>
                            {settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                        </select>
                    </div>
                )}
                
                {/* Year and Status Filter Grouped */}
                <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                        <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="pl-8 pr-2 py-1.5 bg-transparent text-[10px] font-black appearance-none cursor-pointer outline-none">
                            <option value={-1}>Semua Tahun</option>
                            {years.map(y => (<option key={y} value={y}>{y}</option>))}
                        </select>
                    </div>
                    <div className="w-[1px] h-4 bg-slate-100 self-center mx-1"></div>
                    <div className="relative">
                        <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value as any)} 
                            className="pl-8 pr-2 py-1.5 bg-transparent text-[10px] font-black appearance-none cursor-pointer outline-none"
                        >
                            <option value="UNPAID">Belum Lunas</option>
                            <option value="PAID">Lunas</option>
                            <option value="ALL">Semua</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-black px-6 py-3.5 rounded-2xl border-2 border-slate-800 flex flex-col justify-center items-end min-w-[200px] shadow-2xl ml-auto xl:mt-0 mt-2">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1.5">TOTAL TUNGGAKAN</p>
                <p className="text-xl font-black text-white leading-none animate-blink">Rp {totalArrearsFiltered.toLocaleString('id-ID')}</p>
            </div>
          </div>

          <div className="overflow-auto flex-1 relative sticky-header">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                          <th className="px-5 py-3.5">Unit</th>
                          <th className="px-5 py-3.5">Periode</th>
                          <th className="px-5 py-3.5 text-right">Total</th>
                          <th className="px-5 py-3.5 text-center">Aksi</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredResidents.length > 0 ? (
                          filteredResidents.map(r => { 
                              const total = calculateTotalArrears(r.id); 
                              return (
                                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-5 py-3.5 font-black text-slate-800 text-xs uppercase">{r.houseNo}</td>
                                    <td className={`px-5 py-3.5 text-[10px] font-bold ${total === 0 ? 'text-emerald-500' : 'text-slate-500'}`}>{getArrearsDescription(r.id)}</td>
                                    <td className={`px-5 py-3.5 text-right font-black text-xs ${total === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {total.toLocaleString()}</td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center justify-center gap-1">
                                            <button 
                                                onClick={() => { const items = bills.filter(b => b.residentId === r.id && b.status === 'UNPAID'); setSelectedResidentDetail({ id: r.id, name: r.name, houseNo: r.houseNo, phone: r.phone, items }); setShowDetailModal(true); }} 
                                                className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 transition-all"
                                                title="Lihat Rincian"
                                            >
                                                <Eye size={14}/>
                                            </button>
                                            {!isResident && (
                                                <>
                                                    <button 
                                                        onClick={() => { const items = bills.filter(b => b.residentId === r.id && b.status === 'UNPAID'); setSelectedResidentDetail({ id: r.id, name: r.name, houseNo: r.houseNo, phone: r.phone, items }); setShowDetailModal(true); }}
                                                        className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"
                                                        title="Edit (Buka Rincian)"
                                                    >
                                                        <Edit size={14}/>
                                                    </button>
                                                    {total > 0 && (
                                                        <>
                                                            <button 
                                                                onClick={() => sendWhatsAppReminder({id: r.id, name: r.name, houseNo: r.houseNo, phone: r.phone}, total)}
                                                                className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"
                                                                title="Kirim WhatsApp"
                                                            >
                                                                <MessageSquare size={14}/>
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    const unpaidBills = bills.filter(b => b.residentId === r.id && b.status === 'UNPAID').sort((a,b) => a.period_year !== b.period_year ? a.period_year - b.period_year : a.period_month - b.period_month);
                                                                    if (unpaidBills.length > 0) {
                                                                        const oldest = unpaidBills[0];
                                                                        setSelectedBill(oldest);
                                                                        setPaymentAmount(oldest.total.toString());
                                                                        setShowPaymentModal(true);
                                                                    }
                                                                }}
                                                                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md"
                                                                title="Bayar Sekarang"
                                                            >
                                                                <Wallet size={14}/>
                                                            </button>
                                                        </>
                                                    )}
                                                    <button 
                                                        onClick={() => handleDeleteAllArrears(r.id)}
                                                        className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100"
                                                        title="Hapus Semua Tunggakan"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                              ); 
                          })
                      ) : (
                          <tr><td colSpan={4} className="px-6 py-16 text-center text-slate-300 text-xs italic">Data tidak ditemukan</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* DETAIL MODAL */}
      {showDetailModal && selectedResidentDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                      <div>
                          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Detail Tunggakan</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedResidentDetail.houseNo} - {selectedResidentDetail.name}</p>
                      </div>
                      <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all"><X size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
                      {selectedResidentDetail.items.map(bill => (
                          <div key={bill.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all">
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{MONTHS[bill.period_month-1]} {bill.period_year}</p>
                                  <p className="text-sm font-black text-slate-800">Rp {bill.total.toLocaleString()}</p>
                              </div>
                              <div className="flex gap-2">
                                  {!isResident && (
                                      <button 
                                        onClick={() => { if(window.confirm("Hapus tagihan periode ini?")) deleteBill(bill.id); }}
                                        className="p-2 text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                      >
                                          <Trash2 size={16} />
                                      </button>
                                  )}
                                  <button onClick={() => { setSelectedBill(bill); setPaymentAmount(bill.total.toString()); setShowPaymentModal(true); }} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-emerald-600 active:scale-95 transition-all">Bayar</button>
                              </div>
                          </div>
                      ))}
                      {selectedResidentDetail.items.length === 0 && <p className="text-center py-10 text-slate-400 font-bold italic">Semua tagihan sudah lunas.</p>}
                  </div>
              </div>
          </div>
      )}

      {/* PAYMENT MODAL - REFINED COMPACT VERSION */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in zoom-in duration-200">
             {/* Modal Header */}
             <div className="px-6 pt-6 pb-4 flex justify-between items-center bg-white shrink-0">
                <h3 className="font-black text-[#1e293b] text-lg tracking-tight leading-none">
                  Input Pembayaran
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-300 hover:text-slate-500 transition-colors p-1">
                    <X size={20} strokeWidth={3} />
                </button>
             </div>
             
             <form onSubmit={handlePaymentSubmit} className="px-6 pb-6 space-y-4 overflow-y-auto custom-scrollbar">
                {/* TANGGAL */}
                <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">TANGGAL</label>
                    <div className="relative">
                      <input 
                          type="date" 
                          required 
                          value={paymentDate} 
                          onChange={e => setPaymentDate(e.target.value)} 
                          className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all appearance-none" 
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Calendar size={16} />
                      </div>
                    </div>
                </div>

                {/* KETERANGAN */}
                <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">KETERANGAN</label>
                    <input 
                        type="text"
                        readOnly
                        value={`Bayar Tunggakan ${MONTHS[selectedBill.period_month-1]} ${selectedBill.period_year}`}
                        className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs text-slate-500 outline-none cursor-default" 
                    />
                </div>

                {/* KATEGORI */}
                <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">KATEGORI</label>
                    <div className="relative">
                      <select 
                          disabled
                          className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs text-slate-700 outline-none appearance-none cursor-default"
                      >
                          <option>PENERIMAAN TUNGGAKAN</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <ChevronDown size={16} strokeWidth={3} />
                      </div>
                    </div>
                </div>

                {/* JUMLAH (RP) */}
                <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">JUMLAH (RP)</label>
                    <input 
                        type="number" 
                        required 
                        value={paymentAmount} 
                        onChange={(e) => setPaymentAmount(e.target.value)} 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all" 
                        placeholder="0" 
                    />
                </div>

                {/* METODE PEMBAYARAN */}
                <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">METODE PEMBAYARAN</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            type="button" 
                            onClick={() => setPaymentMethod('CASH')} 
                            className={`py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'CASH' ? 'bg-[#1e293b] border-[#1e293b] text-white shadow-lg' : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'}`}
                        >
                            TUNAI
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setPaymentMethod('TRANSFER')} 
                            className={`py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'TRANSFER' ? 'bg-[#1e293b] border-[#1e293b] text-white shadow-lg' : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'}`}
                        >
                            TRANSFER
                        </button>
                    </div>
                </div>

                {/* Bank Selection */}
                {paymentMethod === 'TRANSFER' && (
                    <div className="animate-in slide-in-from-top-1 space-y-1.5">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">REKENING BANK</label>
                        <select 
                            required 
                            value={selectedBankId} 
                            onChange={e => setSelectedBankId(e.target.value)} 
                            className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs text-slate-700 outline-none"
                        >
                            <option value="">-- Pilih Rekening --</option>
                            {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>)}
                        </select>
                    </div>
                )}

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                    <button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="w-full py-4 bg-[#1e293b] hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-3"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                        <span>SIMPAN PEMBAYARAN</span>
                    </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Arrears;
