// Camera state
let cameraStream = null;
let currentCameraId = null;
let rotationDegrees = 0;

// DOM Elements
const cameraPreview = document.getElementById('camera-preview');
const captureBtn = document.getElementById('capture-btn');
const rotateBtn = document.getElementById('rotate-btn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await detectAvailableCameras();
  await initializeCamera();
  captureBtn.addEventListener('click', handleCapture);
  rotateBtn.addEventListener('click', handleRotate);

  // Listen for camera changes from menu
  window.electronAPI.onChangeCamera(async (cameraId) => {
    await switchCamera(cameraId);
  });
});

// Detect available cameras
async function detectAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Cámara ${device.deviceId.substring(0, 8)}`
      }));

    // Send available cameras to main process
    const result = await window.electronAPI.updateAvailableCameras(cameras);
    if (result.success && result.selectedCameraId) {
      currentCameraId = result.selectedCameraId;
    } else if (cameras.length > 0) {
      currentCameraId = cameras[0].deviceId;
    }
  } catch (error) {
    console.error('Error detecting cameras:', error);
  }
}

// Camera initialization
async function initializeCamera(cameraId = null) {
  try {
    // Use provided cameraId or currentCameraId
    const deviceId = cameraId || currentCameraId;

    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    // If a specific camera is selected, use it
    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    }

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraPreview.srcObject = cameraStream;
    cameraPreview.style.display = 'block';
  } catch (error) {
    console.error('Error accessing camera:', error);
    showCameraPlaceholder();
  }
}

// Switch camera
async function switchCamera(cameraId) {
  // Stop current stream
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  // Start new camera
  currentCameraId = cameraId;
  await initializeCamera(cameraId);
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

// Rotate camera
function handleRotate() {
  rotationDegrees = (rotationDegrees + 90) % 360;
  cameraPreview.style.transform = `rotate(${rotationDegrees}deg)`;
}

// Capture image
async function handleCapture() {
  if (!cameraStream) {
    alert('La cámara no está disponible');
    return;
  }

  const canvas = document.getElementById('capture-canvas');
  const context = canvas.getContext('2d');

  const videoWidth = cameraPreview.videoWidth;
  const videoHeight = cameraPreview.videoHeight;

  // Adjust canvas size based on rotation
  if (rotationDegrees === 90 || rotationDegrees === 270) {
    canvas.width = videoHeight;
    canvas.height = videoWidth;
  } else {
    canvas.width = videoWidth;
    canvas.height = videoHeight;
  }

  // Save context state
  context.save();

  // Apply rotation transformation
  if (rotationDegrees === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotationDegrees === 180) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  } else if (rotationDegrees === 270) {
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
  }

  // Draw current video frame to canvas with rotation
  context.drawImage(cameraPreview, 0, 0, videoWidth, videoHeight);

  // Restore context state
  context.restore();

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
