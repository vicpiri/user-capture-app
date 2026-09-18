// Ver > Visor en ventana aparte: shows whatever the main window's viewer shows.
// The URL arrives already built by the main window, with the version of a
// turned photo, so this page only has to load it.

const mirrorImage = document.getElementById('mirror-image');
const mirrorEmpty = document.getElementById('mirror-empty');

function showImage(image) {
  if (image && image.url) {
    if (mirrorImage.getAttribute('src') !== image.url) {
      mirrorImage.src = image.url;
    }
    mirrorImage.hidden = false;
    mirrorEmpty.hidden = true;
  } else {
    mirrorImage.removeAttribute('src');
    mirrorImage.hidden = true;
    mirrorEmpty.hidden = false;
  }
}

// A photo deleted from imports while on show
mirrorImage.addEventListener('error', () => showImage(null));

window.electronAPI.onViewerMirrorImage(showImage);
window.electronAPI.getViewerMirrorImage().then(showImage);

document.addEventListener('dblclick', () => window.electronAPI.setViewerMirrorFullScreen('toggle'));

document.addEventListener('keydown', (event) => {
  if (event.key === 'F11') {
    event.preventDefault();
    window.electronAPI.setViewerMirrorFullScreen('toggle');
  } else if (event.key === 'Escape') {
    window.electronAPI.setViewerMirrorFullScreen(false);
  }
});
