const PER_PAGE = 50;
let photos = [];
let currentPage = 1;
let viewerIndex = 0;
let zoom = 1;
let drag = false;
let startX = 0, startY = 0, offsetX = 0, offsetY = 0;
const selected = new Set();
const instructions = new Map();

const gallery = document.getElementById("gallery");
const count = document.getElementById("selectedCount");
const pageInfo = document.getElementById("pageInfo");
const pageNumber = document.getElementById("pageNumber");
const selectionTitle = document.getElementById("selectionTitle");
const selectionList = document.getElementById("selectionList");
const lightbox = document.getElementById("lightbox");
const largePhoto = document.getElementById("largePhoto");
const largeName = document.getElementById("largeName");
const largePosition = document.getElementById("largePosition");
const selectLarge = document.getElementById("selectLarge");
const photoStage = document.getElementById("photoStage");
const photoInstruction = document.getElementById("photoInstruction");
const statusEl = document.getElementById("connectionStatus");
const storageKey = `jorge-arreola-gallery:${GALLERY_CONFIG.folderId}`;

function imageUrl(fileId, size = 1600) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}
function downloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}
function folderUrl() {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(GALLERY_CONFIG.folderId)}`;
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function numericNameCompare(a,b) {
  return a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:"base"});
}

function loadSavedSelection() {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
    (data.selected || []).forEach(n => selected.add(n));
    Object.entries(data.instructions || {}).forEach(([name, note]) => instructions.set(name, note));
  } catch (_) {}
}
function saveSelection() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      selected: [...selected],
      instructions: Object.fromEntries(instructions)
    }));
  } catch (_) {}
}

function render() {
  if (!photos.length) return;
  const totalPages = Math.ceil(photos.length / PER_PAGE);
  currentPage = Math.max(1, Math.min(currentPage, totalPages));
  const start = (currentPage - 1) * PER_PAGE;
  const pagePhotos = photos.slice(start, start + PER_PAGE);

  gallery.innerHTML = pagePhotos.map((p, localIndex) => {
    const note = instructions.get(p.name) || "";
    return `
    <article class="card ${selected.has(p.name) ? "selected" : ""}" data-name="${escapeHtml(p.name)}">
      <button class="photo-button" type="button" data-index="${start + localIndex}" aria-label="Ver ${escapeHtml(p.name)} en grande">
        <img src="${imageUrl(p.id, 900)}" alt="${escapeHtml(p.name)}" loading="lazy">
      </button>
      <div class="check">${selected.has(p.name) ? "✓" : ""}</div>
      <div class="name">${escapeHtml(p.name)}</div>
      ${note ? `<div class="instruction-note"><strong>Instrucción:</strong> ${escapeHtml(note)}</div>` : ""}
      <button class="select-card" type="button" data-select="${escapeHtml(p.name)}">
        ${selected.has(p.name) ? "✓ Seleccionada" : "Seleccionar"}
      </button>
    </article>`;
  }).join("");

  gallery.querySelectorAll(".photo-button").forEach(btn => btn.addEventListener("click", () => openViewer(Number(btn.dataset.index))));
  gallery.querySelectorAll("[data-select]").forEach(btn => btn.addEventListener("click", e => { e.stopPropagation(); toggle(btn.dataset.select); }));

  pageInfo.textContent = `${start + 1}–${Math.min(start + PER_PAGE, photos.length)} de ${photos.length}`;
  pageNumber.textContent = `Página ${currentPage} de ${totalPages}`;
  document.getElementById("prevBtn").disabled = currentPage === 1;
  document.getElementById("nextBtn").disabled = currentPage === totalPages;
  updateSelection();
}

function toggle(name) {
  if (selected.has(name)) selected.delete(name); else selected.add(name);
  saveSelection();
  render();
  if (lightbox.classList.contains("open")) updateViewerButton();
}

function updateSelection() {
  const names = [...selected].sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
  count.textContent = names.length;
  selectionTitle.textContent = `${names.length} fotografía${names.length === 1 ? "" : "s"} seleccionada${names.length === 1 ? "" : "s"}`;
  if (!names.length) { selectionList.textContent = "Todavía no has seleccionado fotografías."; return; }
  selectionList.innerHTML = names.map(name => {
    const note = instructions.get(name);
    return `<div class="selection-row"><strong>${escapeHtml(name)}</strong>${note ? `<span>Instrucción: ${escapeHtml(note)}</span>` : ""}</div>`;
  }).join("");
}

function openViewer(index) {
  viewerIndex = Math.max(0, Math.min(index, photos.length - 1));
  zoom = 1; offsetX = 0; offsetY = 0;
  updateViewer();
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}
function closeViewer() {
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
}
function updateViewer() {
  const p = photos[viewerIndex];
  largePhoto.src = imageUrl(p.id, 2200);
  largePhoto.alt = p.name;
  largeName.textContent = p.name;
  largePosition.textContent = `${viewerIndex + 1} / ${photos.length}`;
  photoInstruction.value = instructions.get(p.name) || "";
  applyZoom();
  updateViewerButton();
}
function updateViewerButton() {
  const name = photos[viewerIndex].name;
  const isSelected = selected.has(name);
  selectLarge.textContent = isSelected ? "✓ Seleccionada" : "Seleccionar foto";
  selectLarge.classList.toggle("is-selected", isSelected);
}
function applyZoom() {
  largePhoto.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  largePhoto.style.cursor = zoom > 1 ? (drag ? "grabbing" : "grab") : "default";
}
function changeZoom(amount) {
  zoom = Math.max(1, Math.min(4, zoom + amount));
  if (zoom === 1) { offsetX = 0; offsetY = 0; }
  applyZoom();
}

function buildSelectionText(names) {
  return `JORGE ARREOLA FOTOGRAFÍA\nGALERÍA: ${GALLERY_CONFIG.clientName.toUpperCase()}\n\n` +
    names.map(name => `${name}${instructions.get(name) ? `\nINSTRUCCIÓN: ${instructions.get(name)}` : ""}`).join("\n\n") + "\n";
}
function downloadBlob(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], {type:type || "application/octet-stream"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function loadPhotosViaJsonp() {
  if (!GALLERY_CONFIG.appsScriptUrl || GALLERY_CONFIG.appsScriptUrl.includes("PEGA_AQUI")) {
    statusEl.textContent = "Falta configurar la URL de Google Apps Script.";
    statusEl.classList.add("error");
    return;
  }

  const callbackName = `__driveGalleryCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const script = document.createElement("script");
  let finished = false;

  const cleanup = () => {
    try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    script.remove();
  };

  const finishError = (message) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    cleanup();
    statusEl.textContent = message;
    statusEl.classList.add("error");
  };

  const timeout = setTimeout(() => {
    const localFileHint = location.protocol === "file:"
      ? " Estás abriendo index.html directamente como archivo local (file://). Prueba con INICIAR_GALERIA.bat o publícalo en GitHub Pages."
      : "";
    finishError("No se recibió respuesta de Google Drive en 30 segundos." + localFileHint);
  }, 30000);

  window[callbackName] = data => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    cleanup();

    if (!data || data.error) {
      statusEl.textContent = `Error de Drive: ${data?.error || "respuesta inválida"}`;
      statusEl.classList.add("error");
      return;
    }

    photos = (data.files || []).filter(f => /^image\/(jpeg|jpg|png|webp)$/i.test(f.mimeType || ""));
    photos.sort(numericNameCompare);

    if (!photos.length) {
      statusEl.textContent = "La carpeta no contiene imágenes compatibles.";
      statusEl.classList.add("error");
      return;
    }

    statusEl.textContent = `${photos.length} fotografías cargadas desde Google Drive.`;
    document.getElementById("downloadGalleryBtn").title = "Abre la carpeta de Drive para descargar toda la galería";
    loadSavedSelection();
    render();
  };

  script.async = true;
  script.type = "text/javascript";
  script.src = `${GALLERY_CONFIG.appsScriptUrl}?folderId=${encodeURIComponent(GALLERY_CONFIG.folderId)}&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
  script.onerror = () => finishError(
    location.protocol === "file:"
      ? "Chrome no pudo ejecutar la respuesta de Google Apps Script desde file://. Usa INICIAR_GALERIA.bat o GitHub Pages."
      : "No se pudo conectar con Google Apps Script."
  );

  document.head.appendChild(script);
}

document.getElementById("closeLightbox").onclick = closeViewer;
document.getElementById("lightPrev").onclick = () => { viewerIndex = (viewerIndex - 1 + photos.length) % photos.length; zoom=1; offsetX=0; offsetY=0; updateViewer(); };
document.getElementById("lightNext").onclick = () => { viewerIndex = (viewerIndex + 1) % photos.length; zoom=1; offsetX=0; offsetY=0; updateViewer(); };
selectLarge.onclick = () => toggle(photos[viewerIndex].name);
document.getElementById("downloadPhoto").onclick = () => window.open(downloadUrl(photos[viewerIndex].id), "_blank", "noopener");

document.getElementById("saveInstruction").onclick = () => {
  const name = photos[viewerIndex].name;
  const value = photoInstruction.value.trim();
  if (value) instructions.set(name, value); else instructions.delete(name);
  if (!selected.has(name)) selected.add(name);
  saveSelection(); render(); updateViewerButton(); photoInstruction.value = instructions.get(name) || "";
  alert(value ? "Instrucción guardada y fotografía seleccionada." : "Instrucción eliminada. La fotografía quedó seleccionada.");
};
document.getElementById("zoomIn").onclick = () => changeZoom(.5);
document.getElementById("zoomOut").onclick = () => changeZoom(-.5);
document.getElementById("zoomReset").onclick = () => { zoom=1; offsetX=0; offsetY=0; applyZoom(); };
photoStage.addEventListener("wheel", e => { e.preventDefault(); changeZoom(e.deltaY < 0 ? .25 : -.25); }, {passive:false});
largePhoto.addEventListener("pointerdown", e => { if (zoom<=1) return; drag=true; startX=e.clientX-offsetX; startY=e.clientY-offsetY; largePhoto.setPointerCapture(e.pointerId); applyZoom(); });
largePhoto.addEventListener("pointermove", e => { if (!drag) return; offsetX=e.clientX-startX; offsetY=e.clientY-startY; applyZoom(); });
largePhoto.addEventListener("pointerup", () => { drag=false; applyZoom(); });
largePhoto.addEventListener("pointercancel", () => { drag=false; applyZoom(); });

document.addEventListener("keydown", e => {
  if (!lightbox.classList.contains("open")) return;
  if (e.key === "Escape") closeViewer();
  if (e.key === "ArrowLeft") document.getElementById("lightPrev").click();
  if (e.key === "ArrowRight") document.getElementById("lightNext").click();
  if (e.key === "+" || e.key === "=") changeZoom(.5);
  if (e.key === "-") changeZoom(-.5);
});

document.getElementById("prevBtn").onclick = () => { currentPage--; render(); window.scrollTo({top:250, behavior:"smooth"}); };
document.getElementById("nextBtn").onclick = () => { currentPage++; render(); window.scrollTo({top:250, behavior:"smooth"}); };
document.getElementById("clearBtn").onclick = () => { selected.clear(); instructions.clear(); saveSelection(); render(); };
document.getElementById("copyBtn").onclick = async () => {
  const names=[...selected].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  if (!names.length) return alert("No hay fotografías seleccionadas.");
  try { await navigator.clipboard.writeText(buildSelectionText(names)); alert("Lista copiada al portapapeles."); }
  catch { alert("No se pudo copiar automáticamente. Usa el botón Descargar selección TXT."); }
};
document.getElementById("downloadBtn").onclick = () => {
  const names=[...selected].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  if (!names.length) return alert("No hay fotografías seleccionadas.");
  downloadBlob(buildSelectionText(names), `seleccion-${GALLERY_CONFIG.clientName.toLowerCase()}.txt`, "text/plain;charset=utf-8");
};
document.getElementById("downloadGalleryBtn").onclick = () => {
  window.open(folderUrl(), "_blank", "noopener");
};

document.getElementById("clientNameTop").textContent = GALLERY_CONFIG.clientName;
document.getElementById("galleryTitle").textContent = GALLERY_CONFIG.galleryTitle;
loadPhotosViaJsonp();
