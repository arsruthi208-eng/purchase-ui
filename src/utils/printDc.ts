import logoSrc from '../assets/apple-uniformm-logo.png'
import type { CuttingOrder } from '../api/cutting'
import type { StitchingDc } from '../api/stitchingDc'
import type { IroningDc } from '../api/ironingDc'
import type { CheckingDc } from '../api/checkingDc'
import type { UnitDc, AccessoryDc } from '../api/unitDc'

const COMPANY_NAME    = 'APPLE UNIFORMM'
const COMPANY_TAGLINE = 'Manufacturer of SCHOOL, COLLEGE, SPORTS &amp; INDUSTRIAL UNIFORMS.'
const COMPANY_ADDRESS = '3/190, Mettupalayam road, Negamam, Sathyamangalam'

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
      } catch { resolve(logoSrc as string) }
    }
    img.onerror = () => resolve('')
    img.src = logoSrc as string
  })
}

function esc(v?: string | number | null): string {
  return String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// ─── shared HTML skeleton ────────────────────────────────────────────────────

function buildHtml(opts: {
  title: string
  dcType: string
  dcNumber: string
  logoDataUrl: string
  summaryFields: { label: string; value: string }[]
  statsHtml: string
  bodyHtml: string
}): string {
  const { title, dcType, dcNumber, logoDataUrl, summaryFields, statsHtml, bodyHtml } = opts
  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" class="logo" alt="Apple Uniformm">`
    : `<div class="brand-text">${COMPANY_NAME}</div>`

  const summaryRows = summaryFields
    .map(f => `<div class="field"><div class="field-lbl">${f.label}</div><div class="field-val">${f.value}</div></div>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: #fff; }

  /* ── header ── */
  .hdr { text-align: center; padding-bottom: 8px; border-bottom: 2px solid #1b7a3d; margin-bottom: 10px; }
  .logo { height: 48px; width: auto; }
  .brand-text { font-size: 22px; font-weight: 800; color: #c4161c; letter-spacing: 0.04em; }
  .brand-name { font-size: 20px; font-weight: 800; color: #c4161c; letter-spacing: 0.04em; margin-top: 2px; }
  .tagline { font-size: 10px; font-weight: 700; color: #1b5e20; margin-top: 1px; }
  .address { font-size: 10px; color: #444; margin-top: 1px; }

  /* ── DC type banner ── */
  .dc-banner {
    display: flex; justify-content: space-between; align-items: center;
    background: #1b7a3d; color: #fff; padding: 6px 12px;
    border-radius: 4px; margin-bottom: 10px;
  }
  .dc-type { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; }
  .dc-number { font-size: 16px; font-weight: 800; font-family: monospace; letter-spacing: 0.05em; }

  /* ── summary grid ── */
  .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 24px; padding: 10px 0; border-bottom: 1px solid #ddd; margin-bottom: 10px; }
  .field-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #666; margin-bottom: 2px; }
  .field-val { font-size: 12px; font-weight: 600; color: #111; }

  /* ── stats strip ── */
  .stats { display: flex; gap: 0; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin-bottom: 12px; }
  .stat { flex: 1; text-align: center; padding: 8px 4px; border-right: 1px solid #ddd; }
  .stat:last-child { border-right: none; }
  .stat-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 3px; }
  .stat-val { font-size: 16px; font-weight: 800; color: #1b5e20; }

  /* ── table ── */
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #1b5e20; margin: 12px 0 5px; padding-bottom: 3px; border-bottom: 2px solid #1b7a3d; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { background: #2d6a4f; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 8px; text-align: left; border: 1px solid #1b5235; }
  td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: middle; }
  tbody tr:nth-child(even) { background: #f7f9f7; }
  .num { text-align: right; }
  .ctr { text-align: center; }
  tfoot td { background: #e8f5e9; font-weight: 700; border-top: 2px solid #1b7a3d; }

  /* ── footer ── */
  .footer { margin-top: 24px; display: flex; justify-content: flex-end; }
  .sign-block { text-align: center; }
  .sign-line { width: 160px; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; font-weight: 700; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="hdr">
    ${logoHtml}
    <div class="brand-name">${COMPANY_NAME}</div>
    <div class="tagline">${COMPANY_TAGLINE}</div>
    <div class="address">${COMPANY_ADDRESS}</div>
  </div>

  <div class="dc-banner">
    <span class="dc-type">${dcType}</span>
    <span class="dc-number">${dcNumber}</span>
  </div>

  <div class="summary">${summaryRows}</div>
  <div class="stats">${statsHtml}</div>

  ${bodyHtml}

  <div class="footer">
    <div class="sign-block">
      <div class="sign-line">Authorised Signatory</div>
    </div>
  </div>

  <script>
    window.onload = function () {
      document.title = '${title}';
      setTimeout(function () { window.print(); }, 300);
    };
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`
}

function openPrint(html: string): void {
  const w = window.open('', '_blank', 'width=794,height=1123')
  if (!w) {
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.target = '_blank'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
}

function statHtml(label: string, value: string): string {
  return `<div class="stat"><div class="stat-lbl">${label}</div><div class="stat-val">${value}</div></div>`
}

// ─── Cutting DC ──────────────────────────────────────────────────────────────

export async function printCuttingDc(doc: CuttingOrder): Promise<void> {
  const logo = await getLogoDataUrl()
  const totalQty    = doc.items.reduce((s, i) => s + i.quantity, 0)
  const totalFabric = doc.items.reduce((s, i) => s + i.fabricConsumed, 0)

  const bodyHtml = `
    <div class="section-title">Cutting Lines</div>
    <table>
      <thead><tr>
        <th class="ctr" style="width:32px">#</th>
        <th>Style</th><th>Fabric</th><th>Colour</th>
        <th class="ctr">Gender</th><th class="ctr">Std</th>
        <th class="num">Qty (pcs)</th><th class="num">Fabric Used (m)</th>
      </tr></thead>
      <tbody>
        ${doc.items.map((it, i) => `<tr>
          <td class="ctr">${i + 1}</td>
          <td style="font-weight:600">${esc(it.styleName)}</td>
          <td>${esc(it.fabricName)}</td>
          <td>${esc(it.colourName)}</td>
          <td class="ctr">${esc(it.gender)}</td>
          <td class="ctr">${esc(it.standard)}</td>
          <td class="num" style="font-weight:700">${it.quantity.toLocaleString('en-IN')}</td>
          <td class="num" style="font-weight:700">${Number(it.fabricConsumed).toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="6" class="num">TOTAL</td>
        <td class="num">${totalQty.toLocaleString('en-IN')} pcs</td>
        <td class="num">${totalFabric.toFixed(2)} m</td>
      </tr></tfoot>
    </table>`

  const title = `${doc.cuttingNumber} DC`
  const html = buildHtml({
    title, dcType: 'CUTTING DC', dcNumber: doc.cuttingNumber, logoDataUrl: logo,
    summaryFields: [
      { label: 'Cutting Number', value: esc(doc.cuttingNumber) },
      { label: 'Cutting Date',   value: fmtDate(doc.cuttingDate) },
      { label: 'School',         value: esc(doc.schoolName) },
      { label: 'Status',         value: esc(doc.status) },
      { label: 'Sales Order',    value: esc(doc.schoolOrderNumber) },
      { label: 'Received By',    value: esc(doc.sentToPersonName) },
    ],
    statsHtml: statHtml('Lines', String(doc.items.length)) + statHtml('Total Pieces', totalQty.toLocaleString('en-IN')) + statHtml('Fabric Consumed', totalFabric.toFixed(2) + ' m'),
    bodyHtml,
  })
  openPrint(html)
}

// ─── Unit DC ─────────────────────────────────────────────────────────────────

export async function printUnitDc(doc: UnitDc): Promise<void> {
  const logo = await getLogoDataUrl()
  const totalQty = doc.items.reduce((s, i) => s + i.quantity, 0)

  const bodyHtml = `
    <div class="section-title">Garment Lines</div>
    <table>
      <thead><tr>
        <th class="ctr" style="width:32px">#</th>
        <th>Style</th><th class="ctr">Gender</th><th class="ctr">Standard</th>
        <th class="num">Quantity</th>
      </tr></thead>
      <tbody>
        ${doc.items.map((it, i) => `<tr>
          <td class="ctr">${i + 1}</td>
          <td style="font-weight:600">${esc(it.styleName)}</td>
          <td class="ctr">${esc(it.gender)}</td>
          <td class="ctr">${esc(it.standard)}</td>
          <td class="num" style="font-weight:700">${it.quantity.toLocaleString('en-IN')}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="4" class="num">TOTAL</td>
        <td class="num">${totalQty.toLocaleString('en-IN')} pcs</td>
      </tr></tfoot>
    </table>`

  const title = `${doc.dcNumber} DC`
  const html = buildHtml({
    title, dcType: 'UNIT DC', dcNumber: doc.dcNumber, logoDataUrl: logo,
    summaryFields: [
      { label: 'DC Number',      value: esc(doc.dcNumber) },
      { label: 'Delivery Date',  value: fmtDate(doc.deliveryDate) },
      { label: 'Stitching Unit', value: esc(doc.stitchingUnitName) },
      { label: 'Cutting #',      value: esc(doc.cuttingNumber) },
      { label: 'Status',         value: esc(doc.status) },
      { label: 'Received By',    value: esc(doc.sentToPersonName) },
    ],
    statsHtml: statHtml('Lines', String(doc.items.length)) + statHtml('Total Pieces', totalQty.toLocaleString('en-IN')),
    bodyHtml,
  })
  openPrint(html)
}

// ─── Accessory DC ────────────────────────────────────────────────────────────

export async function printAccessoryDc(doc: AccessoryDc): Promise<void> {
  const logo = await getLogoDataUrl()
  const totalQty = doc.items.reduce((s, i) => s + Number(i.quantity), 0)

  const bodyHtml = `
    <div class="section-title">Accessory Lines</div>
    <table>
      <thead><tr>
        <th class="ctr" style="width:32px">#</th>
        <th>Accessory</th>
        <th class="num">Quantity</th>
        <th class="ctr">UOM</th>
      </tr></thead>
      <tbody>
        ${doc.items.map((it, i) => `<tr>
          <td class="ctr">${i + 1}</td>
          <td style="font-weight:600">${esc(it.accessoryName)}</td>
          <td class="num" style="font-weight:700">${Number(it.quantity).toLocaleString('en-IN')}</td>
          <td class="ctr">${esc(it.unitOfMeasure)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="2" class="num">TOTAL</td>
        <td class="num">${totalQty.toLocaleString('en-IN')}</td>
        <td></td>
      </tr></tfoot>
    </table>`

  const title = `${doc.dcNumber} DC`
  const html = buildHtml({
    title, dcType: 'ACCESSORY DC', dcNumber: doc.dcNumber, logoDataUrl: logo,
    summaryFields: [
      { label: 'DC Number',      value: esc(doc.dcNumber) },
      { label: 'Delivery Date',  value: fmtDate(doc.deliveryDate) },
      { label: 'Stitching Unit', value: esc(doc.stitchingUnitName) },
      { label: 'Sales Order',    value: esc(doc.schoolOrderNumber) },
      { label: 'Status',         value: esc(doc.status) },
      { label: 'Received By',    value: esc(doc.sentToPersonName) },
    ],
    statsHtml: statHtml('Lines', String(doc.items.length)) + statHtml('Total Qty', totalQty.toLocaleString('en-IN')),
    bodyHtml,
  })
  openPrint(html)
}

// ─── Stitching (KajaButton) DC ───────────────────────────────────────────────

export async function printStitchingDc(doc: StitchingDc): Promise<void> {
  const logo = await getLogoDataUrl()
  const totalQty  = doc.items.reduce((s, i) => s + i.quantity, 0)
  const totalKaja = doc.kajaConsumption.reduce((s, k) => s + Number(k.quantity), 0)

  const kajaHtml = doc.kajaConsumption.length > 0 ? `
    <div class="section-title">Kaja / Hook &amp; Eye Consumption</div>
    <table>
      <thead><tr>
        <th class="ctr" style="width:32px">#</th>
        <th>Accessory</th>
        <th class="num">Quantity</th>
        <th class="ctr">UOM</th>
      </tr></thead>
      <tbody>
        ${doc.kajaConsumption.map((k, i) => `<tr>
          <td class="ctr">${i + 1}</td>
          <td style="font-weight:600">${esc(k.accessoryName)}</td>
          <td class="num" style="font-weight:700">${Number(k.quantity).toLocaleString('en-IN')}</td>
          <td class="ctr">${esc(k.unitOfMeasure)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="2" class="num">TOTAL</td>
        <td class="num">${totalKaja.toLocaleString('en-IN')}</td>
        <td></td>
      </tr></tfoot>
    </table>` : ''

  const bodyHtml = `
    <div class="section-title">Garment Lines</div>
    <table>
      <thead><tr>
        <th class="ctr" style="width:32px">#</th>
        <th>Style</th><th class="ctr">Gender</th><th class="ctr">Standard</th>
        <th class="num">Quantity</th>
      </tr></thead>
      <tbody>
        ${doc.items.map((it, i) => `<tr>
          <td class="ctr">${i + 1}</td>
          <td style="font-weight:600">${esc(it.styleName)}</td>
          <td class="ctr">${esc(it.gender)}</td>
          <td class="ctr">${esc(it.standard)}</td>
          <td class="num" style="font-weight:700">${it.quantity.toLocaleString('en-IN')}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="4" class="num">TOTAL</td>
        <td class="num">${totalQty.toLocaleString('en-IN')} pcs</td>
      </tr></tfoot>
    </table>
    ${kajaHtml}`

  const title = `${doc.dcNumber} DC`
  const html = buildHtml({
    title, dcType: 'STITCHING DC', dcNumber: doc.dcNumber, logoDataUrl: logo,
    summaryFields: [
      { label: 'DC Number',      value: esc(doc.dcNumber) },
      { label: 'Delivery Date',  value: fmtDate(doc.deliveryDate) },
      { label: 'Stitching Unit', value: esc(doc.stitchingUnitName) },
      { label: 'Cutting Order',  value: esc(doc.cuttingOrderNumber) },
      { label: 'School',         value: esc(doc.schoolName) },
      { label: 'Status',         value: esc(doc.status) },
      { label: 'Sales Order',    value: esc(doc.schoolOrderNumber) },
      { label: 'Received By',    value: esc(doc.sentToPersonName) },
    ],
    statsHtml: statHtml('Garment Lines', String(doc.items.length)) + statHtml('Total Pieces', totalQty.toLocaleString('en-IN')) + statHtml('Kaja Lines', String(doc.kajaConsumption.length)),
    bodyHtml,
  })
  openPrint(html)
}

// ─── Ironing DC ──────────────────────────────────────────────────────────────

export async function printIroningDc(doc: IroningDc): Promise<void> {
  const logo = await getLogoDataUrl()
  const totalQty = doc.items.reduce((s, i) => s + i.quantity, 0)

  const bodyHtml = `
    <div class="section-title">Garment Lines</div>
    <table>
      <thead><tr>
        <th class="ctr" style="width:32px">#</th>
        <th>Style</th><th class="ctr">Gender</th><th class="ctr">Standard</th>
        <th class="num">Quantity</th>
      </tr></thead>
      <tbody>
        ${doc.items.map((it, i) => `<tr>
          <td class="ctr">${i + 1}</td>
          <td style="font-weight:600">${esc(it.styleName)}</td>
          <td class="ctr">${esc(it.gender)}</td>
          <td class="ctr">${esc(it.standard)}</td>
          <td class="num" style="font-weight:700">${it.quantity.toLocaleString('en-IN')}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="4" class="num">TOTAL</td>
        <td class="num">${totalQty.toLocaleString('en-IN')} pcs</td>
      </tr></tfoot>
    </table>`

  const title = `${doc.dcNumber} DC`
  const html = buildHtml({
    title, dcType: 'IRONING DC', dcNumber: doc.dcNumber, logoDataUrl: logo,
    summaryFields: [
      { label: 'DC Number',      value: esc(doc.dcNumber) },
      { label: 'Ironing Date',   value: fmtDate(doc.deliveryDate) },
      { label: 'Stitching Unit', value: esc(doc.stitchingUnitName) },
      { label: 'School',         value: esc(doc.schoolName) },
      { label: 'Sales Order',    value: esc(doc.schoolOrderNumber) },
      { label: 'Status',         value: esc(doc.status) },
      { label: 'Received By',    value: esc(doc.sentToPersonName) },
    ],
    statsHtml: statHtml('Lines', String(doc.items.length)) + statHtml('Total Pieces', totalQty.toLocaleString('en-IN')),
    bodyHtml,
  })
  openPrint(html)
}

// ─── Checking DC ─────────────────────────────────────────────────────────────

export async function printCheckingDc(doc: CheckingDc): Promise<void> {
  const logo = await getLogoDataUrl()
  const totalQty = doc.items.reduce((s, i) => s + i.quantity, 0)

  const bodyHtml = `
    <div class="section-title">Garment Lines</div>
    <table>
      <thead><tr>
        <th class="ctr" style="width:32px">#</th>
        <th>Style</th><th class="ctr">Gender</th><th class="ctr">Standard</th>
        <th class="num">Quantity</th>
      </tr></thead>
      <tbody>
        ${doc.items.map((it, i) => `<tr>
          <td class="ctr">${i + 1}</td>
          <td style="font-weight:600">${esc(it.styleName)}</td>
          <td class="ctr">${esc(it.gender)}</td>
          <td class="ctr">${esc(it.standard)}</td>
          <td class="num" style="font-weight:700">${it.quantity.toLocaleString('en-IN')}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="4" class="num">TOTAL</td>
        <td class="num">${totalQty.toLocaleString('en-IN')} pcs</td>
      </tr></tfoot>
    </table>`

  const title = `${doc.dcNumber} DC`
  const html = buildHtml({
    title, dcType: 'CHECKING DC', dcNumber: doc.dcNumber, logoDataUrl: logo,
    summaryFields: [
      { label: 'DC Number',      value: esc(doc.dcNumber) },
      { label: 'Check Date',     value: fmtDate(doc.checkDate) },
      { label: 'Stitching Unit', value: esc(doc.stitchingUnitName) },
      { label: 'School',         value: esc(doc.schoolName) },
      { label: 'Sales Order',    value: esc(doc.schoolOrderNumber) },
      { label: 'Status',         value: esc(doc.status) },
      { label: 'Received By',    value: esc(doc.sentToPersonName) },
    ],
    statsHtml: statHtml('Lines', String(doc.items.length)) + statHtml('Total Pieces', totalQty.toLocaleString('en-IN')),
    bodyHtml,
  })
  openPrint(html)
}
