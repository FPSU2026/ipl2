
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Droplets, 
  Camera, 
  Image as ImageIcon, 
  Save, 
  User as UserIcon, 
  Search,
  CheckCircle2,
  Trash2,
  X,
  AlertTriangle,
  Info,
  ArrowRight,
  Plus,
  Minus,
  Upload,
  FileText,
  Download,
  Loader2,
  Phone,
  Lock,
  Edit,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MONTHS } from '../constants';
import { MeterReading } from '../types';
import * as XLSX from 'xlsx';

interface MeterInputProps {
  user: any;
}

const MeterInput: React.FC<MeterInputProps> = ({ user }) => {
  const { residents, bills, settings, addNotification, addMeterReading, updateMeterReading, deleteMeterReading, meterReadings } = useApp();
  
  // Calculate Next Month Logic
  const calculateNextPeriod = () => {
    const now = new Date();
    let nextM = now.getMonth() + 2; // +1 for 1-based index, +1 for "Next Month"
    let nextY = now.getFullYear();

    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    return { month: nextM, year: nextY };
  };

  const nextPeriod = calculateNextPeriod();

  const [selectedUnit, setSelectedUnit] = useState('');
  // Set default to Next Month and Year
  const [month, setMonth] = useState(nextPeriod.month); 
  const [year, setYear] = useState(nextPeriod.year);
  
  const [meterValue, setMeterValue] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Local filtered history view
  const [historyView, setHistoryView] = useState<MeterReading[]>([]);
  
  // States for derived values
  const [meterAwal, setMeterAwal] = useState(0);
  const [usage, setUsage] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Photo Modal State
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Added submitting state
  const importFileRef = useRef<HTMLInputElement>(null);

  // Searchable Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Added ref for file input
  const [cameraActive, setCameraActive] = useState(false);

  // Determine if current selected unit has existing data
  const existingData = useMemo(() => {
      if (!selectedUnit) return null;
      return meterReadings.find(r => r.residentId === selectedUnit && r.month === month && r.year === year);
  }, [selectedUnit, month, year, meterReadings]);

  // Handle ESC Key & Click Outside
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showPhotoModal) setShowPhotoModal(false);
        if (cameraActive) setCameraActive(false);
        if (showImportModal) setShowImportModal(false);
        if (isDropdownOpen) setIsDropdownOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };

    window.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        window.removeEventListener('keydown', handleEsc);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPhotoModal, cameraActive, showImportModal, isDropdownOpen]);

  // Sync local history view with context meter readings
  useEffect(() => {
      const recent = meterReadings.filter(r => r.month === month && r.year === year).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setHistoryView(recent);
  }, [meterReadings, month, year]);

  // AUTO-POPULATE LOGIC: Handle Existing Data or Reset
  useEffect(() => {
    if (selectedUnit) {
      if (existingData) {
        // Data exists: Populate. If EditingId matches, we don't treat it as "Locked" in UI logic later.
        if (editingId !== existingData.id) {
             setMeterValue(existingData.meterValue.toString());
             setPhoto(existingData.photoUrl || null);
             setMeterAwal(existingData.prevMeterValue);
        }
      } else {
        // No data: Reset for input
        if (!editingId) {
            setMeterValue('');
            setPhoto(null);
            
            // Fetch Meter Awal logic (Only if no existing data for current period)
            const resident = residents.find(r => r.id === selectedUnit);
            if (resident) {
                const lastReading = meterReadings
                    .filter(r => r.residentId === selectedUnit && (r.year < year || (r.year === year && r.month < month)))
                    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                
                const initialValue = lastReading ? lastReading.meterValue : resident.initialMeter;
                setMeterAwal(initialValue);
            }
        }
      }
    } else {
      if (!editingId) {
          setMeterAwal(0);
          setMeterValue('');
          setPhoto(null);
      }
    }
  }, [selectedUnit, existingData, residents, meterReadings, month, year]);

  // Calculate usage and cost in real-time
  useEffect(() => {
    const val = parseInt(meterValue) || 0;
    const diff = Math.max(0, val - meterAwal);
    setUsage(diff);

    let cost = settings.water_abodemen;
    const limit = settings.water_rate_threshold || 10;
    if (diff > 0) {
        if (diff <= limit) {
            cost += diff * settings.water_rate_low;
        } else {
            cost += (limit * settings.water_rate_low) + ((diff - limit) * settings.water_rate_high);
        }
    }
    setEstimatedCost(cost);
  }, [meterValue, meterAwal, settings]);

  const startCamera = async () => {
    if (existingData && !editingId) return; // Prevent if data exists and NOT editing
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      addNotification("Gagal mengakses kamera.", "error");
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      setPhoto(canvas.toDataURL('image/jpeg'));
      
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => track.stop());
      }
      setCameraActive(false);
    }
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (existingData && !editingId) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhoto(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (existingData && !editingId) {
        addNotification("Data untuk unit ini sudah ada.", "warning");
        return;
    }
    if (!selectedUnit) {
      addNotification("Pilih unit warga terlebih dahulu.", "warning");
      return;
    }
    if (!meterValue || parseInt(meterValue) < meterAwal) {
      addNotification("Angka meteran tidak valid atau lebih kecil dari meter awal.", "error");
      return;
    }
    if (!photo) {
        addNotification("Foto bukti meteran wajib diambil!", "error");
        return;
    }

    // Duplicate Check (Skip if editing self)
    if (!editingId) {
        const isDuplicate = meterReadings.some(reading => 
          reading.residentId === selectedUnit && 
          reading.month === month && 
          reading.year === year
        );

        if (isDuplicate) {
          addNotification(`Data meteran untuk periode ${MONTHS[month-1]} ${year} sudah ada!`, "error");
          return;
        }
    }

    setIsSubmitting(true);
    try {
      const resident = residents.find(r => r.id === selectedUnit);
      
      const entryData: MeterReading = {
        id: editingId || Math.random().toString(36).substr(2, 9),
        residentId: selectedUnit,
        month: month,
        year: year,
        meterValue: parseInt(meterValue),
        prevMeterValue: meterAwal,
        usage: usage,
        photoUrl: photo,
        timestamp: new Date().toISOString(),
        operator: user.username 
      };

      if (editingId) {
          await updateMeterReading(entryData);
          setEditingId(null);
      } else {
          await addMeterReading(entryData);
          addNotification(`Data unit ${resident?.houseNo} berhasil disimpan.`, "success");
      }
      
      // Reset form
      setSelectedUnit('');
      setUnitSearch('');
      setMeterValue('');
      setPhoto(null);
    } catch (error) {
      addNotification("Gagal menyimpan data.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (reading: MeterReading) => {
      setSelectedUnit(reading.residentId);
      setMeterAwal(reading.prevMeterValue);
      setMeterValue(reading.meterValue.toString());
      setPhoto(reading.photoUrl || null);
      setEditingId(reading.id);
      // Ensure month/year matches (though list is already filtered)
      setMonth(reading.month);
      setYear(reading.year);
      
      // Update dropdown label if needed
      const r = residents.find(res => res.id === reading.residentId);
      if (r) setUnitSearch(''); // Reset search when editing

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (reading: MeterReading) => {
      if (window.confirm("Jika  data meteran ini dihapus maka  Tagihan terkait juga akan dihapus.Yakin akan dihapus ?")) {
          await deleteMeterReading(reading.id, reading.residentId, reading.month, reading.year);
      }
  };

  const openPhotoModal = (url: string) => {
      setPreviewPhoto(url);
      setZoomLevel(1);
      setShowPhotoModal(true);
  };

  // IMPORT LOGIC (Unchanged)
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
        
        let successCount = 0;
        let duplicateCount = 0;
        
        for (const row of jsonData) {
            if (row.NO_RUMAH && row.METER_AKHIR) {
                const resident = residents.find(r => r.houseNo.toLowerCase() === String(row.NO_RUMAH).toLowerCase());
                if (resident) {
                    const isDup = meterReadings.some(r => r.residentId === resident.id && r.month === month && r.year === year);
                    
                    if (!isDup) {
                        const meterVal = parseInt(String(row.METER_AKHIR));
                        const prevVal = resident.initialMeter; 
                        
                        if (!isNaN(meterVal) && meterVal >= prevVal) {
                            const usageVal = meterVal - prevVal;
                            const newEntry: MeterReading = {
                                id: `imp-${Date.now()}-${Math.random()}`,
                                residentId: resident.id,
                                month: month, 
                                year: year,
                                meterValue: meterVal,
                                prevMeterValue: prevVal,
                                usage: usageVal,
                                photoUrl: '',
                                timestamp: new Date().toISOString(),
                                operator: 'IMPORT'
                            };
                            await addMeterReading(newEntry);
                            successCount++;
                        }
                    } else {
                        duplicateCount++;
                    }
                }
            }
        }
        if (duplicateCount > 0) {
            addNotification(`${successCount} data diimport. ${duplicateCount} data dilewati (duplikat).`, "warning");
        } else {
            addNotification(`${successCount} Data meteran berhasil diimport.`, "success");
        }
        setShowImportModal(false);
      } catch (error) {
        addNotification("Gagal mengimport file.", "error");
      } finally {
        setIsImporting(false);
        if (importFileRef.current) importFileRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const data = [{ "NO_RUMAH": "A-01", "METER_AKHIR": 150 }, { "NO_RUMAH": "B-05", "METER_AKHIR": 200 }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_meteran.xlsx");
  };

  const selectedResident = residents.find(r => r.id === selectedUnit);
  const isReadOnly = !!existingData && !editingId;

  // Filter residents for dropdown
  const filteredResidents = residents.filter(r => 
    r.houseNo.toLowerCase().includes(unitSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="card p-10 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
              <Droplets size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Pencatatan Meter Air</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Input data pemakaian air bulanan</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
                onClick={() => setShowImportModal(true)}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm"
             >
                <Upload size={16} /> Import Excel
             </button>

             <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center space-x-3 pr-6">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                <UserIcon size={20} />
                </div>
                <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Petugas Aktif</p>
                <p className="text-xs font-black text-slate-700 uppercase">{user.username} ({user.role === 'ADMIN' ? 'LOCAL' : 'STAFF'})</p>
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Side Inputs */}
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2" ref={dropdownRef}>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">No. Rumah / Unit</label>
                
                {/* Searchable Dropdown */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => !editingId && setIsDropdownOpen(!isDropdownOpen)}
                        disabled={!!editingId}
                        className={`w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex justify-between items-center text-left focus:ring-4 focus:ring-blue-500/5 transition-all font-black text-slate-700 outline-none shadow-sm ${!!editingId ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-slate-100'}`}
                    >
                        <span>
                            {selectedResident ? selectedResident.houseNo : '-- Pilih No Rumah --'}
                        </span>
                        <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''} text-slate-400`} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-64 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-3 bg-slate-50 border-b border-slate-100 sticky top-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="text" 
                                        autoFocus
                                        placeholder="Cari No. Rumah..." 
                                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-blue-500"
                                        value={unitSearch}
                                        onChange={(e) => setUnitSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                {filteredResidents.length > 0 ? (
                                    filteredResidents.map(r => {
                                        const isDone = historyView.some(h => h.residentId === r.id);
                                        return (
                                            <button
                                                key={r.id}
                                                onClick={() => {
                                                    setSelectedUnit(r.id);
                                                    setIsDropdownOpen(false);
                                                    setUnitSearch('');
                                                }}
                                                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold flex justify-between items-center transition-colors ${selectedUnit === r.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                            >
                                                <span>{r.houseNo}</span>
                                                {isDone && <CheckCircle2 size={14} className="text-emerald-500" />}
                                            </button>
                                        )
                                    })
                                ) : (
                                    <div className="p-4 text-center text-xs text-slate-400 italic">
                                        Data tidak ditemukan
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                {selectedResident && (
                    <div className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                        <div>
                            <p className="text-3xl font-black text-slate-800">{selectedResident.houseNo}</p>
                        </div>
                        {selectedResident.phone && (
                            <a 
                                href={`https://wa.me/${selectedResident.phone.replace(/^0/, '62').replace(/\D/g, '')}`} 
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black hover:bg-emerald-200 transition-colors"
                            >
                                <Phone size={14} /> WhatsApp
                            </a>
                        )}
                    </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Bulan</label>
                <div className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black text-slate-500 outline-none cursor-not-allowed">
                  {MONTHS[month-1]} 
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Tahun</label>
                <div className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-black text-slate-500 outline-none cursor-not-allowed">
                  {year}
                </div>
              </div>
            </div>

            {/* Meter Inputs Section */}
            <div className="grid grid-cols-2 gap-6 items-stretch">
                {/* Meter Awal */}
                <div className="space-y-3">
                   <label className="block text-[11px] font-black text-blue-500 uppercase tracking-widest">Meter Awal (m³)</label>
                   <div className="h-[120px] bg-blue-50 border-2 border-blue-100 rounded-[2rem] flex flex-col items-center justify-center">
                     <span className="text-4xl font-black text-blue-600">{meterAwal}</span>
                     <span className="text-[10px] font-bold text-blue-400 uppercase mt-1">Bulan Lalu</span>
                   </div>
                </div>

                {/* Meter Akhir */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest">Meter Akhir (m³)</label>
                      {isReadOnly && <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase">Read-Only</span>}
                    </div>
                    <div className="relative group h-[120px]">
                      <input 
                        type="number"
                        value={meterValue}
                        onChange={(e) => setMeterValue(e.target.value)}
                        placeholder="0"
                        readOnly={isReadOnly}
                        className={`w-full h-full border-4 rounded-[2rem] text-5xl font-black transition-all outline-none text-center 
                          ${isReadOnly 
                            ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                            : 'bg-slate-50 border-slate-100 text-slate-800 focus:bg-white focus:border-emerald-500 focus:shadow-xl'
                          } 
                          ${!isReadOnly && parseInt(meterValue) < meterAwal && meterValue !== '' ? 'border-rose-200 text-rose-500 bg-rose-50' : ''}`}
                      />
                      {isReadOnly && (
                        <div className="absolute top-2 right-2 text-slate-300">
                          <Lock size={16} />
                        </div>
                      )}
                    </div>
                </div>
            </div>

            {!isReadOnly && parseInt(meterValue) < meterAwal && meterValue !== '' && (
                  <div className="flex items-center justify-center text-rose-500 bg-rose-50 p-3 rounded-xl space-x-2 text-[10px] font-black uppercase tracking-widest animate-bounce">
                    <AlertTriangle size={16} />
                    <span>Meter akhir tidak boleh lebih kecil dari awal!</span>
                  </div>
            )}

            {selectedUnit && (
              <div className="p-6 bg-emerald-50/80 border border-emerald-100 rounded-[2rem] flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <Info size={24} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-1">Estimasi Biaya Air (Abodemen + Pemakaian)</p>
                    <div className="flex items-baseline space-x-3">
                      <p className="text-3xl font-black text-emerald-800">{usage} <span className="text-sm">m³</span></p>
                      <div className="h-6 w-[2px] bg-emerald-200"></div>
                      <p className="text-xl font-black text-emerald-600">Rp {estimatedCost.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="bg-white p-2 rounded-xl shadow-sm">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Side Photo Areas */}
          <div className="space-y-4">
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Bukti Foto Meteran <span className="text-rose-500">*Wajib</span></label>
            <div className="grid grid-cols-2 gap-4 h-[320px]">
              {/* Camera Area */}
              <div 
                onClick={!photo && !cameraActive && !isReadOnly ? startCamera : undefined}
                className={`relative border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center transition-all overflow-hidden ${photo || cameraActive ? 'border-blue-200' : isReadOnly ? 'border-slate-100 bg-slate-50 cursor-default' : 'border-slate-200 hover:border-emerald-400 cursor-pointer bg-slate-50/50'}`}
              >
                {cameraActive ? (
                  <div className="absolute inset-0 bg-black">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); capturePhoto(); }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-blue-500 shadow-xl active:scale-90 transition-transform flex items-center justify-center"
                    >
                      <div className="w-12 h-12 bg-red-500 rounded-full" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setCameraActive(false); }}
                      className="absolute top-6 left-6 p-2 bg-white/20 text-white rounded-full hover:bg-white/40 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : photo ? (
                  <div className="absolute inset-0 group">
                    <img src={photo} className="w-full h-full object-cover" alt="Capture" />
                    {!isReadOnly && (
                        <button 
                        onClick={(e) => { e.stopPropagation(); setPhoto(null); }}
                        className="absolute top-6 right-6 p-3 bg-black/50 text-white rounded-full hover:bg-black transition-colors"
                        >
                        <X size={18} />
                        </button>
                    )}
                    <div className="absolute bottom-6 left-6 right-6 bg-black/40 backdrop-blur-md p-3 rounded-2xl text-[10px] font-black text-white uppercase text-center tracking-widest">
                      Preview Foto Meteran {existingData && !editingId ? '(Tersimpan)' : ''}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all ${isReadOnly ? 'bg-slate-100 text-slate-300' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                      <Camera size={40} />
                    </div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{isReadOnly ? 'Tidak Ada Foto' : 'Ambil Foto'}</span>
                  </>
                )}
              </div>

              {/* Gallery Area */}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleGallerySelect}
              />
              <div 
                onClick={() => !isReadOnly && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center bg-slate-50/50 transition-all group ${isReadOnly ? 'cursor-not-allowed opacity-50' : 'hover:border-emerald-400 cursor-pointer'}`}
              >
                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mb-6 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
                  <ImageIcon size={40} />
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Pilih Galeri</span>
              </div>
            </div>

            <div className="pt-10 flex justify-end gap-3">
              {editingId && (
                  <button 
                    onClick={() => { setEditingId(null); setSelectedUnit(''); setMeterValue(''); setPhoto(null); }}
                    className="bg-slate-200 text-slate-500 px-6 py-6 rounded-[2rem] font-black text-base uppercase tracking-widest hover:bg-slate-300 transition-all"
                  >
                      Batal
                  </button>
              )}
              <button 
                onClick={handleSave}
                disabled={!selectedUnit || !meterValue || (parseInt(meterValue) < meterAwal && !existingData) || isSubmitting || (!!existingData && !editingId)}
                className="bg-[#10B981] hover:bg-[#0da673] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white px-12 py-6 rounded-[2rem] font-black text-base uppercase tracking-widest flex items-center space-x-4 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all w-full md:w-auto"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : !!existingData && !editingId ? <CheckCircle2 size={24} /> : <Save size={24} />}
                <span>{isSubmitting ? 'Menyimpan...' : !!existingData && !editingId ? 'Data Sudah Ada' : editingId ? 'Update Data' : 'Simpan Pencatatan'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="card border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-800">RIWAYAT INPUT METER</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Entri data meteran untuk periode terpilih</p>
          </div>
          <div className="bg-slate-100 px-5 py-2 rounded-full text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-3">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>{historyView.length} Entri</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              <tr>
                <th className="px-8 py-6">Warga / Unit</th>
                <th className="px-8 py-6">Waktu Input</th>
                <th className="px-8 py-6">Operator</th>
                <th className="px-8 py-6">Meter Awal/Akhir</th>
                <th className="px-8 py-6">Pemakaian</th>
                <th className="px-8 py-6">Bukti</th>
                <th className="px-8 py-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyView.length > 0 ? historyView.map((row) => {
                const resident = residents.find(r => r.id === row.residentId);
                return (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-black text-slate-700 text-base">{resident?.houseNo}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{new Date(row.timestamp).toLocaleString('id-ID')}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg uppercase tracking-widest">{row.operator || '-'}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                       <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">{row.prevMeterValue}</span>
                       <ArrowRight size={12} className="text-slate-300" />
                       <span className="text-sm font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{row.meterValue}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-black text-blue-600">{row.usage} m³</span>
                  </td>
                  <td className="px-8 py-6">
                    {row.photoUrl ? (
                      <div 
                        className="relative w-14 h-14 rounded-2xl border border-slate-200 overflow-hidden shadow-sm group/thumb cursor-pointer hover:ring-4 hover:ring-blue-500/20 transition-all"
                        onClick={() => openPhotoModal(row.photoUrl!)}
                      >
                        <img src={row.photoUrl} className="w-full h-full object-cover" alt="Proof" />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon size={16} className="text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-200">
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => handleEdit(row)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all" 
                            title="Edit"
                          >
                              <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(row)}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all" 
                            title="Hapus"
                          >
                              <Trash2 size={16} />
                          </button>
                      </div>
                  </td>
                </tr>
              )}) : (
                <tr>
                  <td colSpan={7} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                      <Search size={64} className="mb-6 text-slate-300" />
                      <p className="text-sm font-black uppercase tracking-[0.4em]">Belum ada pencatatan</p>
                      <p className="text-[10px] font-bold text-slate-300 uppercase mt-4">Pilih unit warga untuk memulai input data bulan ini</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ZOOMABLE PHOTO MODAL */}
      {showPhotoModal && previewPhoto && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[150] p-4" onClick={() => setShowPhotoModal(false)}>
              <div 
                className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl animate-in zoom-in duration-200 flex flex-col h-[80vh]"
                onClick={e => e.stopPropagation()}
              >
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 z-10 shrink-0">
                      <div className="flex items-center gap-2">
                          <ImageIcon size={16} className="text-slate-400"/>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-600">Bukti Foto Meteran</p>
                      </div>
                      <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))} 
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition-colors"
                            title="Zoom Out"
                          >
                              <Minus size={16}/>
                          </button>
                          <span className="text-xs font-black text-slate-500 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                          <button 
                            onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))} 
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition-colors"
                            title="Zoom In"
                          >
                              <Plus size={16}/>
                          </button>
                          <div className="h-4 w-[1px] bg-slate-300 mx-2"></div>
                          <button onClick={() => setShowPhotoModal(false)} className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-full transition-colors">
                              <X size={20} />
                          </button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-4 relative">
                      <img 
                        src={previewPhoto} 
                        alt="Meteran" 
                        style={{ 
                            transform: `scale(${zoomLevel})`, 
                            transition: 'transform 0.2s ease-out',
                            maxWidth: '100%',
                            maxHeight: '100%'
                        }}
                        className="object-contain" 
                      />
                  </div>
              </div>
          </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 text-center p-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText size={32} />
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-2">Import Data Meteran</h3>
                <p className="text-xs font-bold text-slate-400 mb-6">
                    Unduh template Excel, isi kolom <strong>NO_RUMAH</strong> dan <strong>METER_AKHIR</strong>, lalu upload kembali.
                </p>
                
                <input 
                    type="file"
                    ref={importFileRef}
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImport}
                />
                
                <div className="space-y-3">
                    <button 
                        onClick={() => importFileRef.current?.click()}
                        disabled={isImporting}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 hover:bg-slate-900 flex items-center justify-center gap-2"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <span>Pilih File Excel</span>
                    </button>
                    <button 
                        onClick={downloadTemplate}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <Download size={14} /> Download Template
                    </button>
                    <button 
                        onClick={() => setShowImportModal(false)}
                        className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600"
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

export default MeterInput;
