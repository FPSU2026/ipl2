
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
  
  // Default to CURRENT MONTH
  let defaultMonth = currentRealMonth;
  let defaultYear = currentRealYear;

  const [selectedPeriod, setSelectedPeriod] = useState({ month: defaultMonth, year: defaultYear });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRT, setFilterRT] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'UNDERPAID' | 'OVERPAID'>('ALL');

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Payment Proof State
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit Mode state
  const [isEditMode, setIsEditMode] = useState(false);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailBill, setDetailBill] = useState<Bill | null>(null);
  
  // EDIT BILL DETAIL MODAL
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Bill>>({});
  // NEW: Manual splits for Edit Modal
  const [manualSplits, setManualSplits] = useState({ deposit: 0, shortage: 0, arrears: 0 });

  // Print & Share States
  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'A5' | 'A4' | 'Custom'>('58mm');
  const [customPaperWidth, setCustomPaperWidth] = useState<string>('75'); // Default custom width in mm
  const [isSharing, setIsSharing] = useState(false);
  
  // Import Payment State
  const [showImportPaymentModal, setShowImportPaymentModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importPeriod, setImportPeriod] = useState({ month: 1, year: currentRealYear }); // Default January as requested
  const importFileRef = useRef<HTMLInputElement>(null);

  const detailRef = useRef<HTMLDivElement>(null);

  const isResident = currentUser?.role === UserRole.RESIDENT;
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPaymentModal(false); setShowPhotoModal(false); setShowDetailModal(false); setShowEditModal(false); setShowPrintSettings(false);
        if (showImportPaymentModal && !isImporting) setShowImportPaymentModal(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showImportPaymentModal, isImporting]);

  // AUTO CALCULATE TOTAL IN EDIT MODAL
  useEffect(() => {
      if (showEditModal && editFormData) {
          // Calculate Net Arrears from Splits
          const netArrears = (manualSplits.shortage || 0) + (manualSplits.arrears || 0) - (manualSplits.deposit || 0);

          const subTotal = (Number(editFormData.ipl_cost) || 0) + 
                           (Number(editFormData.kas_rt_cost) || 0) + 
                           (Number(editFormData.abodemen_cost) || 0) + 
                           (Number(editFormData.water_cost) || 0) + 
                           (Number(editFormData.extra_cost) || 0);
          
          const total = subTotal + netArrears;

          // Update formData with the calculated total and the net arrears to be saved in DB
          setEditFormData(prev => ({ 
              ...prev, 
              arrears: netArrears,
              total: total 
          }));
      }
  }, [editFormData.ipl_cost, editFormData.kas_rt_cost, editFormData.abodemen_cost, editFormData.water_cost, editFormData.extra_cost, manualSplits, showEditModal]);

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
        // 1. Resident Filter
        if (isResident && bill.residentId !== currentUser.residentId) return false;
        
        // 2. Period Filter (Only for Non-Residents)
        if (!isResident) {
            if (bill.period_month !== selectedPeriod.month || bill.period_year !== selectedPeriod.year) {
                return false;
            }
        }

        const resident = residents.find(r => r.id === bill.residentId);
        if (!resident) return false;

        // 3. RT Filter
        if (filterRT !== 'ALL' && resident.rt !== filterRT) return false;

        // 4. Search Filter
        const matchesSearch = resident.name.toLowerCase().includes(searchTerm.toLowerCase()) || resident.houseNo.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
        
        // 5. Status Filter
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
        // Sort Logic:
        // 1. Unpaid first
        if (a.status !== b.status) {
            return a.status === 'UNPAID' ? -1 : 1;
        }
        // 2. Year Descending
        if (a.period_year !== b.period_year) {
            return b.period_year - a.period_year;
        }
        // 3. Month Descending
        return b.period_month - a.period_month;
    });
  }, [bills, residents, isResident, currentUser, selectedPeriod, filterRT, searchTerm, statusFilter]);

  const handleDeleteBill = async (id: string) => {
      if (window.confirm("Apakah Anda yakin ingin MENGHAPUS data tagihan ini? Tindakan ini tidak dapat dibatalkan.")) {
          await deleteBill(id);
      }
  };

  // EDIT BILL LOGIC
  const handleEditBill = (bill: Bill) => {
      setEditingBill(bill);
      
      // Initialize splits based on current net arrears
      setManualSplits({
          deposit: bill.arrears < 0 ? Math.abs(bill.arrears) : 0,
          shortage: 0, // Default to 0 as we can't distinguish strictly from DB
          arrears: bill.arrears > 0 ? bill.arrears : 0
      });

      setEditFormData({
          ipl_cost: bill.ipl_cost,
          kas_rt_cost: bill.kas_rt_cost,
          abodemen_cost: bill.abodemen_cost,
          water_cost: bill.water_cost,
          extra_cost: bill.extra_cost,
          arrears: bill.arrears, // This will be overwritten by effect
          total: bill.total
      });
      setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
      if (!editingBill) return;
      const updatedBill: Bill = {
          ...editingBill,
          ...editFormData
      } as Bill;
      
      await updateBill(updatedBill);
      setShowEditModal(false);
      setEditingBill(null);
  };

  const handleWhatsAppShare = (bill: Bill) => {
      const resident = residents.find(r => r.id === bill.residentId);
      if (!resident || !resident.phone) {
          addNotification("No HP warga tidak ditemukan.", "error");
          return;
      }

      let phoneClean = resident.phone.trim().replace(/\D/g, '');
      if (phoneClean.startsWith('0')) phoneClean = '62' + phoneClean.slice(1);

      const monthName = MONTHS[bill.period_month - 1];
      const statusText = bill.status === 'PAID' ? 'LUNAS' : 'BELUM BAYAR';
      
      // Breakdown Text
      let rincian = "";
      rincian += `IPL: Rp ${bill.ipl_cost.toLocaleString()}\n`;
      if(bill.kas_rt_cost > 0) rincian += `Kas RT: Rp ${bill.kas_rt_cost.toLocaleString()}\n`;
      
      if(bill.water_usage > 0) {
         rincian += `Air (${bill.water_usage}m³): Rp ${bill.water_cost.toLocaleString()}\n`;
      } else if (bill.abodemen_cost > 0) {
         rincian += `Abodemen Air: Rp ${bill.abodemen_cost.toLocaleString()}\n`;
      }
      
      if(bill.extra_cost > 0) rincian += `Lain-lain: Rp ${bill.extra_cost.toLocaleString()}\n`;
      if(bill.arrears > 0) rincian += `Tunggakan Lalu: Rp ${bill.arrears.toLocaleString()}\n`;

      const message = `*TAGIHAN IURAN WARGA*\n` +
                      `Periode: ${monthName} ${bill.period_year}\n` +
                      `Nama: ${resident.name}\n` +
                      `Unit: ${resident.houseNo}\n\n` +
                      `*RINCIAN:*\n` +
                      rincian + 
                      `--------------------------\n` +
                      `*TOTAL: Rp ${bill.total.toLocaleString()}*\n` +
                      `Status: ${statusText}\n\n` +
                      `Mohon segera melakukan pembayaran. Terima kasih.`;

      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const url = isMobile 
          ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}` 
          : `https://web.whatsapp.com/send?phone=${phoneClean}&text=${encodeURIComponent(message)}`;
      
      window.open(url, '_blank');
  };

  // ... (Print Logic unchanged) ...
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
    if (diff > 0) {
        diffHtml = `<tr><td style="padding-top:5px; font-weight:bold;">KEMBALI/DEPOSIT</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp ${diff.toLocaleString()}</td></tr>`;
    } else if (diff < 0) {
        diffHtml = `<tr><td style="padding-top:5px; font-weight:bold;">KURANG BAYAR</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp ${Math.abs(diff).toLocaleString()}</td></tr>`;
    } else {
        diffHtml = `<tr><td style="padding-top:5px; font-weight:bold;">KEMBALI</td><td style="padding-top:5px; text-align:right; font-weight:bold;">Rp 0</td></tr>`;
    }

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
            } else { downloadAndOpenWA(blob, resident); }
        } else { downloadAndOpenWA(blob, resident); }
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
    
    // Set Date: Default to today, or if editing, try to use existing paid_at date
    const initialDate = isEdit && bill.paid_at 
        ? new Date(bill.paid_at).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0];
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
    if (isResident && paymentMethod === 'TRANSFER' && !paymentProof) { addNotification("Wajib melampirkan foto bukti pembayaran jika via Transfer!", "error"); return; }
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

  // --- IMPORT PAYMENTS LOGIC ---
  const downloadPaymentTemplate = () => {
    const data = [
        { "NO_RUMAH": "A-01", "JUMLAH_BAYAR": 150000, "TANGGAL_BAYAR": "2025-01-20", "METODE": "CASH", "BANK_TUJUAN": "", "KETERANGAN": "Lunas Januari" },
        { "NO_RUMAH": "B-05", "JUMLAH_BAYAR": 200000, "TANGGAL_BAYAR": "2025-01-22", "METODE": "TRANSFER", "BANK_TUJUAN": "BCA", "KETERANGAN": "Transfer Mbanking" }
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Pembayaran");
    XLSX.writeFile(wb, "template_import_pembayaran.xlsx");
  };

  const handleImportPayments = (event: React.ChangeEvent<HTMLInputElement>) => {
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

            const targetMonth = importPeriod.month;
            const targetYear = importPeriod.year;
            let successCount = 0;
            let skippedCount = 0;
            const total = jsonData.length;
            let processed = 0;

            for (const row of jsonData) {
                // Basic Validation
                if (row.NO_RUMAH && row.JUMLAH_BAYAR) {
                    const houseNo = String(row.NO_RUMAH).trim();
                    const resident = residents.find(r => r.houseNo.toLowerCase() === houseNo.toLowerCase());
                    
                    if (resident) {
                        // Find Bill for the selected period
                        const bill = bills.find(b => 
                            b.residentId === resident.id && 
                            b.period_month === targetMonth && 
                            b.period_year === targetYear
                        );

                        // Only process if bill exists and is UNPAID (or you can allow overwriting paid bills if logic supports it)
                        // Safe approach: Only UNPAID or Partially Paid
                        if (bill && bill.status === 'UNPAID') {
                            const amount = parseInt(String(row.JUMLAH_BAYAR).replace(/\D/g,''));
                            
                            // Determine Date
                            let dateStr = new Date().toISOString().split('T')[0];
                            if (row.TANGGAL_BAYAR) {
                                if (typeof row.TANGGAL_BAYAR === 'number') {
                                    dateStr = new Date(Math.round((row.TANGGAL_BAYAR - 25569)*86400*1000)).toISOString().split('T')[0];
                                } else {
                                    // Try to parse string
                                    dateStr = String(row.TANGGAL_BAYAR); 
                                }
                            }

                            // Determine Method & Bank
                            const methodRaw = String(row.METODE || 'CASH').toUpperCase();
                            const paymentMethod = methodRaw.includes('TRANSFER') ? 'TRANSFER' : 'CASH';
                            
                            let bankId = '';
                            if (paymentMethod === 'TRANSFER' && row.BANK_TUJUAN) {
                                const bankName = String(row.BANK_TUJUAN).toLowerCase();
                                const bank = bankAccounts.find(b => b.bankName.toLowerCase().includes(bankName));
                                if (bank) bankId = bank.id;
                            }

                            // Process Payment using Context Function
                            await payBill(
                                bill.id,
                                amount,
                                paymentMethod,
                                bankId,
                                undefined, // No proof for bulk import
                                row.KETERANGAN || `Import Pembayaran ${MONTHS[targetMonth-1]}`,
                                false,
                                dateStr
                            );
                            successCount++;
                        } else {
                            skippedCount++; // Bill not found or already paid
                        }
                    } else {
                        skippedCount++; // Resident not found
                    }
                }
                processed++;
                setImportProgress(Math.round((processed / total) * 100));
            }

            addNotification(`Import Selesai. Sukses: ${successCount}, Dilewati: ${skippedCount}`, "success");
            setShowImportPaymentModal(false);
        } catch (error) {
            console.error(error);
            addNotification("Gagal import file. Cek format Excel.", "error");
        } finally {
            setIsImporting(false);
            setImportProgress(0);
            if (importFileRef.current) importFileRef.current.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
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
            {/* SEARCH INPUT */}
            <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder={t('search_unit')} 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all shadow-sm" 
                />
            </div>

            {/* STATUS FILTER - Moved to Header */}
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full xl:w-auto overflow-x-auto">
                {['ALL', 'UNPAID', 'PAID'].map(s => (
                    <button 
                        key={s} 
                        onClick={() => setStatusFilter(s as any)} 
                        className={`flex-1 xl:flex-none px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${statusFilter === s ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                        {s === 'ALL' ? 'Semua' : s === 'PAID' ? 'Lunas' : 'Belum'}
                    </button>
                ))}
            </div>

            {/* Only show month/year filter & Import Button if NOT Resident */}
            {!isResident && (
                <div className="flex items-center gap-2 w-full xl:w-auto">
                    <button 
                        onClick={() => setShowImportPaymentModal(true)}
                        className="bg-white border border-slate-200 text-slate-600 px-3 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap flex-1 xl:flex-none justify-center"
                    >
                        <Upload size={14} /> <span className="hidden xl:inline">Import</span>
                    </button>

                    <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex-1 xl:flex-none justify-center">
                        <select 
                            className="bg-transparent px-2 py-1.5 outline-none text-xs font-black text-slate-700 cursor-pointer"
                            value={selectedPeriod.month}
                            onChange={(e) => setSelectedPeriod({...selectedPeriod, month: parseInt(e.target.value)})}
                        >
                            {MONTHS.map((m, i) => {
                                // Filter Logic: If current year, only show up to current month
                                if (selectedPeriod.year === currentRealYear && i + 1 > currentRealMonth) return null;
                                return <option key={i} value={i+1}>{m}</option>
                            })}
                        </select>
                        <div className="w-[1px] h-4 bg-slate-200"></div>
                        <select
                             className="bg-transparent px-2 py-1.5 outline-none text-xs font-black text-slate-700 cursor-pointer"
                             value={selectedPeriod.year}
                             onChange={(e) => {
                                 const val = parseInt(e.target.value);
                                 // If switching to current year and selected month is future, reset month
                                 if (val === currentRealYear && selectedPeriod.month > currentRealMonth) {
                                     setSelectedPeriod({ month: currentRealMonth, year: val });
                                 } else {
                                     setSelectedPeriod({...selectedPeriod, year: val});
                                 }
                             }}
                        >
                             <option value={currentRealYear}>{currentRealYear}</option>
                             <option value={currentRealYear + 1}>{currentRealYear + 1}</option>
                             <option value={currentRealYear - 1}>{currentRealYear - 1}</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="overflow-auto flex-1 relative bg-slate-50/30">
            {/* DESKTOP TABLE VIEW */}
            <table className="w-full text-left hidden md:table">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-20 shadow-sm">
                <tr>
                    <th className="px-4 py-3 bg-slate-50">{t('th_house')}</th>
                    <th className="px-4 py-3 bg-slate-50 text-center">
                        {isResident ? t('th_period') : `${t('th_bill_month')} ${MONTHS[selectedPeriod.month-1]}`}
                    </th>
                    <th className="px-4 py-3 bg-slate-50 text-right">{t('th_total')}</th>
                    <th className="px-4 py-3 bg-slate-50 text-center">{t('th_status')}</th>
                    <th className="px-4 py-3 bg-slate-50 text-center">{t('th_action')}</th>
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
                            <td className="px-4 py-2.5">
                                <span className="font-black text-slate-800 text-xs uppercase">{resident.houseNo}</span>
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold text-slate-600 text-xs">
                                {isResident ? (
                                    <span>{MONTHS[bill.period_month - 1]} {bill.period_year}</span>
                                ) : (
                                    <span>Rp {(bill.total - bill.arrears).toLocaleString()}</span>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                                <div className="font-black text-slate-800 text-xs">Rp {displayTotal.toLocaleString()}</div>
                                {bill.arrears > 0 && (
                                    <div className="text-[8px] font-black text-rose-500 uppercase">{t('cost_arrears')}: Rp {bill.arrears.toLocaleString()}</div>
                                )}
                                {bill.arrears < 0 && (
                                    <div className="text-[8px] font-black text-blue-500 uppercase">Deposit: Rp {Math.abs(bill.arrears).toLocaleString()}</div>
                                )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                <span className={`px-2 py-1 text-[8px] font-black rounded-md uppercase tracking-widest border ${statusBadge.className}`}>
                                    {statusBadge.label}
                                </span>
                            </td>
                            <td className="px-4 py-2.5">
                                <div className="flex items-center justify-center space-x-1">
                                    <button onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors" title="Lihat Detail"><Eye size={14} /></button>
                                    {bill.status === 'UNPAID' ? (
                                        <>
                                            {/* ADDED EDIT BUTTON FOR UNPAID */}
                                            {!isResident && (
                                                <button onClick={() => handleEditBill(bill)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="Ubah Rincian"><Edit size={14} /></button>
                                            )}

                                            {isFutureBill ? (
                                                <button 
                                                    disabled 
                                                    className="p-1.5 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed"
                                                >
                                                    <Lock size={14} />
                                                </button>
                                            ) : (
                                                <button onClick={() => openPaymentModal(bill)} className="p-1.5 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-500/20" title="Bayar"><Wallet size={14} /></button>
                                            )}
                                            
                                            {!isResident && (
                                                <button onClick={() => handleDeleteBill(bill.id)} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors" title="Hapus Tagihan"><Trash2 size={14}/></button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg" title="Cetak"><Printer size={14} /></button>
                                            <button 
                                                onClick={() => openPaymentModal(bill, true)} 
                                                disabled={editCount >= 1}
                                                className={`p-1.5 rounded-lg transition-colors ${editCount >= 1 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                                                title="Ubah Pembayaran"
                                            >
                                                <Edit size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                        );
                    })
                ) : (
                    <tr>
                        <td colSpan={5} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center justify-center opacity-30">
                                <FilePlus size={48} className="text-slate-400 mb-4" />
                                <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                                    {statusFilter === 'PAID' ? "Belum ada yang melunasi tagihan" : "Tidak ada data tagihan untuk periode ini"}
                                </p>
                            </div>
                        </td>
                    </tr>
                )}
                </tbody>
            </table>

            {/* MOBILE CARD VIEW (DYNAMIC NO SCROLL) */}
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
                                {/* Header: House No & Status */}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="font-black text-slate-800 text-lg">{resident.houseNo}</span>
                                        {isResident && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{MONTHS[bill.period_month - 1]} {bill.period_year}</p>}
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusBadge.className}`}>
                                        {statusBadge.label}
                                    </span>
                                </div>

                                {/* Body: Amount */}
                                <div className="mb-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('th_total')}</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-slate-800">Rp {displayTotal.toLocaleString()}</span>
                                        {bill.status === 'PAID' && bill.total !== displayTotal && (
                                            <span className="text-[10px] text-slate-400 line-through">Rp {bill.total.toLocaleString()}</span>
                                        )}
                                    </div>
                                    {bill.arrears > 0 && (
                                        <p className="text-[9px] font-bold text-rose-500 uppercase mt-1">{t('cost_arrears')}: Rp {bill.arrears.toLocaleString()}</p>
                                    )}
                                    {bill.arrears < 0 && (
                                        <p className="text-[9px] font-bold text-blue-500 uppercase mt-1">Deposit: Rp {Math.abs(bill.arrears).toLocaleString()}</p>
                                    )}
                                </div>

                                {/* Actions Grid */}
                                <div className="grid grid-cols-4 gap-2 border-t border-slate-50 pt-4">
                                    <button 
                                        onClick={() => { setDetailBill(bill); setShowDetailModal(true); }} 
                                        className="col-span-1 py-3 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-100"
                                    >
                                        <Eye size={18} />
                                    </button>

                                    {bill.status === 'UNPAID' ? (
                                        <>
                                            {/* ADDED EDIT BUTTON MOBILE */}
                                            {!isResident && (
                                                <button 
                                                    onClick={() => handleEditBill(bill)} 
                                                    className="col-span-1 py-3 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-100"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                            )}

                                            {isFutureBill ? (
                                                <button disabled className={`${isResident ? 'col-span-3' : 'col-span-2'} py-3 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed font-bold text-xs uppercase tracking-widest`}>
                                                    <Lock size={16} /> Locked
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => openPaymentModal(bill)} 
                                                    className={`${isResident ? 'col-span-3' : 'col-span-2'} py-3 bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all font-bold text-xs uppercase tracking-widest`}
                                                >
                                                    <Wallet size={16} /> {t('btn_pay_now')}
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => { setDetailBill(bill); setShowPrintSettings(true); }} 
                                                className="col-span-2 py-3 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest"
                                            >
                                                <Printer size={16} /> {t('btn_print')}
                                            </button>
                                            <button 
                                                onClick={() => openPaymentModal(bill, true)}
                                                disabled={editCount >= 1}
                                                className={`col-span-1 py-3 rounded-xl flex items-center justify-center ${editCount >= 1 ? 'bg-slate-100 text-slate-300' : 'bg-amber-50 text-amber-600'}`}
                                            >
                                                <Edit size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                                
                                {!isResident && bill.status === 'UNPAID' && !isFutureBill && (
                                    <button 
                                        onClick={() => handleDeleteBill(bill.id)} 
                                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 opacity-30">
                        <FilePlus size={48} className="text-slate-400 mb-4" />
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 text-center">
                            {statusFilter === 'PAID' ? "Belum ada yang melunasi tagihan" : "Tidak ada data tagihan untuk periode ini"}
                        </p>
                    </div>
                )}
            </div>
          </div>
      </div>

      {/* DETAIL MODAL - UPDATED WITH GROUPED SECTIONS & GRAND TOTAL HEADER */}
      {showDetailModal && detailBill && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[150] p-4 sm:p-6">
              <div className="bg-white rounded-3xl shadow-2xl w-[90%] md:w-[70%] max-w-3xl overflow-hidden flex flex-col h-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-white shrink-0">
                      <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs flex items-center gap-2">
                        <FileText size={16} className="text-slate-400"/> {t('modal_detail_title')}
                      </h3>
                      <button onClick={() => setShowDetailModal(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={18} /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-0 bg-white custom-scrollbar min-h-0 relative">
                      <div ref={detailRef} className="bg-white px-4 py-4 relative overflow-hidden">
                          
                          {/* SECTION 1: GRAND TOTAL HEADER (TOP) - COMPACT */}
                          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-2 border-b-2 border-slate-800 pb-3 mb-4">
                              <div className="flex-1">
                                  <div className="flex flex-col">
                                      <h1 className="text-2xl font-black text-slate-800 tracking-tighter leading-none mb-1">
                                          {residents.find(r => r.id === detailBill.residentId)?.houseNo}
                                      </h1>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                          Periode: {MONTHS[detailBill.period_month - 1]} {detailBill.period_year}
                                      </span>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL TAGIHAN (AKUMULASI)</p>
                                  <p className="text-2xl font-black text-emerald-600 tracking-tight leading-none">Rp {detailBill.total.toLocaleString()}</p>
                              </div>
                          </div>
                          
                          {/* SECTION 2: BREAKDOWN - COMPACT */}
                          <div className="space-y-3">
                              
                              {/* A. TAGIHAN BULAN BERJALAN */}
                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                  <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest mb-3 border-b border-slate-200 pb-1 flex items-center gap-2">
                                      <Calendar size={14} className="text-slate-400"/> Tagihan Bulan {MONTHS[detailBill.period_month - 1]}
                                  </h4>
                                  
                                  <div className="space-y-2 text-xs">
                                      <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                                          <span className="font-bold text-slate-600">{t('cost_ipl')}</span>
                                          <span className="font-black text-slate-800">Rp {detailBill.ipl_cost.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                                          <span className="font-bold text-slate-600">{t('cost_kas')}</span>
                                          <span className="font-black text-slate-800">Rp {detailBill.kas_rt_cost.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                                          <span className="font-bold text-slate-600">{t('cost_abodemen')}</span>
                                          <span className="font-black text-slate-800">Rp {detailBill.abodemen_cost.toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                                          <span className="font-bold text-slate-600">{t('cost_water')} ({detailBill.water_usage}m³)</span>
                                          <span className="font-black text-slate-800">Rp {detailBill.water_cost.toLocaleString()}</span>
                                      </div>
                                      {detailBill.extra_cost > 0 && (
                                          <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                                              <span className="font-bold text-slate-600">{t('cost_extra')}</span>
                                              <span className="font-black text-slate-800">Rp {detailBill.extra_cost.toLocaleString()}</span>
                                          </div>
                                      )}
                                  </div>

                                  {/* Water Detail Box */}
                                  {detailBill.water_usage > 0 && (
                                    <div className="mt-2 bg-white p-2 rounded-lg border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Perhitungan Air</p>
                                        <div className="text-[9px] text-slate-500 font-mono">
                                            {detailBill.water_usage > (settings.water_rate_threshold || 10) 
                                                ? `(${settings.water_rate_threshold || 10} x ${settings.water_rate_low}) + (${detailBill.water_usage - (settings.water_rate_threshold || 10)} x ${settings.water_rate_high})`
                                                : `${detailBill.water_usage} x ${settings.water_rate_low}`
                                            }
                                        </div>
                                    </div>
                                  )}

                                  <div className="mt-3 pt-2 border-t-2 border-slate-200 flex justify-between items-center">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subtotal Bulan Ini</span>
                                      <span className="text-sm font-black text-slate-800">
                                          Rp {(detailBill.total - detailBill.arrears).toLocaleString()}
                                      </span>
                                  </div>
                              </div>

                              {/* B. LEBIH BAYAR / DEPOSIT */}
                              {detailBill.arrears < 0 && (
                                  <div className="p-3 rounded-xl border bg-blue-50 border-blue-100 flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                          <AlertCircle size={14} className="text-blue-500" />
                                          <span className="font-black text-xs uppercase tracking-widest text-blue-700">
                                              Lebih Bayar / Deposit
                                          </span>
                                      </div>
                                      <span className="text-sm font-black text-blue-600">
                                          - Rp {Math.abs(detailBill.arrears).toLocaleString()}
                                      </span>
                                  </div>
                              )}

                              {/* C. KURANG BAYAR / TUNGGAKAN */}
                              {detailBill.arrears > 0 && (
                                  <div className="p-3 rounded-xl border bg-rose-50 border-rose-100 flex justify-between items-center">
                                      <div className="flex items-center gap-2">
                                          <AlertCircle size={14} className="text-rose-500" />
                                          <span className="font-black text-xs uppercase tracking-widest text-rose-700">
                                              Kurang Bayar / Tunggakan
                                          </span>
                                      </div>
                                      <span className="text-sm font-black text-rose-600">
                                          + Rp {detailBill.arrears.toLocaleString()}
                                      </span>
                                  </div>
                              )}

                              {/* D. TOTAL FOOTER */}
                              <div className="p-4 bg-slate-800 text-white rounded-xl flex justify-between items-center shadow-lg shadow-slate-900/10">
                                  <span className="font-black text-xs uppercase tracking-widest">Total Yang Harus Dibayar</span>
                                  <span className="font-black text-lg">Rp {detailBill.total.toLocaleString()}</span>
                              </div>

                          </div>

                          {/* Proof of Payment View if exists */}
                          {detailBill.photo_url && (
                              <div className="mt-4 border-t-2 border-slate-100 pt-3">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('lbl_proof')}</p>
                                  <img src={detailBill.photo_url} alt="Bukti Bayar" className="max-h-32 rounded-xl border border-slate-200 shadow-sm" />
                              </div>
                          )}
                      </div>
                  </div>
                  
                  {/* UPDATED: ACTIONS (RESIDENT = BAYAR, ADMIN = CETAK) */}
                  <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0 z-10">
                      {isResident && detailBill.status === 'UNPAID' ? (
                          <button 
                            onClick={() => openPaymentModal(detailBill)}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                          >
                              <Wallet size={16} /> {t('btn_pay_now')}
                          </button>
                      ) : (
                          <>
                            {isResident && (
                                <div className="w-full py-4 bg-slate-100 text-emerald-600 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                                    <CheckCircle2 size={16} /> {t('status_paid')}
                                </div>
                            )}
                            
                            {!isResident && (
                                <>
                                    <button onClick={() => { setShowDetailModal(false); setShowPrintSettings(true); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                        <Printer size={14} /> {t('btn_print')}
                                    </button>
                                    <button onClick={() => handleWhatsAppShare(detailBill)} className="flex-1 py-3 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                                        <MessageCircle size={14} /> WhatsApp
                                    </button>
                                    <button onClick={handleShareImage} disabled={isSharing} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:bg-emerald-400 disabled:cursor-not-allowed">
                                        {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} <span>Gambar</span>
                                    </button>
                                </>
                            )}
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* EDIT COST MODAL (FOR UNPAID BILLS) - UPDATED WITH SPLIT ARREARS */}
      {showEditModal && editingBill && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                  <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0">
                      <div>
                          <h3 className="font-black text-lg">Ubah Rincian Biaya</h3>
                          <p className="text-[10px] uppercase tracking-widest opacity-60">Periode {MONTHS[editingBill.period_month-1]} {editingBill.period_year}</p>
                      </div>
                      <button onClick={() => setShowEditModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button>
                  </div>
                  
                  <div className="p-8 space-y-4 overflow-y-auto custom-scrollbar">
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_ipl')}</label><input type="number" value={editFormData.ipl_cost} onChange={e => setEditFormData({...editFormData, ipl_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_kas')}</label><input type="number" value={editFormData.kas_rt_cost} onChange={e => setEditFormData({...editFormData, kas_rt_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_abodemen')}</label><input type="number" value={editFormData.abodemen_cost} onChange={e => setEditFormData({...editFormData, abodemen_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_water')}</label><input type="number" value={editFormData.water_cost} onChange={e => setEditFormData({...editFormData, water_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('cost_extra')}</label><input type="number" value={editFormData.extra_cost} onChange={e => setEditFormData({...editFormData, extra_cost: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" /></div>
                      
                      {/* SPLIT ARREARS SECTION */}
                      <div className="pt-2 border-t border-dashed border-slate-200">
                          <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Lebih Bayar / Deposit</label>
                          <input type="number" value={manualSplits.deposit} onChange={e => setManualSplits({...manualSplits, deposit: Number(e.target.value)})} className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-700" placeholder="0" />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Kurang Bayar (Periode Lalu)</label>
                          <input type="number" value={manualSplits.shortage} onChange={e => setManualSplits({...manualSplits, shortage: Number(e.target.value)})} className="w-full p-3 bg-rose-50 border border-rose-200 rounded-xl font-bold text-rose-600" placeholder="0" />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Tunggakan (Belum Lunas)</label>
                          <input type="number" value={manualSplits.arrears} onChange={e => setManualSplits({...manualSplits, arrears: Number(e.target.value)})} className="w-full p-3 bg-rose-100 border border-rose-300 rounded-xl font-bold text-rose-800" placeholder="0" />
                      </div>
                      
                      <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                          <span className="font-black text-sm uppercase">Total Baru</span>
                          <span className="font-black text-xl text-slate-800">Rp {editFormData.total?.toLocaleString()}</span>
                      </div>

                      <button onClick={handleSaveEdit} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl mt-4">Simpan Perubahan</button>
                  </div>
              </div>
          </div>
      )}

      {/* ... (Print Settings & Photo Modal unchanged) ... */}
      {showPrintSettings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="font-black text-slate-800 text-lg">Pengaturan Cetak</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pilih ukuran kertas kwitansi</p>
                      </div>
                      <button onClick={() => setShowPrintSettings(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={18}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ukuran Kertas</label>
                          <div className="grid grid-cols-2 gap-3">
                              <button onClick={() => setPaperSize('58mm')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paperSize === '58mm' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                  <div className="w-6 h-8 border border-current rounded bg-white"></div>
                                  <span className="text-xs font-bold">58mm</span>
                              </button>
                              <button onClick={() => setPaperSize('80mm')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paperSize === '80mm' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                  <div className="w-8 h-10 border border-current rounded bg-white"></div>
                                  <span className="text-xs font-bold">80mm</span>
                              </button>
                              <button onClick={() => setPaperSize('A5')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paperSize === 'A5' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                  <div className="w-10 h-8 border border-current rounded bg-white"></div>
                                  <span className="text-xs font-bold">A5</span>
                              </button>
                              <button onClick={() => setPaperSize('Custom')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paperSize === 'Custom' ? 'bg-indigo-50 border-indigo-500 text-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                  <div className="w-full h-8 border border-dashed border-current rounded bg-white flex items-center justify-center text-[10px] font-bold">AUTO</div>
                                  <span className="text-xs font-bold">Custom</span>
                              </button>
                          </div>
                      </div>

                      {/* Custom Input */}
                      {paperSize === 'Custom' && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lebar Kertas (mm)</label>
                              <div className="relative">
                                  <input 
                                    type="number" 
                                    value={customPaperWidth}
                                    onChange={(e) => setCustomPaperWidth(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500"
                                    placeholder="Contoh: 75"
                                  />
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">mm</div>
                              </div>
                          </div>
                      )}

                      <button 
                        onClick={() => handlePrintReceipt(detailBill || selectedBill!)} 
                        className="w-full py-4 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          <Printer size={16} /> Cetak Sekarang
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showPhotoModal && previewPhoto && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[160] p-4" onClick={() => setShowPhotoModal(false)}>
              <div className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-600">Pratinjau Foto</p>
                      <button onClick={() => setShowPhotoModal(false)} className="p-2 hover:bg-red-50 text-slate-400 rounded-full transition-colors"><X size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-4">
                      <img src={previewPhoto} className="object-contain max-w-full max-h-full" />
                  </div>
              </div>
          </div>
      )}
      
      {/* Payment Modal - UPDATED WITH CONDITIONAL PROOF UPLOAD */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
             <div className="bg-slate-800 p-6 flex justify-between items-center text-white shrink-0">
                <div>
                   <h3 className="font-black text-lg">{isEditMode ? t('modal_pay_edit_title') : t('modal_pay_title')}</h3>
                   <p className="text-[10px] uppercase tracking-widest opacity-60">Periode {MONTHS[selectedBill.period_month-1]} {selectedBill.period_year}</p>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={18} /></button>
             </div>
             
             {isEditMode && (
                 <div className="mx-6 mt-4 p-3 bg-amber-50 text-amber-700 rounded-xl flex items-start gap-2 border border-amber-100 shrink-0">
                     <AlertOctagon size={16} className="shrink-0 mt-0.5" />
                     <div>
                         <p className="text-xs font-bold">Perhatian!</p>
                         <p className="text-[10px] leading-tight">Perubahan pembayaran hanya dapat dilakukan <strong className="underline">1 kali saja</strong>.</p>
                     </div>
                 </div>
             )}

             <form onSubmit={handlePaymentSubmit} className="p-8 space-y-5 pt-4 overflow-y-auto custom-scrollbar">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200"><span className="font-bold text-slate-500">Tagihan Pokok</span><span className="font-black text-slate-700">Rp {(selectedBill.total - selectedBill.arrears).toLocaleString()}</span></div>
                    {selectedBill.arrears !== 0 && (
                        <div className="flex justify-between items-center pt-1">
                            <span className={`font-bold ${selectedBill.arrears > 0 ? 'text-rose-500' : 'text-blue-500'}`}>{selectedBill.arrears > 0 ? t('cost_arrears') : 'Deposit'}</span>
                            <span className={`font-black ${selectedBill.arrears > 0 ? 'text-rose-600' : 'text-blue-600'}`}>{selectedBill.arrears > 0 ? '+' : '-'} Rp {Math.abs(selectedBill.arrears).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between pt-3 border-t-2 border-slate-200 mt-2 font-black text-slate-800 uppercase tracking-widest text-[10px]"><span>Total Tagihan</span><span className="text-sm">Rp {selectedBill.total.toLocaleString()}</span></div>
                </div>

                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('lbl_method')}</label>
                   <div className="flex gap-2">
                        <button type="button" onClick={() => setPaymentMethod('CASH')} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'CASH' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>{t('method_cash')}</button>
                        <button type="button" onClick={() => setPaymentMethod('TRANSFER')} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${paymentMethod === 'TRANSFER' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>{t('method_transfer')}</button>
                   </div>
                </div>

                {/* NEW: Payment Date Input */}
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Calendar size={14} /> Tanggal Pembayaran
                   </label>
                   <input 
                        type="date" 
                        required 
                        value={paymentDate} 
                        onChange={(e) => setPaymentDate(e.target.value)} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" 
                   />
                </div>

                {paymentMethod === 'TRANSFER' && (
                    <select 
                        required 
                        value={selectedBankId} 
                        onChange={(e) => setSelectedBankId(e.target.value)} 
                        className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold text-xs"
                    >
                        <option value="">-- Pilih Rekening --</option>
                        {bankAccounts
                            .filter(acc => acc.isActive)
                            .map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>
                            ))
                        }
                    </select>
                )}

                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('lbl_amount')}</label>
                   <input type="number" required autoFocus value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-800 outline-none" />
                </div>

                {/* UPLOAD BUKTI BAYAR - ONLY FOR TRANSFER OR ADMIN EDITING */}
                {(paymentMethod === 'TRANSFER' || isEditMode) && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            {t('lbl_proof')} <span className="text-rose-500">*Wajib</span>
                        </label>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFileSelect}
                        />

                        {paymentProof ? (
                            <div className="relative rounded-2xl overflow-hidden border border-slate-200 group">
                                <img src={paymentProof} alt="Preview" className="w-full h-32 object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        type="button"
                                        onClick={() => setPaymentProof(null)} 
                                        className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${isResident ? 'border-blue-200 bg-blue-50 hover:border-blue-300' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                            >
                                <Upload size={24} className={isResident ? "text-blue-400" : "text-slate-400"} />
                                <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">{t('btn_upload')}</p>
                            </div>
                        )}
                        {isResident && !paymentProof && <p className="text-[9px] text-rose-500 font-bold italic">* Mohon lampirkan foto bukti pembayaran.</p>}
                    </div>
                )}

                <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                    {isEditMode ? t('btn_save') : t('btn_confirm')}
                </button>
             </form>
          </div>
        </div>
      )}

      {/* IMPORT PAYMENT MODAL */}
      {showImportPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 text-center p-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <FileSpreadsheet size={32} />
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-2">Import Data Pembayaran</h3>
                <p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">
                    Upload file Excel berisi data pembayaran warga. Pastikan format kolom sesuai template.
                </p>
                
                {/* Period Selector */}
                <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Periode Tagihan</p>
                    <div className="grid grid-cols-2 gap-2">
                        <select 
                            value={importPeriod.month}
                            onChange={(e) => setImportPeriod({...importPeriod, month: parseInt(e.target.value)})}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                        >
                            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                        </select>
                        <select 
                            value={importPeriod.year}
                            onChange={(e) => setImportPeriod({...importPeriod, year: parseInt(e.target.value)})}
                            className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                        >
                            <option value={currentRealYear}>{currentRealYear}</option>
                            <option value={currentRealYear + 1}>{currentRealYear + 1}</option>
                        </select>
                    </div>
                    <p className="text-[9px] text-emerald-600 mt-2 font-bold italic">* Default: Khusus Bulan Januari (Bulan 1)</p>
                </div>

                <input 
                    type="file"
                    ref={importFileRef}
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImportPayments}
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
                        onClick={() => importFileRef.current?.click()}
                        disabled={isImporting}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 hover:bg-slate-900 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <span>{isImporting ? 'Memproses...' : 'Pilih File Excel'}</span>
                    </button>
                    <button 
                        onClick={downloadPaymentTemplate}
                        disabled={isImporting}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Download size={14} /> Download Template
                    </button>
                    <button 
                        onClick={() => setShowImportPaymentModal(false)}
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

export default Billing;
