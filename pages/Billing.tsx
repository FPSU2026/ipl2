
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Printer, Share2, Wallet, CreditCard, ChevronDown, FilePlus, Loader2, X, Check, AlertCircle, ImageIcon, Eye, Info, Banknote, Building2, Download, RefreshCw, Plus, Minus, Edit, Trash2, MapPin, Calendar, Droplets, User, FileText, ArrowRight, CheckCircle2, AlertTriangle, AlertOctagon, Settings, Upload, Image as ImageIcon2, Lock } from 'lucide-react';
import { MONTHS, DEFAULT_SETTINGS } from '../constants';
import { useApp } from '../context/AppContext';
import { Bill, UserRole } from '../types';
import html2canvas from 'html2canvas';

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

  // AUTO SELECT BANK ACCOUNT WHEN TRANSFER IS CHOSEN
  useEffect(() => {
    if (paymentMethod === 'TRANSFER' && !selectedBankId) {
        const activeBank = bankAccounts.find(acc => acc.isActive);
        if (activeBank) {
            setSelectedBankId(activeBank.id);
        }
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

  const handleDeleteBill = async (id: string) => {
      if (window.confirm("Apakah Anda yakin ingin MENGHAPUS data tagihan ini?")) {
          await deleteBill(id);
      }
  };

  const handleEditBill = (bill: Bill) => {
      setEditingBill(bill);
      setEditFormData({
          ipl_cost: bill.ipl_cost, kas_rt_cost: bill.kas_rt_cost, abodemen_cost: bill.abodemen_cost, water_cost: bill.water_cost, extra_cost: bill.extra_cost, arrears: bill.arrears, total: bill.total
      });
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
        case '58mm':
            cssPageRule = '@page { size: 58mm auto; margin: 0mm; }';
            bodyWidth = 'width: 58mm;';
            fontSize = '10px';
            break;
        case '80mm':
            cssPageRule = '@page { size: 80mm auto; margin: 0mm; }';
            bodyWidth = 'width: 80mm;';
            fontSize = '11px';
            break;
        case 'A5':
            cssPageRule = '@page { size: A5 landscape; margin: 10mm; }';
            bodyWidth = 'width: 100%;';
            fontSize = '12px';
            break;
        case 'A4':
            cssPageRule = '@page { size: A4; margin: 20mm; }';
            bodyWidth = 'width: 100%;';
            fontSize = '12px';
            break;
        case 'Custom':
            const safeWidth = customPaperWidth || '75';
            cssPageRule = `@page { size: ${safeWidth}mm auto; margin: 0mm; }`;
            bodyWidth = `width: ${safeWidth}mm;`;
            fontSize = '12px';
            break;
    }

    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;
    const monthName = MONTHS[bill.period_month - 1];
    const paidAmount = bill.paid_amount || 0;
    const diff = paidAmount - bill.total;
    
    let diffHtml = "";
    if (diff > 0) diffHtml = `<tr><td style="padding-top:5px; font-weight:bold;">KEMBALI/DEPOSIT</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp ${diff.toLocaleString()}</td></tr>`;
    else if (diff < 0) diffHtml = `<tr><td style="padding-top:5px; font-weight:bold;">KURANG BAYAR</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp ${Math.abs(diff).toLocaleString()}</td></tr>`;
    else diffHtml = `<tr><td style="padding-top:5px; font-weight:bold;">KEMBALI</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp 0</td></tr>`;

    const formattedPaidDate = bill.paid_at ? new Date(bill.paid_at).toLocaleDateString('id-ID') : '-';

    const htmlContent = `<html><head><title>Cetak Kwitansi</title><style>${cssPageRule} body { font-family: monospace; padding: 10px; font-size: ${fontSize}; margin: 0; } .container { ${bodyWidth} margin: 0 auto; } table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: 2px 0; } .line { border-top: 1px dashed black; margin: 5px 0; } .double-line { border-top: 2px solid black; margin: 5px 0; } .text-right { text-align: right; } .text-center { text-align: center; } .bold { font-weight: bold; }</style></head><body onload="window.print(); setTimeout(function(){window.close();}, 1000);"><div class="container"><div class="text-center"><b style="font-size: 1.2em;">KWITANSI PEMBAYARAN</b><br/><b>KOMPLEK ${settings.location_name}</b></div><br/><table><tr><td style="width: 70px;">No. Rumah</td><td>: ${resident.houseNo}</td></tr><tr><td>Periode</td><td>: ${monthName} ${bill.period_year}</td></tr><tr><td>Tgl Bayar</td><td>: ${formattedPaidDate}</td></tr></table><div class="double-line"></div><b>RINCIAN TAGIHAN</b><div class="line"></div><table><tr><td>IPL</td><td class="text-right">Rp ${bill.ipl_cost.toLocaleString()}</td></tr><tr><td>Kas RT</td><td class="text-right">Rp ${bill.kas_rt_cost.toLocaleString()}</td></tr><tr><td>Abodemen</td><td class="text-right">Rp ${bill.abodemen_cost.toLocaleString()}</td></tr><tr><td>Air (${bill.water_usage} m³)</td><td class="text-right">Rp ${(bill.water_cost || 0).toLocaleString()}</td></tr>${(bill.extra_cost > 0) ? `<tr><td>Biaya Lain</td><td class="text-right">Rp ${bill.extra_cost.toLocaleString()}</td></tr>` : ''}${(bill.arrears > 0) ? `<tr><td>Tunggakan Lalu</td><td class="text-right">Rp ${bill.arrears.toLocaleString()}</td></tr>` : ''}</table><div class="line"></div><table><tr><td class="bold">SUB TOTAL</td><td class="text-right bold">Rp ${bill.total.toLocaleString()}</td></tr></table><div class="double-line"></div><table><tr><td class="bold">DIBAYARKAN</td><td class="text-right bold">Rp ${paidAmount.toLocaleString()}</td></tr>${diffHtml}</table><br/><p class="text-center">Terima Kasih</p><p class="text-center" style="font-size: 0.8em; color: #555;">Dicetak oleh: ${currentUser?.username || 'Admin'}</p></div></body></html>`;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setShowPrintSettings(false);
  };

  const handleShareImage = async () => {
    if (!detailRef.current || !detailBill) return;
    const resident = residents.find(r => r.id === detailBill.residentId);
    if (!resident) return;

    setIsSharing(true);
    try {
        const canvas = await html2canvas(detailRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) { addNotification("Gagal membuat gambar.", "error"); return; }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile && navigator.share && navigator.canShare) {
            const fileName = `Tagihan_${resident.houseNo}_${MONTHS[detailBill.period_month - 1]}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
                try { await navigator.share({ files: [file], title: 'Rincian Tagihan', text: `Tagihan ${MONTHS[detailBill.period_month - 1]} ${detailBill.period_year} - ${resident.houseNo}` }); addNotification("Berhasil membagikan gambar.", "success"); return; } 
                catch (err) { if ((err as any).name !== 'AbortError') { downloadAndOpenWA(blob, resident); } }
            } else downloadAndOpenWA(blob, resident);
        } else downloadAndOpenWA(blob, resident);
    } catch (e) { addNotification("Gagal memproses gambar.", "error"); } finally { setIsSharing(false); }
  };

  const downloadAndOpenWA = (blob: Blob, resident: any) => {
      if (!detailBill) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Tagihan_${resident.houseNo}_${MONTHS[detailBill.period_month - 1]}_${detailBill.period_year}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      let phoneClean = (resident.phone || '').trim().replace(/\D/g, ''); 
      if (phoneClean.startsWith('0')) phoneClean = '62' + phoneClean.slice(1);
      const text = `Halo Bapak/Ibu Warga Unit ${resident.houseNo}.\nBerikut dilampirkan rincian tagihan bulan ${MONTHS[detailBill.period_month - 1]} ${detailBill.period_year}.\n\n(Mohon lampirkan gambar tagihan yang baru saja terunduh)`;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      window.open(isMobile ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}` : `https://web.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(text)}`, '_blank');
      addNotification("Gambar telah diunduh. Silakan paste/lampirkan di WhatsApp.", "info");
  };

  const openPaymentModal = (bill: Bill, isEdit: boolean = false) => {
    setSelectedBill(bill);
    setPaymentAmount(isEdit ? (bill.paid_amount || 0).toString() : bill.total.toString());
    setPaymentMethod('CASH');
    setSelectedBankId('');
    setPaymentProof(bill.photo_url || null);
    const initialDate = isEdit && bill.paid_at ? new Date(bill.paid_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    setPaymentDate(initialDate);
    setIsEditMode(isEdit);
    setShowDetailModal(false);
    setShowPaymentModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => { if (event.target?.result) setPaymentProof(event.target.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;
    if (isResident && paymentMethod === 'TRANSFER' && !paymentProof) { addNotification("Wajib melampirkan foto bukti pembayaran!", "error"); return; }
    const amount = parseInt(paymentAmount);
    await payBill(selectedBill.id, amount, paymentMethod, selectedBankId, paymentProof || undefined, undefined, isEditMode, paymentDate);
    setShowPaymentModal(false);
  };

  const getStatusBadge = (bill: Bill) => {
      if (bill.status === 'UNPAID') return { label: t('status_unpaid'), className: 'bg-rose-50 text-rose-600 border-rose-100' };
      const paid = bill.paid_amount || 0;
      const total = bill.total;
      const diff = paid - total;
      if (diff > 0) return { label: `KEMBALI / DEPOSIT (+Rp ${diff.toLocaleString('id-ID')})`, className: 'bg-blue-50 text-blue-600 border-blue-100' };
      else if (diff < 0) return { label: `KURANG BAYAR (-Rp ${Math.abs(diff).toLocaleString('id-ID')})`, className: 'bg-amber-50 text-amber-600 border-amber-100' };
      else return { label: t('status_paid'), className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-0 flex flex-col h-[calc(100vh-120px)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 shrink-0">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t('bill_title')}</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
               {isResident ? t('bill_history') : `${t('bill_period_data')}: ${MONTHS[selectedPeriod.month-1]} ${selectedPeriod.year}`}
           </p>
        </div>
        {!isResident && (
            <div className="flex items-center space-x-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                <select className="bg-transparent px-3 py-2 outline-none text-sm font-black text-slate-700 cursor-pointer" value={selectedPeriod.month} onChange={(e) => setSelectedPeriod({...selectedPeriod, month: parseInt(e.target.value)})}>
                    {MONTHS.map((m, i) => (<option key={i} value={i+1}>{m}</option>))}
                </select>
                <div className="w-[1px] h-6 bg-slate-200"></div>
                <span className="px-3 py-2 text-sm font-black text-slate-700">{selectedPeriod.year}</span>
            </div>
        )}
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row gap-4 justify-between items-center shrink-0">
            <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input type="text" placeholder={t('search_unit')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" />
                </div>
            </div>
            <div className="flex gap-2 w-full xl:w-auto overflow-x-auto pb-1 md:pb-0">
                {['ALL', 'UNPAID', 'PAID'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s as any)} className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border whitespace-nowrap transition-all ${statusFilter === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border-slate-200'}`}>{s === 'ALL' ? t('status_all') : s === 'PAID' ? t('status_paid') : t('status_unpaid')}</button>
                ))}
            </div>
          </div>

          <div className="overflow-auto flex-1 relative bg-slate-50/30">
            <table className="w-full text-left hidden md:table">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-20 shadow-sm">
                <tr>
                    <th className="px-6 py-5 bg-slate-50">{t('th_house')}</th>
                    <th className="px-6 py-5 bg-slate-50 text-center">{isResident ? t('th_period') : `${t('th_bill_month')} ${MONTHS[selectedPeriod.month-1]}`}</th>
                    <th className="px-6 py-5 bg-slate-50 text-right">{t('th_total')}</th>
                    <th className="px-6 py-5 bg-slate-50 text-center">{t('th_status')}</th>
                    <th className="px-6 py-5 bg-slate-50 text-center">{t('th_action')}</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                {filteredBills.length > 0 ? (
                    filteredBills.map((bill) => {
                        const resident = residents.find(r => r.id === bill.residentId);
                        if (!resident) return null;
                        const statusBadge = getStatusBadge(bill);
                        const editCount = bill.payment_edit_count || 0;
                        const displayTotal = bill.status === 'PAID' ? (bill.paid_amount || 0) : bill.total;
                        const isFutureBill = bill.period_year > currentRealYear || (bill.period_year === currentRealYear && bill.period_month > currentRealMonth);
                        return (
                        <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-5"><span className="font-black text-slate-800 text-sm uppercase">{resident.houseNo}</span></td>
                            <td className="px-6 py-5 text-center font-bold text-slate-600 text-sm">{isResident ? (<span>{MONTHS[bill.period_month - 1]} {bill.period_year}</span>) : (<span>Rp {(bill.total - bill.arrears).toLocaleString()}</span>)}</td>
                            <td className="px-6 py-5 text-right"><div className="font-black text-slate-800 text-sm">Rp {displayTotal.toLocaleString()}</div>{bill.arrears > 0 && (<div className="text-[9px] font-black text-rose-500 uppercase">{t('cost_arrears')}: Rp {bill.arrears.toLocaleString()}</div>)}{bill.arrears < 0 && (<div className="text-[9px] font-black text-blue-500 uppercase">Deposit: Rp {Math.abs(bill.arrears).toLocaleString()}</div>)}</td>
                            <td className="px-6 py-5 text-center"><span className={`px-3 py-1.5 text-[9px] font-black rounded-lg uppercase tracking-widest border ${statusBadge.className}`}>{statusBadge.label}</span></td>
                            <td className="px-6 py-5"><div className="flex items-center justify-center space-x-2"><button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors" title="Lihat Detail"><Eye size={16} /></button>{bill.status === 'UNPAID' ? (<>{!isResident && (<button onClick={() => handleEditBill(bill)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors" title="Ubah Rincian"><Edit size={16} /></button>)}{isFutureBill ? (<button disabled className="p-2 bg-slate-100 text-slate-400 rounded-xl cursor-not-allowed"><Lock size={16} /></button>) : (<button onClick={() => openPaymentModal(bill)} className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20" title="Bayar"><Wallet size={16} /></button>)}{!isResident && (<button onClick={() => handleDeleteBill(bill.id)} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors" title="Hapus Tagihan"><Trash2 size={16}/></button>)}</>) : (<><button onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-xl" title="Cetak"><Printer size={16} /></button><button onClick={() => openPaymentModal(bill, true)} disabled={editCount >= 1} className={`p-2 rounded-xl transition-colors ${editCount >= 1 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`} title="Ubah Pembayaran"><Edit size={16} /></button></>)}</div></td>
                        </tr>
                        );
                    })
                ) : (
                    <tr><td colSpan={5} className="px-6 py-20 text-center"><div className="flex flex-col items-center justify-center opacity-30"><FilePlus size={48} className="text-slate-400 mb-4" /><p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">{statusFilter === 'PAID' ? "Belum ada yang melunasi tagihan" : "Tidak ada data tagihan untuk periode ini"}</p></div></td></tr>
                )}
                </tbody>
            </table>

            <div className="md:hidden p-4 space-y-4">
                {filteredBills.length > 0 ? (
                    filteredBills.map((bill) => {
                        const resident = residents.find(r => r.id === bill.residentId);
                        if (!resident) return null;
                        const statusBadge = getStatusBadge(bill);
                        const editCount = bill.payment_edit_count || 0;
                        const displayTotal = bill.status === 'PAID' ? (bill.paid_amount || 0) : bill.total;
                        const isFutureBill = bill.period_year > currentRealYear || (bill.period_year === currentRealYear && bill.period_month > currentRealMonth);
                        return (
                            <div key={bill.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div><span className="font-black text-slate-800 text-lg">{resident.houseNo}</span>{isResident && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{MONTHS[bill.period_month - 1]} {bill.period_year}</p>}</div>
                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusBadge.className}`}>{statusBadge.label}</span>
                                </div>
                                <div className="mb-4"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('th_total')}</p><div className="flex items-baseline gap-2"><span className="text-2xl font-black text-slate-800">Rp {displayTotal.toLocaleString()}</span>{bill.status === 'PAID' && bill.total !== displayTotal && (<span className="text-[10px] text-slate-400 line-through">Rp {bill.total.toLocaleString()}</span>)}</div>{bill.arrears > 0 && (<p className="text-[9px] font-bold text-rose-500 uppercase mt-1">{t('cost_arrears')}: Rp {bill.arrears.toLocaleString()}</p>)}{bill.arrears < 0 && (<p className="text-[9px] font-bold text-blue-500 uppercase mt-1">Deposit: Rp {Math.abs(bill.arrears).toLocaleString()}</p>)}</div>
                                <div className="grid grid-cols-4 gap-2 border-t border-slate-50 pt-4"><button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="col-span-1 py-3 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-100"><Eye size={18} /></button>{bill.status === 'UNPAID' ? (<>{!isResident && (<button onClick={() => handleEditBill(bill)} className="col-span-1 py-3 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-100"><Edit size={18} /></button>)}{isFutureBill ? (<button disabled className={`${isResident ? 'col-span-3' : 'col-span-2'} py-3 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed font-bold text-xs uppercase tracking-widest`}><Lock size={16} /> Locked</button>) : (<button onClick={() => openPaymentModal(bill)} className={`${isResident ? 'col-span-3' : 'col-span-2'} py-3 bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest`}><Wallet size={16} /> {t('btn_pay_now')}</button>)}</>) : (<><button onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} className="col-span-2 py-3 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest"><Printer size={16} /> {t('btn_print')}</button><button onClick={() => openPaymentModal(bill, true)} disabled={editCount >= 1} className={`col-span-1 py-3 rounded-xl flex items-center justify-center ${editCount >= 1 ? 'bg-slate-100 text-slate-300' : 'bg-amber-50 text-amber-600'}`}><Edit size={18} /></button></>)}</div>{!isResident && bill.status === 'UNPAID' && !isFutureBill && (<button onClick={() => handleDeleteBill(bill.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>)}
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 opacity-30"><FilePlus size={48} className="text-slate-400 mb-4" /><p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 text-center">{statusFilter === 'PAID' ? "Belum ada yang melunasi tagihan" : "Tidak ada data tagihan untuk periode ini"}</p></div>
                )}
            </div>
          </div>
      </div>

      {showDetailModal && detailBill && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4 sm:p-6">
              <div className="bg-white rounded-3xl shadow-2xl w-[90%] md:w-[70%] max-w-3xl overflow-hidden flex flex-col h-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2"><FileText size={16} className="text-slate-400"/> {t('modal_detail_title')}</h3>
                      <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={18} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-0 bg-white custom-scrollbar min-h-0 relative">
                      <div ref={detailRef} className="bg-white px-6 py-6 relative overflow-hidden">
                          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-4 border-b-2 border-slate-800 pb-4 mb-4">
                              <div className="flex-1"><div className="flex items-baseline gap-3"><h1 className="text-4xl font-black text-slate-800 tracking-tighter leading-none">{residents.find(r => r.id === detailBill.residentId)?.houseNo}</h1><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{MONTHS[detailBill.period_month - 1]} {detailBill.period_year}</span></div></div>
                              <div className="text-right"><p className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">Rp {detailBill.total.toLocaleString()}</p></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                              <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1"><span className="font-bold text-slate-600">{t('cost_ipl')}</span><span className="font-black text-slate-800">Rp {detailBill.ipl_cost.toLocaleString()}</span></div>
                              <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1"><span className="font-bold text-slate-600">{t('cost_kas')}</span><span className="font-black text-slate-800">Rp {detailBill.kas_rt_cost.toLocaleString()}</span></div>
                              <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1"><span className="font-bold text-slate-600">{t('cost_abodemen')}</span><span className="font-black text-slate-800">Rp {detailBill.abodemen_cost.toLocaleString()}</span></div>
                              <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1"><span className="font-bold text-slate-600">{t('cost_water')} ({detailBill.water_usage}m³)</span><span className="font-black text-slate-800">Rp {detailBill.water_cost.toLocaleString()}</span></div>
                              {detailBill.water_usage > 0 && (
                                <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100 my-2">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-200 pb-1">RINCIAN PERHITUNGAN BIAYA PEMAKAIAN AIR</p>
                                    <div className="flex justify-between text-[10px] text-slate-600 mb-1"><span>{detailBill.water_usage > (settings.water_rate_threshold || 10) ? `Tarif \u2264 ${settings.water_rate_threshold || 10} m³ : ${settings.water_rate_threshold || 10} x Rp ${settings.water_rate_low.toLocaleString()}` : `Tarif \u2264 ${settings.water_rate_threshold || 10} m³ : ${detailBill.water_usage} x Rp ${settings.water_rate_low.toLocaleString()}`}</span><span className="font-mono font-bold">Rp {(Math.min(detailBill.water_usage, (settings.water_rate_threshold || 10)) * settings.water_rate_low).toLocaleString()}</span></div>
                                    {detailBill.water_usage > (settings.water_rate_threshold || 10) && (<div className="flex justify-between text-[10px] text-slate-600"><span>{`Tarif > ${settings.water_rate_threshold || 10} m³ : (${detailBill.water_usage - (settings.water_rate_threshold || 10)}) x Rp ${settings.water_rate_high.toLocaleString()}`}</span><span className="font-mono font-bold">Rp {((detailBill.water_usage - (settings.water_rate_threshold || 10)) * settings.water_rate_high).toLocaleString()}</span></div>)}
                                </div>
                              )}
                              {detailBill.extra_cost > 0 && (<div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1"><span className="font-bold text-slate-600">{t('cost_extra')}</span><span className="font-black text-slate-800">Rp {detailBill.extra_cost.toLocaleString()}</span></div>)}
                              {detailBill.arrears > 0 && (<div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1 text-rose-600"><span className="font-bold">{t('cost_arrears')}</span><span className="font-black">Rp {detailBill.arrears.toLocaleString()}</span></div>)}
                          </div>
                          {detailBill.photo_url && (<div className="mt-6 border-t-2 border-slate-100 pt-4"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('lbl_proof')}</p><img src={detailBill.photo_url} alt="Bukti Bayar" className="max-h-40 rounded-xl border border-slate-200 shadow-sm" /></div>)}
                      </div>
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0 z-10">{isResident && detailBill.status === 'UNPAID' ? (<button onClick={() => openPaymentModal(detailBill)} className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"><Wallet size={16} /> {t('btn_pay_now')}</button>) : (<>{isResident && (<div className="w-full py-4 bg-slate-100 text-emerald-600 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"><CheckCircle2 size={16} /> {t('status_paid')}</div>)}{!isResident && (<><button onClick={() => { setShowDetailModal(false); setShowPrintSettings(true); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"><Printer size={14} /> {t('btn_print')}</button><button onClick={handleShareImage} disabled={isSharing} className="flex-1 py-3 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:bg-emerald-400 disabled:cursor-not-allowed">{isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} <span>WhatsApp</span></button></>)}</>)}</div>
              </div>
          </div>
      )}

      {showEditModal && editingBill && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                  <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0"><div><h3 className="font-black text-lg">Ubah Rincian Biaya</h3><p className="text-[10px] uppercase tracking-widest opacity-60">Periode {MONTHS[editingBill.period_month-1]} {editingBill.period_year}</p></div><button onClick={() => setShowEditModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button></div>
                  <div className="p-8 space-y-4 overflow-y-auto custom-scrollbar">
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_ipl')}</label><input type="number" value={editFormData.ipl_cost} onChange={e => setEditFormData({...editFormData, ipl_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_kas')}</label><input type="number" value={editFormData.kas_rt_cost} onChange={e => setEditFormData({...editFormData, kas_rt_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_abodemen')}</label><input type="number" value={editFormData.abodemen_cost} onChange={e => setEditFormData({...editFormData, abodemen_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_water')}</label><input type="number" value={editFormData.water_cost} onChange={e => setEditFormData({...editFormData, water_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_extra')}</label><input type="number" value={editFormData.extra_cost} onChange={e => setEditFormData({...editFormData, extra_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">{t('cost_arrears')}</label><input type="number" value={editFormData.arrears} onChange={e => setEditFormData({...editFormData, arrears: Number(e.target.value)})} className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl font-bold text-rose-600" /></div>
                      <div className="pt-4 border-t border-slate-200 flex justify-between items-center"><span className="font-black text-sm uppercase">Total Baru</span><span className="font-black text-xl text-slate-800">Rp {editFormData.total?.toLocaleString()}</span></div>
                      <button onClick={handleSaveEdit} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl mt-4">Simpan Perubahan</button>
                  </div>
              </div>
          </div>
      )}

      {showPrintSettings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50"><div><h3 className="font-black text-slate-800 text-lg">Pengaturan Cetak</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pilih ukuran kertas kwitansi</p></div><button onClick={() => setShowPrintSettings(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={18}/></button></div>
                  <div className="p-6 space-y-4">
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ukuran Kertas</label><div className="grid grid-cols-2 gap-3"><button onClick={() => setPaperSize('58mm')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paperSize === '58mm' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}><div className="w-6 h-8 border border-current rounded bg-white"></div><span className="text-xs font-bold">58mm</span></button><button onClick={() => setPaperSize('80mm')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paperSize === '80mm' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}><div className="w-8 h-10 border border-current rounded bg-white"></div><span className="text-xs font-bold">80mm</span></button><button onClick={() => setPaperSize('A5')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paperSize === 'A5' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}><div className="w-10 h-8 border border-current rounded bg-white"></div><span className="text-xs font-bold">A5</span></button><button onClick={() => setPaperSize('Custom')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paperSize === 'Custom' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}><div className="w-full h-8 border border-dashed border-current rounded bg-white flex items-center justify-center text-[10px] font-bold">AUTO</div><span className="text-xs font-bold">Custom</span></button></div></div>
                      {paperSize === 'Custom' && (<div className="animate-in fade-in slide-in-from-top-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lebar Kertas (mm)</label><div className="relative"><input type="number" value={customPaperWidth} onChange={(e) => setCustomPaperWidth(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500" placeholder="Contoh: 75" /><div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">mm</div></div></div>)}
                      <button onClick={() => handlePrintReceipt(detailBill || selectedBill!)} className="w-full py-4 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><Printer size={16} /> Cetak Sekarang</button>
                  </div>
              </div>
          </div>
      )}

      {showPhotoModal && previewPhoto && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[160] p-4" onClick={() => setShowPhotoModal(false)}>
              <div className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0"><p className="text-xs font-black uppercase tracking-widest text-slate-600">Pratinjau Foto</p><button onClick={() => setShowPhotoModal(false)} className="p-2 hover:bg-red-50 text-slate-400 rounded-full transition-colors"><X size={20} /></button></div>
                  <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-4"><img src={previewPhoto} className="object-contain max-w-full max-h-full" /></div>
              </div>
          </div>
      )}
      
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
             <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0"><div><h3 className="font-black text-lg">{isEditMode ? t('modal_pay_edit_title') : t('modal_pay_title')}</h3><p className="text-[10px] uppercase tracking-widest opacity-60">Periode {MONTHS[selectedBill.period_month-1]} {selectedBill.period_year}</p></div><button onClick={() => setShowPaymentModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button></div>
             {isEditMode && (<div className="mx-6 mt-4 p-3 bg-amber-50 text-amber-700 rounded-xl flex items-start gap-2 border border-amber-100 shrink-0"><AlertOctagon size={16} className="shrink-0 mt-0.5" /><div><p className="text-xs font-bold">Perhatian!</p><p className="text-[10px] leading-tight">Perubahan pembayaran hanya dapat dilakukan <strong className="underline">1 kali saja</strong>.</p></div></div>)}
             <form onSubmit={handlePaymentSubmit} className="p-8 space-y-5 pt-4 overflow-y-auto custom-scrollbar">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs"><div className="flex justify-between items-center pb-2 border-b border-slate-200"><span className="font-bold text-slate-500">Tagihan Pokok</span><span className="font-black text-slate-700">Rp {(selectedBill.total - selectedBill.arrears).toLocaleString()}</span></div>{selectedBill.arrears !== 0 && (<div className="flex justify-between items-center pt-1"><span className={`font-bold ${selectedBill.arrears > 0 ? 'text-rose-500' : 'text-blue-500'}`}>{selectedBill.arrears > 0 ? t('cost_arrears') : 'Deposit'}</span><span className={`font-black ${selectedBill.arrears > 0 ? 'text-rose-600' : 'text-blue-600'}`}>{selectedBill.arrears > 0 ? '+' : '-'} Rp {Math.abs(selectedBill.arrears).toLocaleString()}</span></div>)}<div className="flex justify-between pt-3 border-t-2 border-slate-200 mt-2 font-black text-slate-800 uppercase tracking-widest text-[10px]"><span>Total Tagihan</span><span className="text-sm">Rp {selectedBill.total.toLocaleString()}</span></div></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('lbl_method')}</label><div className="flex gap-2"><button type="button" onClick={() => setPaymentMethod('CASH')} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'CASH' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>{t('method_cash')}</button><button type="button" onClick={() => setPaymentMethod('TRANSFER')} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'TRANSFER' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>{t('method_transfer')}</button></div></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Calendar size={14} /> Tanggal Pembayaran</label><input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" /></div>
                {paymentMethod === 'TRANSFER' && (<select required value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs"><option value="">-- Pilih Rekening --</option>{bankAccounts.filter(acc => acc.isActive).map(acc => (<option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>))}</select>)}
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('lbl_amount')}</label><input type="number" required autoFocus value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-800 outline-none" /></div>
                {(paymentMethod === 'TRANSFER' || isEditMode) && (<div className="space-y-2 animate-in fade-in slide-in-from-top-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('lbl_proof')} <span className="text-rose-500">*Wajib</span></label><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/>{paymentProof ? (<div className="relative rounded-2xl overflow-hidden border border-slate-200 group"><img src={paymentProof} alt="Preview" className="w-full h-32 object-cover" /><div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" onClick={() => setPaymentProof(null)} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"><Trash2 size={16} /></button></div></div>) : (<div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${isResident ? 'border-blue-200 bg-blue-50 hover:border-blue-300' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}><Upload size={24} className={isResident ? "text-blue-400" : "text-slate-400"} /><p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">{t('btn_upload')}</p></div>)}{isResident && !paymentProof && <p className="text-[9px] text-rose-500 font-bold italic">* Mohon lampirkan foto bukti pembayaran.</p>}</div>)}
                <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">{isEditMode ? t('btn_save') : t('btn_confirm')}</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
