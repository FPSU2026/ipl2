import React, { useState, useRef, useMemo } from 'react';
import { Search, Printer, Wallet, X, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { MONTHS } from '../constants';
import { useApp } from '../context/AppContext';
import { Bill, UserRole } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Billing: React.FC = () => {
  const { bills, residents, payBill, settings, currentUser, addNotification } = useApp();
  
  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');
  
  // Modal States
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

  // --- LOGIC HELPER ---
  const getStatusInfo = (bill: Bill) => {
    const paid = bill.paid_amount || 0;
    if (bill.status === 'PAID' && paid < bill.total) {
      return { label: 'KURANG BAYAR', color: 'bg-amber-50 text-amber-600 border-amber-200', type: 'PARTIAL' };
    }
    if (bill.status === 'PAID' && paid >= bill.total) {
      return { label: 'LUNAS', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', type: 'PAID' };
    }
    return { label: 'BELUM BAYAR', color: 'bg-rose-50 text-rose-600 border-rose-200', type: 'UNPAID' };
  };

  // --- FILTER LOGIC ---
  const sortedBills = useMemo(() => {
    return bills.filter(bill => {
      if (isResident && bill.residentId !== currentUser?.residentId) return false;
      if (bill.period_month !== selectedMonth || bill.period_year !== selectedYear) return false;

      const resident = residents.find(r => r.id === bill.residentId);
      if (searchTerm && resident) {
        const s = searchTerm.toLowerCase();
        if (!resident.name.toLowerCase().includes(s) && !resident.houseNo.toLowerCase().includes(s)) return false;
      }

      const info = getStatusInfo(bill);
      if (statusFilter !== 'ALL' && info.type !== statusFilter) return false;

      return true;
    }).sort((a, b) => {
      const resA = residents.find(r => r.id === a.residentId);
      const resB = residents.find(r => r.id === b.residentId);
      return (resA?.houseNo || '').localeCompare(resB?.houseNo || '', undefined, { numeric: true });
    });
  }, [bills, residents, isResident, currentUser, selectedMonth, selectedYear, searchTerm, statusFilter]);

  // --- HANDLERS ---
  const handleOpenPayment = (bill: Bill) => {
    setSelectedBill(bill);
    const remaining = bill.total - (bill.paid_amount || 0);
    setPaymentAmount(remaining.toString());
    setShowPaymentModal(true);
  };

  const handleOpenDetail = (bill: Bill) => {
    setDetailBill(bill);
    setShowDetailModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || !paymentAmount) return;
    setIsProcessing(true);
    try {
      await payBill(selectedBill.id, parseInt(paymentAmount), paymentMethod, selectedBankId);
      setShowPaymentModal(false);
      addNotification("Pembayaran berhasil dicatat", "success");
    } catch (error) {
      addNotification("Gagal memproses pembayaran", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!detailRef.current || !detailBill) return;
    const resident = residents.find(r => r.id === detailBill.residentId);
    if (!resident?.phone) return addNotification("No WhatsApp tidak tersedia", "error");

    setIsSharing(true);
    try {
      const canvas = await html2canvas(detailRef.current, { scale: 2 });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error();
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Tagihan_${resident.houseNo}.png`;
      link.click();

      let phone = resident.phone.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.slice(1);
      const text = encodeURIComponent(`Halo *${resident.name}*, berikut rincian tagihan unit *${resident.houseNo}* bulan ${MONTHS[detailBill.period_month-1]}.`);
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    } catch (e) {
      addNotification("Gagal memproses gambar", "error");
    } finally { setIsSharing(false); }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Date Picker */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Tagihan & Pembayaran</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periode: {MONTHS[selectedMonth-1]} {selectedYear}</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="text-xs font-bold p-2 outline-none">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="text-xs font-bold p-2 outline-none border-l">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input 
            type="text" placeholder="Cari unit atau nama..." 
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-white rounded-xl border border-slate-200 p-1 overflow-x-auto no-scrollbar">
          {(['ALL', 'UNPAID', 'PARTIAL', 'PAID'] as const).map(f => (
            <button
              key={f} onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all ${statusFilter === f ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              {f === 'ALL' ? 'Semua' : f === 'UNPAID' ? 'Belum Bayar' : f === 'PARTIAL' ? 'Kurang Bayar' : 'Lunas'}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr className="text-[10px] font-black text-slate-400 uppercase">
              <th className="p-4">Unit / Warga</th>
              <th className="p-4 text-right">Tagihan</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {sortedBills.map(bill => {
              const res = residents.find(r => r.id === bill.residentId);
              const info = getStatusInfo(bill);
              return (
                <tr key={bill.id} className="hover:bg-slate-50">
                  <td className="p-4">
                    <p className="font-bold text-slate-800">{res?.houseNo}</p>
                    <p className="text-[10px] text-slate-500">{res?.name}</p>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-black">Rp {bill.total.toLocaleString()}</p>
                    {bill.paid_amount > 0 && <p className="text-[9px] text-emerald-500">Bayar: Rp {bill.paid_amount.toLocaleString()}</p>}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-[9px] font-black border ${info.color}`}>{info.label}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleOpenDetail(bill)} className="p-2 text-slate-400 hover:text-blue-500"><Eye size={16}/></button>
                      {info.type !== 'PAID' && (
                        <button onClick={() => handleOpenPayment(bill)} className="p-2 text-emerald-500"><Wallet size={16}/></button>
                      )}
                      <button onClick={() => {setDetailBill(bill); setShowPrintSettings(true)}} className="p-2 text-blue-500"><Printer size={16}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {sortedBills.map(bill => {
          const res = residents.find(r => r.id === bill.residentId);
          const info = getStatusInfo(bill);
          return (
            <div key={bill.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-black">{res?.houseNo}</h3>
                <span className={`px-2 py-1 text-[8px] font-black rounded border ${info.color}`}>{info.label}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl flex justify-between">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Total</p>
                  <p className="font-black text-sm">Rp {bill.total.toLocaleString()}</p>
                </div>
                {bill.paid_amount > 0 && (
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Dibayar</p>
                    <p className="font-black text-sm text-emerald-600">Rp {bill.paid_amount.toLocaleString()}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenDetail(bill)} className="flex-1 py-3 bg-slate-100 rounded-xl font-black text-[10px] uppercase text-slate-600 flex justify-center items-center gap-2"><Eye size={14}/> Detail</button>
                {info.type !== 'PAID' && (
                  <button onClick={() => handleOpenPayment(bill)} className="flex-1 py-3 bg-emerald-500 rounded-xl font-black text-[10px] uppercase text-white flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/20"><Wallet size={14}/> Bayar</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800">INPUT PEMBAYARAN</h3>
              <button onClick={() => setShowPaymentModal(false)}><X/></button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Jumlah Bayar</label>
                <input 
                  type="number" value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full p-3 bg-slate-50 border rounded-xl font-black"
                />
              </div>
              <button 
                disabled={isProcessing}
                className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isProcessing ? 'MEMPROSES...' : 'KONFIRMASI BAYAR'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal Redesigned */}
      {showDetailModal && detailBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden" ref={detailRef}>
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest flex items-center gap-2"><FileText size={14} /> Rincian Tagihan</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400"><X size={18}/></button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h1 className="text-4xl font-black text-slate-800">{residents.find(r => r.id === detailBill.residentId)?.houseNo}</h1>
                <p className="text-2xl font-black text-slate-700">Rp {detailBill.total.toLocaleString()}</p>
                <div className="h-1 w-12 bg-emerald-500 mt-2 rounded-full"></div>
              </div>
              <div className="space-y-3 text-sm mb-6">
                <div className="flex justify-between"><span>IPL & Kebersihan</span><span className="font-bold">Rp {detailBill.ipl_cost.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Kas RT</span><span className="font-bold">Rp {detailBill.kas_rt_cost.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Air ({detailBill.water_usage}m³)</span><span className="font-bold">Rp {(detailBill.water_cost + detailBill.abodemen_cost).toLocaleString()}</span></div>
              </div>
              <button onClick={handleShareWhatsApp} disabled={isSharing} className="w-full py-3 bg-[#10B981] text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2">
                <CheckCircle2 size={16}/> {isSharing ? 'MENGIRIM...' : 'KIRIM WHATSAPP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
