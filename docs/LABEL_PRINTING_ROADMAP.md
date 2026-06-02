# Label Printing & Barcode Scanning — Roadmap

## Overview

End-to-end label printing for tool storage using the **ZTC S4M-300dpi ZPL** label printer,
connected over LAN. Labels encode location codes and tool identifiers as barcodes/QR codes.
Future phase adds mobile camera scanning for quick stock in/out without touching a PC.

**Printer:** ZTC S4M, 300 dpi, ZPL II language, TCP port 9100 (raw ZPL)  
**Label size:** 57 × 32 mm (storage) / 57 × 38 mm (tool) — standard roll  
**At 300 dpi:** 1 mm ≈ 12 dots → 57×32 mm = 684 × 384 dots

---

## Status

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Printer network setup | ⏳ Planned |
| 2 | Backend label service (TCP + ZPL) | ⏳ Planned |
| 3 | Frontend print buttons + preview modal | ⏳ Planned |
| 4 | Mobile camera scan for stock in/out | ⏳ Future |

---

## Phase 1 — Printer Network Setup

### Find the printer's current IP

Hold the **Feed** button while powering on → the printer prints a network config label showing
the current IP address, subnet mask, and gateway.

### Set a static IP

**Option A — Front panel** (if LCD present):
```
Menu → Network → TCP/IP → Protocol → Permanent → IP Address → [enter octets]
```

**Option B — ZPL `^NS` command** (send over USB once):
```zpl
^XA
^NSP,192.168.2.xxx,255.255.255.0,192.168.2.1
^XZ
```
`P` = Permanent. Replace the IP/mask/gateway with your values.

**Option C — Embedded web server:**  
Browse to `http://<current-ip>/` → Network Configuration → set static IP.

### Verify connectivity

```bash
ping 192.168.2.xxx
# Browse to http://192.168.2.xxx/ for printer web UI
```

### Environment variables

Add to `.env` and `docker-compose.yml` backend service:
```
LABEL_PRINTER_IP=192.168.2.xxx
LABEL_PRINTER_PORT=9100
```

---

## Phase 2 — Backend Label Service

### New files

```
backend/
  services/
    labelPrinter.js          ← TCP socket + ZPL builder functions
  controllers/
    labelsController.js      ← Express route handlers
  routes/
    labels.js                ← Express router
```

Register in `backend/server.js`:
```js
app.use('/api/labels', require('./routes/labels'));
```

### `backend/services/labelPrinter.js`

Core TCP print function (no npm dependencies — uses Node.js built-in `net`):
```js
const net = require('net');

function printZPL(zpl) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const ip   = process.env.LABEL_PRINTER_IP;
    const port = parseInt(process.env.LABEL_PRINTER_PORT || '9100');

    client.connect(port, ip, () => {
      client.write(zpl, 'utf8', () => { client.destroy(); resolve(); });
    });
    client.on('error', (err) => { client.destroy(); reject(err); });
    client.setTimeout(5000, () => { client.destroy(); reject(new Error('Printer timeout')); });
  });
}
```

### ZPL label designs

**Storage label — 57×32 mm** (Location / Cabinet / Shelf / Box):
```
┌─────────────────────────────┐
│  ▐▐▌▌▐▐▌▌ (Code128 barcode) │  ← ^BC, height 80 dots
│  ROOM1-CAB2-SH3-BX1         │  ← location code, bold
│  Cabinet: Workshop Main     │  ← entity name
│  Location: Tool Room A      │  ← parent name
└─────────────────────────────┘
```

Barcode content: plain location code string (e.g. `ROOM1-CAB2-SH3-BX1`)  
Command: `^BY2,3,80` + `^BCN,80,Y,N,N`

**Tool label — 57×38 mm**:
```
┌─────────────────────────────┐
│ ▓▓▓  TOOL-001               │
│ ▓QR▓  10mm End Mill HSS     │
│ ▓▓▓  Loc: ROOM1-CAB2-SH3   │
│       Qty: 3  Min: 1        │
└─────────────────────────────┘
```

