import type { SchoolOrderDetail, SchoolOrderItemResponse } from '../api/schoolOrders'
import logoSrc from '../assets/apple-uniformm-logo.png'

const COMPANY_ADDRESS = '3/190, Mettupalayam road, Negamam, Sathyamangalam'
const TAGLINE = 'Manufacturer of SCHOOL, COLLEGE, SPORTS & INDUSTRIAL UNIFORMS.'
const DEFAULT_NOTES =
  'We hereby confirm the above quantities and are pleased to proceed with production as per your order. Please feel free to reach out for any further clarification or additional requirements. Thank you for your trust and support.'

async function getLogoDataUrl(): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
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

function printGender(g: string, corporate: boolean): string {
  if (!corporate) return g
  if (g === 'BOYS') return "MEN'S"
  if (g === 'GIRLS') return 'LADIES'
  return g
}

function defaultSubject(order: SchoolOrderDetail): string {
  if (order.subject?.trim()) return order.subject.trim()
  const stds = [...new Set(order.items.map(i => i.standard).filter(Boolean))]
  const gens = [...new Set(order.items.map(i => printGender(i.gender, order.orderKind === 'CORPORATE')))]
  const stdPart = stds.length ? stds.join(' & ') : ''
  const genPart = gens.length ? gens.join(' & ') : ''
  return `Order Confirmation ${stdPart} ${genPart}`.replace(/\s+/g, ' ').trim()
}

function groupConsecutive<T>(items: T[], key: (t: T) => string): { key: string; rows: T[] }[] {
  const out: { key: string; rows: T[] }[] = []
  for (const item of items) {
    const k = key(item)
    const last = out[out.length - 1]
    if (last && last.key === k) last.rows.push(item)
    else out.push({ key: k, rows: [item] })
  }
  return out
}

function sizeBody(items: SchoolOrderItemResponse[]): string {
  const groups = groupConsecutive(items, i => `${i.sectionTitle || ''}||${i.styleName}`)
  let n = 0
  const chunks = groups.map(g => {
    const title = g.rows[0].sectionTitle
    const banner = title
      ? `<tr class="sec"><td colspan="6">${esc(title)}</td></tr>`
      : ''
    const rows = g.rows.map(item => {
      n += 1
      return `<tr>
        <td style="text-align:center">${n}</td>
        <td>${esc(item.gender)}</td>
        <td>${esc(item.standard)}</td>
        <td>${esc(item.styleName)}</td>
        <td style="text-align:center">${esc(item.size)}</td>
        <td style="text-align:right">${item.quantity.toLocaleString('en-IN')}</td>
      </tr>`
    }).join('')
    const tot = g.rows.reduce((s, i) => s + i.quantity, 0)
    return `${banner}${rows}<tr class="tot"><td colspan="5" style="text-align:right">TOTAL</td><td style="text-align:right">${tot.toLocaleString('en-IN')}</td></tr>`
  }).join('')
  return `<table class="grid">
    <thead><tr>
      <th style="width:48px">S.NO</th>
      <th>GENDER</th>
      <th>STD</th>
      <th>PRODUCT DESCRIPTION</th>
      <th style="width:70px">SIZE</th>
      <th style="width:90px">QUANTITY</th>
    </tr></thead>
    <tbody>${chunks}</tbody>
  </table>`
}

