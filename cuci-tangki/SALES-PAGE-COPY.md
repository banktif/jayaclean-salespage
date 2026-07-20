# SALES PAGE v4 — KILLER EDITION
## Blueprint Lengkap: Design + Copywriting + Psikologi + Layout

> **Status:** READY TO BUILD | **Brand:** JAYABINA (Jaya Bina Services)
> **Reference:** SALES-PAGE-COPY.md v1-v3 + 4 Expert Audits
> **Target:** Highest-converting sales page for Malaysian Muslim market

---

## 🎨 A. DESIGN SYSTEM (Pakar Warna + Typography)

### A1. Color Palette — Teal/Water Theme (NOT forest green)

```
--water-deepest:  #0B1413    ← Footer, deepest dark
--water-dark:     #101B1A    ← Hero BG, topbar
--water-mid:      #16302D    ← Problem section BG
--water-card:     #0D1716    ← Card surfaces on dark

--teal-primary:   #0E8C86    ← ⭐ CTA buttons, links, icons
--teal-hover:     #0A6A65    ← Button hover
--teal-glow:      rgba(14,140,134,.35)  ← Button shadows
--teal-soft:      rgba(14,140,134,.12)  ← Checkmark BG

--karat:          #C25E2E    ← Problem emphasis, eyebrow labels
--karat-soft:     #E08A5C    ← Hero word highlights
--karat-bg:       rgba(194,94,46,.14)  ← Hero glow

--water-light:    #E8F6F4    ← Light section BGs
--water-whitest:  #F7FCFB    ← Main BG, cards
--surface-white:  #FFFFFF    ← Cards

--wa-green:       #1FAF5E    ← WhatsApp ONLY
--danger:         #C62828    ← Shock emphasis words
```

**⚠️ YELLOW #FFC107 — REMOVED.** Fails WCAG, reads as "cheap" in Msia.

### A2. Typography — 3-Role System (NOT Poppins)

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Headlines | **Bricolage Grotesque** | 700-800 | H1, H2, price display |
| Body | **Figtree** | 400-700 | Paragraphs, buttons, cards |
| Labels | **IBM Plex Mono** | 400-500 | Eyebrows, step numbers, captions |

**Google Fonts import:**
```html
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### A3. Typography Scale

```
H1:      clamp(34px, 7vw, 62px)   | line-height: 1.06  | letter-spacing: -0.015em
H2:      clamp(28px, 5vw, 42px)   | line-height: 1.08  | letter-spacing: -0.01em
Body:    17px                      | line-height: 1.65
Eyebrow: 12px                      | letter-spacing: 0.22em | uppercase | IBM Plex Mono
Price:   clamp(52px, 9vw, 72px)   | Bricolage Grotesque 800
Button:  17px                      | Figtree 700 | letter-spacing: 0
```

### A4. Gradient Strategy — 4 locations only

1. **Hero:** Radial double-glow (teal + rust)
2. **Transisi:** 4-stop dark→light gradient bridge (150px)
3. **Deposit block:** Directional teal gradient
4. **Urgensi CTA:** Dark gradient

### A5. Section Background Progression (Dark→Light Story)

```
Hero      → #101B1A (deepest, mystery)
Masalah   → #16302D (inside the tank)
Transisi  → Gradient bridge (THE BREATH)
Proses    → #E8F6F4 (first light — relief)
Bukti     → #FFFFFF (brightest — proof)
Harga     → #E8F6F4 (soft — calm before action)
Tempahan  → #101B1A (dark focus — commit now)
Tentang   → #F7FCFB (warmth — human)
FAQ       → #FFFFFF (clean)
Urgensi   → #0B1413 (dark punch)
Footer    → #0B1413
```

### A6. Component Design

**Buttons:**
- Primary: Teal `#0E8C86`, white text, `border-radius: 999px` (pill), shadow glow
- Ghost dark: Transparent, `border: 1.5px solid rgba(232,246,244,0.3)`
- WhatsApp: `#1FAF5E`, white text, pill

**Cards (dark BG):**
- `background: rgba(255,255,255,0.03)`
- `backdrop-filter: blur(12px)`
- `border: 1px solid rgba(232,246,244,0.08)`
- `border-radius: 20px`

**Cards (light BG):**
- `background: #FFFFFF`
- `border-radius: 20px`
- `box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(18,33,31,0.05)`

**Forms (dark):**
- Input: `rgba(255,255,255,0.06)` bg, `border: 1.5px solid rgba(255,255,255,0.1)`, `border-radius: 14px`
- Focus: `border-color: #0E8C86`, `box-shadow: 0 0 0 4px rgba(14,140,134,0.2)`