QR content: `TOOL:{tool_number}` (e.g. `TOOL:TOOL-001`)  
Command: `^BQN,2,4` (Model 2, magnification 4 ≈ 24×24 mm at 300 dpi)

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/labels/location/:id` | 400+ | Print location label |
| POST | `/api/labels/cabinet/:id` | 400+ | Print cabinet label |
| POST | `/api/labels/shelf/:id` | 400+ | Print shelf label |
| POST | `/api/labels/box/:id` | 400+ | Print box label |
| POST | `/api/labels/tool/:id` | 400+ | Print tool label |
| GET | `/api/labels/preview/:type/:id` | 100+ | Return ZPL string for preview |

Optional query param: `?copies=2` (default 1, max 10).

### Label preview (Labelary)

The GET preview endpoint returns the raw ZPL string. The frontend POSTs it to the
free [Labelary API](https://labelary.com/service.html) to render a PNG:

```
POST https://api.labelary.com/v1/printers/8dpmm/labels/2.25x1.25/0/
Content-Type: application/x-www-form-urlencoded
Body: file=<zpl string>
Response: image/png
```

No API key required. Use `8dpmm` for 300 dpi, `2.25x1.25` for 57×32 mm (inches).

---

## Phase 3 — Frontend Print UI

### Changes to `frontend/tools.html` + `frontend/js/tools.js`

**Print buttons** — add a 🖨️ icon button to every table row:
- Locations table → `printLabel('location', id)`
- Cabinets table → `printLabel('cabinet', id)`
- Shelves table → `printLabel('shelf', id)`
- Boxes table → `printLabel('box', id)`
- Inventory table → `printLabel('tool', id)`
- Tool Detail modal → print button in header area

**Label preview modal:**
```
┌─ Label Preview ──────────────────┐
│  [PNG rendered by Labelary API]  │
│                                  │
│  Copies: [1 ▼]                   │
│  [Cancel]         [🖨️ Print]     │
└──────────────────────────────────┘
```

**JS function pattern:**
```js
async function printLabel(type, id, copies = 1) {
    // 1. GET /api/labels/preview/type/id → ZPL string
    // 2. POST ZPL to Labelary → get PNG blob → show in preview modal
    // 3. User confirms → POST /api/labels/type/id?copies=n
    // 4. Show success toast "Label sent to printer"
}
```

---

## Phase 4 — Mobile Camera Scanning *(Future)*

### New files

```
frontend/
  scan.html        ← mobile-first full-screen scanner page
  js/scan.js       ← scan logic
```

### Library

**`html5-qrcode`** — loaded from CDN, no build step:
```html
<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
```

Supports: QR Code, Code128, Code39, EAN-13, EAN-8 — works on iOS Safari + Android Chrome.

### Scan workflow

```
Camera opens → user points at label
      │
      ├─ Decodes TOOL:xxx → fetch tool data
      │       └─ Show: tool name, qty, location
      │          Buttons: [+ Stock In] [− Stock Out]
      │          → POST /api/tools/:id/stock-in|out
      │
      └─ Decodes LOC:xxx → fetch tools at location
              └─ Show: list of tools stored here
```

### Auth

Reuses existing JWT from `localStorage` (`cnc_auth_token`) — no re-login needed
as long as the user is already logged in on that device.

### Navigation

Add to nav bar in `frontend/index.html` (visible on mobile for level 100+):
```html
<a href="scan.html" id="scanLink">📷 Scan</a>
```

---

## Files Summary

| File | Action | Phase |
|------|--------|-------|
| `.env` / `docker-compose.yml` | Add `LABEL_PRINTER_IP`, `LABEL_PRINTER_PORT` | 1 |
| `backend/services/labelPrinter.js` | Create — TCP print + ZPL builders | 2 |
| `backend/controllers/labelsController.js` | Create — route handlers | 2 |
| `backend/routes/labels.js` | Create — Express router | 2 |
| `backend/server.js` | Register `/api/labels` route | 2 |
| `frontend/tools.html` | Add print buttons + preview modal | 3 |
| `frontend/js/tools.js` | Add `printLabel()` + preview logic | 3 |
| `frontend/scan.html` | Create — mobile scan page | 4 |
| `frontend/js/scan.js` | Create — scan + stock in/out logic | 4 |
| `frontend/index.html` | Add Scan nav link | 4 |

---

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Print protocol | Raw TCP port 9100 | Simplest, no driver needed, works on all OS |
| ZPL sender | Node.js `net` built-in | Zero npm dependencies |
| Storage barcode | Code128 | Compact, fast scan, all scanners support it |
| Tool barcode | QR Code | Encodes more data, scannable from any angle including mobile |
| Preview rendering | Labelary API (free) | No server-side image generation needed |
| Mobile scanning | `html5-qrcode` CDN | No build step, best mobile Safari support |
| QR content format | `TOOL:{tool_number}` / `LOC:{code}` | Simple prefix for fast decode routing |