function stdBody(items: SchoolOrderItemResponse[]): string {
  const groups = groupConsecutive(items, i => i.sectionTitle || i.gender)
  let n = 0
  const chunks = groups.map(g => {
    const title = g.rows[0].sectionTitle || printGender(g.rows[0].gender, false)
    const rows = g.rows.map(item => {
      n += 1
      return `<tr>
        <td style="text-align:center">${n}</td>
        <td>${esc(item.styleName)}</td>
        <td>${esc(item.gender)}</td>
        <td>${esc(item.standard)}</td>
        <td style="text-align:right">${item.totalStudentCount != null ? item.totalStudentCount.toLocaleString('en-IN') : '—'}</td>
        <td style="text-align:right">${item.studentCount != null ? item.studentCount.toLocaleString('en-IN') : '—'}</td>
        <td style="text-align:right">${item.quantity.toLocaleString('en-IN')}</td>
      </tr>`
    }).join('')
    const totStudents = g.rows.reduce((s, i) => s + (i.totalStudentCount ?? 0), 0)
    const noStudents = g.rows.reduce((s, i) => s + (i.studentCount ?? 0), 0)
    const qty = g.rows.reduce((s, i) => s + i.quantity, 0)
    return `<tr class="sec"><td colspan="7">${esc(title)}</td></tr>${rows}
      <tr class="tot"><td colspan="4" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${totStudents.toLocaleString('en-IN')}</td>
        <td style="text-align:right">${noStudents.toLocaleString('en-IN')}</td>
        <td style="text-align:right">${qty.toLocaleString('en-IN')}</td></tr>`
  }).join('')
  return `<table class="grid">
    <thead><tr>
      <th style="width:48px">S.NO</th>
      <th>STYLE</th>
      <th>GENDER</th>
      <th>STD</th>
      <th>TOTAL STUDENTS</th>
      <th>NO. OF STUDENTS</th>
      <th style="width:80px">QTY</th>
    </tr></thead>
    <tbody>${chunks}</tbody>
  </table>`
}

function corpBody(items: SchoolOrderItemResponse[]): string {
  const groups = groupConsecutive(items, i => `${i.gender}||${i.standard}||${i.sectionTitle || ''}`)
  let n = 0
  const chunks = groups.map(g => {
    const sample = g.rows[0]
    const title = sample.sectionTitle || `${printGender(sample.gender, true)} — ${sample.standard}`
    const rows = g.rows.map(item => {
      n += 1
      return `<tr>
        <td style="text-align:center">${n}</td>
        <td>${esc(printGender(item.gender, true))}</td>
        <td>${esc(item.standard)}</td>
        <td>${esc(item.styleName)}</td>
        <td style="text-align:right">${item.studentCount != null ? item.studentCount.toLocaleString('en-IN') : '—'}</td>
        <td style="text-align:right">${item.setCount != null ? item.setCount.toLocaleString('en-IN') : item.quantity.toLocaleString('en-IN')}</td>
      </tr>`
    }).join('')
    const students = g.rows.reduce((s, i) => s + (i.studentCount ?? 0), 0)
    const sets = g.rows.reduce((s, i) => s + (i.setCount ?? i.quantity), 0)
    return `<tr class="sec"><td colspan="6">${esc(title)}</td></tr>${rows}
      <tr class="tot"><td colspan="4" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${students.toLocaleString('en-IN')}</td>
        <td style="text-align:right">${sets.toLocaleString('en-IN')}</td></tr>`
  }).join('')
  return `<table class="grid">
    <thead><tr>
      <th style="width:48px">S.NO</th>
      <th>GENDER</th>
      <th>YEAR</th>
      <th>PRODUCT DESCRIPTION</th>
      <th>NO. OF STUDENTS</th>
      <th>NO. OF SETS</th>
    </tr></thead>
    <tbody>${chunks}</tbody>
  </table>`
}

