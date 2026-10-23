import html2canvas from 'html2canvas'

/**
 * Renders a self-contained HTML document string into a hidden iframe,
 * captures it with html2canvas at 2× resolution, and downloads as PNG.
 *
 * @param filename  - filename without extension (e.g. "AUCU026")
 * @param html      - full HTML document string (same as used for printing)
 */
export async function downloadAsImage(filename: string, html: string): Promise<void> {
  // Mount a hidden iframe so the HTML has its own document/styles
  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:794px;height:1px;border:none;visibility:hidden;overflow:hidden;'
  document.body.appendChild(iframe)

  // Write the HTML and wait for the load event
  await new Promise<void>(resolve => {
    iframe.onload = () => resolve()
    iframe.contentDocument!.open()
    iframe.contentDocument!.write(html)
    iframe.contentDocument!.close()
  })

  // Extra settle time for fonts / images inside the iframe
  await new Promise(r => setTimeout(r, 700))

  const body = iframe.contentDocument!.body
  // Make body tall enough to capture full content
  body.style.height = 'auto'
  body.style.overflow = 'visible'

  const canvas = await html2canvas(body, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    windowWidth: 794,
    scrollX: 0,
    scrollY: 0,
    logging: false,
  })

  document.body.removeChild(iframe)

  const a = document.createElement('a')
  a.download = `${filename}.png`
  a.href = canvas.toDataURL('image/png')
  a.click()
}
