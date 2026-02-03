
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Printer, Share2, Wallet, CreditCard, ChevronDown, FilePlus, Loader2, X, Check, AlertCircle, ImageIcon, Eye, Info, Banknote, Building2, Download, RefreshCw, Plus, Minus, Edit, Trash2, MapPin, Calendar, Droplets, User, FileText, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, Settings, Filter, MessageCircle } from 'lucide-react';
import { MONTHS, DEFAULT_SETTINGS } from '../constants';
import { useApp } from '../context/AppContext';
import { Bill, UserRole } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Billing: React.FC = () => {
  const { bills, residents, payBill, settings, currentUser, bankAccounts, addNotification } = useApp();
  
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');
  
  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [showPrintSettings, setShowPrintSettings] = useState(false); // For printing modal
  const [isSharing, setIsSharing] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const isResident = currentUser?.role === UserRole.RESIDENT;

  // Simple Translation Helper
  const t = (key: string) => {
      const isEn = settings.language === 'en';
      const dict: Record<string, {en: string, id: string}> = {
          'total': { en: 'Total Amount', id: 'Total Tagihan' },
          'arrears': { en: 'Arrears', id: 'Tunggakan' },
          'status': { en: 'Status', id: 'Status' },
          // Add more as needed
      };
      return dict[key] ? (isEn ? dict[key].en : dict[key].id) : key;
  };

  // Filter Logic
  const sortedBills = useMemo(() => {
     return bills.filter(bill => {

        if (isResident && bill.residentId !== currentUser?.residentId) return false;
        if (bill.period_month !== selectedMonth || bill.period_year !== selectedYear) return false;

        const resident = residents.find(r => r.id === bill.residentId);
        if (searchTerm && resident) {
            const searchLower = searchTerm.toLowerCase();
            if (!resident.name.toLowerCase().includes(searchLower) && !resident.houseNo.toLowerCase().includes(searchLower)) {
                return false;
            }
        }

        const paid = bill.paid_amount || 0;

        if (statusFilter === 'UNPAID' && bill.status !== 'UNPAID') return false;
        if (statusFilter === 'PAID' && bill.status !== 'PAID') return false;

        if (statusFilter === 'PARTIAL') {
            if (!(bill.status === 'PAID' && paid < bill.total)) return false;
        }

        return true;
    }).sort((a, b) => {
        const resA = residents.find(r => r.id === a.residentId);
        const resB = residents.find(r => r.id === b.residentId);
        return (resA?.houseNo || '').localeCompare(resB?.houseNo || '', undefined, { numeric: true });
    });
}, [bills, residents, isResident, currentUser, selectedMonth, selectedYear, searchTerm, statusFilter]);



  const getStatusBadge = (bill: Bill) => {
    const paid = bill.paid_amount || 0;

    if (bill.status === 'PAID' && paid < bill.total) {
        return { label: 'KURANG BAYAR', className: 'bg-amber-100 text-amber-600 border-amber-200' };
    }

    if (bill.status === 'PAID') {
        return { label: 'LUNAS', className: 'bg-emerald-100 text-emerald-600 border-emerald-200' };
    }

    return { label: 'BELUM BAYAR', className: 'bg-rose-100 text-rose-600 border-rose-200' };
};

  const openPaymentModal = (bill: Bill) => {
      setSelectedBill(bill);
      // Default to full amount remaining
      const remaining = bill.total - (bill.paid_amount || 0);
      setPaymentAmount(remaining.toString());
      setPaymentMethod('CASH');
      setSelectedBankId('');
      setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedBill || !paymentAmount) return;
      
      setIsProcessing(true);
      try {
          await payBill(
              selectedBill.id, 
              parseInt(paymentAmount), 
              paymentMethod, 
              selectedBankId
          );
          setShowPaymentModal(false);
          // notification handled in context
      } catch (error) {
          console.error(error);
      } finally {
          setIsProcessing(false);
      }
  };

  const handlePrint = () => {
      if (!detailBill) return;
      const resident = residents.find(r => r.id === detailBill.residentId);
      if (!resident) return;

      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(settings.location_name, 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text("BUKTI PEMBAYARAN IURAN WARGA", 105, 28, { align: 'center' });
      
      doc.line(20, 35, 190, 35);

      // Details
      doc.text(`No. Transaksi : ${detailBill.id.substring(0,8).toUpperCase()}`, 20, 45);
      doc.text(`Tanggal Cetak : ${new Date().toLocaleDateString('id-ID')}`, 140, 45);
      
      doc.text(`Nama Warga    : ${resident.name}`, 20, 55);
      doc.text(`No. Rumah     : ${resident.houseNo}`, 20, 60);
      doc.text(`Periode       : ${MONTHS[detailBill.period_month-1]} ${detailBill.period_year}`, 20, 65);

      // Table
      const tableData = [
          ['IPL & Kebersihan', `Rp ${detailBill.ipl_cost.toLocaleString('id-ID')}`],
          ['Kas RT', `Rp ${detailBill.kas_rt_cost.toLocaleString('id-ID')}`],
          ['Air (Abodemen + Pakai)', `Rp ${(detailBill.water_cost + detailBill.abodemen_cost).toLocaleString('id-ID')}`],
          ['Lain-lain', `Rp ${detailBill.extra_cost.toLocaleString('id-ID')}`],
          ['Kurang', `Rp ${detailBill.arrears.toLocaleString('id-ID')}`],
      ];

      autoTable(doc, {
          startY: 75,
          head: [['Keterangan', 'Jumlah']],
          body: tableData,
          theme: 'grid',
          styles: { fontSize: 10 },
          headStyles: { fillColor: [40, 40, 40] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL TAGIHAN : Rp ${detailBill.total.toLocaleString('id-ID')}`, 190, finalY, { align: 'right' });
      
      if (detailBill.status === 'PAID') {
          doc.setTextColor(0, 150, 0);
          doc.text("STATUS: LUNAS", 20, finalY + 10);
          doc.setTextColor(0, 0, 0);
          if (detailBill.paid_at) {
              doc.setFont('helvetica', 'italic');
              doc.setFontSize(8);
              doc.text(`Dibayar pada: ${new Date(detailBill.paid_at).toLocaleString('id-ID')}`, 20, finalY + 15);
          }
      } else {
          doc.setTextColor(200, 0, 0);
          doc.text("STATUS: BELUM LUNAS", 20, finalY + 10);
      }

      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text("Terima kasih atas pembayaran iuran tepat waktu.", 105, 280, { align: 'center' });

      doc.save(`Invoice_${resident.houseNo}_${MONTHS[detailBill.period_month-1]}_${detailBill.period_year}.pdf`);
      setShowPrintSettings(false);
  };

  const handleShareImage = async () => {
    if (!detailRef.current || !detailBill) return;
    
    // 1. Cari Data Warga sesuai Tagihan
    const resident = residents.find(r => r.id === detailBill.residentId);
    if (!resident) {
        addNotification("Data warga tidak ditemukan.", "error");
        return;
    }

    // 2. Ambil & Validasi Nomor HP Warga Tersebut
    // Bersihkan karakter non-digit
    let phoneClean = (resident.phone || '').trim().replace(/\D/g, '');
    
    // Normalisasi awalan nomor
    if (phoneClean.startsWith('0')) {
        // Ganti 0 di depan dengan 62
        phoneClean = '62' + phoneClean.slice(1);
    } else if (phoneClean.startsWith('8')) {
        // Jika langsung mulai 8 (misal 812...), tambahkan 62
        phoneClean = '62' + phoneClean;
    }
    // Jika sudah mulai dengan 62, biarkan

    // Validasi Ketersediaan
    if (!phoneClean) {
        addNotification(`Gagal: Nomor WhatsApp untuk unit ${resident.houseNo} belum terdaftar di Data Warga.`, "error");
        return;
    }

    // Validasi Panjang Nomor (Minimal 10 digit, misal 62 8xx ...)
    if (phoneClean.length < 10) {
        addNotification(`Gagal: Nomor HP ${resident.phone} terlalu pendek/tidak valid.`, "error");
        return;
    }

    setIsSharing(true);
    try {
        const canvas = await html2canvas(detailRef.current, {
            scale: 2, 
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
        });

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) { addNotification("Gagal membuat gambar.", "error"); return; }

        // Download logic + WA redirect
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Tagihan_${resident.houseNo}_${MONTHS[detailBill.period_month - 1]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const text = `Halo Bapak/Ibu Warga Unit ${resident.houseNo}.\nBerikut rincian tagihan bulan ${MONTHS[detailBill.period_month - 1]} ${detailBill.period_year}.`;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Gunakan nomor HP warga yang valid
        const waUrl = isMobile 
            ? `https://api.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(text)}`
            : `https://web.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(text)}`;
        
        window.open(waUrl, '_blank');
        addNotification(`Mengirim tagihan ke ${resident.houseNo} (${phoneClean}) via WhatsApp.`, "info");

    } catch (e) {
        console.error(e);
        addNotification("Gagal memproses gambar.", "error");
    } finally {
        setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tagihan & Pembayaran</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                    Kelola tagihan bulanan warga
                </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="bg-transparent px-3 py-2 outline-none text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-xl"
                >
                    {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <div className="w-[1px] bg-slate-200 hidden sm:block"></div>
                <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="bg-transparent px-3 py-2 outline-none text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-xl"
                >
                    {/* Dynamic Year Range */}
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                    type="text" 
                    placeholder="Cari No. Rumah atau Nama..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
            </div>
            <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                {(['ALL', 'UNPAID', 'PAID'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {status === 'ALL' ? 'Semua' : status === 'UNPAID' ? 'Belum Lunas' : 'Lunas'}
                    </button>
                ))}
            </div>
        </div>

        {/* Mobile Cards (Fragment Re-insertion) */}
        <div className="md:hidden space-y-4">
            {/* Mobile View Cards (Dynamic Grid) */}
            <div className="md:hidden p-0 space-y-3">
                {sortedBills.length > 0 ? sortedBills.map((bill) => {
                    const resident = residents.find(r => r.id === bill.residentId);
                    if (!resident) return null;
                    const statusBadge = getStatusBadge(bill);
                    const displayTotal = bill.status === 'PAID' ? (bill.paid_amount || 0) : bill.total;
                    const currentBillAmount = bill.total - bill.arrears;

                    return (
                        <div key={bill.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                            {/* Header: Identity & Status */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">No. Rumah</p>
                                    <h3 className="text-xl font-black text-slate-800">{resident.houseNo}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1">
                                        {MONTHS[bill.period_month - 1]} {bill.period_year}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 text-[9px] font-black rounded-lg uppercase tracking-widest border ${statusBadge.className}`}>
                                    {statusBadge.label}
                                </span>
                            </div>

                            {/* Body: Financials */}
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 grid grid-cols-2 gap-4">
                                <div className="col-span-2 pb-2 border-b border-slate-200">
                                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tagihan Bulan Ini</p>
                                     <p className="text-sm font-black text-slate-700">Rp {currentBillAmount.toLocaleString('id-ID')}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('total')}</p>
                                    <p className={`text-sm font-black ${bill.status === 'PAID' ? 'text-emerald-600' : 'text-slate-800'}`}>Rp {displayTotal.toLocaleString('id-ID')}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('arrears')}</p>
                                    <p className={`text-sm font-black ${bill.arrears > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                                        {bill.arrears > 0 ? `Rp ${bill.arrears.toLocaleString('id-ID')}` : '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Footer: Actions */}
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} 
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-slate-200 transition-colors"
                                >
                                    <Eye size={16} /> Detail
                                </button>
                                
                                {bill.status === 'UNPAID' ? (
                                    <button 
                                        onClick={() => openPaymentModal(bill)} 
                                        className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                    >
                                        <Wallet size={16} /> Bayar
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} 
                                        className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-blue-100 transition-colors"
                                    >
                                        <Printer size={16} /> Cetak
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-12">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tidak ada data tagihan</p>
                    </div>
                )}
            </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit / Warga</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Periode</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tagihan</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {sortedBills.length > 0 ? sortedBills.map(bill => {
                        const resident = residents.find(r => r.id === bill.residentId);
                        const statusBadge = getStatusBadge(bill);
                        return (
                            <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <p className="text-sm font-bold text-slate-800">{resident?.houseNo}</p>
                                    <p className="text-[10px] text-slate-500">{resident?.name}</p>
                                </td>
                                <td className="p-4 text-xs font-medium text-slate-600">
                                    {MONTHS[bill.period_month - 1]} {bill.period_year}
                                </td>
                                <td className="p-4 text-right">
                                    <p className="text-sm font-black text-slate-800">Rp {bill.total.toLocaleString('id-ID')}</p>
                                    {bill.arrears > 0 && <p className="text-[9px] text-rose-500 font-bold">Tunggakan: Rp {bill.arrears.toLocaleString('id-ID')}</p>}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${statusBadge.className}`}>
                                        {statusBadge.label}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Detail"><Eye size={16} /></button>
                                        {bill.status === 'UNPAID' ? (
                                            <button onClick={() => openPaymentModal(bill)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Bayar"><Wallet size={16} /></button>
                                        ) : (
                                            <button onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="Cetak"><Printer size={16} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }) : (
                        <tr><td colSpan={5} className="p-8 text-center text-xs text-slate-400 italic">Data tidak ditemukan</td></tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Detail Modal - REDESIGNED FOR WHATSAPP SHARE */}
        {showDetailModal && detailBill && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200" ref={detailRef}>
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                        <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <FileText size={14} /> Rincian Tagihan
                        </h3>
                        <button onClick={() => setShowDetailModal(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 transition-all"><X size={18}/></button>
                    </div>
                    
                    <div className="p-6 pt-2">
                        {/* Hero Info */}
                        <div className="mb-6">
                            <div className="flex items-baseline gap-2 mb-1">
                                <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                                    {residents.find(r => r.id === detailBill.residentId)?.houseNo || 'Unit'}
                                </h1>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {MONTHS[detailBill.period_month-1]} {detailBill.period_year}
                                </span>
                            </div>
                            <p className="text-3xl font-black text-slate-800 tracking-tight">Rp {detailBill.total.toLocaleString('id-ID')}</p>
                            <div className="h-1 w-full bg-slate-800 mt-4 rounded-full"></div>
                        </div>

                        {/* List Items */}
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-start text-sm">
                                <span className="font-bold text-slate-600 w-2/3">Iuran Pemeliharaan Lingkungan (Kebersihan & Keamanan)</span>
                                <span className="font-black text-slate-800">Rp {detailBill.ipl_cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold text-slate-600">Iuran Kas RT</span>
                                <span className="font-black text-slate-800">Rp {detailBill.kas_rt_cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold text-slate-600">Abodemen Air</span>
                                <span className="font-black text-slate-800">Rp {detailBill.abodemen_cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold text-slate-600">Biaya Air ({detailBill.water_usage}m³)</span>
                                <span className="font-black text-slate-800">Rp {(detailBill.water_cost || 0).toLocaleString()}</span>
                            </div>
                            {detailBill.extra_cost > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-600">Biaya Lain-lain</span>
                                    <span className="font-black text-slate-800">Rp {detailBill.extra_cost.toLocaleString()}</span>
                                </div>
                            )}
                            {detailBill.arrears > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-rose-500">Kurang</span>
                                    <span className="font-black text-rose-600">Rp {detailBill.arrears.toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Water Detail Box */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-2">Rincian Perhitungan Biaya Pemakaian Air</p>
                            <div className="space-y-1 text-xs text-slate-500">
                                {(() => {
                                    const threshold = settings.water_rate_threshold || 10;
                                    const usage = detailBill.water_usage;
                                    if (usage <= threshold) {
                                        return (
                                            <div className="flex justify-between">
                                                <span>Tarif ≤ {threshold} m³ : {usage} x Rp {settings.water_rate_low.toLocaleString()}</span>
                                                <span className="font-bold text-slate-700">Rp {(usage * settings.water_rate_low).toLocaleString()}</span>
                                            </div>
                                        );
                                    } else {
                                        const cost1 = threshold * settings.water_rate_low;
                                        const usage2 = usage - threshold;
                                        const cost2 = usage2 * settings.water_rate_high;
                                        return (
                                            <>
                                                <div className="flex justify-between">
                                                    <span>Tarif ≤ {threshold} m³ : {threshold} x Rp {settings.water_rate_low.toLocaleString()}</span>
                                                    <span className="font-bold text-slate-700">Rp {cost1.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Tarif &gt; {threshold} m³ : {usage2} x Rp {settings.water_rate_high.toLocaleString()}</span>
                                                    <span className="font-bold text-slate-700">Rp {cost2.toLocaleString()}</span>
                                                </div>
                                            </>
                                        );
                                    }
                                })()}
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setShowPrintSettings(true); setShowDetailModal(false); }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                            >
                                <Printer size={16} /> Cetak
                            </button>
                            <button 
                                onClick={handleShareImage}
                                className="flex-1 py-3 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
                            >
                                {isSharing ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                                WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedBill && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                    <div className="bg-slate-800 p-6 flex justify-between items-center text-white">
                        <div>
                            <h3 className="font-black text-lg">Input Pembayaran</h3>
                            <p className="text-[10px] uppercase tracking-widest opacity-60">
                                {MONTHS[selectedBill.period_month-1]} {selectedBill.period_year}
                            </p>
                        </div>
                        <button onClick={() => setShowPaymentModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button>
                    </div>
                    
                    <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                            <p className="text-xs text-slate-500 mb-1">Total Tagihan</p>
                            <p className="text-2xl font-black text-slate-800">Rp {selectedBill.total.toLocaleString()}</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Metode Pembayaran</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => setPaymentMethod('CASH')} className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === 'CASH' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-400'}`}>
                                    <Banknote size={20} /> <span className="text-[10px] font-black">TUNAI</span>
                                </button>
                                <button type="button" onClick={() => setPaymentMethod('TRANSFER')} className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${paymentMethod === 'TRANSFER' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                                    <CreditCard size={20} /> <span className="text-[10px] font-black">TRANSFER</span>
                                </button>
                            </div>
                        </div>

                        {paymentMethod === 'TRANSFER' && (
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Rekening Tujuan</label>
                                <select 
                                    required 
                                    value={selectedBankId} 
                                    onChange={(e) => setSelectedBankId(e.target.value)} 
                                    className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl font-bold text-blue-800 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    <option value="">-- Pilih Rekening --</option>
                                    {bankAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Jumlah Dibayar (Rp)</label>
                            <input 
                                type="number" 
                                required 
                                value={paymentAmount} 
                                onChange={(e) => setPaymentAmount(e.target.value)} 
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-800 outline-none focus:bg-white focus:border-emerald-500 transition-all" 
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={isProcessing}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                        >
                            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                            <span>Konfirmasi Pembayaran</span>
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Print Settings Modal */}
        {showPrintSettings && detailBill && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center">
                    <Printer size={48} className="mx-auto text-blue-500 mb-4" />
                    <h3 className="font-black text-lg text-slate-800 mb-2">Cetak Bukti Pembayaran</h3>
                    <p className="text-xs text-slate-500 mb-6">Unduh bukti pembayaran dalam format PDF.</p>
                    <div className="flex gap-3">
                        <button onClick={handlePrint} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-blue-500/20">Download PDF</button>
                        <button onClick={() => setShowPrintSettings(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs uppercase">Batal</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Billing;
