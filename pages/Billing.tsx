
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Printer, 
  Share2, 
  Wallet, 
  CreditCard, 
  ChevronDown, 
  FilePlus, 
  Loader2, 
  X, 
  Check, 
  AlertCircle, 
  ImageIcon, 
  Eye, 
  Info, 
  Banknote, 
  Building2, 
  Download, 
  RefreshCw, 
  Plus, 
  Minus, 
  Edit, 
  Trash2, 
  MapPin, 
  Calendar, 
  Droplets, 
  User, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Settings, 
  Filter, 
  MessageCircle 
} from 'lucide-react';
import { MONTHS, DEFAULT_SETTINGS } from '../constants';
import { useApp } from '../context/AppContext';
import { Bill, UserRole } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Billing: React.FC = () => {
  const { bills, residents, payBill, updateBill, deleteBill, settings, currentUser, bankAccounts, addNotification, language } = useApp();
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'PARTIAL'>('ALL');
  const [filterRT, setFilterRT] = useState('ALL');
  
  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Edit Bill Modal
  const [showEditBillModal, setShowEditBillModal] = useState(false);
  const [editBillData, setEditBillData] = useState<Partial<Bill>>({});

  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const isResident = currentUser?.role === UserRole.RESIDENT;

  // Filter Logic
  const sortedBills = useMemo(() => {
      return bills.filter(bill => {
          if (isResident && bill.residentId !== currentUser?.residentId) return false;
          if (bill.period_month !== selectedMonth || bill.period_year !== selectedYear) return false;
          
          const resident = residents.find(r => r.id === bill.residentId);
          if (!resident) return false;

          // RT Filter
          if (filterRT !== 'ALL' && resident.rt !== filterRT) return false;

          // Search Filter
          if (searchTerm) {
              const searchLower = searchTerm.toLowerCase();
              if (!resident.name.toLowerCase().includes(searchLower) && !resident.houseNo.toLowerCase().includes(searchLower)) {
                  return false;
              }
          }

          // Strict Logic: Kurang Bayar (paid < total but > 0)
          const isActuallyPaid = bill.status === 'PAID' && (bill.paid_amount || 0) >= bill.total;
          const isPartiallyPaid = (bill.paid_amount || 0) > 0 && (bill.paid_amount || 0) < bill.total;

          if (statusFilter === 'PAID') return isActuallyPaid;
          if (statusFilter === 'UNPAID') return !isActuallyPaid;
          if (statusFilter === 'PARTIAL') return isPartiallyPaid;
          
          return true;
      }).sort((a, b) => {
          const resA = residents.find(r => r.id === a.residentId);
          const resB = residents.find(r => r.id === b.residentId);
          return (resA?.houseNo || '').localeCompare(resB?.houseNo || '', undefined, { numeric: true });
      });
  }, [bills, residents, isResident, currentUser, selectedMonth, selectedYear, searchTerm, statusFilter, filterRT]);

  const getStatusBadge = (bill: Bill) => {
      const isActuallyPaid = bill.status === 'PAID' && (bill.paid_amount || 0) >= bill.total;
      const isPartiallyPaid = (bill.paid_amount || 0) > 0 && (bill.paid_amount || 0) < bill.total;
      
      if (isActuallyPaid) {
          return { label: 'LUNAS', className: 'bg-emerald-100 text-emerald-600 border-emerald-200' };
      }
      if (isPartiallyPaid) {
          return { label: 'KURANG BAYAR', className: 'bg-amber-100 text-amber-600 border-amber-200' };
      }
      return { label: 'BELUM BAYAR', className: 'bg-rose-100 text-rose-600 border-rose-200' };
  };

  const openPaymentModal = (bill: Bill) => {
      setSelectedBill(bill);
      const remaining = bill.total - (bill.paid_amount || 0);
      setPaymentAmount(remaining.toString());
      setPaymentMethod('CASH');
      setSelectedBankId('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedBill || !paymentAmount) return;
      setIsProcessing(true);
      try {
          await payBill(selectedBill.id, parseInt(paymentAmount), paymentMethod, selectedBankId, undefined, undefined, false, paymentDate);
          setShowPaymentModal(false);
          addNotification("Pembayaran berhasil disimpan.", "success");
      } catch (error) {
          addNotification("Gagal memproses pembayaran.", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleOpenEditBill = (bill: Bill) => {
      setEditBillData({...bill});
      setShowEditBillModal(true);
  };

  const handleUpdateBillSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editBillData.id) return;
      setIsProcessing(true);
      try {
          await updateBill(editBillData as Bill);
          setShowEditBillModal(false);
          addNotification("Data tagihan diperbarui.", "success");
      } catch (e) {
          addNotification("Gagal memperbarui tagihan.", "error");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleDeleteBill = async (id: string) => {
      if (window.confirm("Hapus tagihan ini secara permanen? Tindakan ini tidak dapat dibatalkan.")) {
          await deleteBill(id);
          addNotification("Tagihan berhasil dihapus.", "success");
      }
  };

  const handleShareImage = async (targetBill: Bill) => {
    setDetailBill(targetBill);
    setShowDetailModal(true);
    
    setTimeout(async () => {
        if (!detailRef.current) return;
        const resident = residents.find(r => r.id === targetBill.residentId);
        if (!resident) return;

        setIsSharing(true);
        try {
            const canvas = await html2canvas(detailRef.current, {
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true
            });
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) return;
            
            const phone = resident.phone.replace(/\D/g, '').replace(/^0/, '62');
            const text = `Halo Bapak/Ibu ${resident.name}, berikut rincian tagihan unit ${resident.houseNo} periode ${MONTHS[targetBill.period_month-1]} ${targetBill.period_year}.`;
            
            if (navigator.share && /mobile/i.test(navigator.userAgent)) {
                const file = new File([blob], `Tagihan_${resident.houseNo}.png`, { type: 'image/png' });
                await navigator.share({ files: [file], title: 'Rincian Tagihan', text: text });
            } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Tagihan_${resident.houseNo}.png`;
                link.click();
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSharing(false);
        }
    }, 500);
  };

  const handlePrint = async () => {
    if (!detailBill || !detailRef.current) return;
    
    try {
        const resident = residents.find(r => r.id === detailBill.residentId);
        if (!resident) return;

        const canvas = await html2canvas(detailRef.current, {
            scale: 2, 
            backgroundColor: '#ffffff',
            useCORS: true
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Tagihan_${resident.houseNo}_${MONTHS[detailBill.period_month-1]}_${detailBill.period_year}.pdf`);
        
        setShowPrintSettings(false);
        addNotification("Tagihan berhasil diunduh sebagai PDF.", "success");
    } catch (e) {
        addNotification("Gagal mencetak tagihan.", "error");
        console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full -m-4 bg-[#F8FAFC] animate-in fade-in duration-500">
        {/* STICKY HEADER & FILTERS */}
        <div className="sticky top-0 z-40 bg-[#F8FAFC]/95 backdrop-blur-md px-5 py-4 space-y-4 border-b border-slate-100 shrink-0">
            {/* Title & Period */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase leading-none">Tagihan & Pembayaran</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Monitoring & Administrasi Iuran</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent px-3 py-2 outline-none text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-xl">
                        {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <div className="w-[1px] h-4 bg-slate-200"></div>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-transparent px-3 py-2 outline-none text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-xl">
                        {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* RT, Search, and Status Filters */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="text" placeholder="Cari No. Rumah atau Nama..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" />
                    </div>
                    
                    {/* RT Filter */}
                    {!isResident && (
                        <div className="relative md:w-48">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <select value={filterRT} onChange={(e) => setFilterRT(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none appearance-none cursor-pointer shadow-sm">
                                <option value="ALL">Semua RT</option>
                                {settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Status Tabs */}
                <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm overflow-x-auto no-scrollbar">
                    {(['ALL', 'UNPAID', 'PAID', 'PARTIAL'] as const).map(status => (
                        <button key={status} onClick={() => setStatusFilter(status)} className={`flex-1 min-w-[80px] px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === status ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            {status === 'ALL' ? 'Semua' : status === 'UNPAID' ? 'Belum Lunas' : status === 'PAID' ? 'Lunas' : 'Kurang Bayar'}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            <div className="max-w-[100%] mx-auto space-y-4">
                {/* Mobile Cards (Visible only on small screens) */}
                <div className="md:hidden space-y-4">
                    {sortedBills.map(bill => {
                        const resident = residents.find(r => r.id === bill.residentId);
                        const statusBadge = getStatusBadge(bill);
                        const isActuallyPaid = bill.status === 'PAID' && (bill.paid_amount || 0) >= bill.total;
                        return (
                            <div key={bill.id} className="bg-white p-5 rounded-[2rem] shadow-md border border-slate-100 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800">{resident?.houseNo}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{resident?.name}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 text-[8px] font-black rounded-lg uppercase tracking-widest border ${statusBadge.className}`}>{statusBadge.label}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL TAGIHAN</p>
                                        <p className="text-sm font-black text-slate-800">Rp {bill.total.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">DIBAYAR</p>
                                        <p className={`text-sm font-black ${isActuallyPaid ? 'text-emerald-600' : 'text-rose-500'}`}>Rp {(bill.paid_amount || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                     <button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"><Eye size={16} /> Rincian</button>
                                     {!isActuallyPaid ? (
                                        <button onClick={() => openPaymentModal(bill)} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"><Wallet size={16} /> Bayar</button>
                                     ) : (
                                        <button onClick={() => handleShareImage(bill)} className="flex-1 py-3 bg-[#10B981] text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><MessageCircle size={16} /> WhatsApp</button>
                                     )}
                                </div>
                                {!isResident && (
                                    <div className="flex gap-2 pt-2 border-t border-slate-50 justify-center">
                                        <button onClick={() => handleOpenEditBill(bill)} className="p-2 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100"><Edit size={14}/></button>
                                        <button onClick={() => handleDeleteBill(bill.id)} className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100"><Trash2 size={14}/></button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Desktop Table (Full Width) */}
                <div className="hidden md:block bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden w-full">
                    <table className="w-full text-left table-fixed">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%]">Unit / Nama</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%]">Tagihan</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[20%]">Status</th>
                                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[30%]">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedBills.map(bill => {
                                const resident = residents.find(r => r.id === bill.residentId);
                                const statusBadge = getStatusBadge(bill);
                                const isActuallyPaid = bill.status === 'PAID' && (bill.paid_amount || 0) >= bill.total;
                                return (
                                    <tr key={bill.id} className="hover:bg-slate-50 transition-all group">
                                        <td className="p-5">
                                            <p className="text-base font-black text-slate-800 truncate">{resident?.houseNo}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{resident?.name}</p>
                                        </td>
                                        <td className="p-5">
                                            <p className="text-sm font-black text-slate-800">Rp {bill.total.toLocaleString()}</p>
                                            {bill.paid_amount && bill.paid_amount > 0 && <p className="text-[9px] font-bold text-emerald-600">Dibayar: Rp {bill.paid_amount.toLocaleString()}</p>}
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-2.5 py-1 text-[8px] font-black rounded-lg border inline-block ${statusBadge.className}`}>{statusBadge.label}</span>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all" title="Detail"><Eye size={16} /> Rincian</button>
                                                {!isActuallyPaid ? (
                                                    <button onClick={() => openPaymentModal(bill)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md shadow-emerald-500/10 hover:bg-emerald-600 transition-all" title="Bayar"><Wallet size={16} /> Bayar</button>
                                                ) : (
                                                    <button onClick={() => handleShareImage(bill)} className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md hover:bg-[#059669] transition-all" title="WhatsApp"><MessageCircle size={16} /> WhatsApp</button>
                                                )}
                                                {!isResident && (
                                                    <div className="flex items-center gap-1 ml-2 border-l border-slate-100 pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleOpenEditBill(bill)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl transition-all" title="Edit"><Edit size={16} /></button>
                                                        <button onClick={() => handleDeleteBill(bill.id)} className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Delete"><Trash2 size={16} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {sortedBills.length === 0 && (
                                <tr><td colSpan={4} className="p-24 text-center text-slate-300 font-bold italic uppercase tracking-[0.2em]">Tidak ada data tagihan ditemukan</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* MODAL RINCIAN TAGIHAN (Sesuai Gambar 2) */}
        {showDetailModal && detailBill && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 relative" ref={detailRef}>
                    {/* Watermark LUNAS */}
                    {detailBill.status === 'PAID' && (detailBill.paid_amount || 0) >= detailBill.total && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden select-none">
                            <span className="text-[120px] font-black text-emerald-500/10 -rotate-12 tracking-tighter uppercase leading-none">LUNAS</span>
                        </div>
                    )}
                    <div className="p-8 pb-4 flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-3">
                            <FileText size={18} className="text-slate-800" />
                            <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">RINCIAN TAGIHAN</h3>
                        </div>
                        <button onClick={() => setShowDetailModal(false)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition-all"><X size={20}/></button>
                    </div>
                    <div className="p-8 pt-2 relative z-10">
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl font-black text-slate-800">{residents.find(r => r.id === detailBill.residentId)?.houseNo}</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{MONTHS[detailBill.period_month-1]} {detailBill.period_year}</span>
                            </div>
                            <p className="text-4xl font-black text-[#1e293b] tracking-tight">Rp {detailBill.total.toLocaleString('id-ID')}</p>
                            <div className="h-[2px] w-full bg-slate-800 mt-4 rounded-full"></div>
                        </div>
                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-start text-xs font-bold">
                                <span className="text-slate-600 w-2/3 leading-relaxed">Iuran Pemeliharaan Lingkungan (Kebersihan & Keamanan)</span>
                                <span className="text-slate-800 font-black">Rp {detailBill.ipl_cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-600">Iuran Kas RT</span>
                                <span className="text-slate-800 font-black">Rp {detailBill.kas_rt_cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-600">Abodemen Air</span>
                                <span className="text-slate-800 font-black">Rp {detailBill.abodemen_cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-600">Biaya Air ({detailBill.water_usage}m³)</span>
                                <span className="text-slate-800 font-black">Rp {(detailBill.water_cost || 0).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-100 mb-8">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-200">RINCIAN PERHITUNGAN PEMAKAIAN AIR</p>
                            <div className="space-y-2 text-[11px] font-bold text-slate-600">
                                {(() => {
                                    const threshold = settings.water_rate_threshold || 10;
                                    const usage = detailBill.water_usage;
                                    if (usage <= threshold) {
                                        return (<div className="flex justify-between"><span>Tarif ≤ {threshold} m³ : {usage} x Rp {settings.water_rate_low.toLocaleString()}</span><span className="font-black text-slate-800">Rp {(usage * settings.water_rate_low).toLocaleString()}</span></div>);
                                    } else {
                                        const cost1 = threshold * settings.water_rate_low;
                                        const usage2 = usage - threshold;
                                        const cost2 = usage2 * settings.water_rate_high;
                                        return (<><div className="flex justify-between"><span>Tarif ≤ {threshold} m³ : {threshold} x Rp {settings.water_rate_low.toLocaleString()}</span><span className="font-black text-slate-800">Rp {cost1.toLocaleString()}</span></div><div className="flex justify-between"><span>Tarif > {threshold} m³ : {usage2} x Rp {settings.water_rate_high.toLocaleString()}</span><span className="font-black text-slate-800">Rp {cost2.toLocaleString()}</span></div></>);
                                    }
                                })()}
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => { setShowPrintSettings(true); }} className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-slate-100"><Printer size={18} /> CETAK</button>
                            <button onClick={() => handleShareImage(detailBill)} className="flex-1 py-4 bg-[#10B981] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all active:scale-95">
                                {isSharing ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />} WHATSAPP
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL INPUT PEMBAYARAN (Sesuai Gambar 1 - DIJAGA SESUAI TEMPLATE TERAKHIR) */}
        {showPaymentModal && selectedBill && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                    {/* Dark Header */}
                    <div className="bg-[#1e293b] p-8 pb-6 relative">
                        <div className="pr-10">
                            <h3 className="font-black text-xl text-white leading-none mb-1">Input Pembayaran</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {MONTHS[selectedBill.period_month-1]} {selectedBill.period_year}
                            </p>
                        </div>
                        <button 
                            onClick={() => setShowPaymentModal(false)} 
                            className="absolute top-8 right-6 p-1.5 rounded-full text-slate-400 hover:bg-white/10 transition-all"
                        >
                            <X size={20} strokeWidth={3} />
                        </button>
                    </div>
                    
                    <form onSubmit={handlePaymentSubmit} className="p-8 pt-6 space-y-6">
                        {/* Total Tagihan Box */}
                        <div className="bg-[#f8fafc] p-6 rounded-3xl text-center border border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 mb-1">Total Tagihan</p>
                            <p className="text-3xl font-black text-[#1e293b]">
                                Rp {selectedBill.total.toLocaleString()}
                            </p>
                        </div>

                        {/* Metode Pembayaran Selection */}
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">METODE PEMBAYARAN</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    type="button" 
                                    onClick={() => setPaymentMethod('CASH')} 
                                    className={`py-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border ${paymentMethod === 'CASH' ? 'bg-[#1e293b] border-[#1e293b] text-white shadow-xl' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}
                                >
                                    <Banknote size={24} />
                                    <span className="font-black text-[10px] uppercase tracking-widest">TUNAI</span>
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setPaymentMethod('TRANSFER')} 
                                    className={`py-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border ${paymentMethod === 'TRANSFER' ? 'bg-[#1e293b] border-[#1e293b] text-white shadow-xl' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}
                                >
                                    <CreditCard size={24} />
                                    <span className="font-black text-[10px] uppercase tracking-widest">TRANSFER</span>
                                </button>
                            </div>
                        </div>

                        {/* Bank Selection (Optional) */}
                        {paymentMethod === 'TRANSFER' && (
                            <div className="animate-in slide-in-from-top-2 space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">REKENING BANK</label>
                                <select 
                                    required 
                                    value={selectedBankId} 
                                    onChange={(e) => setSelectedBankId(e.target.value)} 
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-700 outline-none"
                                >
                                    <option value="">-- Pilih Rekening --</option>
                                    {bankAccounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>))}
                                </select>
                            </div>
                        )}

                        {/* Amount Input */}
                        <div className="space-y-3">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">JUMLAH DIBAYAR (RP)</label>
                            <input 
                                type="number" 
                                required 
                                value={paymentAmount} 
                                onChange={(e) => setPaymentAmount(e.target.value)} 
                                className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-black text-3xl text-slate-800 outline-none focus:border-[#10b981] focus:ring-4 focus:ring-[#10b981]/5 transition-all" 
                                placeholder="0" 
                            />
                        </div>

                        {/* Confirmation Button */}
                        <div className="pt-2">
                            <button 
                                type="submit" 
                                disabled={isProcessing} 
                                className="w-full py-5 bg-[#10b981] hover:bg-[#059669] text-white rounded-2xl font-black text-xs uppercase tracking-[0.1em] shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {isProcessing ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <CheckCircle2 size={20} strokeWidth={2.5} />
                                )}
                                <span>KONFIRMASI PEMBAYARAN</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Modal Koreksi Tagihan */}
        {showEditBillModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                        <h3 className="font-black text-slate-800">Koreksi Data Tagihan</h3>
                        <button onClick={() => setShowEditBillModal(false)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-50"><X size={20}/></button>
                    </div>
                    <form onSubmit={handleUpdateBillSubmit} className="p-8 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[9px] font-black text-slate-400 uppercase mb-2">IPL (K&K)</label><input type="number" value={editBillData.ipl_cost} onChange={e => setEditBillData({...editBillData, ipl_cost: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none" /></div>
                            <div><label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Kas RT</label><input type="number" value={editBillData.kas_rt_cost} onChange={e => setEditBillData({...editBillData, kas_rt_cost: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none" /></div>
                            <div><label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Abodemen</label><input type="number" value={editBillData.abodemen_cost} onChange={e => setEditBillData({...editBillData, abodemen_cost: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none" /></div>
                            <div><label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Biaya Air</label><input type="number" value={editBillData.water_cost} onChange={e => setEditBillData({...editBillData, water_cost: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none" /></div>
                        </div>
                        <div><label className="block text-[9px] font-black text-slate-400 uppercase mb-2">Tunggakan Lalu</label><input type="number" value={editBillData.arrears} onChange={e => setEditBillData({...editBillData, arrears: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none" /></div>
                        <div className="bg-slate-900 p-5 rounded-2xl text-white text-center">
                            <p className="text-[10px] font-bold opacity-60 uppercase mb-1">TOTAL BARU</p>
                            <p className="text-2xl font-black">Rp {((editBillData.ipl_cost || 0) + (editBillData.kas_rt_cost || 0) + (editBillData.abodemen_cost || 0) + (editBillData.water_cost || 0) + (editBillData.extra_cost || 0) + (editBillData.arrears || 0)).toLocaleString()}</p>
                        </div>
                        <button type="submit" disabled={isProcessing} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20">Simpan Koreksi</button>
                    </form>
                </div>
            </div>
        )}

        {/* Modal Konfirmasi Print */}
        {showPrintSettings && detailBill && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2.5rem] p-8 max-sm w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mx-auto"><Printer size={40} /></div>
                    <div>
                        <h3 className="font-black text-xl text-slate-800 mb-2">Siap Mencetak?</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Bukti tagihan akan diunduh sebagai PDF.</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={handlePrint} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg active:scale-95">PROSES CETAK</button>
                        <button onClick={() => setShowPrintSettings(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[11px] uppercase tracking-widest">BATAL</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Billing;
