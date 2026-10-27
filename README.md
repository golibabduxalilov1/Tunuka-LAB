# TunukaLab

Tunuka kesimini chizish → yoyilma → rulon listi (1250 × 6000) → CypCut uchun DXF.

- `web/` — sayt (Next.js 15, React 19). Kirish, buyurtmalar roʻyxati, muharrir.
- `api/` — server (NestJS 11). Roʻyxatdan oʻtish/kirish (JWT), buyurtmalarni saqlash (SQLite, `api/data/`).

Hisob-kitob yadrosi (`web/lib/core.js`) brauzerda ishlaydi: yoyilma, raskroy, DXF yaratish va qayta oʻqib tekshirish.

## Muharrir tuzilishi

| Boʻlim | Vazifasi |
|---|---|
| **Chizma** | Asosiy ish joyi: chapda detallar, markazda chizma maydoni, oʻngda tanlangan detal/segment xususiyatlari va natija |
| Yoyilma | Har bir detalning yassi holati va bukish chiziqlari |
| Raskroy | Detallarning rulon listiga joylashuvi, statistika, list boʻyicha DXF |
| Eksport | Tekshiruv natijalari, DXF koʻrinishi, ZIP |
| Sozlamalar | Material, list, DXF parametrlari, ichki testlar |

## Chizish

| Amal | Qanday |
|---|---|
| Asboblar | **V** tanlash · **L** chiziq · **A** yoy · **H** surish · **F** hammasini koʻrsatish · **G** toʻr |
| Segment chizish | Chiziq asbobida bosing — kursor burchak qadami (15°) va uzunlik qadamiga tortiladi; **Shift** — erkin burchak |
| Aniq uzunlik | Chizish paytida raqam yozing va **Enter**: `25` yoki burchak bilan `25<45` |
| Yoʻnalishni qotirish | **← ↑ → ↓** (qayta bosilsa bekor) — keyin uzunlik yozib Enter |
| Oxirgisini oʻchirish | **Backspace** |
| Oʻlchamni oʻzgartirish | Tanlash asbobida koʻk oʻlcham yozuvini bosing (yoki segmentni tanlab raqam yozing) |
| Uchni surish | Tanlash asbobida kvadrat tutqichni suring |
| Erkin kesimni boshidan davom ettirish | Chiziq asbobida boshlangʻich nuqtani bosing |
| Bekor qilish / qaytarish | **Ctrl+Z** / **Ctrl+Y** · saqlash — avtomatik (**Ctrl+S** — darhol) |
| Matnli buyruq | Oʻng paneldagi maydon: `↑20 ←20 ↑20` yoki `20<90 20<180` |

Taglikli detallarda (GAP, kasseta, lotok…) taglik qoʻzgʻalmas, faqat tomon profili chiziladi; qarama-qarshi tomon avtomatik koʻzgu qilinib, kulrang punktir bilan koʻrsatiladi.

## Talab

Node.js 24 (bazaga `node:sqlite` ishlatiladi).

## Birinchi marta

```
npm run install:all
npm run build
```

## Ishga tushirish (ikkita terminalda)

```
npm run start:api
npm run start:web
```

Sayt: http://localhost:3000 — roʻyxatdan oʻting va «+ Yangi buyurtma».

Ishlab chiqish rejimi (kod oʻzgarsa avtomatik qayta yuklanadi): `npm run dev:api` va `npm run dev:web`.

## Sozlamalar (muhit oʻzgaruvchilari)

| Oʻzgaruvchi | Qayerda | Standart |
|---|---|---|
| `PORT` | api | 4000 |
| `JWT_SECRET` | api | yoʻq boʻlsa `api/data/jwt.secret` avtomatik yaratiladi |
| `DATA_DIR` | api | `api/data` (baza va kalit) |
| `API_URL` | web | `http://localhost:4000` (Next.js `/api` ni shu yerga uzatadi) |

## Internetga chiqarish

Serverda (VPS) ikkala qismni `npm run build` dan keyin ishga tushiring, `JWT_SECRET` ni oʻrnating va oldiga HTTPS bilan nginx qoʻying (faqat 3000-port tashqariga ochiladi; API ga sayt `/api` orqali murojaat qiladi). `api/data/` papkasini muntazam zaxiralang — barcha foydalanuvchi va buyurtmalar shu yerda.
