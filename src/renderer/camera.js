// Camera state
let cameraStream = null;

// DOM Elements
const cameraPreview = document.getElementById('camera-preview');
const captureBtn = document.getElementById('capture-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeCamera();
  captureBtn.addEventListener('click', handleCapture);
});

// Camera initialization
async function initializeCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.style.display = 'block';
  } catch (error) {
    console.error('Error accessing camera:', error);
    showCameraPlaceholder();
  }
}

function showCameraPlaceholder(message = 'No se pudo acceder a la cámara') {
  cameraPreview.style.display = 'none';

  const placeholder = document.createElement('div');
  placeholder.className = 'camera-placeholder';
  placeholder.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <p>${message}</p>
  `;
  document.querySelector('.camera-container').appendChild(placeholder);
}

// Capture image
async function handleCapture() {
  if (!cameraStream) {
    alert('La cámara no está disponible');
    return;
  }

  const canvas = document.getElementById('capture-canvas');
  const context = canvas.getContext('2d');

  // Set canvas size to match video
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;

  // Draw current video frame to canvas
  context.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);

  // Convert to JPEG blob
  const imageData = canvas.toDataURL('image/jpeg', 0.9);

  // Save image
  const result = await window.electronAPI.saveCapturedImage(imageData);

  if (result.success) {
    // Show visual feedback
    cameraPreview.style.filter = 'brightness(1.5)';
    setTimeout(() => {
      cameraPreview.style.filter = 'brightness(1)';
    }, 100);
  } else {
    alert('Error al capturar la imagen: ' + result.error);
  }
}

// Stop camera when window closes
window.addEventListener('beforeunload', () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
});
