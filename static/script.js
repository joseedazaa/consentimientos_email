// Mostrar el PDF y permitir firmar sobre él
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

  const pages = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    pages.push({ page, viewport });
    totalHeight += viewport.height;
    maxWidth = Math.max(maxWidth, viewport.width);
  }

  pdfCanvas.width = maxWidth;
  pdfCanvas.height = totalHeight;
  sigCanvas.width = maxWidth;
  sigCanvas.height = totalHeight;

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
renderPDF();

// Eventos de dibujo
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

// Enviar con EmailJS
document.getElementById("send").addEventListener("click", async () => {
  const sigDataUrl = sigCanvas.toDataURL("image/png");

  emailjs.init("2mCQ45S_dNLMex9Nr"); // Tu Public Key

  const templateParams = {
    message: "Nuevo consentimiento firmado.",
    signature: sigDataUrl
  };

  emailjs.send("service_rxgpa8f", "service_rxgpa8f", templateParams)
    .then(() => alert("✅ Enviado correctamente a la asesoría."),
          err => alert("❌ Error al enviar: " + JSON.stringify(err)));
});
