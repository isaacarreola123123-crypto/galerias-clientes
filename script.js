function renderGalleryList(galleries) {

  galleryList.innerHTML = "";

  galleries.forEach(galleryData => {

    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "gallery-choice";

    button.dataset.galleryClient =
      galleryData.clientName || "";

    button.dataset.galleryFolder =
      galleryData.folderId || "";

    button.innerHTML = `
      <span class="gallery-choice-name">
        ${escapeHtml(galleryData.clientName)}
      </span>

      <span class="gallery-choice-title">
        ${escapeHtml(
          galleryData.galleryTitle ||
          \`Galería de ${galleryData.clientName}\`
        )}
      </span>

      <span class="gallery-choice-arrow">
        →
      </span>
    `;

    galleryList.appendChild(button);

  });

}


/*
 * Delegación de clics para las galerías.
 */
galleryList.addEventListener("click", event => {

  const button =
    event.target.closest(".gallery-choice");

  if (!button || !galleryList.contains(button)) {
    return;
  }

  const clientName =
    button.dataset.galleryClient;

  const folderId =
    button.dataset.galleryFolder;

  const galleryData = {
    clientName: clientName,

    galleryTitle:
      button
        .querySelector(".gallery-choice-title")
        ?.textContent
        .trim() ||
      `Galería de ${clientName}`,

    folderId: folderId
  };

  if (!folderId) {

    statusEl.textContent =
      "Esta galería no tiene una carpeta configurada.";

    statusEl.classList.add("error");

    return;
  }

  selectGallery(galleryData);

});
