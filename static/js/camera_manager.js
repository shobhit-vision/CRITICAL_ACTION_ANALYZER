import { generateInsights } from './ui.js';
import { initializePose, onResultsPose } from './pose_analysis.js';

let camera = null;
let pose = null;
let isCameraRunning = false; // Declare locally instead of importing
let analysisInterval = null;

// Start camera function
function startCamera() {
  if (isCameraRunning) return;
  
  // Initialize pose if not already done
  if (!pose) {
    pose = initializePose();
  }
  
  const videoElement = document.querySelector('.input_video');
  
  // Get user media
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoElement.srcObject = stream;
      isCameraRunning = true;
      
      // Set up camera utils
      camera = new window.Camera(videoElement, {
        onFrame: async () => {
          await pose.send({image: videoElement});
        },
        width: 640,
        height: 480
      });
      
      camera.start();
      document.getElementById('start-camera').disabled = true;
      document.getElementById('stop-camera').disabled = false;
      
      // Start periodic analysis
      analysisInterval = setInterval(generateInsights, 3000);
    })
    .catch(err => {
      console.error("Error accessing camera: ", err);
      alert("Cannot access camera: " + err.message);
    });
}

// Stop camera function
function stopCamera() {
  if (!isCameraRunning) return;
  
  const videoElement = document.querySelector('.input_video');
  
  // Stop the camera stream
  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
  }
  
  isCameraRunning = false;
  document.getElementById('start-camera').disabled = false;
  document.getElementById('stop-camera').disabled = true;
  
  // Clear analysis interval
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }
}

// Reset data function
function resetData() {
  const poseHistory = [];
  
  // Reset charts
  const charts = {};
  Object.values(charts).forEach(chart => {
    chart.data.datasets.forEach(dataset => {
      dataset.data = [];
    });
    chart.update();
  });
  
  // Reset metrics
  document.getElementById('posture-score').textContent = '0%';
  document.getElementById('balance-score').textContent = '0%';
  document.getElementById('symmetry-score').textContent = '0%';
  document.getElementById('smoothness-score').textContent = '0%';
  
  // Reset analysis text
  document.getElementById('posture-analysis').textContent = 'Start analysis to see results...';
  document.getElementById('movement-analysis').textContent = 'Start analysis to see results...';
  document.getElementById('recommendations').textContent = 'Start analysis to see recommendations...';
  
  // Clear landmark table
  document.getElementById('landmark-data').innerHTML = '';
}

export {
  startCamera,
  stopCamera,
  resetData
};