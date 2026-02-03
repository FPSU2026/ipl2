
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Printer, Share2, Wallet, CreditCard, ChevronDown, FilePlus, Loader2, X, Check, AlertCircle, ImageIcon, Eye, Info, Banknote, Building2, Download, RefreshCw, Plus, Minus, Edit, Trash2, MapPin, Calendar, Droplets, User, FileText, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, Settings, Upload, Image as ImageIcon2, Lock, Filter } from 'lucide-react';
import { MONTHS, DEFAULT_SETTINGS } from '../constants';
import { useApp } from '../context/AppContext';
import { Bill, UserRole } from '../types';
import html2canvas from 'html2canvas';

const Billing: React.FC = () => {
  const navigate = useNavigate();
  const { bills, residents, settings, payBill, updateBill, deleteBill, addNotification, currentUser, bankAccounts, transactions, t } = useApp();
  
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

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Bill>>({});

  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'A5' | 'A4' | 'Custom'>('58mm');
  const [customPaperWidth, setCustomPaperWidth] = useState<string>('75'); 
  const [isSharing, setIsSharing] = useState(false);
  
  const detailRef = useRef<HTMLDivElement>(null);

  const isResident = currentUser?.role === UserRole.RESIDENT;
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPaymentModal(false); setShowPhotoModal(false); setShowDetailModal(false); setShowEditModal(false); setShowPrintSettings(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (paymentMethod === 'TRANSFER' && !selectedBankId) {
        const activeBank = bankAccounts.find(acc => acc.isActive);
        if (activeBank) setSelectedBankId(activeBank.id);
    }
  }, [paymentMethod, bankAccounts, selectedBankId]);

  useEffect(() => {
      if (showEditModal && editFormData) {
          const total = (Number(editFormData.ipl_cost) || 0) + 
                        (Number(editFormData.kas_rt_cost) || 0) + 
                        (Number(editFormData.abodemen_cost) || 0) + 
                        (Number(editFormData.water_cost) || 0) + 
                        (Number(editFormData.extra_cost) || 0) + 
                        (Number(editFormData.arrears) || 0);
          setEditFormData(prev => ({ ...prev, total }));
      }
  }, [editFormData.ipl_cost, editFormData.kas_rt_cost, editFormData.abodemen_cost, editFormData.water_cost, editFormData.extra_cost, editFormData.arrears, showEditModal]);

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
        if (isResident && bill.residentId !== currentUser.residentId) return false;
        if (!isResident) {
            if (bill.period_month !== selectedPeriod.month || bill.period_year !== selectedPeriod.year) return false;
        }
        const resident = residents.find(r => r.id === bill.residentId);
        if (!resident) return false;
        if (filterRT !== 'ALL' && resident.rt !== filterRT) return false;
        const matchesSearch = resident.name.toLowerCase().includes(searchTerm.toLowerCase()) || resident.houseNo.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        if (statusFilter !== 'ALL') {
            const paidAmount = bill.paid_amount || 0;
            const diff = bill.total - paidAmount;
            if (statusFilter === 'UNPAID') return bill.status === 'UNPAID';
            if (statusFilter === 'PAID') return bill.status === 'PAID';
            if (statusFilter === 'OVERPAID') return bill.status === 'PAID' && diff < 0;
            if (statusFilter === 'UNDERPAID') return bill.status === 'PAID' && diff > 0;
        }
        return true;
    }).sort((a, b) => {
        if (a.status !== b.status) return a.status === 'UNPAID' ? -1 : 1;
        if (a.period_year !== b.period_year) return b.period_year - a.period_year;
        return b.period_month - a.period_month;
    });
  }, [bills, residents, isResident, currentUser, selectedPeriod, filterRT, searchTerm, statusFilter]);

  const totalFilteredAmount = useMemo(() => {
      return filteredBills.reduce((acc, bill) => acc + (bill.status === 'PAID' ? (bill.paid_amount || 0) : bill.total), 0);
  }, [filteredBills]);

  const handleDeleteBill = async (id: string) => {
      if (window.confirm("Apakah Anda yakin ingin MENGHAPUS data tagihan ini?")) await deleteBill(id);
  };

  const handleEditBill = (bill: Bill) => {
      setEditingBill(bill);
      setEditFormData({ ipl_cost: bill.ipl_cost, kas_rt_cost: bill.kas_rt_cost, abodemen_cost: bill.abodemen_cost, water_cost: bill.water_cost, extra_cost: bill.extra_cost, arrears: bill.arrears, total: bill.total });
      setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
      if (!editingBill) return;
      const updatedBill: Bill = { ...editingBill, ...editFormData } as Bill;
      await updateBill(updatedBill);
      setShowEditModal(false);
      setEditingBill(null);
  };

  const handlePrintReceipt = (bill: Bill) => {
    const resident = residents.find(r => r.id === bill.residentId);
    if (!resident) return;
    let cssPageRule = '';
    let bodyWidth = '';
    let fontSize = '12px';
    switch(paperSize) {
        case '58mm': cssPageRule = '@page { size: 58mm auto; margin: 0mm; }'; bodyWidth = 'width: 58mm;'; fontSize = '10px'; break;
        case '80mm': cssPageRule = '@page { size: 80mm auto; margin: 0mm; }'; bodyWidth = 'width: 80mm;'; fontSize = '11px'; break;
        case 'A5': cssPageRule = '@page { size: A5 landscape; margin: 10mm; }'; bodyWidth = 'width: 100%;'; fontSize = '12px'; break;
        case 'A4': cssPageRule = '@page { size: A4; margin: 20mm; }'; bodyWidth = 'width: 100%;'; fontSize = '12px'; break;
        case 'Custom': const safeWidth = customPaperWidth || '75'; cssPageRule = `@page { size: ${safeWidth}mm auto; margin: 0mm; }`; bodyWidth = `width: ${safeWidth}mm;`; fontSize = '12px'; break;
    }
    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;
    const monthName = MONTHS[bill.period_month - 1];
    const paidAmount = bill.paid_amount || 0;
    const diff = paidAmount - bill.total;
    let diffHtml = diff > 0 ? `<tr><td style="padding-top:5px; font-weight:bold;">KEMBALI/DEPOSIT</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp ${diff.toLocaleString()}</td></tr>` : diff < 0 ? `<tr><td style="padding-top:5px; font-weight:bold;">KURANG BAYAR</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp ${Math.abs(diff).toLocaleString()}</td></tr>` : `<tr><td style="padding-top:5px; font-weight:bold;">KEMBALI</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp 0</td></tr>`;
    const formattedPaidDate = bill.paid_at ? new Date(bill.paid_at).toLocaleDateString('id-ID') : '-';
    const htmlContent = `<html><head><title>Kwitansi</title><style>${cssPageRule} body { font-family: monospace; padding: 10px; font-size: ${fontSize}; margin: 0; } .container { ${bodyWidth} margin: 0 auto; } table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: 2px 0; } .line { border-top: 1px dashed black; margin: 5px 0; } .double-line { border-top: 2px solid black; margin: 5px 0; } .text-right { text-align: right; } .text-center { text-align: center; } .bold { font-weight: bold; }</style></head><body onload="window.print(); setTimeout(function(){window.close();}, 1000);"><div class="container"><div class="text-center"><b style="font-size: 1.2em;">KWITANSI PEMBAYARAN</b><br/><b>KOMPLEK ${settings.location_name}</b></div><br/><table><tr><td style="width: 70px;">No. Rumah</td><td>: ${resident.houseNo}</td></tr><tr><td>Periode</td><td>: ${monthName} ${bill.period_year}</td></tr><tr><td>Tgl Bayar</td><td>: ${formattedPaidDate}</td></tr></table><div class="double-line"></div><b>RINCIAN TAGIHAN</b><div class="line"></div><table><tr><td>IPL</td><td class="text-right">Rp ${bill.ipl_cost.toLocaleString()}</td></tr><tr><td>Kas RT</td><td class="text-right">Rp ${bill.kas_rt_cost.toLocaleString()}</td></tr><tr><td>Abodemen</td><td class="text-right">Rp ${bill.abodemen_cost.toLocaleString()}</td></tr><tr><td>Air (${bill.water_usage} m³)</td><td class="text-right">Rp ${(bill.water_cost || 0).toLocaleString()}</td></tr>${(bill.extra_cost > 0) ? `<tr><td>Biaya Lain</td><td class="text-right">Rp ${bill.extra_cost.toLocaleString()}</td></tr>` : ''}${(bill.arrears > 0) ? `<tr><td>Tunggakan Lalu</td><td class="text-right">Rp ${bill.arrears.toLocaleString()}</td></tr>` : ''}</table><div class="line"></div><table><tr><td class="bold">SUB TOTAL</td><td class="text-right bold">Rp ${bill.total.toLocaleString()}</td></tr></table><div class="double-line"></div><table><tr><td class="bold">DIBAYARKAN</td><td class="text-right bold">Rp ${paidAmount.toLocaleString()}</td></tr>${diffHtml}</table><br/><p class="text-center">Terima Kasih</p></div></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setShowPrintSettings(false);
  };

  const openPaymentModal = (bill: Bill, isEdit: boolean = false) => {
    setSelectedBill(bill); setPaymentAmount(isEdit ? (bill.paid_amount || 0).toString() : bill.total.toString()); setPaymentMethod('CASH'); setSelectedBankId(''); setPaymentProof(bill.photo_url || null); setPaymentDate(isEdit && bill.paid_at ? new Date(bill.paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]); setIsEditMode(isEdit); setShowDetailModal(false); setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    if (isResident && paymentMethod === 'TRANSFER' && !paymentProof) { addNotification("Wajib lampirkan bukti pembayaran!", "error"); return; }
    await payBill(selectedBill.id, parseInt(paymentAmount), paymentMethod, selectedBankId, paymentProof || undefined, undefined, isEditMode, paymentDate, 'PENERIMAAN TAGIHAN');
    setShowPaymentModal(false);
  };

  const getStatusBadge = (bill: Bill) => {
      if (bill.status === 'UNPAID') return { label: t('status_unpaid'), className: 'bg-rose-50 text-rose-600 border-rose-100' };
      const diff = (bill.paid_amount || 0) - bill.total;
      if (diff > 0) return { label: `DEPOSIT (+Rp ${diff.toLocaleString()})`, className: 'bg-blue-50 text-blue-600 border-blue-100' };
      if (diff < 0) return { label: `KURANG (-Rp ${Math.abs(diff).toLocaleString()})`, className: 'bg-amber-50 text-amber-600 border-amber-100' };
      return { label: t('status_paid'), className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0">
        <div>
           <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">{t('bill_title')}</h2>
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
               {isResident ? t('bill_history') : `Manajemen Iuran & Keuangan`}
           </p>
        </div>
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          {/* COMPACT FILTER BAR - Sejajar */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row gap-3 justify-between items-center shrink-0">
            <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                <div className="relative w-full sm:w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder={t('search_unit')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" />
                </div>
                {!isResident && (
                    <>
                        <div className="relative w-32">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                            <select value={filterRT} onChange={(e) => setFilterRT(e.target.value)} className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black appearance-none cursor-pointer">
                                <option value="ALL">Semua RT</option>
                                {settings.rtList.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center space-x-1.5 bg-white py-1 px-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <Calendar size={12} className="text-slate-300 ml-1" />
                            <select className="bg-transparent px-1 py-0.5 outline-none text-[10px] font-black text-slate-700 cursor-pointer" value={selectedPeriod.month} onChange={(e) => setSelectedPeriod({...selectedPeriod, month: parseInt(e.target.value)})}>
                                {MONTHS.map((m, i) => (<option key={i} value={i+1}>{m}</option>))}
                            </select>
                            <div className="w-[1px] h-3 bg-slate-200"></div>
                            <span className="px-1 text-[10px] font-black text-slate-700">{selectedPeriod.year}</span>
                        </div>
                    </>
                )}
                
                <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 flex flex-col justify-center min-w-[120px]">
                    <p className="text-[7px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-0.5">TOTAL TERFILTER</p>
                    <p className="text-[11px] font-black text-emerald-700 leading-none">Rp {totalFilteredAmount.toLocaleString('id-ID')}</p>
                </div>
            </div>

            <div className="flex gap-1.5 w-full xl:w-auto overflow-x-auto pb-0.5 justify-end">
                {['ALL', 'UNPAID', 'PAID'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s as any)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${statusFilter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200'}`}>{s === 'ALL' ? 'Semua' : s === 'PAID' ? 'Lunas' : 'Belum'}</button>
                ))}
            </div>
          </div>

          <div className="overflow-auto flex-1 relative bg-slate-50/20 sticky-header">
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <tr>
                    <th className="px-5 py-3.5">{t('th_house')}</th>
                    <th className="px-5 py-3.5 text-center">{isResident ? t('th_period') : `Iuran Dasar`}</th>
                    <th className="px-5 py-3.5 text-right">{t('th_total')}</th>
                    <th className="px-5 py-3.5 text-center">{t('th_status')}</th>
                    <th className="px-5 py-3.5 text-center">{t('th_action')}</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                {filteredBills.length > 0 ? (
                    filteredBills.map((bill) => {
                        const resident = residents.find(r => r.id === bill.residentId);
                        if (!resident) return null;
                        const statusBadge = getStatusBadge(bill);
                        const isFutureBill = bill.period_year > currentRealYear || (bill.period_year === currentRealYear && bill.period_month > currentRealMonth);
                        return (
                        <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3.5"><span className="font-black text-slate-800 text-xs uppercase">{resident.houseNo}</span></td>
                            <td className="px-5 py-3.5 text-center"><span className="font-bold text-slate-500 text-[11px]">{isResident ? `${MONTHS[bill.period_month-1]} ${bill.period_year}` : `Rp ${(bill.total - bill.arrears).toLocaleString()}`}</span></td>
                            <td className="px-5 py-3.5 text-right"><div className="font-black text-slate-800 text-xs">Rp {(bill.status === 'PAID' ? bill.paid_amount! : bill.total).toLocaleString()}</div>{bill.arrears !== 0 && (<div className={`text-[8px] font-black uppercase ${bill.arrears > 0 ? 'text-rose-500' : 'text-blue-500'}`}>{bill.arrears > 0 ? 'Tunggakan' : 'Deposit'}: Rp {Math.abs(bill.arrears).toLocaleString()}</div>)}</td>
                            <td className="px-5 py-3.5 text-center"><span className={`px-2 py-0.5 text-[8px] font-black rounded-md uppercase tracking-tighter border ${statusBadge.className}`}>{statusBadge.label}</span></td>
                            <td className="px-5 py-3.5"><div className="flex items-center justify-center gap-1.5"><button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"><Eye size={14} /></button>{bill.status === 'UNPAID' ? (<>{!isResident && (<button onClick={() => handleEditBill(bill)} className="p-1.5 bg-blue-50 text-blue-500 rounded-lg"><Edit size={14} /></button>)}{isFutureBill ? (<button disabled className="p-1.5 bg-slate-50 text-slate-300 rounded-lg cursor-not-allowed"><Lock size={14} /></button>) : (<button onClick={() => openPaymentModal(bill)} className="p-1.5 bg-emerald-500 text-white rounded-lg shadow-sm"><Wallet size={14} /></button>)}</>) : (<><button onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} className="p-1.5 bg-blue-50 text-blue-500 rounded-lg"><Printer size={14} /></button><button onClick={() => openPaymentModal(bill, true)} disabled={(bill.payment_edit_count || 0) >= 1} className={`p-1.5 rounded-lg ${(bill.payment_edit_count || 0) >= 1 ? 'bg-slate-50 text-slate-200' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}><Edit size={14} /></button></>)}</div></td>
                        </tr>
                        );
                    })
                ) : (
                    <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-300 text-xs italic">Data tidak ditemukan</td></tr>
                )}
                </tbody>
            </table>
          </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && detailBill && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-auto max-h-[85vh] animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100 bg-white">
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-2"><FileText size={14}/> Rincian Tagihan</h3>
                      <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400"><X size={16} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-0 bg-white custom-scrollbar">
                      <div ref={detailRef} className="bg-white p-6">
                          <div className="flex justify-between items-start gap-4 border-b-2 border-slate-800 pb-3 mb-4">
                              <h1 className="text-3xl font-black text-slate-800 tracking-tighter leading-none uppercase">{residents.find(r => r.id === detailBill.residentId)?.houseNo}</h1>
                              <div className="text-right">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{MONTHS[detailBill.period_month - 1]} {detailBill.period_year}</p>
                                  <p className="text-xl font-black text-slate-800 tracking-tight">Rp {detailBill.total.toLocaleString()}</p>
                              </div>
                          </div>
                          <div className="space-y-2 text-[11px]">
                              {[
                                  { label: 'IPL (Kebersihan & Keamanan)', val: detailBill.ipl_cost },
                                  { label: 'Kas RT', val: detailBill.kas_rt_cost },
                                  { label: 'Abodemen Air', val: detailBill.abodemen_cost },
                                  { label: `Biaya Air (${detailBill.water_usage}m³)`, val: detailBill.water_cost },
                                  { label: 'Lain-lain', val: detailBill.extra_cost },
                                  { label: 'Tunggakan', val: detailBill.arrears, color: 'text-rose-600' }
                              ].filter(i => i.val !== 0).map((i, idx) => (
                                  <div key={idx} className={`flex justify-between items-center border-b border-dashed border-slate-100 pb-1 ${i.color || 'text-slate-600'}`}>
                                      <span className="font-bold">{i.label}</span>
                                      <span className="font-black">Rp {i.val.toLocaleString()}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
                    {isResident && detailBill.status === 'UNPAID' ? (<button onClick={() => openPaymentModal(detailBill)} className="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">BAYAR SEKARANG</button>) : (<><button onClick={() => setShowPrintSettings(true)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest">Cetak Kwitansi</button><button onClick={() => addNotification("Pindahkan gambar ke WA secara manual", "info")} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md">Bagikan WA</button></>)}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Billing;
