tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: {
                            50: '#f0fdf4',
                            100: '#dcfce7',
                            500: '#10b981',
                            600: '#059669',
                            700: '#047857',
                            800: '#065f46',
                        }
                    }
                }
            }
        }

// 1. Cek apakah startTime sudah ada di sessionStorage. Jika belum, simpan waktu sekarang.
        let startTime = sessionStorage.getItem('website_start_time');

        if (!startTime) {
            startTime = Date.now();
            sessionStorage.setItem('website_start_time', startTime);
        }

        function updateTimer() {
            // Hitung durasi berdasarkan waktu awal yang tersimpan di sessionStorage
            const elapsedTime = Math.floor((Date.now() - Number(startTime)) / 1000);

            const hours = Math.floor(elapsedTime / 3600);
            const minutes = Math.floor((elapsedTime % 3600) / 60);
            const seconds = elapsedTime % 60;

            const formattedHours = String(hours).padStart(2, '0');
            const formattedMinutes = String(minutes).padStart(2, '0');
            const formattedSeconds = String(seconds).padStart(2, '0');

            const timerElement = document.getElementById('time-counter');

            if (hours > 0) {
                timerElement.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
            } else {
                timerElement.textContent = `${formattedMinutes}:${formattedSeconds}`;
            }
        }

        setInterval(updateTimer, 1000);
        updateTimer();

        // Database Init & Storage
        let transactions = JSON.parse(localStorage.getItem('ahmad_cashflow_v2')) || [];
        

        let parsedBulkTemp = [];
        let extractedPdfText = ""; // Variabel penampung teks dari PDF
        
        // Chart.js Instances
        let cashflowChart = null;
        let balanceChart = null;
        let categoryChart = null;
        let stackedCategoryChart = null;
        let savingsRatioChart = null;
        let modalChartInstance = null; // Menahan instansi bagan modal jumbo
        let forecastModalChartInstance = null; // Menahan instansi bagan modal proyeksi

        let currentZoomScale = 1.0; // Menyimpan skala pembesaran grafik saat ini
        let currentEnlargedChartSourceId = ""; // Menyimpan ID sumber grafik jumbo aktif

        // Custom Confirm Handler
        function showCustomConfirm(title, message, callback) {
            const modal = document.getElementById('custom-confirm-modal');
            const tEl = document.getElementById('confirm-title');
            const mEl = document.getElementById('confirm-msg');
            const cancelBtn = document.getElementById('confirm-cancel-btn');
            const okBtn = document.getElementById('confirm-ok-btn');

            tEl.textContent = title;
            mEl.textContent = message;

            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
            }, 50);

            const cleanUp = () => {
                modal.classList.add('opacity-0');
                modal.querySelector('div').classList.add('scale-95');
                setTimeout(() => modal.classList.add('hidden'), 300);
            };

            cancelBtn.onclick = () => {
                cleanUp();
            };

            okBtn.onclick = () => {
                cleanUp();
                callback();
            };
        }

        // Tab switching controller
        function switchTab(tabId, el) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('border-emerald-600', 'text-emerald-600', 'font-semibold');
                btn.classList.add('border-transparent', 'text-slate-500', 'font-medium');
            });
            
            document.getElementById(tabId).classList.remove('hidden');
            el.classList.add('border-emerald-600', 'text-emerald-600', 'font-semibold');
            el.classList.remove('border-transparent', 'text-slate-500', 'font-medium');
        }

        // Mini Tabs Controller untuk membedah rutinitas (Langganan vs Transfer)
        window.switchRecurringTab = function(tabId, el) {
            document.getElementById('rec-subscriptions').classList.add('hidden');
            document.getElementById('rec-transfers').classList.add('hidden');
            document.querySelectorAll('.rec-tab-btn').forEach(btn => {
                btn.classList.remove('border-emerald-500', 'text-emerald-600', 'font-semibold');
                btn.classList.add('border-transparent', 'text-slate-500', 'font-medium');
            });
            
            document.getElementById(tabId).classList.remove('hidden');
            el.classList.add('border-emerald-500', 'text-emerald-600', 'font-semibold');
            el.classList.remove('border-transparent', 'text-slate-500', 'font-medium');
        }

        function saveToLocalStorage() {
            localStorage.setItem('ahmad_cashflow_v2', JSON.stringify(transactions));
            updateYearFilters();
            updateUI();
        }

        function formatRupiah(number) {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(number);
        }

        // Beautiful Toast Notification
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const iconSpan = document.getElementById('toast-icon');
            const msgSpan = document.getElementById('toast-message');

            msgSpan.textContent = message;
            if (type === 'success') {
                iconSpan.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i>';
            } else {
                iconSpan.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 text-rose-400"></i>';
            }
            lucide.createIcons();

            toast.classList.remove('translate-y-20', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');

            setTimeout(() => {
                toast.classList.remove('translate-y-0', 'opacity-100');
                toast.classList.add('translate-y-20', 'opacity-0');
            }, 3000);
        }

        async function handlePDFUpload(event) {
                const files = Array.from(event.target.files);
                if (files.length === 0) return;
            
                const statusEl = document.getElementById('pdf-status');
                let successCount = 0;
            
                for (const file of files) {
                    // 1. Validasi tipe file
                    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf');
                    if (!isPdf) {
                        showToast(`File "${file.name}" ditolak karena bukan PDF`, "error");
                        continue;
                    }
            
                    // 2. Ekstrak teks per file
                    try {
                        await processSinglePdfFile(file);
                        successCount++;
                    } catch (err) {
                        console.error(err);
                    }
                }
            
                // 3. Update status akhir
                if (statusEl) {
                    statusEl.innerText = `✅ Selesai mengekstrak ${successCount} dari ${files.length} file PDF! Silakan klik 'Analisis'.`;
                }
            
                // 4. Reset input
                event.target.value = '';
            }

            // Fungsi khusus membaca 1 file PDF dan menambahkan teksnya ke textarea
            async function processSinglePdfFile(file) {
                const statusEl = document.getElementById('pdf-status');
                const bulkInput = document.getElementById('bulk-input');
            
                if (statusEl) {
                    statusEl.innerText = `⏳ Membaca "${file.name}"...`;
                }
            
                try {
                    // Gunakan file.arrayBuffer() modern (lebih rapi dibanding FileReader)
                    const arrayBuffer = await file.arrayBuffer();
                    const typedarray = new Uint8Array(arrayBuffer);
                    
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let fileText = "";
                    
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        
                        let lastY = -1;
                        let pageText = "";
                        
                        // Menyatukan baris berdasarkan tinggi sumbu-Y (toleransi 5px)
                        textContent.items.forEach(function (item) {
                            if (lastY !== -1 && Math.abs(lastY - item.transform[5]) > 5) {
                                pageText += "\n"; 
                            }
                            pageText += item.str.trim() + " ";
                            lastY = item.transform[5];
                        });
                        
                        fileText += pageText + "\n";
                    }
            
                    // ✅ TAMBAHKAN TEKS KE TEXTAREA (Gunakan += agar tidak menimpa file sebelumnya)
                    if (bulkInput) {
                        bulkInput.value += `\n--- [ISI FILE: ${file.name}] ---\n` + fileText + "\n";
                    }
            
                    showToast(`Berhasil membaca "${file.name}"`, "success");
            
                } catch (error) {
                    console.error(`Error membaca PDF (${file.name}):`, error);
                    showToast(`Gagal membaca file "${file.name}"`, "error");
                    throw error; // Lempar error agar ditangkap oleh block catch di handlePDFUpload
                }
            }

        // SMART PARSER: Membedah data teks mutasi yang dicopy-paste + Proteksi Duplikat
        function handleBulkParse() {
            const textInput = document.getElementById('bulk-input').value;
            if (!textInput.trim()) {
                showToast("Tempel teks mutasi atau Upload PDF terlebih dahulu!", "error");
                return;
            }

            parsedBulkTemp = [];
            let duplicateLocalCount = 0;
            let duplicateGlobalCount = 0;
            const seenInCurrentImport = new Map();

            // Kamus konversi bulan Indonesia ke angka
            const indonesianMonths = {
                'januari': '01', 'jan': '01',
                'februari': '02', 'feb': '02',
                'maret': '03', 'mar': '03',
                'april': '04', 'apr': '04',
                'mei': '05', 'may': '05',
                'juni': '06', 'jun': '06',
                'juli': '07', 'jul': '07',
                'agustus': '08', 'agu': '08', 'aug': '08',
                'september': '09', 'sep': '09',
                'oktober': '10', 'okt': '10', 'oct': '10',
                'november': '11', 'nov': '11',
                'desember': '12', 'des': '12', 'dec': '12'
            };

            let internalIndex = 0;

            const processValidTx = (txDate, txType, txAmount, txDesc) => {
                txDesc = txDesc.replace(/\s+/g, ' ').trim();
                const txSignature = `${txDate}_${txType}_${txAmount}_${txDesc}`;

                if (seenInCurrentImport.has(txSignature)) {
                    duplicateLocalCount++;
                    return;
                }
                seenInCurrentImport.set(txSignature, true);

                const isExistingInDatabase = (transactions || []).some(existTx => {
                    return existTx.date === txDate && 
                           existTx.type === txType && 
                           existTx.amount === txAmount && 
                           existTx.description.trim() === txDesc;
                });

                const mode = document.querySelector('input[name="import-mode"]:checked').value;
                if (mode === 'append' && isExistingInDatabase) {
                    duplicateGlobalCount++;
                    return;
                }

                
                let category = 'Lainnya';
                const descUpper = txDesc.toUpperCase();

                // 1. Pemasukan (Gaji & Lainnya)
                if (descUpper.includes('GAJI') || descUpper.includes('SALARY') || descUpper.includes('PAYROLL') || descUpper.includes('TRANSFER DARI') || descUpper.includes('DANA MASUK')) {
                    category = 'Pemasukan Utama';
                } else if (descUpper.includes('CASHBACK') || descUpper.includes('BONUS') || descUpper.includes('REFUND') || descUpper.includes('REWARD')) {
                    category = 'Pemasukan Lainnya';
                }

                // 2. E-Wallet & Top Up
                else if (
                    descUpper.includes('FLIP') || descUpper.includes('FLIPTECH') || descUpper.includes('LENTERA') ||
                    descUpper.includes('DANA') || descUpper.includes('ESPAY') ||
                    descUpper.includes('GOPAY') || descUpper.includes('GO-PAY') || descUpper.includes('GOJEK') || descUpper.includes('GOTO') ||
                    descUpper.includes('OVO') || descUpper.includes('VISIONET') ||
                    descUpper.includes('SHOPEEPAY') || descUpper.includes('AIRPAY') ||
                    descUpper.includes('LINKAJA') || descUpper.includes('LINK AJA') || descUpper.includes('FINTEK KARYA') ||
                    descUpper.includes('ISAKU') || descUpper.includes('I-SAKU') || descUpper.includes('SAKUKU') ||
                    descUpper.includes('ASTRAPAY') || descUpper.includes('DOKU')
                ) {
                    category = 'E-Wallet & Top Up';
                }

                // 3. Cicilan & Pinjaman
                else if (
                    descUpper.includes('SPAYLATER') || descUpper.includes('SHOPEE LATER') ||
                    descUpper.includes('KREDIVO') || descUpper.includes('AKULAKU') ||
                    descUpper.includes('INDODANA') || descUpper.includes('CICILAN') || descUpper.includes('ANGSURAN')
                ) {
                    category = 'Cicilan & Pinjaman';
                }

                // 4. Tagihan & Utilitas
                else if (
                    descUpper.includes('PLN') || descUpper.includes('LISTRIK') || descUpper.includes('TOKEN') ||
                    descUpper.includes('PDAM') || descUpper.includes('AIR') ||
                    descUpper.includes('TLKM') || descUpper.includes('TELKOM') || descUpper.includes('INDIHOME') || descUpper.includes('BIZNET') ||
                    descUpper.includes('PULSA') || descUpper.includes('PAKET DATA')
                ) {
                    category = 'Tagihan & Utilitas';
                }

                // 5. Transportasi & Bensin
                else if (
                    descUpper.includes('PERTAMINA') || descUpper.includes('SPBU') || descUpper.includes('BENSIN') || descUpper.includes('SHELL') ||
                    descUpper.includes('MAXIM') || descUpper.includes('GRAB') || descUpper.includes('PARKIR') || descUpper.includes('TOL')
                ) {
                    category = 'Transportasi & Bensin';
                }

                // 6. Investasi & Tabungan
                else if (
                    descUpper.includes('BIBIT') || descUpper.includes('BAREKSA') || descUpper.includes('STOCKBIT') ||
                    descUpper.includes('PLUANIG') || descUpper.includes('ASETKU') || descUpper.includes('DEPOSITO') ||
                    descUpper.includes('REKSADANA') || descUpper.includes('SEKURITAS')
                ) {
                    category = 'Investasi & Tabungan';
                }

                // 7. Admin Bank
                else if (
                    descUpper.includes('MONTHLY FEE') || descUpper.includes('ADMIN FEE') || descUpper.includes('FEE') ||
                    descUpper.includes('ADMIN') || descUpper.includes('BIAYA ADM') || descUpper.includes('BIAYA LAYANAN')
                ) {
                    category = 'Admin Bank';
                }

                // 8. Belanja & QRIS
                else if (
                    descUpper.includes('QRIS') || descUpper.includes('PENARIKAN TUNAI') || descUpper.includes('WARUNG') ||
                    descUpper.includes('SUPERMARKET') || descUpper.includes('MINIMARKET') || descUpper.includes('ALFAMART') ||
                    descUpper.includes('INDOMARET') || descUpper.includes('TOKO')
                ) {
                    category = 'Belanja & QRIS';
                }

                // 9. Transfer Pihak Lain
                else if (
                    descUpper.includes('TRANSFER KE') || descUpper.includes('USWATUN') || descUpper.includes('DANA KELUAR') ||
                    descUpper.includes('TRANSFER') || descUpper.includes('TRF') || descUpper.includes('KIRIM')
                ) {
                    category = 'Transfer Pihak Lain';
                }

                parsedBulkTemp.push({
                    id: 'bulk_' + internalIndex++ + '_' + Date.now(),
                    date: txDate,
                    type: txType,
                    category: category,
                    description: txDesc,
                    amount: txAmount
                });
            };

            // ==============================================================
            // 1. PRE-PROCESSOR KHUSUS BSI (GLOBAL MULTILINE EXTRACTION)
            // ==============================================================
            // Perbaiki angka BSI yang pecah seperti "312.000 ,00" menjadi "312.000,00"
            let workingText = textInput.replace(/\s+,/g, ',');

            // Pola untuk membersihkan teks sampah BSI dari deskripsi
            const junkWords = /PERIODE LAPORAN|REKENING|RINGKASAN TRANSAKSI|Date & Time|Detail Transaksi|No Reff|Debit|Kredit|Saldo|ahmad juwaini|JL RAYA LAMPIHONG|BYOND/gi;

            const bsiNum = "(0[,\\.]00|[1-9]\\d{0,2}(?:\\.\\d{3})*[,\\.]\\d{2})";
            
            // FOKUS PERBAIKAN: Tambahkan deteksi WAKTU (\d{2}:\d{2}) setelah tahun. 
            // Ini mencegah regex secara tidak sengaja membaca "31 Mei 2026" dari Header Laporan yang tidak memiliki jam.
            const bsiRegex = new RegExp(`(\\d{1,2})\\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Jan|Feb|Mar|Apr|Jun|Jul|Agu|Sep|Okt|Nov|Des)\\s+(\\d{4})\\s+(\\d{2}:\\d{2})([\\s\\S]*?)(FT[A-Z0-9]{5,})\\s*(?:\\|)?\\s*${bsiNum}\\s*(?:\\|)?\\s*${bsiNum}`, 'gi');

            let match;
            while ((match = bsiRegex.exec(workingText)) !== null) {
                const dayStr = match[1];
                const monthStr = match[2];
                const yearStr = match[3];
                const timeStr = match[4]; // Jam dipisah agar tidak masuk mengotori teks deskripsi
                let descRaw = match[5];
                const refNo = match[6];
                const debitStr = match[7];
                const creditStr = match[8];
                
                const monthLower = monthStr.toLowerCase();
                const monthNum = indonesianMonths[monthLower] || '01';
                const txDate = `${yearStr}-${monthNum}-${dayStr.padStart(2, '0')}`;

                // BERSIHKAN DESKRIPSI: Buang sampah dan batasi panjang
                let txDesc = descRaw
                    .replace(junkWords, '') // Hapus teks sampah
                    .replace(/\||-/g, ' ') // Hilangkan simbol pemisah seperti pipa | atau strip -
                    .replace(/\n/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // Tambahkan nomor referensi agar deskripsi tetap informatif
                txDesc = `${txDesc} ${refNo}`.trim();

                const parseBsiAmt = (str) => {
                    let clean = str.replace(/[,\\.]00$/, '');
                    clean = clean.replace(/[\\.,]/g, '');
                    return parseFloat(clean) || 0;
                };

                const debit = parseBsiAmt(debitStr);
                const credit = parseBsiAmt(creditStr);

                let txType = (credit > 0) ? 'income' : 'expense';
                let txAmount = (credit > 0) ? credit : debit;

                if (txAmount > 0) {
                    processValidTx(txDate, txType, txAmount, txDesc);
                }
            }

            // ==============================================================
            // 2. PARSER BARIS PER BARIS (UNTUK BRI, LINKAJA, & FALLBACK)
            // ==============================================================
            const lines = workingText.split('\n');

            const briRegex = /^(\d{2}\/\d{2}\/\d{2})(?:\s+\d{2}:\d{2}:\d{2})?\s+(.*?)(?:\s+\d{7,})?\s+([\d,\.]+)\s+([\d,\.]+)\s+[\d,\.]+$/i;
            const linkAjaRegex = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})\s+(.*?)\s+Rp([\d\.]+)(?:\s+Rp[\d\.]+)?$/i;

            lines.forEach((line) => {
                line = line.trim();
                if (!line) return;

                let txDate = null;
                let txType = null;
                let txAmount = 0;
                let txDesc = "";

                const briMatch = line.match(briRegex);
                if (briMatch) {
                    const [ , dateStr, descStr, debitStr, creditStr ] = briMatch;
                    const parts = dateStr.split('/');
                    txDate = `20${parts[2]}-${parts[1]}-${parts[0]}`; // Convert format DD/MM/YY
                    txDesc = descStr.trim();
                    
                    const debit = parseFloat(debitStr.replace(/,/g, ''));
                    const credit = parseFloat(creditStr.replace(/,/g, ''));
                    
                    if (credit > 0 && debit === 0) {
                        txType = 'income';
                        txAmount = credit;
                    } else if (debit > 0 && credit === 0) {
                        txType = 'expense';
                        txAmount = debit;
                    } else if (debit > 0 && credit > 0) {
                        return; // Hindari anomali jika kedua kolom terisi
                    }
                } 
                else {
                    const linkAjaMatch = line.match(linkAjaRegex);
                    if (linkAjaMatch) {
                        const [ , dayStr, monthStr, yearStr, descStr, amountStr ] = linkAjaMatch;
                        
                        const monthLower = monthStr.toLowerCase();
                        const monthNum = indonesianMonths[monthLower] || '01';
                        const paddedDay = dayStr.padStart(2, '0');
                        
                        txDate = `${yearStr}-${monthNum}-${paddedDay}`;
                        txDesc = descStr.trim();
                        txAmount = parseFloat(amountStr.replace(/\./g, ''));
                        
                        const descUpper = txDesc.toUpperCase();
                        if (descUpper.includes('ISI SALDO') || descUpper.includes('PENGEMBALIAN')) {
                            txType = 'income';
                        } else {
                            txType = 'expense';
                        }
                    }
                    else {
                        // Fallback Generic
                        let parts = line.split('\t').map(p => p.trim());
                        if (parts.filter(p => p !== "").length < 3) {
                            parts = line.split(/\s{2,}/).map(p => p.trim());
                        }

                        const cleanParts = parts.filter(p => p !== "");
                        if (cleanParts.length >= 3) {
                            const dateRaw = cleanParts[0];
                            const dateRegexGen = /^(\d{2})[-/\s](\d{2})[-/\s](\d{4})$/;
                            const matchGen = dateRaw.match(dateRegexGen);

                            if (matchGen) {
                                txDate = `${matchGen[3]}-${matchGen[2]}-${matchGen[1]}`;
                                const amountRaw = cleanParts[2];
                                txDesc = cleanParts.slice(3).join(' ') || cleanParts[1] || 'Tanpa keterangan';
                                
                                const isExpenseStr = amountRaw.includes('-');
                                txAmount = parseFloat(amountRaw.replace(/[^0-9]/g, ''));
                                txType = isExpenseStr ? 'expense' : 'income';
                            }
                        }
                    }
                }

                if (txDate && txType && txAmount && !isNaN(txAmount) && txAmount > 0) {
                    processValidTx(txDate, txType, txAmount, txDesc);
                }
            });

            if (parsedBulkTemp.length === 0) {
                if (duplicateGlobalCount > 0) {
                    showToast(`Semua mutasi yang dibaca sudah tercatat di database Anda! (${duplicateGlobalCount} data diabaikan)`, "error");
                } else {
                    showToast("Sistem tidak dapat mendeteksi tabel mutasi yang valid.", "error");
                }
                return;
            }

            document.getElementById('parsed-count').innerText = parsedBulkTemp.length;
            renderBulkPreviewTable();
            document.getElementById('bulk-preview-area').classList.remove('hidden');

            let toastMsg = `Berhasil mengekstrak ${parsedBulkTemp.length} transaksi!`;
            if (duplicateLocalCount > 0 || duplicateGlobalCount > 0) {
                toastMsg += ` (${duplicateLocalCount + duplicateGlobalCount} duplikat diabaikan)`;
            }
            showToast(toastMsg, "success");
        }

        // Render preview table inside Bulk tab dengan editable category dropdown
        function renderBulkPreviewTable() {
            const body = document.getElementById('bulk-preview-body');
            body.innerHTML = parsedBulkTemp.map((tx, idx) => {
                const badgeColor = tx.type === 'income' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200';
                
                const amountPrefix = tx.type === 'income' ? '+' : '-';
                const amountColor = tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600';

                return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-4 text-xs font-semibold text-slate-600">${tx.date}</td>
                        <td class="p-4">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}">
                                ${tx.type === 'income' ? 'Kredit' : 'Debit'}
                            </span>
                        </td>
                        <td class="p-4">
                            <select onchange="updateParsedCategory(${idx}, this.value)" class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:ring-1 focus:ring-emerald-500">
                                <option value="Pemasukan Utama" ${tx.category === 'Pemasukan Utama' ? 'selected' : ''}>Pemasukan Utama (Gaji & Utama)</option>
                                <option value="Pemasukan Lainnya" ${tx.category === 'Pemasukan Lainnya' ? 'selected' : ''}>Pemasukan Lainnya (Bonus, Freelance & Cashback)</option>
                                <option value="E-Wallet & Top Up" ${tx.category === 'E-Wallet & Top Up' ? 'selected' : ''}>E-Wallet & Top Up (DANA, GoPay, OVO, ShopeePay, Flip, dll)</option>
                                <option value="Cicilan & Pinjaman" ${tx.category === 'Cicilan & Pinjaman' ? 'selected' : ''}>Cicilan & Pinjaman (SPayLater, Kredivo, Bank, dll)</option>
                                <option value="Transfer Pihak Lain" ${tx.category === 'Transfer Pihak Lain' ? 'selected' : ''}>Transfer Pihak Lain (Keluarga, Teman, Kirim Uang)</option>
                                <option value="Belanja & QRIS" ${tx.category === 'Belanja & QRIS' ? 'selected' : ''}>Belanja & QRIS (Supermarket, Harian, Merchant)</option>
                                <option value="Makan & Minum" ${tx.category === 'Makan & Minum' ? 'selected' : ''}>Makan & Minum (Resto, Cafe, Gofood/Grabfood)</option>
                                <option value="Tagihan & Utilitas" ${tx.category === 'Tagihan & Utilitas' ? 'selected' : ''}>Tagihan & Utilitas (Listrik/PLN, Air/PDAM, Pulsa & Internet)</option>
                                <option value="Investasi & Tabungan" ${tx.category === 'Investasi & Tabungan' ? 'selected' : ''}>Investasi & Tabungan (Reksadana, Saham, Emas, Crypto)</option>
                                <option value="Transportasi & Bensin" ${tx.category === 'Transportasi & Bensin' ? 'selected' : ''}>Transportasi & Bensin (BBM, Ojol, Parkir, Tol)</option>
                                <option value="Admin Bank" ${tx.category === 'Admin Bank' ? 'selected' : ''}>Admin Bank & Biaya Layanan</option>
                                <option value="Lainnya" ${tx.category === 'Lainnya' ? 'selected' : ''}>Lainnya / Pengeluaran Tak Terduga</option>
                            </select>
                        </td>
                        <td class="p-4 text-xs font-medium text-slate-800">${tx.description}</td>
                        <td class="p-4 text-xs font-bold text-right ${amountColor}">${amountPrefix} ${formatRupiah(tx.amount)}</td>
                    </tr>
                `;
            }).join('');
        }
        

        window.updateParsedCategory = function(index, value) {
            if (parsedBulkTemp[index]) {
                parsedBulkTemp[index].category = value;
            }
        }

        function commitBulkImport() {
            if (parsedBulkTemp.length === 0) return;

            const mode = document.querySelector('input[name="import-mode"]:checked').value;

            if (mode === 'overwrite') {
                transactions = [...parsedBulkTemp];
            } else {
                transactions = [...transactions, ...parsedBulkTemp];
            }

            saveToLocalStorage();
            document.getElementById('bulk-input').value = '';
            document.getElementById('bulk-preview-area').classList.add('hidden');
            parsedBulkTemp = [];
            
            showToast("Semua data berhasil disimpan ke database lokal!", "success");
            switchTab('dashboard-tab', document.querySelector('.tab-btn'));
        }

        // Global UI Refresh
        function updateUI() {
            renderTotals();
            renderTable();
            renderAnalyticCharts();
        }

        // DYNAMIC YEAR FILTER INJECTOR dengan ALL YEARS
        function updateYearFilters() {
            const filterIds = ['chart-year', 'analysis-cat-year', 'stacked-year', 'ratio-year'];
            let years = [...new Set((transactions || []).map(t => new Date(t.date).getFullYear().toString()))];
            
            // Filter ringan: Hindari kesalahan NaN (Bug Fix)
            years = years.filter(y => y !== 'NaN' && !isNaN(y));

            if (years.length === 0) {
                years = ['2026', '2025', '2024'];
            }
            
            years.sort((a, b) => b - a);

            filterIds.forEach(id => {
                const selectEl = document.getElementById(id);
                if (!selectEl) return;
                
                const currentSelection = selectEl.value;
                
                let optionsHtml = `<option value="ALL">Semua Tahun</option>`;
                optionsHtml += years.map(y => `<option value="${y}">${y}</option>`).join('');
                
                selectEl.innerHTML = optionsHtml;
                
                if (currentSelection && (years.includes(currentSelection) || currentSelection === 'ALL')) {
                    selectEl.value = currentSelection;
                } else {
                    selectEl.value = 'ALL';
                }
            });
        }

        // Hitung total nilai kartu secara dinamis menyesuaikan filter tahun global
        function renderTotals() {
            let income = 0;
            let expense = 0;
            const currentYearFilter = document.getElementById('chart-year').value;

            transactions.forEach(t => {
                const amt = parseFloat(t.amount) || 0;
                const d = new Date(t.date);
                const tYear = d.getFullYear().toString();

                if (currentYearFilter === 'ALL' || tYear === currentYearFilter) {
                    if (t.type === 'income') {
                        income += amt;
                    } else {
                        expense += amt;
                    }
                }
            });

            const balance = income - expense;

            document.getElementById('total-income').innerText = formatRupiah(income);
            document.getElementById('total-expense').innerText = formatRupiah(expense);
            document.getElementById('net-balance').innerText = formatRupiah(balance);

            // Perbarui sub-label pada kartu agar pengguna tahu filter sedang aktif
            const labelSuffix = currentYearFilter === 'ALL' ? "seluruh waktu" : `tahun ${currentYearFilter}`;
            document.getElementById('income-filter-label').innerText = `Akumulasi ${labelSuffix}`;
            document.getElementById('expense-filter-label').innerText = `Akumulasi ${labelSuffix}`;

            const cardBg = document.getElementById('balance-card-bg');
            const iconBg = document.getElementById('balance-icon-bg');
            const icon = document.getElementById('balance-icon');
            const title = document.getElementById('balance-title');
            const subtitle = document.getElementById('balance-subtitle');

            if (cardBg) {
                if (balance >= 5000000) {
                    cardBg.className = "group cursor-pointer hover:shadow-md bg-emerald-50 rounded-2xl p-6 border border-emerald-200 relative overflow-hidden transition-all duration-300";
                    if (iconBg) iconBg.className = "p-1.5 bg-emerald-100 rounded-lg text-emerald-600 flex items-center justify-center";
                    if (icon) icon.className = "w-4 h-4 text-emerald-600 transition-colors duration-300";
                    if (title) title.className = "text-emerald-800 font-semibold text-sm";
                    if (subtitle) {
                        subtitle.className = "text-xs text-emerald-600 mt-1";
                        subtitle.innerText = "Kondisi tabungan sangat sehat!";
                    }
                } else if (balance > 0) {
                    cardBg.className = "group cursor-pointer hover:shadow-md bg-blue-50 rounded-2xl p-6 border border-blue-200 relative overflow-hidden transition-all duration-300";
                    if (iconBg) iconBg.className = "p-1.5 bg-blue-100 rounded-lg text-blue-600 flex items-center justify-center";
                    if (icon) icon.className = "w-4 h-4 text-blue-600 transition-colors duration-300";
                    if (title) title.className = "text-blue-800 font-semibold text-sm";
                    if (subtitle) {
                        subtitle.className = "text-xs text-blue-600 mt-1";
                        subtitle.innerText = "Tabungan bertumbuh aman";
                    }
                } else {
                    cardBg.className = "group cursor-pointer hover:shadow-md bg-rose-50 rounded-2xl p-6 border border-rose-200 relative overflow-hidden transition-all duration-300";
                    if (iconBg) iconBg.className = "p-1.5 bg-rose-100 rounded-lg text-rose-600 flex items-center justify-center";
                    if (icon) icon.className = "w-4 h-4 text-rose-600 transition-colors duration-300";
                    if (title) title.className = "text-rose-800 font-semibold text-sm";
                    if (subtitle) {
                        subtitle.className = "text-xs text-rose-600 mt-1";
                        subtitle.innerText = "Saldo kritis, batasi pengeluaran!";
                    }
                }
            }
        }

        // Render data mutasi di tabel riwayat lengkap
        function renderTable() {
            const tableBody = document.getElementById('transaction-table-body');
            const searchVal = document.getElementById('search-input').value.toLowerCase();
            const filterType = document.getElementById('filter-type').value;
            const filterCat = document.getElementById('filter-category').value;

            const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

            const filtered = sorted.filter(t => {
                const matchSearch = t.description.toLowerCase().includes(searchVal);
                const matchType = filterType === 'all' || t.type === filterType;
                const matchCat = filterCat === 'all' || t.category === filterCat;
                return matchSearch && matchType && matchCat;
            });

            document.getElementById('displayed-count').innerText = filtered.length;

            if (filtered.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-8 text-center text-slate-400 text-sm">
                            Tidak ada transaksi. Silakan input manual atau gunakan fitur Bulk Paste.
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = filtered.map(t => {
                const badgeColor = t.type === 'income' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200';
                
                const amountPrefix = t.type === 'income' ? '+' : '-';
                const amountColor = t.type === 'income' ? 'text-emerald-600' : 'text-rose-600';

                return `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-4 text-sm text-slate-600 whitespace-nowrap">${formatDateString(t.date)}</td>
                        <td class="p-4 whitespace-nowrap">
                            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeColor}">
                                ${t.category}
                            </span>
                        </td>
                        <td class="p-4 text-sm font-medium text-slate-800">${t.description}</td>
                        <td class="p-4 text-sm font-bold text-right whitespace-nowrap ${amountColor}">
                            ${amountPrefix} ${formatRupiah(t.amount)}
                        </td>
                        <td class="p-4 text-center whitespace-nowrap">
                            <div class="flex items-center justify-center space-x-2">
                                <button onclick="editTransaction('${t.id}')" class="text-emerald-600 hover:bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors">Edit</button>
                                <button onclick="deleteTransaction('${t.id}')" class="text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors">Hapus</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function formatDateString(dateStr) {
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return new Date(dateStr).toLocaleDateString('id-ID', options);
        }

        // Manual Input / Edit Handler
        document.getElementById('transaction-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const payload = {
                id: id || Date.now().toString(),
                date: document.getElementById('date').value,
                description: document.getElementById('description').value,
                category: document.getElementById('category').value,
                amount: parseFloat(document.getElementById('amount').value),
                type: document.querySelector('input[name="type"]:checked').value
            };

            if (id) {
                transactions = transactions.map(t => t.id === id ? payload : t);
                showToast("Transaksi berhasil diperbarui");
            } else {
                transactions.push(payload);
                showToast("Transaksi berhasil ditambahkan");
            }

            resetForm();
            saveToLocalStorage();
        });

        window.editTransaction = function(id) {
            const t = transactions.find(tx => tx.id === id);
            if (!t) return;

            document.getElementById('edit-id').value = t.id;
            document.getElementById('date').value = t.date;
            document.getElementById('description').value = t.description;
            document.getElementById('category').value = t.category;
            document.getElementById('amount').value = t.amount;

            const radioType = document.getElementsByName('type');
            radioType.forEach(input => input.checked = (input.value === t.type));

            document.getElementById('submit-btn').innerHTML = '<i data-lucide="save" class="w-4 h-4"></i><span>Simpan Perubahan</span>';
            document.getElementById('cancel-edit-btn').classList.remove('hidden');
            
            switchTab('dashboard-tab', document.querySelector('.tab-btn'));
            document.getElementById('transaction-form').scrollIntoView({ behavior: 'smooth' });
            lucide.createIcons();
        }

        window.deleteTransaction = function(id) {
            showCustomConfirm(
                "Hapus Catatan?",
                "Apakah Anda yakin ingin menghapus catatan mutasi ini?",
                () => {
                    transactions = transactions.filter(t => t.id !== id);
                    saveToLocalStorage();
                    showToast("Catatan mutasi berhasil dihapus");
                }
            );
        }

        function resetForm() {
            document.getElementById('transaction-form').reset();
            document.getElementById('edit-id').value = '';
            document.getElementById('submit-btn').innerHTML = '<i data-lucide="plus-circle" class="w-4 h-4"></i><span>Simpan Transaksi</span>';
            document.getElementById('cancel-edit-btn').classList.add('hidden');
            lucide.createIcons();
        }

        window.resetWholeDatabase = function() {
            showCustomConfirm(
                "Kosongkan Database?",
                "PENTING: Seluruh mutasi Anda akan dihapus permanen dari browser ini.",
                () => {
                    transactions = [];
                    saveToLocalStorage();
                    showToast("Seluruh database telah dikosongkan", "error");
                }
            );
        }

        // Ekspor & Impor Data (JSON Backup)
        function exportJSONBackup() {
            if (transactions.length === 0) {
                showToast("Tidak ada data untuk diekspor", "error");
                return;
            }
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `cashflow_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            showToast("Backup JSON berhasil diunduh!");
        }

        function triggerImport() {
            document.getElementById('import-file-input').click();
        }

        function importJSONBackup(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (Array.isArray(importedData)) {
                        transactions = importedData;
                        saveToLocalStorage();
                        showToast("Data backup berhasil diimpor!", "success");
                    } else {
                        showToast("Format file JSON tidak cocok.", "error");
                    }
                } catch (err) {
                    showToast("Gagal membaca file JSON.", "error");
                }
            };
            reader.readAsText(file);
            event.target.value = ""; // Reset input file
        }

        // Helper untuk parse bulan dan tahun dari label chart
        function getMonthYearFromLabel(label, currentYearFilter) {
            const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const parts = label.split(' ');
            let targetMonth = -1;
            let targetYear = -1;

            if (parts.length === 2) {
                const monthStr = parts[0];
                const yearShort = parts[1]; // misal "25"
                targetMonth = monthsShort.indexOf(monthStr);
                targetYear = 2000 + parseInt(yearShort);
            } else {
                targetMonth = monthsShort.indexOf(label);
                targetYear = currentYearFilter === 'ALL' ? -1 : parseInt(currentYearFilter);
            }
            return { month: targetMonth, year: targetYear };
        }

        // MESIN DRILL-DOWN UTAMA UNTUK INTERAKSI KLIK GRAFIK
        function handleChartDrilldown(chartId, label, datasetLabel) {
            if (!label) return;
            
            let filteredList = [];
            let modalTitleText = "";

            if (chartId === 'cashflowChart') {
                const { month, year } = getMonthYearFromLabel(label, document.getElementById('chart-year').value);
                const type = datasetLabel.includes('Pemasukan') ? 'income' : 'expense';
                
                filteredList = transactions.filter(t => {
                    const d = new Date(t.date);
                    const matchTime = (d.getMonth() === month) && (year === -1 || d.getFullYear() === year);
                    return matchTime && t.type === type;
                });
                modalTitleText = `Audit ${datasetLabel} (${label})`;
            } 
            else if (chartId === 'balanceChart') {
                const { month, year } = getMonthYearFromLabel(label, document.getElementById('chart-year').value);
                
                filteredList = transactions.filter(t => {
                    const d = new Date(t.date);
                    return (d.getMonth() === month) && (year === -1 || d.getFullYear() === year);
                });
                modalTitleText = `Semua Mutasi Kas Periode ${label}`;
            } 
            else if (chartId === 'categoryChart') {
                const catYear = document.getElementById('analysis-cat-year').value;
                const catMonth = document.getElementById('analysis-cat-month').value;
                
                filteredList = transactions.filter(t => {
                    if (t.category !== label) return false;
                    const d = new Date(t.date);
                    if (catYear !== 'ALL' && d.getFullYear().toString() !== catYear) return false;
                    if (catMonth !== 'ALL' && d.getMonth().toString() !== catMonth) return false;
                    return true;
                });
                modalTitleText = `Audit Kategori: ${label}`;
            } 
            else if (chartId === 'stackedCategoryChart') {
                const catMap = {
                    'Pemasukan Utama': 'Pemasukan Utama',
                    'Pemasukan Lainnya': 'Pemasukan Lainnya',
                    'E-Wallet': 'E-Wallet & Top Up',
                    'Cicilan': 'Cicilan & Pinjaman',
                    'Transfer Out': 'Transfer Pihak Lain',
                    'Belanja & QRIS': 'Belanja & QRIS',
                    'Makan & Minum': 'Makan & Minum',
                    'Tagihan': 'Tagihan & Utilitas',
                    'Investasi': 'Investasi & Tabungan',
                    'Transportasi': 'Transportasi & Bensin',
                    'Admin Bank': 'Admin Bank',
                    'Lainnya': 'Lainnya'
                };
                const fullCategoryName = catMap[datasetLabel] || datasetLabel;
                const { month, year } = getMonthYearFromLabel(label, document.getElementById('stacked-year').value);
                
                filteredList = transactions.filter(t => {
                    if (t.category !== fullCategoryName || t.type !== 'expense') return false;
                    const d = new Date(t.date);
                    return (d.getMonth() === month) && (year === -1 || d.getFullYear() === year);
                });
                modalTitleText = `Audit Kategori ${fullCategoryName} (${label})`;
            }
            else if (chartId === 'savingsRatioChart') {
                const ratioYear = document.getElementById('ratio-year').value;
                const isSurplus = label.includes('Surplus');
                
                filteredList = transactions.filter(t => {
                    const d = new Date(t.date);
                    if (ratioYear !== 'ALL' && d.getFullYear().toString() !== ratioYear) return false;
                    return isSurplus ? t.type === 'income' : t.type === 'expense';
                });
                modalTitleText = `Audit Rasio: ${label} (${ratioYear === 'ALL' ? 'Seluruh Waktu' : ratioYear})`;
            }

            // Tampilkan rincian item di dalam modal yang dipercantik
            showChartItemsInModal(modalTitleText, filteredList);
        }

        // Render data hasil klik sub-grafik ke dalam modal detail
        function showChartItemsInModal(titleText, list) {
            const modal = document.getElementById('card-detail-modal');
            const iconContainer = document.getElementById('modal-card-icon-container');
            const titleEl = document.getElementById('modal-card-title');
            const subtitleEl = document.getElementById('modal-card-subtitle');
            const summaryValEl = document.getElementById('modal-card-summary-val');
            const summaryCountEl = document.getElementById('modal-card-summary-count');
            const tableBody = document.getElementById('modal-card-table-body');

            if (titleEl) titleEl.textContent = titleText;
            if (subtitleEl) subtitleEl.textContent = "Data terperinci dari audit interaktif segmen grafik";

            if (iconContainer) {
                iconContainer.className = "p-2 bg-indigo-600 rounded-xl text-white";
                iconContainer.innerHTML = '<i data-lucide="bar-chart-3" class="w-5 h-5"></i>';
            }

            // Hitung total nilai
            const total = list.reduce((sum, t) => {
                return t.type === 'income' ? sum + t.amount : sum - t.amount;
            }, 0);

            if (summaryValEl) {
                summaryValEl.textContent = formatRupiah(total);
                summaryValEl.className = total >= 0 ? "text-lg font-black text-emerald-600" : "text-lg font-black text-rose-600";
            }
            if (summaryCountEl) summaryCountEl.textContent = `${list.length} Transaksi`;

            if (tableBody) {
                if (list.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400">Tidak ada rincian transaksi untuk segmen ini.</td></tr>`;
                } else {
                    tableBody.innerHTML = list.map(t => {
                        const amtColor = t.type === 'income' ? 'text-emerald-600' : 'text-rose-600';
                        const amtPrefix = t.type === 'income' ? '+' : '-';
                        return `
                            <tr class="hover:bg-slate-50 transition-colors">
                                <td class="p-3 text-slate-500 font-semibold whitespace-nowrap">${formatDateString(t.date)}</td>
                                <td class="p-3">
                                    <span class="font-bold text-slate-800 block">${t.description}</span>
                                    <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold mt-1 inline-block">${t.category}</span>
                                </td>
                                <td class="p-3 text-right font-black ${amtColor} whitespace-nowrap">${amtPrefix} ${formatRupiah(t.amount)}</td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    modal.querySelector('div').classList.remove('scale-95');
                }, 50);
            }
            lucide.createIcons();
        }

        // COMPREHENSIVE ANALYTICS RENDER ENGINE
        function renderAnalyticCharts() {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            const sortedAsc = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
            const mainYear = document.getElementById('chart-year').value;
            
            let labels = [];
            let incData = [];
            let expData = [];
            let cumBalance = [];

            // ----------------------------------------------------
            // LOGIKA TIMELINE DINAMIS UNTUK CHART 1 & 2
            // ----------------------------------------------------
            if (mainYear === 'ALL') {
                if (sortedAsc.length === 0) {
                    labels = months;
                    incData = Array(12).fill(0);
                    expData = Array(12).fill(0);
                    cumBalance = Array(12).fill(0);
                } else {
                    const firstDate = new Date(sortedAsc[0].date);
                    const lastDate = new Date(sortedAsc[sortedAsc.length - 1].date);
                    
                    let curYear = firstDate.getFullYear();
                    let curMonth = firstDate.getMonth();
                    
                    const endYear = lastDate.getFullYear();
                    const endMonth = lastDate.getMonth();
                    
                    let runningBalance = 0;

                    // Mengulang bulan-demi-bulan dari transaksi paling awal ke transaksi paling akhir
                    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
                        labels.push(`${months[curMonth]} ${String(curYear).slice(-2)}`);
                        
                        let monthInc = 0;
                        let monthExp = 0;
                        
                        sortedAsc.forEach(t => {
                            const d = new Date(t.date);
                            if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
                                if (t.type === 'income') {
                                    monthInc += t.amount;
                                    runningBalance += t.amount;
                                } else {
                                    monthExp += t.amount;
                                    runningBalance -= t.amount;
                                }
                            }
                        });
                        
                        incData.push(monthInc);
                        expData.push(monthExp);
                        cumBalance.push(runningBalance);
                        
                        curMonth++;
                        if (curMonth > 11) {
                            curMonth = 0;
                            curYear++;
                        }
                    }
                }
            } else {
                // Kasus jika Memilih Tahun Tertentu (Tampilan Jan - Des)
                labels = months;
                incData = Array(12).fill(0);
                expData = Array(12).fill(0);
                cumBalance = Array(12).fill(0);
                
                // Cari saldo bawaan (carry-over) sebelum tahun berjalan dimulai
                let carryOverBalance = 0;
                sortedAsc.forEach(t => {
                    const d = new Date(t.date);
                    if (d.getFullYear() < parseInt(mainYear)) {
                        if (t.type === 'income') carryOverBalance += t.amount;
                        else carryOverBalance -= t.amount;
                    }
                });
                
                let runningBalance = carryOverBalance;
                
                for (let m = 0; m < 12; m++) {
                    let monthInc = 0;
                    let monthExp = 0;
                    
                    sortedAsc.forEach(t => {
                        const d = new Date(t.date);
                        if (d.getFullYear().toString() === mainYear && d.getMonth() === m) {
                            if (t.type === 'income') {
                                monthInc += t.amount;
                                runningBalance += t.amount;
                            } else {
                                monthExp += t.amount;
                                runningBalance -= t.amount;
                            }
                        }
                    });
                    
                    incData[m] = monthInc;
                    expData[m] = monthExp;
                    cumBalance[m] = runningBalance;
                }
            }

            const chartHoverCursor = {
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                }
            };

            // Render Chart 1: Cashflow Overview
            const ctx1 = document.getElementById('cashflowChart').getContext('2d');
            if (cashflowChart) cashflowChart.destroy();
            cashflowChart = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Pemasukan (Kredit)', data: incData, backgroundColor: '#059669', borderRadius: 6 },
                        { label: 'Pengeluaran (Debit)', data: expData, backgroundColor: '#e11d48', borderRadius: 6 }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    onHover: chartHoverCursor.onHover,
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const i = elements[0].index;
                            const datasetIndex = elements[0].datasetIndex;
                            const label = chart.data.labels[i];
                            const datasetLabel = chart.data.datasets[datasetIndex].label;
                            handleChartDrilldown('cashflowChart', label, datasetLabel);
                        }
                    },
                    plugins: { legend: { labels: { font: { family: 'Plus Jakarta Sans' } } } }
                }
            });

            // Render Chart 2: Cumulative Balance Trend
            const ctx2 = document.getElementById('balanceChart').getContext('2d');
            if (balanceChart) balanceChart.destroy();
            balanceChart = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Sisa Saldo Kumulatif',
                        data: cumBalance,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.05)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 3
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    onHover: chartHoverCursor.onHover,
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const i = elements[0].index;
                            const label = chart.data.labels[i];
                            handleChartDrilldown('balanceChart', label, '');
                        }
                    },
                    plugins: { legend: { labels: { font: { family: 'Plus Jakarta Sans' } } } }
                }
            });

            // ----------------------------------------------------
            // CHART 3: Category Pie Chart dengan Kategori Dinamis
            // ----------------------------------------------------
            const catYear = document.getElementById('analysis-cat-year').value;
            const catMonth = document.getElementById('analysis-cat-month').value;

            let categoryMap = {
                'Pemasukan Utama': 0,
                'Pemasukan Lainnya': 0,
                'E-Wallet & Top Up': 0,
                'Cicilan & Pinjaman': 0,
                'Transfer Pihak Lain': 0,
                'Belanja & QRIS': 0,
                'Makan & Minum': 0,
                'Tagihan & Utilitas': 0,
                'Investasi & Tabungan': 0,
                'Transportasi & Bensin': 0,
                'Admin Bank': 0,
                'Lainnya': 0
            };

            transactions.forEach(t => {
                const d = new Date(t.date);
                if (catYear === 'ALL' || d.getFullYear().toString() === catYear) {
                    if (catMonth === 'ALL' || d.getMonth().toString() === catMonth) {
                        if (categoryMap[t.category] !== undefined) {
                            categoryMap[t.category] += t.amount;
                        }
                    }
                }
            });

            const catSummaryEl = document.getElementById('categorySummary');
            if (catSummaryEl) {
                catSummaryEl.innerHTML = '';
                
                // Palet 12 Warna Unik untuk Setiap Kategori
                const catColors = [
                    '#059669', // Pemasukan Utama (Emerald)
                    '#10b981', // Pemasukan Lainnya (Teal)
                    '#f43f5e', // E-Wallet & Top Up (Rose)
                    '#a855f7', // Cicilan & Pinjaman (Purple)
                    '#3b82f6', // Transfer Pihak Lain (Blue)
                    '#eab308', // Belanja & QRIS (Yellow)
                    '#f97316', // Makan & Minum (Orange)
                    '#06b6d4', // Tagihan & Utilitas (Cyan)
                    '#14b8a6', // Investasi & Tabungan (Mint)
                    '#84cc16', // Transportasi & Bensin (Lime)
                    '#ec4899', // Admin Bank (Pink)
                    '#64748b'  // Lainnya (Slate)
                ];
                const catKeys = Object.keys(categoryMap);
                const catValues = Object.values(categoryMap);
                const totalCatSpend = catValues.reduce((a, b) => a + b, 0);

                catKeys.forEach((key, idx) => {
                    const amt = categoryMap[key];
                    const pct = totalCatSpend > 0 ? ((amt / totalCatSpend) * 100).toFixed(1) : 0;
                    
                    if (amt > 0) {
                        const div = document.createElement('div');
                        div.className = "flex items-center justify-between border-b border-slate-100 pb-1.5 cursor-pointer hover:bg-slate-50 transition-colors p-1 rounded";
                        div.onclick = () => handleChartDrilldown('categoryChart', key, '');
                        div.innerHTML = `
                            <div class="flex items-center space-x-1.5">
                                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${catColors[idx]}"></span>
                                <span class="font-medium text-slate-600">${key}</span>
                            </div>
                            <span class="font-bold text-slate-800 text-xs">${formatRupiah(amt)} <span class="text-[10px] text-slate-400 font-normal">(${pct}%)</span></span>
                        `;
                        catSummaryEl.appendChild(div);
                    }
                });

                const ctx3 = document.getElementById('categoryChart').getContext('2d');
                if (categoryChart) categoryChart.destroy();
                categoryChart = new Chart(ctx3, {
                    type: 'doughnut',
                    data: {
                        labels: catKeys,
                        datasets: [{
                            data: catValues,
                            backgroundColor: catColors,
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        onHover: chartHoverCursor.onHover,
                        onClick: (event, elements, chart) => {
                            if (elements.length > 0) {
                                const i = elements[0].index;
                                const label = chart.data.labels[i];
                                handleChartDrilldown('categoryChart', label, '');
                            }
                        },
                        plugins: { legend: { display: false } },
                        cutout: '72%'
                    }
                });
            }

            // ----------------------------------------------------
            // CHART 4: Monthly Category Stacked Trend (Timeline Dinamis)
            // ----------------------------------------------------
            const stackedYear = document.getElementById('stacked-year').value;
            let stackedLabels = [];
            let stackedData = {
                'Pemasukan Lainnya': [],
                'E-Wallet & Top Up': [],
                'Cicilan & Pinjaman': [],
                'Transfer Pihak Lain': [],
                'Belanja & QRIS': [],
                'Makan & Minum': [],
                'Tagihan & Utilitas': [],
                'Investasi & Tabungan': [],
                'Transportasi & Bensin': [],
                'Admin Bank': [],
                'Lainnya': []
            };

            if (stackedYear === 'ALL') {
                if (sortedAsc.length === 0) {
                    stackedLabels = months;
                    Object.keys(stackedData).forEach(k => stackedData[k] = Array(12).fill(0));
                } else {
                    const firstDate = new Date(sortedAsc[0].date);
                    const lastDate = new Date(sortedAsc[sortedAsc.length - 1].date);
                    
                    let curYear = firstDate.getFullYear();
                    let curMonth = firstDate.getMonth();
                    
                    const endYear = lastDate.getFullYear();
                    const endMonth = lastDate.getMonth();

                    while (curYear < endYear || (curYear === endYear && curMonth <= endMonth)) {
                        stackedLabels.push(`${months[curMonth]} ${String(curYear).slice(-2)}`);
                        
                        let monthlyCatVals = {
                            'Pemasukan Lainnya': 0,
                            'E-Wallet & Top Up': 0,
                            'Cicilan & Pinjaman': 0,
                            'Transfer Pihak Lain': 0,
                            'Belanja & QRIS': 0,
                            'Makan & Minum': 0,
                            'Tagihan & Utilitas': 0,
                            'Investasi & Tabungan': 0,
                            'Transportasi & Bensin': 0,
                            'Admin Bank': 0,
                            'Lainnya': 0
                        };

                        sortedAsc.forEach(t => {
                            const d = new Date(t.date);
                            if (d.getFullYear() === curYear && d.getMonth() === curMonth && t.type === 'expense') {
                                if (monthlyCatVals[t.category] !== undefined) {
                                    monthlyCatVals[t.category] += t.amount;
                                }
                            }
                        });

                        Object.keys(stackedData).forEach(k => {
                            stackedData[k].push(monthlyCatVals[k]);
                        });

                        curMonth++;
                        if (curMonth > 11) {
                            curMonth = 0;
                            curYear++;
                        }
                    }
                }
            } else {
                stackedLabels = months;
                Object.keys(stackedData).forEach(k => {
                    stackedData[k] = Array(12).fill(0);
                });

                transactions.forEach(t => {
                    const d = new Date(t.date);
                    if (d.getFullYear().toString() === stackedYear && t.type === 'expense') {
                        const m = d.getMonth();
                        if (stackedData[t.category]) {
                            stackedData[t.category][m] += t.amount;
                        }
                    }
                });
            }

            const ctx4 = document.getElementById('stackedCategoryChart').getContext('2d');
            if (stackedCategoryChart) stackedCategoryChart.destroy();
            stackedCategoryChart = new Chart(ctx4, {
                type: 'bar',
                data: {
                    labels: stackedLabels,
                    datasets: [
                        { label: 'E-Wallet', data: stackedData['E-Wallet & Top Up'], backgroundColor: '#f43f5e' },
                        { label: 'Cicilan', data: stackedData['Cicilan & Pinjaman'], backgroundColor: '#a855f7' },
                        { label: 'Transfer Out', data: stackedData['Transfer Pihak Lain'], backgroundColor: '#3b82f6' },
                        { label: 'Belanja & QRIS', data: stackedData['Belanja & QRIS'], backgroundColor: '#eab308' },
                        { label: 'Makan & Minum', data: stackedData['Makan & Minum'], backgroundColor: '#f97316' },
                        { label: 'Tagihan', data: stackedData['Tagihan & Utilitas'], backgroundColor: '#06b6d4' },
                        { label: 'Investasi', data: stackedData['Investasi & Tabungan'], backgroundColor: '#10b981' },
                        { label: 'Transportasi', data: stackedData['Transportasi & Bensin'], backgroundColor: '#84cc16' },
                        { label: 'Admin Bank', data: stackedData['Admin Bank'], backgroundColor: '#ec4899' },
                        { label: 'Lainnya', data: stackedData['Lainnya'], backgroundColor: '#64748b' }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: chartHoverCursor.onHover,
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const i = elements[0].index;
                            const datasetIndex = elements[0].datasetIndex;
                            const label = chart.data.labels[i];
                            const datasetLabel = chart.data.datasets[datasetIndex].label;
                            handleChartDrilldown('stackedCategoryChart', label, datasetLabel);
                        }
                    },
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true }
                    }
                }
            });

            // ----------------------------------------------------
            // CHART 5: Savings vs Expense Ratio Gauge
            const ratioYear = document.getElementById('ratio-year').value;
            let totalIn = 0;
            let totalOut = 0;

            transactions.forEach(t => {
                const d = new Date(t.date);
                if (ratioYear === 'ALL' || d.getFullYear().toString() === ratioYear) {
                    if (t.type === 'income') totalIn += t.amount;
                    else totalOut += t.amount;
                }
            });

            const netSavings = Math.max(0, totalIn - totalOut);
            const finalExpense = totalOut;
            const savingsRate = totalIn > 0 ? (netSavings / totalIn) * 100 : 0;

            const ctx5 = document.getElementById('savingsRatioChart').getContext('2d');
            if (savingsRatioChart) savingsRatioChart.destroy();
            savingsRatioChart = new Chart(ctx5, {
                type: 'pie',
                data: {
                    labels: ['Surplus Tabungan', 'Total Belanja/Keluar'],
                    datasets: [{
                        data: [netSavings, finalExpense],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: chartHoverCursor.onHover,
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const i = elements[0].index;
                            const label = chart.data.labels[i];
                            handleChartDrilldown('savingsRatioChart', label, '');
                        }
                    },
                    plugins: { legend: { position: 'bottom' } }
                }
            });

            const verdictEl = document.getElementById('ratio-verdict');
            if (verdictEl) {
                if (savingsRate >= 30) {
                    verdictEl.innerText = `Rasio: ${savingsRate.toFixed(1)}% - Sangat Sehat (Ideal >= 30%)`;
                    verdictEl.className = "text-center text-xs font-bold p-3 mt-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200";
                } else if (savingsRate >= 10) {
                    verdictEl.innerText = `Rasio: ${savingsRate.toFixed(1)}% - Stabil & Cukup (10-30%)`;
                    verdictEl.className = "text-center text-xs font-bold p-3 mt-4 rounded-xl bg-blue-50 text-blue-800 border border-blue-200";
                } else {
                    verdictEl.innerText = `Rasio: ${savingsRate.toFixed(1)}% - Rawan Kebocoran Kas (< 10%)`;
                    verdictEl.className = "text-center text-xs font-bold p-3 mt-4 rounded-xl bg-rose-50 text-rose-800 border border-rose-200";
                }
            }

            // Hitung total cicilan utang/pinjaman untuk analisis kesehatan finansial
            let activeDebt = 0;
            transactions.forEach(t => {
                const d = new Date(t.date);
                if (
                    (ratioYear === 'ALL' || d.getFullYear().toString() === ratioYear) && 
                    (t.category === 'Cicilan & Pinjaman' || t.category === 'Cicilan (SPayLater)')
                ) {
                    activeDebt += t.amount;
                }
            });

            // ----------------------------------------------------
            // UPDATE: HEALTH CHECKUP RADAR ENGINE
            // ----------------------------------------------------
            updateFinancialHealthCheckup(totalIn, totalOut, activeDebt);

            // ----------------------------------------------------
            // UPDATE: DETEKTOR RECURRING & SUBSCRIPTIONS
            // ----------------------------------------------------
            detectRecurringExpenses();

            // ----------------------------------------------------
            // UPDATE: FORECASTING ENGINE
            // ----------------------------------------------------
            calculatePredictiveForecast(sortedAsc);
        }

        // FUNGSI 1: Menghitung Skor & Status Kesehatan Finansial secara Dinamis
        function updateFinancialHealthCheckup(totalIn, totalOut, activeDebt) {
            const savings = Math.max(0, totalIn - totalOut);
            const savingsRate = totalIn > 0 ? (savings / totalIn) * 100 : 0;
            const debtRatio = totalIn > 0 ? (activeDebt / totalIn) * 100 : 0;
            
            // Estimasi Rasio Belanja Pokok & Keinginan (Kategori pengeluaran non-cicilan & non-topup)
            let coreSpending = 0;
            transactions.forEach(t => {
                if (
                    t.type === 'expense' && 
                    t.category !== 'Cicilan & Pinjaman' && 
                    t.category !== 'Cicilan (SPayLater)' && 
                    t.category !== 'E-Wallet & Top Up' && 
                    t.category !== 'E-Wallet (Fliptech)'
                ) {
                    coreSpending += t.amount;
                }
            });
            const coreSpendingRatio = totalIn > 0 ? (coreSpending / totalIn) * 100 : 0;

            // Render Progress Bar
            const rateSavingsVal = document.getElementById('rate-savings-val');
            const rateSavingsBar = document.getElementById('rate-savings-bar');
            const rateDebtVal = document.getElementById('rate-debt-val');
            const rateDebtBar = document.getElementById('rate-debt-bar');
            const rateExpenseVal = document.getElementById('rate-expense-val');
            const rateExpenseBar = document.getElementById('rate-expense-bar');

            if (rateSavingsVal) rateSavingsVal.innerText = `${savingsRate.toFixed(1)}%`;
            if (rateSavingsBar) rateSavingsBar.style.width = `${Math.min(100, savingsRate)}%`;
            
            if (rateDebtVal) rateDebtVal.innerText = `${debtRatio.toFixed(1)}%`;
            if (rateDebtBar) rateDebtBar.style.width = `${Math.min(100, debtRatio)}%`;

            if (rateExpenseVal) rateExpenseVal.innerText = `${coreSpendingRatio.toFixed(1)}%`;
            if (rateExpenseBar) rateExpenseBar.style.width = `${Math.min(100, coreSpendingRatio)}%`;

            // Aturan Klasifikasi Skor Finansial
            const badge = document.getElementById('health-badge-container');
            const verdict = document.getElementById('health-verdict');
            const advice = document.getElementById('financial-advice');

            let score = 'A';
            let bgClass = 'bg-emerald-500 text-white';
            let verdictText = 'Sempurna & Sangat Sehat!';
            let adviceText = 'Keuangan Anda luar biasa seimbang. Anda mempraktikkan alokasi aset yang sangat disiplin. Lanjutkan investasi pasif Anda di instrumen pertumbuhan modal jangka panjang.';

            if (savingsRate < 10 || debtRatio > 35) {
                score = 'D';
                bgClass = 'bg-rose-600 text-white animate-pulse';
                verdictText = 'Bahaya! Risiko Kas Bocor';
                adviceText = 'Peringatan: Arus kas bersih Anda kritis atau tumpukan utang SPayLater melebihi ambang batas 30%. Segera pangkas alokasi belanja non-pokok dan stop menambah utang konsumtif baru.';
            } else if (savingsRate < 20 || debtRatio > 20) {
                score = 'C';
                bgClass = 'bg-amber-500 text-white';
                verdictText = 'Waspada, Perlu Penyesuaian';
                adviceText = 'Kondisi kas Anda stabil tetapi pasif. Cobalah untuk menekan biaya transfer, biaya admin, dan langganan e-wallet yang tidak esensial untuk mendongkrak laju tabungan ke angka ideal 20%.';
            } else if (savingsRate < 30) {
                score = 'B';
                bgClass = 'bg-blue-600 text-white';
                verdictText = 'Sehat & Cukup Seimbang';
                adviceText = 'Alokasi keuangan Anda sudah cukup sehat. Anda mengamankan tabungan di atas standar nasional. Disarankan mengalihkan dana mengendap Anda ke instrumen berimbal hasil stabil.';
            }

            if (badge) {
                badge.className = `w-24 h-24 rounded-full flex items-center justify-center text-5xl font-extrabold mx-auto shadow-md ${bgClass}`;
                badge.innerText = score;
            }
            if (verdict) verdict.innerText = verdictText;
            if (advice) advice.innerHTML = `<i data-lucide="lightbulb" class="w-4 h-4 text-emerald-600 mt-0.5 shrink-0"></i><span>${adviceText}</span>`;
            lucide.createIcons();
        }

        // FUNGSI 2: Mendeteksi Pola Pengeluaran Berulang (Langganan & Admin) - UPGRADED
        let globalRecurringCache = []; // Cache hasil deteksi untuk modal audit rutin
        
        function detectRecurringExpenses() {
            const subContainer = document.getElementById('rec-subscriptions');
            const tfContainer = document.getElementById('rec-transfers');
            
            if (!subContainer || !tfContainer) return;

            if (transactions.length === 0) {
                const emptyHTML = '<div class="text-center text-xs text-slate-400 py-6">Belum ada data untuk diproses.</div>';
                subContainer.innerHTML = emptyHTML;
                tfContainer.innerHTML = emptyHTML;
                globalRecurringCache = [];
                return;
            }

            // Kelompokkan data pengeluaran berdasarkan deskripsi mutasi ter-normalisasi
            let matches = {};
            transactions.forEach(t => {
                if (t.type === 'expense') {
                    // Normalisasi deskripsi mutasi
                    let cleanDesc = t.description.toLowerCase()
                        .replace(/\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/g, '')
                        .replace(/\b(jan|feb|mar|apr|mei|jun|jul|aug|sep|oct|nov|dec)\b/g, '')
                        .replace(/\d{4}/g, '')
                        .replace(/\s+/g, ' ').trim();
                    
                    if (cleanDesc.length < 3) cleanDesc = t.description;

                    if (!matches[cleanDesc]) {
                        matches[cleanDesc] = {
                            originalDesc: t.description,
                            count: 0,
                            totalAmount: 0,
                            category: t.category,
                            dates: []
                        };
                    }
                    matches[cleanDesc].count++;
                    matches[cleanDesc].totalAmount += t.amount;
                    matches[cleanDesc].dates.push(new Date(t.date));
                }
            });

            // Terapkan Algoritma Konsistensi Jarak Tanggal (Interval Consistency)
            let recurring = Object.values(matches).filter(m => {
                if (m.count < 2) return false;
                
                // Urutkan tanggal transaksi secara kronologis
                let dates = m.dates.sort((a, b) => a - b);
                let gaps = [];
                for (let i = 1; i < dates.length; i++) {
                    let diffTime = Math.abs(dates[i] - dates[i-1]);
                    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    gaps.push(diffDays);
                }
                
                let avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
                m.avgGap = avgGap;

                if (gaps.length === 1) {
                    // Jika baru muncul 2x, harus masuk dalam rentang toleransi siklus standar:
                    // Bulanan (25-35 hari), Triwulanan (80-100 hari), Semesteran (170-195 hari), Tahunan (350-385 hari)
                    const isMonthly = (avgGap >= 25 && avgGap <= 35);
                    const isQuarterly = (avgGap >= 80 && avgGap <= 100);
                    const isBiAnnual = (avgGap >= 170 && avgGap <= 195);
                    const isAnnual = (avgGap >= 350 && avgGap <= 385);
                    return (isMonthly || isQuarterly || isBiAnnual || isAnnual);
                } else {
                    // Jika muncul >= 3x, periksa penyimpangan (regularitas) jarak hari
                    let maxGap = Math.max(...gaps);
                    let minGap = Math.min(...gaps);
                    let gapDifference = maxGap - minGap;
                    
                    // Lolos jika fluktuasi tanggal < 15 hari atau transaksinya sangat rapat (misal mingguan < 20 hari)
                    return (gapDifference <= 15 || avgGap < 20);
                }
            });

            recurring.sort((a, b) => b.totalAmount - a.totalAmount);
            globalRecurringCache = recurring; // Simpan ke cache global

            // Pisahkan menjadi Langganan vs Transfer
            let subscriptionsList = [];
            let transfersList = [];

            recurring.forEach(m => {
                const catUpper = m.category.toUpperCase();
                const descUpper = m.originalDesc.toUpperCase();
                
                // Indikator klasifikasi cerdas
                const isTransfer = catUpper.includes('TRANSFER PIHAK LAIN') || 
                                catUpper.includes('E-WALLET') || 
                                catUpper.includes('CICILAN & PINJAMAN') ||
                                descUpper.includes('TRANSFER KE') || 
                                descUpper.includes('TITIP') || 
                                descUpper.includes('UTANG') || 
                                descUpper.includes('HUTANG') ||
                                descUpper.includes('KREDIVO') ||
                                descUpper.includes('AKULAKU') ||
                                descUpper.includes('SPAYLATER');

                if (isTransfer) {
                    transfersList.push(m);
                } else {
                    subscriptionsList.push(m);
                }
            });

            // Render HTML Tagihan & Langganan
            if (subscriptionsList.length === 0) {
                subContainer.innerHTML = `
                    <div class="text-center text-xs text-slate-400 py-6">
                        <i data-lucide="check-circle" class="w-8 h-8 mx-auto text-slate-300 mb-1"></i>
                        Aman! Tidak ada tagihan atau langganan rutin yang terdeteksi.
                    </div>
                `;
            } else {
                subContainer.innerHTML = subscriptionsList.map(m => {
                    const avgPrice = m.totalAmount / m.count;
                    const cycleLabel = getCycleLabel(m.avgGap);
                    return `
                        <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs hover:border-emerald-300 transition-colors">
                            <div class="truncate max-w-[160px]">
                                <span class="font-bold text-slate-800 block truncate">${m.originalDesc}</span>
                                <span class="text-[10px] text-slate-400 block">${m.count}x tagihan &bull; ${cycleLabel}</span>
                            </div>
                            <div class="text-right">
                                <span class="font-extrabold text-rose-600 block">${formatRupiah(avgPrice)}</span>
                                <span class="text-[9px] text-slate-400 block">Per Transaksi</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // Render HTML Transfer & Utang
            if (transfersList.length === 0) {
                tfContainer.innerHTML = `
                    <div class="text-center text-xs text-slate-400 py-6">
                        <i data-lucide="info" class="w-8 h-8 mx-auto text-slate-300 mb-1"></i>
                        Tidak ada pengiriman uang berulang ke pihak lain.
                    </div>
                `;
            } else {
                tfContainer.innerHTML = transfersList.map(m => {
                    const avgPrice = m.totalAmount / m.count;
                    const cycleLabel = getCycleLabel(m.avgGap);
                    return `
                        <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs hover:border-emerald-300 transition-colors">
                            <div class="truncate max-w-[160px]">
                                <span class="font-bold text-slate-800 block truncate">${m.originalDesc}</span>
                                <span class="text-[10px] text-slate-400 block">${m.count}x transfer &bull; ${cycleLabel}</span>
                            </div>
                            <div class="text-right">
                                <span class="font-extrabold text-amber-600 block">${formatRupiah(avgPrice)}</span>
                                <span class="text-[9px] text-slate-400 block">Per Transaksi</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            lucide.createIcons();
        }

        // Helper untuk menerjemahkan estimasi siklus jarak hari
        function getCycleLabel(avgGap) {
            if (avgGap >= 5 && avgGap <= 10) return 'Mingguan';
            if (avgGap > 10 && avgGap <= 20) return 'Dua Mingguan';
            if (avgGap > 20 && avgGap <= 45) return 'Siklus Bulanan';
            if (avgGap > 45 && avgGap <= 110) return 'Siklus Triwulanan';
            if (avgGap > 110 && avgGap <= 220) return 'Siklus Semesteran';
            if (avgGap > 220 && avgGap <= 400) return 'Siklus Tahunan';
            return 'Rutin Berkala';
        }

        // FUNGSI 3: Prediksi Saldo dengan Analisis Regresi Rata-Rata Berjalan (Linear Trend Projection)
        function calculatePredictiveForecast(sortedAsc) {
            const forecast3mEl = document.getElementById('forecast-3m-val');
            const forecast6mEl = document.getElementById('forecast-6m-val');

            if (!forecast3mEl || !forecast6mEl) return;

            if (sortedAsc.length < 3) {
                forecast3mEl.innerText = "Butuh minimal 3 data";
                forecast6mEl.innerText = "Butuh minimal 3 data";
                return;
            }

            // Ekstrak data surplus bersih bulanan historis
            let monthlySurplus = {};
            sortedAsc.forEach(t => {
                const date = new Date(t.date);
                const yearMonth = `${date.getFullYear()}-${date.getMonth()}`;
                if (!monthlySurplus[yearMonth]) {
                    monthlySurplus[yearMonth] = { in: 0, out: 0 };
                }
                if (t.type === 'income') {
                    monthlySurplus[yearMonth].in += t.amount;
                } else {
                    monthlySurplus[yearMonth].out += t.amount;
                }
            });

            let historyList = Object.values(monthlySurplus).map(m => m.in - m.out);
            
            // Hitung rata-rata pertumbuhan bulanan historis (Average Monthly Growth Rate)
            let totalGrowth = 0;
            for(let i = 0; i < historyList.length; i++) {
                totalGrowth += historyList[i];
            }
            const averageMonthlyGrowth = totalGrowth / historyList.length;

            // Dapatkan saldo riil saat ini (terakhir di database)
            let currentTotalBalance = 0;
            transactions.forEach(t => {
                if (t.type === 'income') currentTotalBalance += t.amount;
                else currentTotalBalance -= t.amount;
            });

            // Hitung proyeksi ke depan
            const project3M = Math.max(0, currentTotalBalance + (averageMonthlyGrowth * 3));
            const project6M = Math.max(0, currentTotalBalance + (averageMonthlyGrowth * 6));

            forecast3mEl.innerText = formatRupiah(project3M);
            forecast6mEl.innerText = formatRupiah(project6M);

            // Tambahkan perubahan gaya warna dinamis jika proyeksi memburuk (merugi)
            if (project3M < currentTotalBalance) {
                forecast3mEl.className = "text-sm font-extrabold text-rose-600";
            } else {
                forecast3mEl.className = "text-sm font-extrabold text-emerald-600";
            }

            if (project6M < currentTotalBalance) {
                forecast6mEl.className = "text-sm font-extrabold text-rose-600";
            } else {
                forecast6mEl.className = "text-sm font-extrabold text-indigo-700";
            }
        }

        // ====================================================
        // INTERACTIVE DETAIL MODAL SYSTEM
        // ====================================================
        
        // 1. DETAIL KARTU EXPAND (MEMUTASIKAN TABEL RIIL)
        window.expandCardDetail = function(cardType) {
            const modal = document.getElementById('card-detail-modal');
            const iconContainer = document.getElementById('modal-card-icon-container');
            const titleEl = document.getElementById('modal-card-title');
            const subtitleEl = document.getElementById('modal-card-subtitle');
            const summaryValEl = document.getElementById('modal-card-summary-val');
            const summaryCountEl = document.getElementById('modal-card-summary-count');
            const tableBody = document.getElementById('modal-card-table-body');
            
            const currentYearFilter = document.getElementById('chart-year').value;
            const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)); // Urutan kronologis maju
            
            let filteredTx = [];
            let totalSum = 0;

            // Filter data yang cocok dengan pilihan tahun aktif saat ini
            const dateFiltered = sorted.filter(t => {
                if (currentYearFilter === 'ALL') return true;
                return new Date(t.date).getFullYear().toString() === currentYearFilter;
            });

            if (cardType === 'income') {
                filteredTx = dateFiltered.filter(t => t.type === 'income');
                totalSum = filteredTx.reduce((sum, t) => sum + t.amount, 0);
                
                if (iconContainer) {
                    iconContainer.className = "p-2 bg-emerald-600 rounded-xl text-white";
                    iconContainer.innerHTML = '<i data-lucide="trending-up" class="w-5 h-5"></i>';
                }
                if (titleEl) titleEl.textContent = "Analisis Kredit (Uang Masuk)";
                if (subtitleEl) subtitleEl.textContent = `Arus masuk dana riil terdeteksi ${currentYearFilter === 'ALL' ? 'sepanjang waktu' : 'di tahun ' + currentYearFilter}`;
                if (summaryValEl) summaryValEl.className = "text-lg font-black text-emerald-600";
            } else if (cardType === 'expense') {
                filteredTx = dateFiltered.filter(t => t.type === 'expense');
                totalSum = filteredTx.reduce((sum, t) => sum + t.amount, 0);
                
                if (iconContainer) {
                    iconContainer.className = "p-2 bg-rose-600 rounded-xl text-white";
                    iconContainer.innerHTML = '<i data-lucide="trending-down" class="w-5 h-5"></i>';
                }
                if (titleEl) titleEl.textContent = "Analisis Debit (Uang Keluar)";
                if (subtitleEl) subtitleEl.textContent = `Konsumsi, cicilan, & biaya keluar ${currentYearFilter === 'ALL' ? 'sepanjang waktu' : 'di tahun ' + currentYearFilter}`;
                if (summaryValEl) summaryValEl.className = "text-lg font-black text-rose-600";
            } else if (cardType === 'balance') {
                filteredTx = dateFiltered;
                // Untuk saldo mengendap, hitung total kredit minus debit
                const totalIn = dateFiltered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
                const totalOut = dateFiltered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
                totalSum = totalIn - totalOut;

                if (iconContainer) {
                    iconContainer.className = "p-2 bg-blue-600 rounded-xl text-white";
                    iconContainer.innerHTML = '<i data-lucide="wallet" class="w-5 h-5"></i>';
                }
                if (titleEl) titleEl.textContent = "Ringkasan Saldo Berjalan Bersih";
                if (subtitleEl) subtitleEl.textContent = `Dana cadangan berjalan ${currentYearFilter === 'ALL' ? 'sepanjang waktu' : 'di tahun ' + currentYearFilter}`;
                if (summaryValEl) summaryValEl.className = "text-lg font-black text-blue-600";
            }

            // Update Header Statistik Modal
            if (summaryValEl) summaryValEl.textContent = formatRupiah(totalSum);
            if (summaryCountEl) summaryCountEl.textContent = `${filteredTx.length} Transaksi`;

            // Render Rincian Baris Tabel
            if (tableBody) {
                if (filteredTx.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="3" class="p-6 text-center text-slate-400">Tidak ada rincian data mutasi pada filter terpilih.</td></tr>`;
                } else {
                    tableBody.innerHTML = filteredTx.map(t => {
                        const amtColor = t.type === 'income' ? 'text-emerald-600' : 'text-rose-600';
                        const amtPrefix = t.type === 'income' ? '+' : '-';
                        return `
                            <tr class="hover:bg-slate-50 transition-colors">
                                <td class="p-3 text-slate-500 font-semibold whitespace-nowrap">${formatDateString(t.date)}</td>
                                <td class="p-3">
                                    <span class="font-bold text-slate-800 block">${t.description}</span>
                                    <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold mt-1 inline-block">${t.category}</span>
                                </td>
                                <td class="p-3 text-right font-black ${amtColor} whitespace-nowrap">${amtPrefix} ${formatRupiah(t.amount)}</td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            // Tampilkan Modal Animasi
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    modal.querySelector('div').classList.remove('scale-95');
                }, 50);
            }

            lucide.createIcons();
        }

        window.closeCardDetail = function() {
            const modal = document.getElementById('card-detail-modal');
            if (modal) {
                modal.classList.add('opacity-0');
                modal.querySelector('div').classList.add('scale-95');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
        }

        // 2. GRAFIK JUMBO DENGAN ZOOM IN / OUT & INSIGHT CERDAS
        window.expandChartDetail = function(chartId, chartTitle) {
            const modal = document.getElementById('chart-detail-modal');
            const titleEl = document.getElementById('modal-chart-title');
            const insightTextEl = document.getElementById('modal-chart-insight-text');
            
            if (titleEl) titleEl.textContent = chartTitle;
            currentZoomScale = 1.0; // Reset skala zoom saat modal dibuka
            currentEnlargedChartSourceId = chartId; // Set ID asal agar interaksi klik di modal jumbo sejalan
            resetModalCanvasSize();

            // Mendapatkan Instansi Bagan Asli
            let sourceChart = null;
            if (chartId === 'cashflowChart') sourceChart = cashflowChart;
            else if (chartId === 'balanceChart') sourceChart = balanceChart;
            else if (chartId === 'categoryChart') sourceChart = categoryChart;
            else if (chartId === 'stackedCategoryChart') sourceChart = stackedCategoryChart;
            else if (chartId === 'savingsRatioChart') sourceChart = savingsRatioChart;

            if (!sourceChart) return;

            // Kloning Dataset dan Konfigurasi untuk Bagan Baru dalam Modal
            const modalCtx = document.getElementById('modalChartCanvas').getContext('2d');
            if (modalChartInstance) modalChartInstance.destroy();

            // Duplikasi konfigurasi asli + Tambahkan Drill-down click support di modal jumbo
            modalChartInstance = new Chart(modalCtx, {
                type: sourceChart.config.type,
                data: JSON.parse(JSON.stringify(sourceChart.config.data)), // Salinan mendalam data
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: (event, chartElement) => {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    },
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const i = elements[0].index;
                            const datasetIndex = elements[0].datasetIndex !== undefined ? elements[0].datasetIndex : 0;
                            const label = chart.data.labels[i];
                            const datasetLabel = chart.data.datasets[datasetIndex] ? chart.data.datasets[datasetIndex].label : '';
                            handleChartDrilldown(currentEnlargedChartSourceId, label, datasetLabel);
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: { font: { family: 'Plus Jakarta Sans', weight: 'bold' } }
                        }
                    }
                }
            });

            // Tampilkan Insight Dinamis Unik Tergantung Grafik Mana yang Diperbesar
            if (insightTextEl) insightTextEl.textContent = generateChartInsight(chartId);

            // Tampilkan Animasi Modal
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    modal.querySelector('div').classList.remove('scale-95');
                }, 50);
            }
            
            lucide.createIcons();
        }

        window.closeChartDetail = function() {
            const modal = document.getElementById('chart-detail-modal');
            if (modal) {
                modal.classList.add('opacity-0');
                modal.querySelector('div').classList.add('scale-95');
                setTimeout(() => {
                    modal.classList.add('hidden');
                    if (modalChartInstance) {
                        modalChartInstance.destroy();
                        modalChartInstance = null;
                    }
                }, 300);
            }
        }

        // Kontrol Zoom Skala Grafik Modal
        window.zoomModalChart = function(factor) {
            currentZoomScale *= factor;
            // Batas minimal dan maksimal zoom yang aman
            if (currentZoomScale < 0.6) currentZoomScale = 0.6;
            if (currentZoomScale > 3.5) currentZoomScale = 3.5;

            const wrapper = document.getElementById('modal-canvas-resizable-wrapper');
            if (wrapper) {
                wrapper.style.width = `${100 * currentZoomScale}%`;
                wrapper.style.height = `${100 * currentZoomScale}%`;
            }

            if (modalChartInstance) {
                modalChartInstance.resize();
            }
        }

        window.resetModalChartZoom = function() {
            currentZoomScale = 1.0;
            resetModalCanvasSize();
            if (modalChartInstance) {
                modalChartInstance.resize();
            }
        }

        function resetModalCanvasSize() {
            const wrapper = document.getElementById('modal-canvas-resizable-wrapper');
            if (wrapper) {
                wrapper.style.width = "100%";
                wrapper.style.height = "100%";
            }
        }

        // Mesin Analisis Narasi Statistik Dinamis Unik (AI-Generated Insight Simulator)
        function generateChartInsight(chartId) {
            const totalTransactionsCount = transactions.length;
            if (totalTransactionsCount === 0) return "Belum ada data keuangan yang terekam untuk dianalisis.";

            // Hitung variabel dasar keuangan riil
            let incomes = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            let expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            let net = incomes - expenses;
            let spaylater = transactions.filter(t => t.category === 'Cicilan (SPayLater)').reduce((sum, t) => sum + t.amount, 0);

            switch(chartId) {
                case 'cashflowChart':
                    if (net > 0) {
                        return `Kondisi kas surplus bersih sebesar ${formatRupiah(net)}. Aliran arus masuk dana (Inflow) didominasi oleh Pemasukan Utama, sementara margin keamanan Anda aman karena total pengeluaran hanya memakan ${(expenses / incomes * 100).toFixed(1)}% dari total penghasilan.`;
                    } else {
                        return `Kondisi kas defisit bersih sebesar ${formatRupiah(Math.abs(net))}. Total pengeluaran Anda melebihi pemasukan. Sangat disarankan untuk meninjau kembali pengeluaran kategori non-prioritas sesegera mungkin guna memulihkan keseimbangan arus kas bulanan Anda.`;
                    }
                case 'balanceChart':
                    return `Kurva tren di atas menunjukkan akumulasi kekayaan likuid mengendap Anda saat ini berada di angka ${formatRupiah(net)}. Grafik linear yang merayap naik menunjukkan ketahanan dana darurat Anda terus menguat. Jagalah agar kurva pertumbuhan ini tetap positif dengan mempertahankan sisa tabungan bulanan minimal 15%.`;
                case 'categoryChart':
                    return `Peta distribusi pengeluaran Anda menunjukkan bahwa pengeluaran terbesar didominasi oleh kategori tertentu. Biaya utilitas/cicilan bulanan Anda (terutama SPayLater) tercatat sebesar ${formatRupiah(spaylater)} atau ${(spaylater / expenses * 100).toFixed(1)}% dari seluruh total belanja modal.`;
                case 'stackedCategoryChart':
                    return `Analisis tumpukan bulanan menunjukkan dinamika fluktuatif di setiap segmen belanja Anda. Kenaikan tajam kolom biasanya dipicu oleh lonjakan alokasi Belanja & QRIS atau penambahan tagihan berulang. Gunakan visualisasi tumpukan per bulan ini untuk memotong kebiasaan konsumtif musiman Anda.`;
                case 'savingsRatioChart':
                    const rate = incomes > 0 ? (net / incomes * 100) : 0;
                    if (rate >= 20) {
                        return `Rasio tabungan riil Anda saat ini adalah ${rate.toFixed(1)}%. Ini adalah pencapaian yang sangat ideal (Standar sehat >= 20%). Anda memiliki kapasitas investasi cadangan yang kuat untuk dipindahkan ke instrumen reksa dana, SBN, atau emas.`;
                    } else {
                        return `Rasio tabungan berjalan Anda sebesar ${rate.toFixed(1)}% masih berada di bawah target ideal minimal 20%. Cobalah menekan tagihan langganan atau pengeluaran Fliptech harian agar kapasitas surplus dana yang mengendap setiap bulan dapat meningkat.`;
                    }
                default:
                    return "Database transaksi mendeteksi pola perputaran dana bulanan Anda berjalan stabil tanpa fluktuasi anomali yang membahayakan.";
            }
        }

        // ====================================================
        // FUNGSI EXPAND & DETAIL BARU (RECURRING & FORECAST)
        // ====================================================

        // A. EXPAND MODAL EVALUASI RUTINITAS KAS
        window.expandRecurringDetail = function() {
            const modal = document.getElementById('recurring-detail-modal');
            const totalBadge = document.getElementById('recurring-total-badge');
            const tableBody = document.getElementById('recurring-detail-table-body');

            if (!modal) return;

            totalBadge.innerText = `${globalRecurringCache.length} Pola Rutin`;

            if (globalRecurringCache.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-6 text-center text-slate-400">
                            Belum mendeteksi adanya pola pengeluaran berulang.
                        </td>
                    </tr>
                `;
            } else {
                tableBody.innerHTML = globalRecurringCache.map(m => {
                    const avgPrice = m.totalAmount / m.count;
                    const annualEstimate = avgPrice * (365 / m.avgGap);
                    const cycleLabel = getCycleLabel(m.avgGap);

                    // Tentukan warna teks / aksen berdasarkan kategori pengeluaran berulang
                    const isAlert = m.category.includes('Cicilan') || 
                                    m.category.includes('Pinjaman') || 
                                    m.category.includes('E-Wallet') || 
                                    m.category.includes('Tagihan');
                                    
                    const priceColor = isAlert ? 'text-rose-600 font-bold' : 'text-slate-800 font-bold';

                    return `
                        <tr class="hover:bg-slate-50 transition-colors cursor-pointer" onclick="handleChartDrilldown('categoryChart', '${m.category}', '')">
                            <td class="p-3">
                                <span class="font-bold text-slate-800 block">${m.originalDesc}</span>
                                <span class="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold mt-1 inline-block">${m.category}</span>
                            </td>
                            <td class="p-3 font-semibold text-slate-600">${cycleLabel} <span class="text-[10px] text-slate-400 font-normal">(&plusmn; ${Math.round(m.avgGap)} hari)</span></td>
                            <td class="p-3 text-center font-bold text-slate-700">${m.count}x</td>
                            <td class="p-3 text-right ${priceColor}">${formatRupiah(avgPrice)}</td>
                            <td class="p-3 text-right font-black text-slate-900">${formatRupiah(annualEstimate)}</td>
                        </tr>
                    `;
                }).join('');
            }

            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
            }, 50);

            lucide.createIcons();
        }

        window.closeRecurringDetail = function() {
            const modal = document.getElementById('recurring-detail-modal');
            if (modal) {
                modal.classList.add('opacity-0');
                modal.querySelector('div').classList.add('scale-95');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
        }

        // B. EXPAND MODAL FORECAST DENGAN GRAFIK PERHITUNGAN LAPANGAN RIIL
        window.expandForecastDetail = function() {
            const modal = document.getElementById('forecast-detail-modal');
            const mathExp = document.getElementById('forecast-math-explanation');
            const tableBody = document.getElementById('forecast-detail-table-body');

            if (!modal) return;

            // 1. Ekstrak data surplus bersih bulanan historis
            const sortedAsc = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
            if (sortedAsc.length < 3) {
                showToast("Butuh minimal 3 data transaksi untuk simulasi kalkulasi lapangan", "error");
                return;
            }

            let monthlySurplus = {};
            sortedAsc.forEach(t => {
                const date = new Date(t.date);
                const yearMonth = `${date.getFullYear()}-${date.getMonth()}`;
                if (!monthlySurplus[yearMonth]) {
                    monthlySurplus[yearMonth] = { in: 0, out: 0, label: `${date.toLocaleString('id-ID', { month: 'short' })} ${date.getFullYear()}` };
                }
                if (t.type === 'income') {
                    monthlySurplus[yearMonth].in += t.amount;
                } else {
                    monthlySurplus[yearMonth].out += t.amount;
                }
            });

            const surplusKeys = Object.keys(monthlySurplus);
            const historyList = surplusKeys.map(k => monthlySurplus[k].in - monthlySurplus[k].out);
            const historyLabels = surplusKeys.map(k => monthlySurplus[k].label);
            
            // Hitung rata-rata surplus per bulan berjalan (S)
            const totalSurplus = historyList.reduce((a, b) => a + b, 0);
            const avgMonthlyGrowth = totalSurplus / historyList.length;

            // Dapatkan saldo riil saat ini (C)
            let currentTotalBalance = 0;
            transactions.forEach(t => {
                if (t.type === 'income') currentTotalBalance += t.amount;
                else currentTotalBalance -= t.amount;
            });

            // 2. Tulis Narasi Formula Regresi Linier
            if (mathExp) {
                mathExp.innerHTML = `
                    Metode Perhitungan Menggunakan Proyeksi Tren Linier: <br>
                    <strong class="text-indigo-900">F<sub>n</sub> = C + (S &times; n)</strong><br>
                    &bull; <strong class="text-slate-700">C (Saldo Berjalan Saat Ini):</strong> ${formatRupiah(currentTotalBalance)} <br>
                    &bull; <strong class="text-slate-700">S (Rata-rata Surplus Bersih Bulanan):</strong> ${formatRupiah(avgMonthlyGrowth)} <br>
                    &bull; <strong class="text-slate-700">n:</strong> Interval bulan ke-n di masa depan.
                `;
            }

            // 3. Bangun Dataset Proyeksi 12 Bulan ke Depan
            let forecastLabels = [...historyLabels];
            let forecastDataset = Array(historyList.length - 1).fill(null);
            
            // Tambahkan titik terakhir historis ke dataset proyeksi agar grafiknya tersambung mulus
            let currentRunningAccumulative = 0;
            let balanceHistory = [];
            
            // Hitung akumulasi saldo historis bulanan nyata
            let runningBalTemp = 0;
            historyList.forEach((surp, idx) => {
                runningBalTemp += surp;
                balanceHistory.push(runningBalTemp);
            });
            
            forecastDataset.push(balanceHistory[balanceHistory.length - 1]);

            // Tambahkan rincian baris tabel & chart label untuk 12 bulan ke depan
            let tableRowsHtml = "";
            let forecastLineData = [...balanceHistory];
            
            const nextMonthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            let lastDateInDb = new Date(sortedAsc[sortedAsc.length - 1].date);
            let nextMonthIndex = lastDateInDb.getMonth() + 1;
            let nextYear = lastDateInDb.getFullYear();

            for (let n = 1; n <= 12; n++) {
                if (nextMonthIndex > 11) {
                    nextMonthIndex = 0;
                    nextYear++;
                }
                const labelM = `${nextMonthsNames[nextMonthIndex]} ${String(nextYear).slice(-2)}`;
                forecastLabels.push(labelM);

                // Formula Linier
                const projectedVal = Math.max(0, currentTotalBalance + (avgMonthlyGrowth * n));
                forecastDataset.push(projectedVal);

                // Tambah status finansial per bulan
                let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Sehat</span>`;
                if (projectedVal < currentTotalBalance) {
                    statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Menurun</span>`;
                } else if (projectedVal > currentTotalBalance * 1.5) {
                    statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Eksponensial</span>`;
                }

                // Saat baris proyeksi diklik, tampilkan seluruh transaksi berjalan untuk bulan bersangkutan secara simulasi
                tableRowsHtml += `
                    <tr class="hover:bg-slate-50 transition-colors cursor-pointer" onclick="handleForecastRowClick(${nextMonthIndex}, ${nextYear}, ${projectedVal})">
                        <td class="p-2.5 font-bold text-slate-700">${labelM} <span class="text-[9px] text-slate-400 font-normal">(bln +${n})</span></td>
                        <td class="p-2.5 text-right font-black text-slate-800">${formatRupiah(projectedVal)}</td>
                        <td class="p-2.5 text-center">${statusBadge}</td>
                    </tr>
                `;

                nextMonthIndex++;
            }

            if (tableBody) tableBody.innerHTML = tableRowsHtml;

            // 4. Render Chart Canvas Proyeksi Modal
            const forecastCtx = document.getElementById('forecastModalChart').getContext('2d');
            if (forecastModalChartInstance) forecastModalChartInstance.destroy();

            forecastModalChartInstance = new Chart(forecastCtx, {
                type: 'line',
                data: {
                    labels: forecastLabels,
                    datasets: [
                        {
                            label: 'Saldo Historis Riil',
                            data: balanceHistory,
                            borderColor: '#2563eb',
                            backgroundColor: 'rgba(37, 99, 235, 0.04)',
                            borderWidth: 3,
                            tension: 0.3,
                            fill: true
                        },
                        {
                            label: 'Simulasi Proyeksi Linier (12 bln)',
                            data: forecastDataset,
                            borderColor: '#8b5cf6',
                            borderDash: [6, 6],
                            backgroundColor: 'rgba(139, 92, 246, 0.04)',
                            borderWidth: 3,
                            tension: 0.1,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onHover: (event, chartElement) => {
                        event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                    },
                    onClick: (event, elements, chart) => {
                        if (elements.length > 0) {
                            const i = elements[0].index;
                            const label = chart.data.labels[i];
                            
                            // Jika klik bagian histori riil
                            if (i < balanceHistory.length) {
                                handleChartDrilldown('balanceChart', label, '');
                            } else {
                                // Jika klik proyeksi masa depan
                                const stepIndex = i - balanceHistory.length + 1;
                                const futureMonthVal = forecastDataset[i];
                                showToast(`Proyeksi Bulan ke-${stepIndex}: Rencana Saldo Anda ${formatRupiah(futureMonthVal)}`, "success");
                            }
                        }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { font: { family: 'Plus Jakarta Sans', weight: 'bold' } } }
                    },
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return formatRupiah(value).slice(0, -3); // Menghilangkan ,00 untuk keindahan chart
                                }
                            }
                        }
                    }
                }
            });

            // Tampilkan Modal
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
            }, 50);

            lucide.createIcons();
        }

        window.closeForecastDetail = function() {
            const modal = document.getElementById('forecast-detail-modal');
            if (modal) {
                modal.classList.add('opacity-0');
                modal.querySelector('div').classList.add('scale-95');
                setTimeout(() => {
                    modal.classList.add('hidden');
                    if (forecastModalChartInstance) {
                        forecastModalChartInstance.destroy();
                        forecastModalChartInstance = null;
                    }
                }, 300);
            }
        }

        // Tampilkan simulasi masa depan jika baris tabel proyeksi diklik
        window.handleForecastRowClick = function(targetMonth, targetYear, projectedValue) {
            const monthsNamesFull = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            
            // Ekstrak pola recurring dari cache global sebagai dasar rancangan simulasi bulan depan
            const simulatedList = globalRecurringCache.map(r => ({
                date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-05`,
                description: `[Simulasi Rutin] ${r.originalDesc}`,
                category: r.category,
                amount: r.totalAmount / r.count,
                type: 'expense'
            }));

            // Menghitung rata-rata seluruh pemasukan bulanan (Utama + Lainnya)
            const avgIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) / 
                            ([...new Set(transactions.map(t => new Date(t.date).getMonth()))].length || 1);

            if (avgIncome > 0) {
                simulatedList.unshift({
                    date: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-25`,
                    description: `[Simulasi Pemasukan] Ekspektasi Total Pemasukan Bulanan`,
                    category: 'Pemasukan Utama',
                    amount: avgIncome,
                    type: 'income'
                });
            }

            showChartItemsInModal(`Estimasi Alur Kas - ${monthsNamesFull[targetMonth]} ${targetYear}`, simulatedList);
        }

        // Listener Filter Dinamis
        document.getElementById('analysis-cat-year').addEventListener('change', renderAnalyticCharts);
        document.getElementById('analysis-cat-month').addEventListener('change', renderAnalyticCharts);
        document.getElementById('stacked-year').addEventListener('change', renderAnalyticCharts);
        document.getElementById('ratio-year').addEventListener('change', renderAnalyticCharts);

        document.getElementById('search-input').addEventListener('input', renderTable);
        document.getElementById('filter-type').addEventListener('change', renderTable);
        document.getElementById('filter-category').addEventListener('change', renderTable);
        
        // Menyelaraskan filter tahun utama dengan semua kartu dan chart
        document.getElementById('chart-year').addEventListener('change', function() {
            renderTotals();
            renderAnalyticCharts();
        });

        window.onload = function() {
            lucide.createIcons();
            updateYearFilters();
            updateUI();
        }

        // Kontrol Modal Kredit Developer
        window.openCreditModal = function() {
            const modal = document.getElementById('credit-modal');
            if (!modal) return;
            
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
                
                // Panggil re-render di sini agar elemen dipastikan siap
                if (window.lucide) {
                    lucide.createIcons();
                }
            }, 50);
        };

        window.closeCreditModal = function() {
            const modal = document.getElementById('credit-modal');
            if (!modal) return;
            
            modal.classList.add('opacity-0');
            modal.querySelector('div').classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
        };