---

## 🏗️ B. LAYOUT STRUCTURE (13 Sections)

| # | Section | Background | Purpose |
|---|---------|------------|---------|
| 1 | **Hero** | Dark gradient | Emotional hook — wudhu angle |
| 2 | **Masalah** | Dark (#16302D) | Shock image + problem cards |
| 3 | **Transisi** | 4-stop gradient | Visual breathing room — dark→light |
| 4 | **Edukasi** | Light (#E8F6F4) | KKM authority + self-diagnosis checklist |
| 5 | **Solusi** | Light (#F7FCFB) | Introduce JAYABINA — honest/new |
| 6 | **Proses** | Light (#E8F6F4) | 4-step timeline with photos |
| 7 | **Bukti** | White | Before/After slider — REAL proof |
| 8 | **Kenapa Kami** | Light (#E8F6F4) | 4 USP cards |
| 9 | **Harga** | Light (#F7FCFB) | Single pricing card + deposit block |
| 10 | **Tempahan** | Dark (#101B1A) | Booking form — focus mode |
| 11 | **Tentang Kami** | Light (#F7FCFB) | Founder story + photo |
| 12 | **FAQ** | White | 6 accordion items |
| 13 | **Urgensi** | Dark (#0B1413) | Final CTA + slot counter |

### Why this order (vs v3):
- **Edukasi moved BEFORE Solusi** — user self-diagnoses first, then solution lands
- **Bukti (before/after) added** — strongest proof, placed right after process
- **Tentang Kami after Tempahan** — recaptures abandoners with human story
- **Transisi section** — gradient bridge prevents jarring dark→light transition
- **Testimoni REMOVED** — no fake testimonials. Bukti replaces trust signals.

---

## ✍️ C. COPYWRITING — SEMUA 13 SEKSYEN

---

### C1. HERO

**Eyebrow:** 📍 Lembah Klang — KL & Selangor

**Headline:**
> Kau Ambil Wudhu' Pakai Air Tu Setiap Hari.
> **Tapi Kau Pernah Tengok Tak Dalam Tangki Rumah Kau?**

*[Teal text with subtle rust-orange glow underline on "Pernah Tengok Tak"]*

**Body:**
> 5 kali sehari. Setiap kali kau berkumur, air memasuki mulut. Setiap kali kau basuh muka, air meresap ke kulit. Persoalannya: air dari tangki macam mana?

**CTA:**
- Primary: 🗓️ Kunci Slot — RM150 Deposit
- Ghost: Macam Mana Kami Cuci? ↓

**Stats pills:**
`RM300 Satu Servis` · `RM150 Deposit Je` · `4 Slot Sehari` · `1–2 Jam`

**📷 Gambar 1:** Tangan menadah air wudhu' — air jernih dari paip

---

### C2. MASALAH (Shock + Problem)

**Eyebrow:** ⚠️ Bersedia Untuk Realiti

**Headline:**
> Air yang kau guna hari ni — **datang dari sini.**

**Shock image:** 📷 Full-bleed close-up tangki KOTOR — kelodak tebal, air keruh

**Shock line:**
> Kumur-kumur lepas wudhu'. Gosok gigi. Cuci muka anak. Semua guna air yang lalu celah **kelodak bertahun.**

**4 Problem Cards (glass-morphism dark):**

| Icon | Title | Copy |
|------|-------|------|
| 🦢 | Mendapan Bertahun | Lumpur, pasir, karat berkumpul kat dasar. Air kau lalu celah tu setiap hari. |
| 🐀 | Najis Haiwan | Tikus, cicak, burung mati dalam tangki. Busuk. Bakteria. Realiti. |
| 🦠 | Kulat & Bakteria | Air bertakung + panas = tempat pembiakan. Gatal kulit, cirit-birit berkala. |
| 👃 | Air Berbau Busuk | Bau macam longkang? Warna kekuningan? Tangki kau minta tolong. |

**Closing:**
> Bukan nak seramkan. Tapi inilah hakikat yang ramai pemilik rumah tak ambil peduli.

---

### C3. TRANSISI (Visual Bridge Only)

> *"Kami buka. Kami tunjuk. Kami cuci."*

Ini bahagian di mana halaman "bernafas" — latar belakang beralih dari gelap ke terang. Metafora visual: membuka penutup tangki dan cahaya masuk.

---

### C4. EDUKASI

**Eyebrow:** 🩺 Fakta Kesihatan

**Headline:**
> Tangki kau dah berapa tahun tak cuci?

**Body:**
> Kementerian Kesihatan Malaysia (KKM) saran cuci setiap 6–12 bulan. Tapi realitinya? Ramai yang bertahun-tahun tak pernah buka penutup tangki langsung.

**KKM Badge:** 🇲🇾 KKM Disyorkan

**6 Tanda Kecemasan (checklist with red pulse dots):**
- ✓ Air kuning atau berkarat dari paip
- ✓ Bau hapak setiap kali buka paip
- ✓ Tekanan air makin perlahan
- ✓ Kulit gatal lepas mandi — anak pun sama
- ✓ Dah lebih setahun tak pernah buka penutup tangki
- ✓ Nampak habuk/halusan dalam air paip

**Mini CTA:**
> Satu je kena — dah cukup. Kau kena bertindak sekarang.

**📷 Gambar 2:** Infografik mudah — jam 6-12 bulan → cuci wajib

---

### C5. SOLUSI

**Eyebrow:** 💪 JAYABINA

**Headline:**
> Kami baru. Sebab tu **kami kerja dua kali ganda keras.**

**Body:**
> Jujur — kami takde 10 tahun pengalaman. Tapi itu sebenarnya advantage kami. Setiap rumah adalah peluang untuk buktikan sesuatu. Kami tak mampu gagal.

> Kami tak perlu bertahun nak buat kerja betul. Kami perlu **sikap betul, alat proper, komitmen penuh.** Tu yang kami bawa.

**Tagline (pull quote):**
> *"Servis telus. Harga telus. Tangki bersih."*

**📷 Gambar 3:** Team Jaya Bina — profesional, senyum, trusted

---

### C6. PROSES (4 Steps)

**Eyebrow:** 🔧 Cara Kami Bekerja

**Headline:**
> 4 langkah je. **Tapi setiap satu kami buat betul-betul.**

**Body:**
> Sebab kau bayar untuk hasil — bukan alasan.

| # | Title | Copy | Photo |
|---|-------|------|-------|
| 01 | Periksa | Kami sampai, buka penutup, check condition. Kau tahu tahap kotor sebelum kerja mula. | 📷 4 |
| 02 | Sedut | Pam khas sedut semua air kotor, lumpur, mendapan. Habis. Tak tinggal. | 📷 5 |
| 03 | Gosok + Disinfeksi | Dinding & dasar digosok. Sembur disinfektan — bunuh bakteria, kulat, bau. | 📷 6 |
| 04 | Bilas + Check | Bilas bersih. Check kualiti air. Pastikan perfect sebelum balik. | 📷 7 |

---

### C7. BUKTI (Before/After Slider)

**Eyebrow:** 📸 Bukan Cakap Kosong

**Headline:**
> **Ini hasil kerja kami.** Seret untuk bandingkan.

**Interactive Before/After slider:**
- Kiri: "SEBELUM" label — tangki kotor
- Kanan: "SELEPAS" label — tangki bersih
- User boleh seret divider line untuk lihat perbezaan
- 2 pairs ditunjukkan (mobile: 1 pair, swipeable)

**📷 Gambar 8:** Before/After Pair 1
**📷 Gambar 9:** Before/After Pair 2

> *"Setiap job — kami hantar gambar sebelum & selepas ke WhatsApp anda. Bukti, bukan janji."*

---

### C8. KENAPA KAMI

**Eyebrow:** ✅ Kenapa Pilih Kami

**Headline:**
> Bukan cerita sedap. **Ini yang kau dapat.**

**4 USP Cards:**

| Icon | Title | Copy |
|------|-------|------|
| 💰 | RM300. Flat. | Satu harga. Tiada hidden. Tiada naik lepas sampai. |
| 🔒 | Deposit RM150 | Booking secure. Baki bayar lepas puas hati. |
| 🛠️ | Alat Proper | Pam sedutan khas + disinfektan betul. Bukan baldi & berus. |
| 🤝 | Jujur. Tanpa Tekanan. | Takde paksa add-on. Takde cerita sedih. Servis — selesai. |

---

### C9. HARGA

**Eyebrow:** 💳 Harga Telus

**Headline:**
> Satu servis. Satu harga. **Zero hidden.**

**Pricing Card (centered, elevated):**

```
╔═══════════════════════════════╗
║     RM300                     ║
║     /setangki                  ║
║                               ║
║  ✓ Cucian menyeluruh          ║
║  ✓ Sedutan enap cemar         ║
║  ✓ Disinfeksi antibakteria    ║
║  ✓ Bilasan akhir              ║
║  ✓ Pemeriksaan kualiti air    ║
║                               ║
║  ┌─────────────────────────┐  ║
║  │ Deposit RM150 sahaja    │  ║
║  │ Baki RM150 — selepas    │  ║
║  │ servis & anda puas hati │  ║
║  │                         │  ║
║  │ [🗓️ Tempah Slot Saya →] │  ║
║  │ Bayaran selamat: FPX ·  │  ║
║  │ DuitNow · Bayarcash     │  ║
║  └─────────────────────────┘  ║
╚═══════════════════════════════╝
```

---

### C10. TEMPAHAN (Booking Form)

**Eyebrow:** 📅 Booking

**Headline:**
> Pilih tarikh. Deposit RM150. **Kami sampai.**

**Body:**
> Booking dulu, baki lepas servis. Senang.

**Step indicator:** ● — ● — ● (Tarikh / Butiran / Bayar)

**Form:**
- **1. Pilih Tarikh** — Calendar interaktif (← Sebelum · Seterusnya →)
- **2. Pilih Masa** — [☀️ 9AM] [🕒 11AM] [🕒 2PM] [🌤️ 4PM]
- **3. Isi Butiran:**
  - Nama Penuh → *"Nama penuh kau..."*
  - Nombor Telefon → *"012xxxxxxx"*
  - Alamat Penuh → *"No rumah, jalan, taman, poskod..."*

**Price Summary:**
```
Servis Cuci Tangki       RM300
Deposit (50%)           RM150
Baki Selepas Servis     RM150
```

**Button:** 💳 Bayar Deposit RM150 →

**After success:** ✅ Booking Diterima! · WhatsApp button for manual payment

**Fallback WhatsApp:** *"Atau booking terus melalui WhatsApp"*

---

### C11. TENTANG KAMI

**Eyebrow:** 🏠 Cerita Kami

**Headline:**
> Baru. Dan itu **kelebihan terbesar kami.**

**Body:**
> JAYABINA bermula dengan satu benda je: **setiap keluarga berhak dapat air bersih.** Simple.

> Orang skeptical bila dengar "baru". Kami faham. Tapi baru bermaksud **kami tak mampu buat kerja separuh jalan.** Setiap rumah = reputasi kami. Setiap servis = peluang buktikan.

**Pull Quote:**
> *"Kami tak janji bulan bintang. Kami janji: sampai on-time. Cuci bersih. Tangki lagi bersih dari sebelum kami datang."*

**Jaminan Kepuasan:**
> *"Kami cuci sampai kau puas hati. Kalau tak — kami cuci semula. Percuma."*

**Closing:**
> Bila kau buka paip lepas servis — tarik nafas lega. Air bersih. Anak selamat. **Itu ukuran kejayaan kami.**

**📷 Gambar 10:** Owner JAYABINA — Abdul Latif

---

### C12. FAQ

**Eyebrow:** ❓ Soalan Lazim

**Headline:**
> Mesti ada soalan. **Kami jawab straight.**

| # | Soalan | Jawapan |
|---|--------|---------|
| 1 | Berapa lama? | 1–2 jam untuk rumah biasa. Bergantung saiz tangki. Kami bagitahu anggaran tepat lepas check. |
| 2 | Guna bahan bahaya? | Tak. Disinfektan selamat, diluluskan. Bilas bersih. Air selamat — janji. |
| 3 | Kenapa tak cuci sendiri? | Boleh — tapi berisiko. Sempit, licin, sudut susah capai. Kami ada pam sedutan khas. |
| 4 | Hujan? | Renyai — jalan. Lebat — reschedule percuma. Kami call pagi tu. |
| 5 | Cover mana? | KL & Selangor. Luar kawasan? WhatsApp — kami bagi jawapan jujur. |
| 6 | Kenapa deposit? | Untuk sahkan booking & lindungi masa. Baki bayar lepas kau puas hati. |

---

### C13. URGENSI (Final CTA)

**Eyebrow:** 🎯 Jangan Tunggu Lama

**Slot counter:**
> `[████░░░░░░]` 3 slot tinggal minggu ini

**Headline:**
> 4 Slot Sehari. **Sebab Kami Tak Nak Gelojoh.**

**Body:**
> Kami limitkan intentionally. Supaya setiap rumah dapat 100% fokus. Bila kau book — team kami datang untuk **rumah kau je.** Bukan kejar 10 rumah sehari.

**CTA:** 📅 Kunci Slot Saya Sekarang — RM150 Deposit

**📷 Gambar 11:** Keluarga selesa di rumah — air bersih, hati tenang

---

## 🧠 D. PSYCHOLOGY STRATEGY (Pakar Psikologi)

### D1. Emotional Trigger Map

| Section | Primary Trigger | Secondary Trigger |
|---------|----------------|-------------------|
| Hero | Religious purity (wudhu) | Curiosity |
| Masalah | Disgust | Fear |
| Edukasi | Health fear | Authority (KKM) |
| Solusi | Hope | Trust (honesty) |
| Proses | Confidence (transparency) | Relief |
| Bukti | Trust (real proof) | Surprise (transformation) |
| Kenapa | Value justification | Safety |
| Harga | Transparency | Security |
| Tempahan | Commitment | Ease |
| Tentang | Human connection | Trust (guarantee) |
| FAQ | Logic | Objection removal |
| Urgensi | Scarcity (honest) | FOMO |

### D2. Trust Builder Stack (No Fake Testimonials)

1. **KKM badge** — third-party authority
2. **Real before/after photos** — strongest proof
3. **Equipment photos** — shows investment
4. **Process transparency** — 4 steps with photos
5. **Honesty ("kami baru")** — disarms skepticism
6. **Founder photo + name** — human face
7. **Satisfaction guarantee** — risk reversal
8. **Payment badges** (Bayarcash, FPX, DuitNow) — financial safety
9. **"Baki selepas puas hati"** — customer protection

### D3. Urgency — Honest Only

- **4 slots/day** (NOT 10 — "10" sounds fake, "4" signals quality)
- Dynamic "X slots remaining this week" counter
- "Slot pagi biasanya penuh 2-3 hari awal"

### D4. Scarcity Signals

- ⚠️ `[████░░░░░░]` visual slot counter in urgensi section
- "4 slot sehari. Sebab kami tak nak gelojoh."
- Sticky CTA bar on mobile

### D5. Risk Reversal

- "Baki RM150 — selepas servis & anda puas hati"
- "Tak puas hati? Kami cuci semula — PERCUMA."
- "Deposit melalui Bayarcash — bayaran selamat"

---

## 🖼️ E. IMAGE PLACEMENT (11 gambar)

| # | Section | Shot |
|---|---------|------|
| 1 | Hero | Tangan menadah air wudhu' — air jernih |
| 2 | Edukasi | Infografik KKM 6-12 bulan |
| 3 | Solusi | Team JAYABINA — profesional |
| 4 | Proses 1 | Pemeriksaan tangki |
| 5 | Proses 2 | Air kotor disedut keluar |
| 6 | Proses 3 | Cucian & disinfeksi |
| 7 | Proses 4 | Tangki bersih |
| 8 | Bukti | Before/After Pair 1 |
| 9 | Bukti | Before/After Pair 2 |
| 10 | Tentang | Owner — Abdul Latif |
| 11 | Urgensi | Keluarga selesa — air bersih |

**Semua gambar:** Cloudinary `f_auto,q_auto`, `loading="lazy"` (kecuali hero).

---

## 📋 F. COPYWRITING RULES (Locked)

- ✅ BM santai: "kau", "je", "dulu", "takde"
- ✅ Jujur — akui baru, jadikan kekuatan
- ✅ Emosi — wudhu angle, keluarga, anak
- ✅ Fakta — KKM, risiko sebenar
- ✅ Honest urgency — 4 slot, bukan fake countdown
- ❌ JANGAN testimoni palsu
- ❌ JANGAN claim "100+ pelanggan"
- ❌ JANGAN guna yellow `#FFC107`
- ❌ JANGAN fake scarcity ("tinggal 2 minit!")

---

## 🔧 G. TECHNICAL NOTES

- Font: Bricolage Grotesque + Figtree + IBM Plex Mono (not Poppins)
- Colors: Teal `#0E8C86` + Rust `#C25E2E` (not forest green + yellow)
- Gradient: 4 strategic locations (hero, transisi, deposit, urgensi)
- Layout: 13 sections with dark→light narrative arc
- Before/After: Interactive slider component (CSS + minimal JS)
- Slot counter: Visual progress bar pulling from Supabase
- Sticky CTA: Mobile only, WhatsApp + Deposit buttons
- All icons: Lucide (not emoji) for premium feel

---

*Compiled from 4 expert audits — Copywriting, Layout, Color/Typography, Psychology — 2026-07-12*
