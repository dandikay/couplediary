# Couple Diary di Vercel (login Google + penyimpanan Google Drive)

## 1. Siapkan Google (gratis)
1. console.cloud.google.com > buat project > APIs & Services > Library > aktifkan **Google Drive API**.
2. OAuth consent screen (Google Auth Platform): tipe External, scope `drive.file`, `openid`, `email`.
   Klik **Publish App** supaya statusnya In production (kalau Testing, login putus tiap 7 hari).
3. Credentials > Create OAuth client ID > **Web application**.
   Authorized redirect URI: `https://NAMA-PROYEK.vercel.app/api/auth/callback`
4. Salin Client ID dan Client Secret.

## 2. Taruh di Vercel (gratis)
1. Taruh folder ini di repo GitHub, lalu vercel.com > Add New > Project > import repo.
   (Atau di terminal: `npx vercel --prod` dari folder ini.) Framework preset: **Other**.
2. Di proyek: **Storage** > Marketplace > **Upstash Redis** (paket Free) > Connect to Project.
   Variabel database terisi otomatis.
3. Settings > Environment Variables, tambahkan:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET` (teks acak panjang: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
4. Deployments > Redeploy supaya variabel terbaca. Nama proyek harus sama dengan yang dipakai di redirect URI Google.

## 3. Pakai
Buka `https://NAMA-PROYEK.vercel.app` > Lanjut dengan Google > isi halaman sambutan dan buat username + password.
Pasangan login dengan username + password yang sama, lalu pilih "Saya ..." atau buat profil baru.
Data ada di Drive Anda, folder **Couple Diary** (data.json + foto).
