import type { PoDetail } from '../api/purchaseOrders'
import logoSrc from '../assets/apple-uniformm-logo.png'

const COMPANY_GST = '33AAGCA5247H1Z6'
const COMPANY_ADDRESS =
  '3/190-A, Akkarai negamam II cross, Konamoolai (Po), Sathyamangalam – 638 402. Erode Dt.'
const DEFAULT_DELIVERY =
  `Apple Uniformm, ${COMPANY_ADDRESS}`

/** Convert the imported logo asset to a base64 data-URL so it works in isolated print windows */
async function getLogoDataUrl(): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = img.naturalWidth  || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(logoSrc as string)
      }
    }
    img.onerror = () => resolve('')
    img.src = logoSrc as string
  })
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
}

function dash(v?: string | number | null): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

// ── Signature row builder ────────────────────────────────────────────────────
const SIG_ROLES = [
  { role: 'PREPARED_BY',   label: 'Prepared by'   },
  { role: 'CHECKED_BY',    label: 'Checked by'    },
  { role: 'AUTHORISED_BY', label: 'Authorised by' },
]

function fmtSigDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function buildSigRow(po: PoDetail): string {
  const sigs = po.signatures ?? []
  const sigMap = Object.fromEntries(sigs.map(s => [s.role, s]))

  const boxes = SIG_ROLES.map(({ role, label }) => {
    const sig = sigMap[role]
    return `
    <div class="sig">
      <div class="sig-role">${label}</div>
      ${sig
        ? `<img class="sig-img" src="${sig.signatureImage}" alt="signature" />
           <div class="sig-rule"></div>
           <div class="sig-name">${sig.signerName}</div>
           <div class="sig-date">${fmtSigDate(sig.signedAt)}</div>`
        : `<div class="sig-space"></div>
           <div class="sig-rule"></div>
           <div class="sig-lbl">Signature &amp; Date</div>`}
    </div>`
  }).join('')

  return `<div class="sig-row">${boxes}</div>`
}

