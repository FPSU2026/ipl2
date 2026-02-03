
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Printer, Share2, Wallet, CreditCard, ChevronDown, FilePlus, Loader2, X, Check, AlertCircle, ImageIcon, Eye, Info, Banknote, Building2, Download, RefreshCw, Plus, Minus, Edit, Trash2, MapPin, Calendar, Droplets, User, FileText, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, Settings, Upload, Image as ImageIcon2, Lock, FileSpreadsheet, MessageCircle } from 'lucide-react';
import { MONTHS, DEFAULT_SETTINGS } from '../constants';
import { useApp } from '../context/AppContext';
import { Bill, UserRole } from '../types';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const Billing: React.FC = () => {
  const navigate = useNavigate();
  const { bills, residents, settings, payBill, updateBill, deleteBill, addNotification, currentUser, bankAccounts, t } = useApp();
  
  const today = new Date();
  const currentRealMonth = today.getMonth() + 1;
  const currentRealYear = today.getFullYear();
  
  const [selectedPeriod, setSelectedPeriod] = useState({ month: currentRealMonth, year: currentRealYear });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRT, setFilterRT] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'UNDERPAID' | 'OVERPAID'>('ALL');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'A5' | 'A4' | 'Custom'>('58mm');
  const [customPaperWidth, setCustomPaperWidth] = useState<string>('75');

  const detailRef = useRef<HTMLDivElement>(null);
  const isResident = currentUser?.role === UserRole.RESIDENT;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPaymentModal(false); setShowDetailModal(false); setShowPrintSettings(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
        if (isResident && bill.residentId !== currentUser.residentId) return false;
        if (!isResident && (bill.period_month !== selectedPeriod.month || bill.period_year !== selectedPeriod.year)) return false;
        const resident = residents.find(r => r.id === bill.residentId);
        if (!resident) return false;
        if (filterRT !== 'ALL' && resident.rt !== filterRT) return false;
        const matchesSearch = resident.name.toLowerCase().includes(searchTerm.toLowerCase()) || resident.houseNo.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (statusFilter !== 'ALL') {
            if (statusFilter === 'UNPAID') return bill.status === 'UNPAID';
            if (statusFilter === 'PAID') return bill.status === 'PAID';
        }
        return true;
    }).sort((a, b) => a.status === 'UNPAID' ? -1 : 1);
  }, [bills, residents, isResident, currentUser, selectedPeriod, filterRT, searchTerm, statusFilter]);

  const handleWhatsAppShare = (bill: Bill) => {
      const resident = residents.find(r => r.id === bill.residentId);
      if (!resident || !resident.phone) {
          addNotification("No HP warga tidak ditemukan.", "error");
          return;
      }
      let phoneClean = resident.phone.trim().replace(/\D/g, '');
      if (phoneClean.startsWith('0')) phoneClean = '62' + phoneClean.slice(1);
      
      const monthName = MONTHS[bill.period_month-1].toUpperCase();
      const message = `*RINCIAN TAGIHAN IURAN*\nUnit: ${resident.houseNo}\nPeriode: ${monthName} ${bill.period_year}\n--------------------------\nTotal Tagihan: Rp ${bill.total.toLocaleString()}\n--------------------------\nMohon segera melakukan pembayaran. Terima kasih.`;
      
      const url = `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const handleShareImage = async () => {
    if (!detailRef.current || !detailBill) return;
    setIsSharing(true);
    try {
        const canvas = await html2canvas(detailRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Rincian_Tagihan_${detailBill.id}.png`;
            link.click();
            addNotification("Gambar tagihan berhasil diunduh.", "success");
        }
    } catch (e) { addNotification("Gagal membuat gambar.", "error"); } finally { setIsSharing(false); }
  };

  const openPaymentModal = (bill: Bill, isEdit: boolean = false) => {
    setSelectedBill(bill);
    setPaymentAmount(isEdit ? (bill.paid_amount || 0).toString() : bill.total.toString());
    setPaymentMethod('CASH');
    setSelectedBankId('');
    setPaymentProof(bill.photo_url || null);
    setIsEditMode(isEdit);
    setShowDetailModal(false);
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    const amount = parseInt(paymentAmount);
    await payBill(selectedBill.id, amount, paymentMethod, selectedBankId, paymentProof || undefined, undefined, isEditMode, paymentDate);
    setShowPaymentModal(false);
  };

  const getStatusBadge = (bill: Bill) => {
      if (bill.status === 'UNPAID') return { label: 'BELUM BAYAR', className: 'bg-rose-50 text-rose-600 border-rose-100' };
      return { label: 'LUNAS', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-0 flex flex-col h-[calc(100vh-120px)]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t('bill_title')}</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
               {isResident ? t('bill_history') : `${t('bill_period_data')}: ${MONTHS[selectedPeriod.month-1]} ${selectedPeriod.year}`}
           </p>
        </div>
        
        <div className="flex flex-col xl:flex-row gap-3 w-full lg:w-auto xl:items-center">
            <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder={t('search_unit')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none shadow-sm" />
            </div>
            {!isResident && (
                <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex-1 xl:flex-none justify-center">
                    <select className="bg-transparent px-2 py-1.5 outline-none text-xs font-black text-slate-700 cursor-pointer" value={selectedPeriod.month} onChange={(e) => setSelectedPeriod({...selectedPeriod, month: parseInt(e.target.value)})}>
                        {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <div className="w-[1px] h-4 bg-slate-200"></div>
                    <select className="bg-transparent px-2 py-1.5 outline-none text-xs font-black text-slate-700 cursor-pointer" value={selectedPeriod.year} onChange={(e) => setSelectedPeriod({...selectedPeriod, year: parseInt(e.target.value)})}>
                        <option value={currentRealYear}>{currentRealYear}</option>
                        <option value={currentRealYear + 1}>{currentRealYear + 1}</option>
                    </select>
                </div>
            )}
        </div>
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="overflow-auto flex-1 relative bg-slate-50/30">
            <table className="w-full text-left hidden md:table">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-20 shadow-sm">
                <tr>
                    <th className="px-4 py-3 bg-slate-50">{t('th_house')}</th>
                    <th className="px-4 py-3 bg-slate-50 text-center">{isResident ? t('th_period') : `Jumlah Tagihan`}</th>
                    <th className="px-4 py-3 bg-slate-50 text-right">{t('th_total')}</th>
                    <th className="px-4 py-3 bg-slate-50 text-center">{t('th_status')}</th>
                    <th className="px-4 py-3 bg-slate-50 text-center">{t('th_action')}</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                {filteredBills.map((bill) => {
                    const resident = residents.find(r => r.id === bill.residentId);
                    if (!resident) return null;
                    const statusBadge = getStatusBadge(bill);
                    return (
                    <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-black text-slate-800 text-xs uppercase">{resident.houseNo}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-600 text-xs">
                            {isResident ? `${MONTHS[bill.period_month-1]} ${bill.period_year}` : `Rp ${bill.total.toLocaleString()}`}
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-slate-800 text-xs">Rp {bill.total.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-center">
                            <span className={`px-2 py-1 text-[8px] font-black rounded-md uppercase tracking-widest border ${statusBadge.className}`}>
                                {statusBadge.label}
                            </span>
                        </td>
                        <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center space-x-1">
                                <button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"><Eye size={14} /></button>
                                {bill.status === 'UNPAID' ? (
                                    <button onClick={() => openPaymentModal(bill)} className="p-1.5 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20"><Wallet size={14} /></button>
                                ) : (
                                    <button onClick={() => openPaymentModal(bill, true)} className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Edit size={14} /></button>
                                )}
                            </div>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
          </div>
      </div>

      {/* DETAIL MODAL - UPDATED DESIGN TO MATCH THE SCREENSHOT PROVIDED */}
      {showDetailModal && detailBill && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                  {/* Modal Toolbar */}
                  <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white">
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-[11px] flex items-center gap-2">
                        <FileText size={16} className="text-slate-400"/> RINCIAN TAGIHAN
                      </h3>
                      <button onClick={() => setShowDetailModal(false)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={20} /></button>
                  </div>
                  
                  {/* Detailed Invoice Content */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-white" ref={detailRef}>
                      {/* HEADER UNIT & ACCUMULATED TOTAL */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 border-b-2 border-slate-800 pb-6 gap-4">
                          <div className="flex flex-col">
                              <h1 className="text-6xl font-black text-slate-800 tracking-tighter leading-none">
                                  {residents.find(r => r.id === detailBill.residentId)?.houseNo}
                              </h1>
                              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-3 ml-1">
                                  PERIODE: {MONTHS[detailBill.period_month-1].toUpperCase()} {detailBill.period_year}
                              </p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">TOTAL TAGIHAN (AKUMULASI)</p>
                              <p className="text-5xl font-black text-emerald-600 tracking-tight leading-none">
                                  Rp {detailBill.total.toLocaleString()}
                              </p>
                          </div>
                      </div>

                      {/* BREAKDOWN SECTION */}
                      <div className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-sm space-y-6 mb-6">
                          <div className="flex items-center gap-2 text-slate-700 mb-4 border-b border-slate-50 pb-4">
                              <Calendar size={14} className="text-slate-400"/>
                              <h4 className="font-black text-xs uppercase tracking-widest">
                                  TAGIHAN BULAN {MONTHS[detailBill.period_month-1].toUpperCase()}
                              </h4>
                          </div>
                          
                          <div className="space-y-4">
                              <div className="flex justify-between text-[13px] border-b border-dashed border-slate-100 pb-3">
                                  <span className="font-bold text-slate-500 uppercase tracking-tight">IPL</span>
                                  <span className="font-black text-slate-800">Rp {detailBill.ipl_cost.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-[13px] border-b border-dashed border-slate-100 pb-3">
                                  <span className="font-bold text-slate-500 uppercase tracking-tight">Iuran Kas RT</span>
                                  <span className="font-black text-slate-800">Rp {detailBill.kas_rt_cost.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-[13px] border-b border-dashed border-slate-100 pb-3">
                                  <span className="font-bold text-slate-500 uppercase tracking-tight">Abodemen Air</span>
                                  <span className="font-black text-slate-800">Rp {detailBill.abodemen_cost.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-[13px] border-b border-dashed border-slate-100 pb-3">
                                  <span className="font-bold text-slate-500 uppercase tracking-tight">Biaya Air ({detailBill.water_usage}m³)</span>
                                  <span className="font-black text-slate-800">Rp {detailBill.water_cost.toLocaleString()}</span>
                              </div>

                              {/* PERHITUNGAN AIR BOX - MATCHING IMAGE */}
                              {detailBill.water_usage > 0 && (
                                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 mt-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">PERHITUNGAN AIR</p>
                                    <div className="text-[11px] text-slate-500 font-mono font-bold tracking-wider">
                                        {detailBill.water_usage} x {settings.water_rate_low}
                                    </div>
                                </div>
                              )}
                              
                              <div className="pt-6 flex justify-between items-center">
                                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">SUBTOTAL BULAN INI</span>
                                  <span className="text-xl font-black text-slate-800 tracking-tight">
                                      Rp {(detailBill.total - detailBill.arrears).toLocaleString()}
                                  </span>
                              </div>
                          </div>
                      </div>

                      {/* ARREARS BOX - MATCHING IMAGE ROSE STYLE */}
                      {detailBill.arrears > 0 && (
                        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-100 flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-500">
                                    <AlertCircle size={20} />
                                </div>
                                <span className="font-black text-[11px] uppercase tracking-widest text-rose-700">KURANG BAYAR / TUNGGAKAN</span>
                            </div>
                            <span className="font-black text-rose-600 text-2xl tracking-tighter">+ Rp {detailBill.arrears.toLocaleString()}</span>
                        </div>
                      )}

                      {/* TOTAL FINAL BOX - MATCHING IMAGE DARK STYLE */}
                      <div className="p-8 bg-slate-900 text-white rounded-[2rem] flex justify-between items-center shadow-2xl shadow-slate-900/20">
                          <span className="font-black text-[11px] uppercase tracking-[0.25em]">TOTAL YANG HARUS DIBAYAR</span>
                          <span className="font-black text-4xl tracking-tighter">Rp {detailBill.total.toLocaleString()}</span>
                      </div>
                  </div>
                  
                  {/* ACTION BUTTONS */}
                  <div className="p-6 md:px-10 md:pb-10 bg-white border-t border-slate-100 flex flex-wrap sm:flex-nowrap gap-4 shrink-0">
                      <button onClick={() => setShowPrintSettings(true)} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-[1.25rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                          <Printer size={18} /> CETAK
                      </button>
                      <button onClick={() => handleWhatsAppShare(detailBill)} className="flex-1 py-4 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                          <MessageCircle size={18} /> WHATSAPP
                      </button>
                      <button onClick={handleShareImage} disabled={isSharing} className="flex-1 py-4 bg-[#10B981] hover:bg-[#0da673] text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50">
                          {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} GAMBAR
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Billing;
