const PDF_URL = "/pdf";
const pdfCanvas = document.getElementById("pdfCanvas");
const sigCanvas = document.getElementById("sigCanvas");
const pdfCtx = pdfCanvas.getContext("2d");
const sigCtx = sigCanvas.getContext("2d");
let pdfDocRef;
let viewports = [];
let pageHeights = [];
let totalHeight = 0;
let scale = 1;

async function renderPDF() {
  pdfDocRef = await pdfjsLib.getDocument(PDF_URL).promise;
  const pages = [];
  for (let i = 1; i <= pdfDocRef.numPages; i++) pages.push(await pdfDocRef.getPage(i));

  // Escala en base al ancho contenedor
  const containerW = document.querySelector(".stage").clientWidth || 900;
  const unscaled = await pages[0].getViewport({ scale: 1 });
  scale = containerW / unscaled.width;

  // Calcular tamaños y alturas totales
  viewports = pages.map(p => p.getViewport({ scale }));
  const width = Math.max(...viewports.map(v => v.width));
  totalHeight = viewports.reduce((acc, v) => acc + v.height, 0);
  pageHeights = viewports.map(v => v.height);

  pdfCanvas.width = width;
  pdfCanvas.height = Math.ceil(totalHeight);
  sigCanvas.width = width;
  sigCanvas.height = totalHeight;

  // Render apilado: página 1 y debajo la 2
  let yOff = 0;
  for (let i = 0; i < pages.length; i++) {
    await pages[i].render({
      canvasContext: pdfCtx,
      viewport: viewports[i],
      transform: [1, 0, 0, 1, 0, yOff]
    }).promise;
    yOff += viewports[i].height;
  }
}
renderPDF();

// Firma dibujada sobre TODAS las páginas (overlay)
let drawing = false;
function pos(e){
  const rect = sigCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}
function start(e){ drawing = true; const {x,y}=pos(e); sigCtx.beginPath(); sigCtx.moveTo(x,y); }
function move(e){
  if(!drawing) return;
  e.preventDefault?.();
  const {x,y}=pos(e);
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigCtx.strokeStyle = 'black';
  sigCtx.lineTo(x,y);
  sigCtx.stroke();
}
function end(){ drawing=false; sigCtx.beginPath(); }

["mousedown","touchstart"].forEach(ev => sigCanvas.addEventListener(ev, start, {passive:false}));
["mousemove","touchmove"].forEach(ev => sigCanvas.addEventListener(ev, move, {passive:false}));
["mouseup","mouseleave","touchend","touchcancel"].forEach(ev => sigCanvas.addEventListener(ev, end));

// Borrar
document.getElementById("clear").onclick = () => {
  sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height);
};

// Enviar: incrustar firma SOLO en la página 2 y mandar al servidor
document.getElementById("send").onclick = async () => {
  // 1) Cargar PDF original con pdf-lib
  const originalBytes = await fetch(PDF_URL).then(r=>r.arrayBuffer());
  const libDoc = await PDFLib.PDFDocument.load(originalBytes);
  const pages = libDoc.getPages();

  // 2) Recortar del lienzo de firma SOLO el área de la página 2 (asumiendo 2 páginas)
  const page1HeightPx = pageHeights[0];             // altura renderizada de la página 1 en pixeles canvas
  const page2HeightPx = pageHeights[1];             // altura renderizada de la página 2 en pixeles canvas

  // Crear un canvas temporal con el tamaño EXACTO de la página 2
  const crop = document.createElement("canvas");
  crop.width = sigCanvas.width;
  crop.height = page2HeightPx;
  const cctx = crop.getContext("2d");

  // Copiar del overlay la franja correspondiente a la página 2
  // sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
  cctx.drawImage(
    sigCanvas,
    0, page1HeightPx,               // origen Y = empieza donde termina la página 1
    sigCanvas.width, page2HeightPx, // ancho/alto de la página 2
    0, 0,                           // destino
    crop.width, crop.height
  );

  // 3) Convertir esa franja a PNG y embeberla a tamaño completo de la página 2
  const dataUrl = crop.toDataURL("image/png");
  const png = await libDoc.embedPng(dataUrl);

  const page2 = pages[1]; // índice 1 = segunda página
  const { width: pageW, height: pageH } = page2.getSize();

  // Mapeo px(canvas) -> puntos(PDF)
  const sx = pageW / crop.width;
  const sy = pageH / crop.height;

  page2.drawImage(png, {
    x: 0,
    y: 0,
    width: crop.width * sx,
    height: crop.height * sy
  });

  // 4) Obtener bytes y ENVIAR al servidor para email
  const outBytes = await libDoc.save();

  const res = await fetch("/submit", {
    method: "POST",
    headers: {"Content-Type":"application/pdf"},
    body: outBytes
  });

  const js = await res.json();
  if (js.ok) {
    alert("Enviado a la asesoría correctamente.");
    sigCtx.clearRect(0,0,sigCanvas.width,sigCanvas.height);
  } else {
    alert("Error al enviar: " + (js.error || "desconocido"));
  }
};

