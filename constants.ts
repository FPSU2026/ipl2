
import { Settings } from './types';

// Translation Dictionary
export const TRANSLATIONS = {
  id: {
    menu_dashboard: "Dasbor",
    menu_setup: "Pengaturan",
    menu_users: "Manajemen Pengguna",
    menu_residents: "Data Warga",
    menu_meter: "Meteran Air",
    menu_billing: "Tagihan & Pembayaran",
    menu_arrears: "Tunggakan",
    menu_complaints: "Layanan Aduan",
    menu_bank: "Mutasi Bank",
    menu_transactions: "Transaksi Harian",
    menu_balance: "Neraca Keuangan",
    
    // Header Titles
    title_dashboard: "Dasbor Sistem",
    title_residents: "DATA WARGA",
    title_meter: "PENCATATAN METER",
    title_billing: "TAGIHAN",
    title_arrears: "TUNGGAKAN",
    title_complaints: "ADUAN WARGA",
    title_bank: "MUTASI BANK",
    title_transactions: "TRANSAKSI",
    title_balance: "NERACA KEUANGAN",
    title_setup: "PENGATURAN",
    title_users: "MANAJEMEN PENGGUNA",

    // Common
    lbl_profile: "Profil Saya",
    lbl_logout: "Keluar",
    greeting_morning: "Selamat Pagi",
    greeting_afternoon: "Selamat Siang",
    greeting_evening: "Selamat Sore",
    greeting_night: "Selamat Malam",
    footer_text: "Didukung oleh Gnome Comp",

    // Billing Specific
    bill_title: "Tagihan & Pembayaran",
    bill_period_data: "Data Periode",
    bill_history: "Riwayat Tagihan & Pembayaran",
    search_unit: "Cari unit...",
    status_all: "Semua",
    status_paid: "Lunas",
    status_unpaid: "Belum Bayar",
    th_house: "No. Rumah",
    th_bill_month: "Tagihan Bulan",
    th_period: "Periode Tagihan",
    th_total: "Total Bayar",
    th_status: "Status",
    th_action: "Aksi",
    
    // Modal & Actions
    modal_detail_title: "Rincian Tagihan",
    modal_pay_title: "Input Pembayaran",
    modal_pay_edit_title: "Ubah Pembayaran",
    lbl_method: "Metode Pembayaran",
    lbl_amount: "Jumlah Dibayar (Rp)",
    lbl_proof: "Bukti Transfer",
    btn_pay_now: "Bayar Sekarang",
    btn_confirm: "Konfirmasi Pembayaran",
    btn_save: "Simpan Perubahan",
    btn_print: "Cetak",
    btn_upload: "Unggah Bukti",
    
    // Costs
    cost_ipl: "Iuran Pemeliharaan Lingkungan (Kebersihan & Keamanan)",
    cost_kas: "Iuran Kas RT",
    cost_abodemen: "Abodemen Air",
    cost_water: "Biaya Air",
    cost_extra: "Biaya Lain-lain",
    cost_arrears: "Tunggakan Lalu",
    
    // Payment Methods
    method_cash: "Tunai",
    method_transfer: "Transfer"
  },
  en: {
    menu_dashboard: "Dashboard",
    menu_setup: "Settings",
    menu_users: "User Management",
    menu_residents: "Residents Data",
    menu_meter: "Water Meter",
    menu_billing: "Bills & Payments",
    menu_arrears: "Arrears",
    menu_complaints: "Complaints",
    menu_bank: "Bank Mutation",
    menu_transactions: "Daily Transactions",
    menu_balance: "Balance Sheet",

    // Header Titles
    title_dashboard: "System Dashboard",
    title_residents: "RESIDENTS DATA",
    title_meter: "METER RECORDING",
    title_billing: "BILLING",
    title_arrears: "ARREARS",
    title_complaints: "COMPLAINTS",
    title_bank: "BANK MUTATION",
    title_transactions: "TRANSACTIONS",
    title_balance: "BALANCE SHEET",
    title_setup: "SETTINGS",
    title_users: "USER MANAGEMENT",

    // Common
    lbl_profile: "My Profile",
    lbl_logout: "Logout",
    greeting_morning: "Good Morning",
    greeting_afternoon: "Good Afternoon",
    greeting_evening: "Good Evening",
    greeting_night: "Good Night",
    footer_text: "Powered by Gnome Comp",

    // Billing Specific
    bill_title: "Bills & Payments",
    bill_period_data: "Period Data",
    bill_history: "Billing History",
    search_unit: "Search unit...",
    status_all: "All",
    status_paid: "Paid",
    status_unpaid: "Unpaid",
    th_house: "House No.",
    th_bill_month: "Bill Month",
    th_period: "Billing Period",
    th_total: "Total Amount",
    th_status: "Status",
    th_action: "Action",

    // Modal & Actions
    modal_detail_title: "Bill Details",
    modal_pay_title: "Payment Input",
    modal_pay_edit_title: "Edit Payment",
    lbl_method: "Payment Method",
    lbl_amount: "Amount Paid (Rp)",
    lbl_proof: "Payment Proof",
    btn_pay_now: "Pay Now",
    btn_confirm: "Confirm Payment",
    btn_save: "Save Changes",
    btn_print: "Print",
    btn_upload: "Upload Proof",

    // Costs
    cost_ipl: "IPL Fee (Maintenance & Security)",
    cost_kas: "Community Fund",
    cost_abodemen: "Water Subscription",
    cost_water: "Water Usage",
    cost_extra: "Extra Fees",
    cost_arrears: "Previous Arrears",

    // Payment Methods
    method_cash: "Cash",
    method_transfer: "Transfer"
  }
};

