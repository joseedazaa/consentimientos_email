const PDF_URL = "/pdf";
const pdfCanvas = document.getElementById("pdfCanvas");
const sigCanvas = document.getElementById("sigCanvas");
const pdfCtx = pdfCanvas.getContext("2d");
const sigCtx = sigCanvas.getContext("2d");
let drawing = false;

async function renderPDF() {
  const pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
  const scale = 1.4;
  let totalHeight = 0;
  let maxWidth = 0;

  // Calcular tamaño total
  const pages = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    pages.push({ page, viewport });
    totalHeight += viewport.height;
    maxWidth = Math.max(maxWidth, viewport.width);
  }

  // Ajustar tamaño de los lienzos
  pdfCanvas.width = maxWidth;
  pdfCanvas.height = totalHeight;
  sigCanvas.width = maxWidth;
  sigCanvas.height = totalHeight;

  // Dibujar cada página una debajo de otra
  let yOffset = 0;
  for (const { page, viewport } of pages) {
    await page.render({
      canvasContext: pdfCtx,
      viewport,
      transform: [1, 0, 0, 1, 0, yOffset]
    }).promise;
    yOffset += viewport.height;
  }
}

// Eventos de dibujo de la firma
sigCanvas.addEventListener("mousedown", e => {
  drawing = true;
  sigCtx.beginPath();
  sigCtx.moveTo(e.offsetX, e.offsetY);
});
sigCanvas.addEventListener("mousemove", e => {
  if (!drawing) return;
  sigCtx.lineTo(e.offsetX, e.offsetY);
  sigCtx.strokeStyle = "black";
  sigCtx.lineWidth = 2;
  sigCtx.stroke();
});
sigCanvas.addEventListener("mouseup", () => (drawing = false));
sigCanvas.addEventListener("mouseleave", () => (drawing = false));

document.getElementById("clear").addEventListener("click", () => {
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
});

document.getElementById("send").addEventListener("click", async () => {
  const pdfDataUrl = pdfCanvas.toDataURL("image/png");
  const sigDataUrl = sigCanvas.toDataURL("image/png");

  const blob = await fetch(sigDataUrl).then(res => res.blob());
  const formData = new FormData();
  formData.append("signature", blob, "firma.png");
  formData.append("pdf", pdfDataUrl);

  await fetch("/submit", { method: "POST", body: formData });
  alert("PDF firmado enviado correctamente.");
});

renderPDF();
