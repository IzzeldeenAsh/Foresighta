/** A4 width minus the 10mm side margins, in CSS pixels, so the export wraps text like a printed page. */
const PAGE_CONTENT_WIDTH_PX = 718;

/**
 * The contract template's logo lives on S3 without CORS headers, so the canvas cannot read it and it
 * drops out of the PDF. The export swaps it for the same image bundled with the app (same origin).
 */
const LOCAL_LOGOS: Record<string, string> = {
  'whatsapp-small-en.png': 'assets/media/logos/contract-logo-en.png',
  'whatsapp-small-ar.png': 'assets/media/logos/contract-logo-ar.png',
};

/**
 * Exports the platform contract HTML to a PDF entirely in the browser (no API call).
 * The contract carries its own inline styles, so it renders the same as the on-screen preview.
 */
export async function exportContractPdf(html: string, fileName: string, direction: 'rtl' | 'ltr'): Promise<void> {
  const { default: html2pdf } = await import('html2pdf.js');

  // Off-screen stage: html2pdf clones `content`, so positioning lives on the wrapper only.
  const stage = document.createElement('div');
  stage.style.cssText = 'position:fixed;top:0;left:-10000px;pointer-events:none;';
  const content = document.createElement('div');
  content.dir = direction;
  content.style.cssText = `width:${PAGE_CONTENT_WIDTH_PX}px;background:#fff;color:#1f2937;font-size:14px;line-height:1.75;`;
  content.innerHTML = html;
  useLocalLogos(content);
  wrapWords(content);
  stage.appendChild(content);
  document.body.appendChild(stage);

  try {
    await imagesLoaded(content);
    await html2pdf()
      .set({
        margin: [10, 10, 12, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // Keep lines, list items, table rows and images whole across page breaks.
        pagebreak: { mode: ['css', 'legacy'], avoid: ['p', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img'] },
      })
      .from(content)
      .save();
  } finally {
    stage.remove();
  }
}

function useLocalLogos(root: HTMLElement): void {
  root.querySelectorAll('img').forEach(img => {
    const fileName = (img.getAttribute('src') || '').split('?')[0].split('/').pop() || '';
    const local = LOCAL_LOGOS[fileName];
    if (local) img.src = new URL(local, document.baseURI).href;
  });
}

/**
 * html2canvas lays out each text run itself and gets right-to-left text wrong: spaces at line ends
 * vanish (words run together) and punctuation lands on the wrong side. Giving every word and every
 * punctuation mark its own span makes it draw each piece at the position the browser laid it out.
 */
function wrapWords(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue?.trim()) textNodes.push(node);
  }
  for (const node of textNodes) {
    const parts = node.nodeValue?.match(/\s+|[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]/gu) || [];
    if (parts.length < 2) continue;
    const fragment = document.createDocumentFragment();
    for (const part of parts) {
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
      } else {
        const span = document.createElement('span');
        span.textContent = part;
        fragment.appendChild(span);
      }
    }
    node.parentNode?.replaceChild(fragment, node);
  }
}

function imagesLoaded(root: HTMLElement): Promise<void> {
  const pending = Array.from(root.querySelectorAll('img'))
    .filter(img => !img.complete)
    .map(img => new Promise<void>(resolve => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    }));
  return Promise.all(pending).then(() => undefined);
}
