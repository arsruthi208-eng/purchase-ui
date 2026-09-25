import type { SchoolOrderDetail, SchoolOrderItemResponse } from '../api/schoolOrders'
import logoSrc from '../assets/apple-uniformm-logo.png'

const COMPANY_ADDRESS = '3/190, Mettupalayam road, Negamam, Sathyamangalam'
const TAGLINE = 'Manufacturer of SCHOOL, COLLEGE, SPORTS & INDUSTRIAL UNIFORMS.'

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
  const logoImg = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Apple Uniformm" class="logo">`
    : ''
  const listBar = order.orderListLabel
    ? `<div class="list-bar"><span>ORDER LIST : ${esc(order.orderListLabel)}</span><span>DATE : ${fmtDate(order.orderDate)}</span></div>`
    : ''
  const body = kind === 'SCHOOL_SIZE' ? sizeBody(order.items)
    : kind === 'CORPORATE' ? corpBody(order.items)
    : stdBody(order.items)
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0)
  const stds = [...new Set(order.items.map(i => i.standard).filter(Boolean))].join(', ')
  const stdPart = stds ? `Standards ${stds}` : 'the requested items'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${order.orderNumber} SO</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 10mm; }
    .sheet { min-height: 277mm; display: flex; flex-direction: column; }
    .hdr { text-align: center; padding-bottom: 8px; border-bottom: 2px solid #1b7a3d; margin-bottom: 8px; }
    .logo { height: 72px; width: auto; }
    .tag { font-size: 10.5px; font-weight: 700; color: #1b5e20; margin-top: 3px; }
    .addr { font-size: 11px; margin-top: 2px; color: #333; }
    .meta { display: flex; justify-content: space-between; align-items: flex-start; margin: 7px 0 8px; }
    .to { font-size: 12px; line-height: 1.5; }
    .to strong { display: block; margin-bottom: 2px; }
    .nums { text-align: right; font-weight: 700; font-size: 12px; line-height: 1.6; }
    .subject {
      background: #fff8dc; font-weight: 700; padding: 5px 10px; margin-bottom: 7px;
      border-left: 4px solid #d4a800; font-size: 12px; color: #5a3e00;
    }
    .intro { margin-bottom: 8px; line-height: 1.4; font-size: 11.5px; color: #333; }
    .list-bar {
      display: flex; justify-content: space-between; background: #1b7a3d; color: #fff;
      font-weight: 700; padding: 5px 10px; margin-bottom: 6px; font-size: 12px;
    }
    table.grid { width: 100%; border-collapse: collapse; }
    table.grid th { background: #2d6a4f; color: #fff; font-size: 10.5px; font-weight: 700;
      text-align: left; padding: 5px 7px; border: 1px solid #1b5235; letter-spacing: 0.03em; }
    table.grid td { border: 1px solid #ccc; padding: 5px 7px; font-size: 12px; vertical-align: middle; }
    table.grid tbody tr:nth-child(even):not(.sec):not(.tot) { background: #f9f9f9; }
    tr.sec td {
      background: #e8f5e9; color: #1b5e20; font-weight: 700; font-size: 11px;
      padding: 3px 7px; border-color: #a5d6a7; letter-spacing: 0.05em; text-transform: uppercase;
    }
    tr.tot td {
      background: #f0f0f0; font-weight: 700; font-size: 12px;
      border-top: 2px solid #333; border-color: #999;
    }
    .confirm-block { margin-top: 24px; padding: 14px 0 0 0; }
    .confirm-block p { font-size: 12.5px; color: #111; line-height: 1.7; margin-bottom: 8px; }
    .confirm-block p:last-child { margin-bottom: 0; }
    .regards { margin-top: 52px; padding-top: 48px; font-size: 14.5px; line-height: 1.7; color: #111; font-weight: bold; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hdr">
      ${logoImg}
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
    <div class="intro">Respected Mam/Sir,<br>Thank you for your order. We are pleased to confirm the following details.</div>
    ${listBar}
    ${body}
    <div class="confirm-block">
      <p>This is an order confirmation for <strong>${esc(order.schoolName)}</strong>, covering ${esc(stdPart)} with a total quantity of <strong>${totalQty.toLocaleString('en-IN')}</strong> pieces.</p>
      <p>We seek your kind approval and acknowledgement of the above order details to proceed with production as per the agreed specifications.</p>
      <p>Upon your acknowledgement, we will take this order forward and ensure timely delivery as per the agreed schedule.</p>
    </div>
    <div class="regards">
      Kind regards,<br>
      <strong>APPLE UNIFORMM</strong>
    </div>
  </div>
  <script>
    window.onload = function () {
      document.title = '${order.orderNumber} SO';
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
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const printWindow = window.open(url, '_blank', 'width=794,height=1123')
  if (!printWindow) {
    const a = document.createElement('a')
    a.href = url; a.target = '_blank'; a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
