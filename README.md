# Berber Randevu

Berberlər üçün mobil veb tətbiq (PWA): randevu, müştərilər, WhatsApp xatırlatma, gəlir-gedir, veresiyə.
Deploy: [DEPLOY.md](DEPLOY.md).

## Lokal işə salma
```bash
cp .env.example .env          # DATABASE_URL
npm install
npm run db:migrate
npm run dev                   # http://localhost:3000
```

## Yoxlamalar
```bash
npm test                      # unit + DB inteqrasiya (TEST_DATABASE_URL — ayrıca baza!)
npm run build && PORT=3100 npm start &
BASE=http://localhost:3100 npm run e2e   # brauzerdə iki berber ssenarisi
```

## Arxitektura
- `src/lib/time.ts` — bütün "bu gün/sabah" hesabları `Asia/Baku` ilə; DB-də UTC.
- `src/lib/parse.ts` — Azərbaycanca cümlədən ad/gün/saat (Mərhələ 2-də LLM ilə tamamlanacaq).
- `src/server/repo.ts` — bütün data girişi; **hər funksiya `barberId` alır, hər sorğu onunla filtrlənir**.
- `src/app/actions/*` — server actions; `barberId` həmişə sessiyadan götürülür.
- Giriş: telefon + 4 rəqəmli PIN (scrypt, 5 səhv cəhd → 15 dəq blok, 90 günlük sessiya).
