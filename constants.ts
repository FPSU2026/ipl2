
import { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  id: 'global-settings',
  location_name: 'GNOME COMP-TEST DRIVE',
  office_address: '', // Default empty
  language: 'id', // Default Language
  
  // Default Address
  address_rw: '',
  address_kelurahan: '',
  address_kecamatan: '',
  address_city: '',
  address_province: '',
  address_zip: '',
  admin_contact: '',

  ipl_base: 145000,
  kas_rt_base: 20000,
  water_abodemen: 15000,
  water_rate_low: 3500,
  water_rate_high: 4500,
  water_rate_threshold: 10, // Default threshold
  extra_fees: [],
  rtList: ['RT 01', 'RT 02', 'RT 03', 'RT 04', 'RT 05', 'RT 06'],
  rwList: ['RW 15'],
  transactionCategories: [
    { id: 'cat-inc-1', name: 'Iuran Warga (IPL & Air)', type: 'INCOME' },
    { id: 'cat-inc-2', name: 'Sumbangan / Donasi', type: 'INCOME' },
    { id: 'cat-inc-3', name: 'Sewa Fasilitas Warga', type: 'INCOME' },
    { id: 'cat-inc-4', name: 'Bunga Bank', type: 'INCOME' },
    
    // Expense - Rutin
    { id: 'cat-exp-1', name: 'Gaji Keamanan (Satpam)', type: 'EXPENSE', expenseType: 'RUTIN' },
    { id: 'cat-exp-2', name: 'Gaji Kebersihan', type: 'EXPENSE', expenseType: 'RUTIN' },
    { id: 'cat-exp-3', name: 'Listrik & Air Fasum', type: 'EXPENSE', expenseType: 'RUTIN' },
    
    // Expense - Non Rutin
    { id: 'cat-exp-4', name: 'Perbaikan Sarana', type: 'EXPENSE', expenseType: 'NON_RUTIN' },
    { id: 'cat-exp-5', name: 'Kegiatan Warga (17an dll)', type: 'EXPENSE', expenseType: 'NON_RUTIN' },
    { id: 'cat-exp-6', name: 'Konsumsi Rapat', type: 'EXPENSE', expenseType: 'NON_RUTIN' }
  ],
  whatsappTemplates: {
    billMessage: `*TAGIHAN {PERIODE}*

Kepada Yth. {NAMA} ({RUMAH})

Rincian Tagihan:
{RINCIAN}

*TOTAL TAGIHAN: Rp {TOTAL}*

Mohon segera melakukan pembayaran. Terima kasih.`,
    receiptMessage: `*BUKTI PEMBAYARAN*

Terima kasih {NAMA} ({RUMAH})
Pembayaran periode {PERIODE} telah kami terima.

Tanggal: {TANGGAL}
*JUMLAH DIBAYAR: Rp {TOTAL}*

Status: LUNAS`,
    arrearsMessage: `*PEMBERITAHUAN TUNGGAKAN*

Kepada Yth. {NAMA} ({RUMAH})

Berikut adalah rincian tunggakan iuran Anda:
{RINCIAN}

*TOTAL TUNGGAKAN: Rp {TOTAL}*

Mohon untuk segera menyelesaikan pembayaran. Terima kasih.`
  }
};

export const REVENUE_DISTRIBUTION = {
  RT: 0.50,
  RW: 0.25,
  DKM: 0.20,
  POSYANDU: 0.05
};

export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