export const DEFAULT_SETTINGS: Settings = {
  id: 'global-settings',
  location_name: 'GNOME COMP-TEST DRIVE',
  office_address: '', 
  
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
  water_rate_threshold: 10, 
  extra_fees: [],
  rtList: ['RT 01', 'RT 02', 'RT 03', 'RT 04', 'RT 05', 'RT 06'],
  rwList: ['RW 15'],
  transactionCategories: [
    { id: 'cat-inc-1', name: 'Iuran Warga (IPL & Air)', type: 'INCOME' },
    { id: 'cat-inc-2', name: 'Sumbangan / Donasi', type: 'INCOME' },
    { id: 'cat-inc-3', name: 'Sewa Fasilitas Warga', type: 'INCOME' },
    { id: 'cat-inc-4', name: 'Bunga Bank', type: 'INCOME' },
    { id: 'cat-exp-1', name: 'Gaji Keamanan (Satpam)', type: 'EXPENSE', expenseType: 'RUTIN' },
    { id: 'cat-exp-2', name: 'Gaji Kebersihan', type: 'EXPENSE', expenseType: 'RUTIN' },
    { id: 'cat-exp-3', name: 'Listrik & Air Fasum', type: 'EXPENSE', expenseType: 'RUTIN' },
    { id: 'cat-exp-4', name: 'Perbaikan Sarana', type: 'EXPENSE', expenseType: 'NON_RUTIN' },
    { id: 'cat-exp-5', name: 'Kegiatan Warga (17an dll)', type: 'EXPENSE', expenseType: 'NON_RUTIN' },
    { id: 'cat-exp-6', name: 'Konsumsi Rapat', type: 'EXPENSE', expenseType: 'NON_RUTIN' }
  ],
  whatsappTemplates: {
    billMessage: `*PEMBERITAHUAN TAGIHAN BARU*

Yth. Bapak/Ibu {NAMA} ({RUMAH})
Berikut rincian iuran periode {PERIODE}:

{RINCIAN}

*TOTAL TAGIHAN: Rp {TOTAL}*

Mohon segera melakukan pembayaran. Abaikan jika sudah membayar. Terima kasih.`,
    arrearsMessage: `*PEMBERITAHUAN TUNGGAKAN*

Yth. Bapak/Ibu {NAMA} ({RUMAH})
Mohon maaf, berdasarkan catatan kami terdapat tunggakan iuran sbb:

{RINCIAN}

*TOTAL TUNGGAKAN: Rp {TOTAL}*

Mohon bantuannya untuk segera diselesaikan. Terima kasih.`,
    reminderMessage: `*PENGINGAT (REMINDER) TAGIHAN*

Halo {NAMA} ({RUMAH}).
Mengingatkan perihal iuran bulanan berjalan dan tunggakan Anda sebesar *Rp {TOTAL}*.

Rincian:
{RINCIAN}

Mohon segera melakukan pelunasan demi kelancaran operasional lingkungan. Terima kasih.`,
    thanksMessage: `*TERIMA KASIH ATAS PEMBAYARAN*

Alhamdulillah, terima kasih {NAMA} ({RUMAH}).
Pembayaran Iuran/Tunggakan periode {PERIODE} sebesar *Rp {TOTAL}* telah kami terima pada {TANGGAL}.

Semoga lingkungan kita semakin nyaman dan aman.
*SALAM PENGURUS*`,
    receiptMessage: ``
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