function esc(v?: string | number | null): string {
  return dash(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildHtml(order: SchoolOrderDetail, logoDataUrl: string): string {
  const kind = order.orderKind || 'SCHOOL_STD'
  const n = Math.max(order.items.length, 1)
  const rowH = n <= 2 ? 42 : n <= 6 ? 32 : 26
  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Apple Uniformm" class="logo">`
    : `<div class="brand-name">APPLE UNIFORMM</div>`
  const listBar = order.orderListLabel
    ? `<div class="list-bar"><span>ORDER LIST : ${esc(order.orderListLabel)}</span><span>DATE : ${fmtDate(order.orderDate)}</span></div>`
    : ''
  const body = kind === 'SCHOOL_SIZE' ? sizeBody(order.items)
    : kind === 'CORPORATE' ? corpBody(order.items)
    : stdBody(order.items)
  const notes = (order.notes?.trim() || DEFAULT_NOTES)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 297mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color: #111; background: #fff; }
    .sheet { min-height: 277mm; display: flex; flex-direction: column; }
    .hdr { text-align: center; padding-bottom: 8px; }
    .logo { height: 52px; width: auto; }
    .brand-name { font-size: 26px; font-weight: 800; color: #c4161c; letter-spacing: 0.04em; }
    .tag { font-size: 11px; font-weight: 700; color: #1b5e20; margin-top: 2px; }
    .addr { font-size: 12px; margin-top: 2px; }
    .meta { display: flex; justify-content: space-between; align-items: flex-start; margin: 8px 0 10px; }
    .to { font-size: 13px; line-height: 1.4; }
    .to strong { display: block; margin-bottom: 2px; }
    .nums { text-align: right; font-weight: 700; font-size: 13px; }
    .subject {
      background: #ffe566; font-weight: 800; padding: 7px 10px; margin-bottom: 8px;
      border: 1px solid #e0c200; font-size: 13px;
    }
    .intro { margin-bottom: 10px; line-height: 1.45; }
    .list-bar {
      display: flex; justify-content: space-between; background: #1b7a3d; color: #fff;
      font-weight: 800; padding: 6px 12px; margin-bottom: 8px; font-size: 12.5px;
    }
    table.grid { width: 100%; border-collapse: collapse; flex: 1; }
    table.grid th, table.grid td { border: 1px solid #222; padding: 5px 6px; }
    table.grid th { background: #f3f3f3; font-size: 11px; text-align: left; }
    table.grid td { height: ${rowH}px; }
    tr.sec td { background: #ffe566; font-weight: 800; text-align: center; letter-spacing: 0.02em; }
    tr.tot td { background: #ffe566; font-weight: 800; }
    .notes { margin-top: 14px; }
    .notes h4 { margin-bottom: 4px; }
    .notes p { line-height: 1.45; }
    .sign { margin-top: auto; padding-top: 28px; }
    .sign-lbl { margin-top: 36px; font-weight: 700; font-size: 12px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hdr">
      ${logoHtml}
      <div class="brand-name">APPLE UNIFORMM</div>
      <div class="tag">${TAGLINE}</div>
      <div class="addr">${COMPANY_ADDRESS}</div>
    </div>
    <div class="meta">
      <div class="to">
        <strong>TO :</strong>
        ${esc(order.schoolName)}<br>
        ${esc(order.schoolAddress)}
      </div>
      <div class="nums">
        ORDER NO : ${esc(order.orderNumber)}<br>
        DATE : ${fmtDate(order.orderDate)}
      </div>
    </div>
    <div class="subject">SUBJECT : ${esc(defaultSubject(order))}</div>
    <div class="intro">Dear Madam,<br>Thank you for your order. We are pleased to confirm the following details.</div>
    ${listBar}
    ${body}
    <div class="notes">
      <h4>NOTES :</h4>
      <p>${esc(notes)}</p>
      <p style="margin-top:8px">Kind regards,<br>APPLE UNIFORMM</p>
    </div>
    <div class="sign">
      <div class="sign-lbl">Authorised Signatory</div>
    </div>
  </div>
  <script>
    window.onload = function () {
      document.title = '${order.orderNumber}';
      setTimeout(function () { window.print(); }, 300);
    };
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`
}

export async function printSchoolOrder(order: SchoolOrderDetail): Promise<void> {
  const logoDataUrl = await getLogoDataUrl()
  const html = buildHtml(order, logoDataUrl)
  const printWindow = window.open('', '_blank', 'width=794,height=1123')
  if (!printWindow) {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
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