/** Generate a complete, self-contained A4 HTML document for the PO */
function buildPoHtml(po: PoDetail, logoDataUrl: string): string {
  const isAcc = po.poKind === 'ACCESSORY'
  const nItems = Math.max(po.items.length, 1)
  const accRowH = nItems <= 1 ? 118 : nItems === 2 ? 86 : nItems <= 4 ? 64 : 48
  const totalOrdered = po.items.reduce((s, i) => s + i.orderedQuantity, 0)
  const totalValue   = po.items.reduce((s, i) => s + i.orderedQuantity * i.unitPrice, 0)

  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const fmtN = (n: number) => n.toLocaleString('en-IN')

  const qtyLabel = (uom: string) => {
    if (isAcc) return uom
    return uom === 'KG' ? 'kg' : 'mtrs'
  }

  const uoms = [...new Set(po.items.map(i => i.unitOfMeasure))]
  const totalQtyText = isAcc
    ? `${fmtN(totalOrdered)}${uoms.length === 1 ? ` ${uoms[0]}` : ''}`
    : `${fmtN(totalOrdered)} mtrs`

  const itemRows = isAcc
    ? po.items.map((item, idx) => `
    <tr class="item-row">
      <td style="text-align:center">${idx + 1}</td>
      <td>${dash(item.accessoryType)}</td>
      <td>
        <strong>${item.accessoryName ?? ''}</strong>
        <div class="sku">${dash(item.accessoryCode)}</div>
      </td>
      <td style="text-align:center">${dash(item.unitOfMeasure)}</td>
      <td style="text-align:right">${fmtN(item.orderedQuantity)} ${qtyLabel(item.unitOfMeasure)}</td>
      <td style="text-align:right">₹${item.unitPrice.toFixed(2)}</td>
    </tr>
  `).join('')
    : po.items.map((item, idx) => `
    <tr class="item-row">
      <td style="text-align:center">${idx + 1}</td>
      <td>${dash(item.fabricType)}</td>
      <td><strong>${item.fabricName ?? ''}</strong></td>
      <td>${dash(item.colourName)}</td>
      <td style="text-align:center">${item.widthInches != null ? item.widthInches : '—'}</td>
      <td style="text-align:center">${item.weightGsm != null ? item.weightGsm : '—'}</td>
      <td style="text-align:right">${fmtN(item.orderedQuantity)} ${qtyLabel(item.unitOfMeasure)}</td>
      <td style="text-align:right">₹${item.unitPrice.toFixed(2)}</td>
    </tr>
  `).join('')

  const itemsTable = isAcc
    ? `<table class="items-tbl acc-items">
    <colgroup>
      <col><col><col><col><col><col>
    </colgroup>
    <thead>
      <tr>
        <th>Sr. No.</th>
        <th>Accessory Type</th>
        <th>Accessory Name / Code</th>
        <th>UOM</th>
        <th>Quantity</th>
        <th>Unit Price (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="total-row">
        <td colspan="4" style="text-align:right">Total Quantity</td>
        <td style="text-align:right">${totalQtyText}</td>
        <td></td>
      </tr>
    </tbody>
  </table>`
    : `<table class="items-tbl">
    <thead>
      <tr>
        <th style="width:40px">Sr. No.</th>
        <th>Item Description</th>
        <th>Fabric Name</th>
        <th>Colour / Shade</th>
        <th style="width:78px">Width (inch)</th>
        <th style="width:56px">GSM</th>
        <th>Quantity</th>
        <th>Unit Price (₹ / metre)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="total-row">
        <td colspan="6" style="text-align:right">Total Quantity</td>
        <td style="text-align:right">${totalQtyText}</td>
        <td></td>
      </tr>
    </tbody>
  </table>`

  const termsHtml = isAcc
    ? `<div class="col">
        <ol>
          <li>Quality and specification of accessories must match the approved sample before bulk supply.</li>
          <li>Goods are subject to inspection at our premises upon receipt.</li>
          <li>Delivery must be completed on or before the required delivery date.</li>
        </ol>
      </div>
      <div class="col">
        <ol start="4">
          <li>Defective or rejected material must be replaced at the supplier’s cost.</li>
          <li>Invoice and delivery challan must quote this P.O. number.</li>
        </ol>
      </div>`
    : `<div class="col">
        <ol>
          <li>Shade and quality of fabric must be approved before starting bulk production.</li>
          <li>Goods are subject to inspection at our premises upon receipt.</li>
          <li>Delivery must be completed on or before the required delivery date.</li>
        </ol>
      </div>
      <div class="col">
        <ol start="4">
          <li>Defective or rejected material must be replaced at the supplier’s cost.</li>
          <li>Invoice and delivery challan must quote this P.O. number.</li>
        </ol>
      </div>`

  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Apple Uniformm" class="brand-logo">`
    : `<div class="brand-fallback">
         <div class="brand-name">Apple Uniformm</div>
         <div class="brand-tag">Manufacturers of School &amp; College Uniform</div>
       </div>`

  const icoPin = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#c4161c" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`
  const icoMail = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#c4161c" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5z"/></svg>`
  const icoWeb = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#c4161c" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3.2a15.4 15.4 0 0 0-1.3-3.6A8.04 8.04 0 0 1 18.9 8zM12 4c.8 1.1 1.5 2.5 1.9 4H10.1C10.5 6.5 11.2 5.1 12 4zM4.3 14a8.1 8.1 0 0 1 0-4h3.6a16.6 16.6 0 0 0-.1 4H4.3zm.8 2h3.2c.3 1.3.7 2.5 1.3 3.6A8.04 8.04 0 0 1 5.1 16zM8.1 8H4.9A8.04 8.04 0 0 1 8.1 4.4 15.4 15.4 0 0 0 8.1 8zM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4zm2.4-6H9.6a14.7 14.7 0 0 1 .1-4h6.6a14.7 14.7 0 0 1 .1 4zm.3 2c-.3 1.3-.7 2.5-1.3 3.6A8.04 8.04 0 0 0 18.9 16h-3.2zM15.9 8c.4-1.3.9-2.5 1.3-3.6A8.04 8.04 0 0 1 19.1 8h-3.2zM19.7 14h-3.6a16.6 16.6 0 0 0 .1-4h3.5a8.1 8.1 0 0 1 0 4z"/></svg>`

  const deliveryDate = po.expectedDeliveryDate
    ? `On or before ${fmtDate(po.expectedDeliveryDate)}`
    : '—'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { overflow: hidden; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12.5px;
      color: #111;
      background: #fff;
    }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: middle; }

    .sheet {
      height: 281mm;
      max-height: 281mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .hdr {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 6px;
      flex-shrink: 0;
    }
    .brand { flex: 0 0 auto; }
    .brand-logo { height: 54px; width: auto; object-fit: contain; display: block; }
    .brand-name { font-size: 24px; font-weight: 800; color: #c4161c; letter-spacing: -0.3px; }
    .brand-tag { font-size: 11px; font-weight: 600; color: #222; margin-top: 2px; }
    .vdiv { width: 1px; align-self: stretch; background: #bbb; flex-shrink: 0; }
    .contact { flex: 1; display: flex; flex-direction: column; gap: 5px; font-size: 11.5px; line-height: 1.3; color: #222; }
    .c-row { display: flex; align-items: flex-start; gap: 8px; }
    .ico { width: 13px; height: 13px; flex-shrink: 0; margin-top: 1px; }
    .gst {
      flex-shrink: 0;
      align-self: flex-start;
      border: 1px solid #e7b4b4;
      background: linear-gradient(90deg, #f8d0d0 0, #fceeee 18%, #fff 40%);
      color: #c4161c;
      font-weight: 800;
      font-size: 12.5px;
      padding: 7px 10px;
      border-radius: 8px;
      white-space: nowrap;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 2px 0 8px;
      flex-shrink: 0;
    }
    .title-row::before, .title-row::after {
      content: '';
      flex: 1;
      height: 2px;
      background: #c4161c;
    }
    .t-pill {
      background: #c4161c;
      color: #fff;
      font-weight: 800;
      letter-spacing: 0.06em;
      font-size: 14px;
      padding: 6px 20px;
      border-radius: 8px;
      white-space: nowrap;
    }

    .meta-wrap { display: flex; border: 1px solid #bdbdbd; margin-bottom: 8px; flex-shrink: 0; }
    .meta-box { flex: 1; padding: 7px 12px; }
    .meta-box + .meta-box { border-left: 1px solid #bdbdbd; }
    .meta-line { display: flex; gap: 8px; padding: 3px 0; font-size: 12.5px; }
    .meta-lbl { font-weight: 700; min-width: 168px; color: #222; }
    .meta-val { font-weight: 700; }
    .mono { font-family: ui-monospace, Menlo, monospace; }

    .items-tbl { margin-bottom: 8px; font-size: 12.5px; flex-shrink: 0; }
    .items-tbl th {
      border: 1px solid #999; padding: 6px 6px; font-weight: 700;
      background: #f0f0f0; text-align: left; font-size: 11.5px;
    }
    .items-tbl td { border: 1px solid #bbb; padding: 6px 6px; }
    .item-row td { height: 48px; padding: 12px 8px; font-size: 13px; }
    .sku { font-size: 11px; color: #555; margin-top: 4px; }
    .total-row td { font-weight: 700; background: #f5f5f5; padding: 7px 8px; font-size: 12.5px; }

    .acc-sheet .items-tbl { flex: 1; }
    .acc-sheet .acc-items { table-layout: fixed; width: 100%; }
    .acc-sheet .acc-items col { width: 14.2857%; }
    .acc-sheet .acc-items th,
    .acc-sheet .acc-items td {
      width: 14.2857%;
      padding: 10px 8px;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    .acc-sheet .acc-items th { text-align: center; }
    .acc-sheet .acc-items .item-row td { height: ${accRowH}px; padding: 14px 8px; font-size: 13px; }
    .acc-sheet .info-tbl td { padding: 11px 12px; }
    .acc-sheet .meta-line { padding: 5px 0; }
    .acc-sheet .sig-space { height: 58px; }
    .acc-sheet .terms-cols li { margin-bottom: 7px; line-height: 1.55; }
    .acc-sheet .terms-box { padding: 18px 12px 12px; }

    .info-tbl { margin-bottom: 8px; font-size: 12.5px; flex-shrink: 0; }
    .info-tbl td { border: 1px solid #bbb; padding: 7px 10px; }
    .info-lbl { font-weight: 700; background: #f5f5f5; width: 210px; }

    .swatch {
      border: 2px dashed #888;
      flex: 0 0 160px;
      height: 160px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #777;
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .terms-box {
      position: relative;
      border: 1px solid #7eb6d9;
      padding: 16px 10px 10px;
      margin-top: 12px;
      flex-shrink: 0;
      color: #163a66;
    }
    .terms-tab {
      position: absolute;
      top: -11px;
      left: 0;
      background: #c4161c;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      padding: 3px 22px 3px 12px;
      clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 100%, 0 100%);
    }
    .terms-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    .terms-cols .col { padding: 4px 12px 0; }
    .terms-cols .col + .col { border-left: 1px solid #7eb6d9; }
    .terms-cols ol {
      margin: 0;
      padding-left: 18px;
      font-size: 11.5px;
      line-height: 1.45;
    }
    .terms-cols li { margin-bottom: 4px; }

    .sig-row {
      display: flex;
      border: 1px solid #7eb6d9;
      flex-shrink: 0;
      margin-top: auto;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig {
      flex: 1;
      padding: 8px 12px 10px;
      font-size: 12px;
      color: #163a66;
    }
    .sig + .sig { border-left: 1px solid #7eb6d9; }
    .sig-role { font-weight: 800; font-size: 12px; color: #c4161c; margin-bottom: 4px; }
    .sig-img { height: 52px; max-width: 100%; object-fit: contain; display: block; margin: 2px 0 4px; }
    .sig-space { height: 52px; }
    .sig-rule { border-top: 1.5px solid #2a6aa3; margin-top: 4px; }
    .sig-name { padding-top: 4px; font-size: 12px; font-weight: 700; line-height: 1.3; }
    .sig-date { font-size: 10.5px; color: #64748b; margin-top: 1px; }
    .sig-lbl  { padding-top: 4px; font-size: 11.5px; color: #475569; line-height: 1.35; }

    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      html, body { overflow: hidden; }
      .sheet { height: 281mm; max-height: 281mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet${isAcc ? ' acc-sheet' : ''}">
  <div class="hdr">
    <div class="brand">${logoHtml}</div>
    <div class="vdiv"></div>
    <div class="contact">
      <div class="c-row">${icoPin}<span>${COMPANY_ADDRESS}</span></div>
      <div class="c-row">${icoMail}<span>appleuniformm@gmail.com</span></div>
      <div class="c-row">${icoWeb}<span>www.appleuniformm.com</span></div>
    </div>
    <div class="gst">GST No : ${COMPANY_GST}</div>
  </div>

  <div class="title-row"><span class="t-pill">${isAcc ? 'ACCESSORIES PURCHASE ORDER' : 'FABRIC PURCHASE ORDER'}</span></div>

  <div class="meta-wrap">
    <div class="meta-box">
      <div class="meta-line"><span class="meta-lbl">P.O. No :</span><span class="meta-val mono">${po.poNumber}</span></div>
      <div class="meta-line"><span class="meta-lbl">P.O. Date :</span><span class="meta-val">${fmtDate(po.poDate)}</span></div>
    </div>
    <div class="meta-box">
      <div class="meta-line"><span class="meta-lbl">Supplier / Vendor Name :</span><span class="meta-val">${dash(po.purchasePartyName)}</span></div>
      <div class="meta-line"><span class="meta-lbl">Supplier Location :</span><span class="meta-val">${dash(po.purchasePartyAddress)}</span></div>
      <div class="meta-line"><span class="meta-lbl">Supplier GST Number :</span><span class="meta-val">${dash(po.gstNumber)}</span></div>
    </div>
  </div>

  ${itemsTable}

  <table class="info-tbl">
    <tbody>
      <tr>
        <td class="info-lbl">Required Delivery Date</td>
        <td>${deliveryDate}</td>
      </tr>
      <tr>
        <td class="info-lbl">Delivery Address</td>
        <td>${po.deliveryAddress || DEFAULT_DELIVERY}</td>
      </tr>
      <tr>
        <td class="info-lbl">Shipping / Transport Details</td>
        <td>${dash(po.transportDetails || po.shippingAddress)}</td>
      </tr>
      <tr>
        <td class="info-lbl">Special Instructions</td>
        <td>${dash(po.notes)}</td>
      </tr>
    </tbody>
  </table>

  <div class="swatch">${isAcc ? 'ACCESSORY SAMPLE / SWATCH — Attach accessory swatch here' : 'FABRIC SAMPLE / SWATCH — Attach fabric swatch here'}</div>

  <div class="terms-box">
    <div class="terms-tab">Terms &amp; Conditions</div>
    <div class="terms-cols">
      ${termsHtml}
    </div>
  </div>

  ${buildSigRow(po)}
  </div>

  <script>
    window.onload = function () {
      document.title = '${po.poNumber} PO';
      setTimeout(function () { window.print(); }, 300);
    };
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`
}

/**
 * Opens a self-contained print window for the given PO.
 * Works in both browser and Electron without any dependency on the app's CSS or DOM.
 */
export async function printPurchaseOrder(po: PoDetail): Promise<void> {
  const logoDataUrl = await getLogoDataUrl()
  const html = buildPoHtml(po, logoDataUrl)

  const printWindow = window.open('', '_blank', 'width=794,height=1123')
  if (!printWindow) {
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
