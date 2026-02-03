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
  
  // Update: Filter State menjadi 4 bagian
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
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const isResident = currentUser?.role === UserRole.RESIDENT;

  const t = (key: string) => {
      const isEn = settings.language === 'en';
      const dict: Record<string, {en: string, id: string}> = {
          'total': { en: 'Total Amount', id: 'Total Tagihan' },
          'arrears': { en: 'Arrears', id: 'Tunggakan' },
          'status': { en: 'Status', id: 'Status' },
      };
      return dict[key] ? (isEn ? dict[key].en : dict[key].id) : key;
  };

  // --- 1. UPDATE LOGIC FILTER (4 BAGIAN) ---
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

        if (statusFilter === 'UNPAID') {
            // Belum bayar sama sekali (Status UNPAID dan paid 0)
            if (bill.status !== 'UNPAID' || paid > 0) return false;
        } 
        else if (statusFilter === 'PARTIAL') {
            // Kurang Bayar (Status PAID tapi jumlah bayar < total)
            if (!(bill.status === 'PAID' && paid < bill.total)) return false;
        } 
        else if (statusFilter === 'PAID') {
            // Lunas (Status PAID dan jumlah bayar >= total)
            if (!(bill.status === 'PAID' && paid >= bill.total)) return false;
        }

        return true;
    }).sort((a, b) => {
        const resA = residents.find(r => r.id === a.residentId);
        const resB = residents.find(r => r.id === b.residentId);
        return (resA?.houseNo || '').localeCompare(resB?.houseNo || '', undefined, { numeric: true });
    });
  }, [bills, residents, isResident, currentUser, selectedMonth, selectedYear, searchTerm, statusFilter]);

  // --- 2. UPDATE WARNA BADGE ---
  const getStatusBadge = (bill: Bill) => {
    const paid = bill.paid_amount || 0;

    // Kurang Bayar (Amber/Orange)
    if (bill.status === 'PAID' && paid < bill.total) {
        return { label: 'KURANG BAYAR', className: 'bg-amber-50 text-amber-600 border-amber-200' };
    }

    // Lunas (Emerald/Green)
    if (bill.status === 'PAID' && paid >= bill.total) {
        return { label: 'LUNAS', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
    }

    // Belum Bayar (Rose/Red)
    return { label: 'BELUM BAYAR', className: 'bg-rose-50 text-rose-600 border-rose-200' };
  };

  // ... (Fungsi handlePaymentSubmit, handlePrint, handleShareImage tetap sama seperti sebelumnya) ...
  const openPaymentModal = (bill: Bill) => {
      setSelectedBill(bill);
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
          await payBill(selectedBill.id, parseInt(paymentAmount), paymentMethod, selectedBankId);
          setShowPaymentModal(false);
      } catch (error) {
          console.error(error);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleShareImage = async () => {
    if (!detailRef.current || !detailBill) return;
    const resident = residents.find(r => r.id === detailBill.residentId);
    if (!resident) { addNotification("Data warga tidak ditemukan.", "error"); return; }

    let phoneClean = (resident.phone || '').trim().replace(/\D/g, '');
    if (phoneClean.startsWith('0')) phoneClean = '62' + phoneClean.slice(1);
    else if (phoneClean.startsWith('8')) phoneClean = '62' + phoneClean;

    if (!phoneClean || phoneClean.length < 10) {
        addNotification(`Gagal: Nomor WhatsApp tidak valid.`, "error");
        return;
    }

    setIsSharing(true);
    try {
        const canvas = await html2canvas(detailRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Tagihan_${resident.houseNo}.png`;
        link.click();

        const text = `Halo Bapak/Ibu Warga Unit ${resident.houseNo}.\nBerikut rincian tagihan bulan ${MONTHS[detailBill.period_month - 1]} ${detailBill.period_year}.`;
        const waUrl = `https://api.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
    } catch (e) {
        console.error(e);
    } finally {
        setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
        {/* Header (Bulan/Tahun) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tagihan & Pembayaran</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Kelola tagihan bulanan warga</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent px-3 py-2 outline-none text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-xl">
                    {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-transparent px-3 py-2 outline-none text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 rounded-xl">
                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
        </div>

        {/* --- 3. UPDATE UI FILTER (4 TOMBOL) --- */}
        <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                    type="text" 
                    placeholder="Cari No. Rumah atau Nama..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
            </div>
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 overflow-x-auto no-scrollbar">
                {(['ALL', 'UNPAID', 'PARTIAL', 'PAID'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === status ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {status === 'ALL' ? 'Semua' : status === 'UNPAID' ? 'Belum Bayar' : status === 'PARTIAL' ? 'Kurang Bayar' : 'Lunas'}
                    </button>
                ))}
            </div>
        </div>

        {/* View Content (Mobile & Desktop) */}
        {/* Konten tabel/card menggunakan sortedBills dan getStatusBadge yang sudah kita update di atas */}
        <div className="md:hidden space-y-4">
            {sortedBills.length > 0 ? sortedBills.map((bill) => {
                const resident = residents.find(r => r.id === bill.residentId);
                const statusBadge = getStatusBadge(bill);
                return (
                    <div key={bill.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">{resident?.houseNo}</h3>
                                <p className="text-[10px] font-bold text-slate-500">{MONTHS[bill.period_month - 1]} {bill.period_year}</p>
                            </div>
                            <span className={`px-2 py-1 text-[8px] font-black rounded-lg border ${statusBadge.className}`}>
                                {statusBadge.label}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex justify-center items-center gap-2"><Eye size={14}/> Detail</button>
                            {statusBadge.label !== 'LUNAS' ? (
                                <button onClick={() => openPaymentModal(bill)} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20"><Wallet size={14}/> Bayar</button>
                            ) : (
                                <button onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex justify-center items-center gap-2"><Printer size={14}/> Cetak</button>
                            )}
                        </div>
                    </div>
                );
            }) : (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Data tidak ditemukan</p>
                </div>
            )}
        </div>

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
                    {sortedBills.map(bill => {
                        const resident = residents.find(r => r.id === bill.residentId);
                        const statusBadge = getStatusBadge(bill);
                        return (
                            <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4">
                                    <p className="text-sm font-bold text-slate-800">{resident?.houseNo}</p>
                                    <p className="text-[10px] text-slate-500">{resident?.name}</p>
                                </td>
                                <td className="p-4 text-xs font-medium text-slate-600">{MONTHS[bill.period_month - 1]} {bill.period_year}</td>
                                <td className="p-4 text-right">
                                    <p className="text-sm font-black text-slate-800">Rp {bill.total.toLocaleString('id-ID')}</p>
                                    {bill.paid_amount > 0 && bill.paid_amount < bill.total && (
                                        <p className="text-[9px] text-amber-500 font-bold">Dibayar: Rp {bill.paid_amount.toLocaleString('id-ID')}</p>
                                    )}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${statusBadge.className}`}>
                                        {statusBadge.label}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Eye size={16} /></button>
                                        {statusBadge.label !== 'LUNAS' && (
                                            <button onClick={() => openPaymentModal(bill)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"><Wallet size={16} /></button>
                                        )}
                                        <button onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Printer size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default Billing;
