import { generateInsights } from './ui.js';
import { initializePose, onResultsPose } from './pose_analysis.js';

let camera = null;
let pose = null;
let analysisInterval = null;

// Start camera function
function startCamera() {
  // Initialize pose if not already done
  if (!pose) {
    pose = initializePose();
  }
  
  const videoElement = document.querySelector('.input_video');
  
  // Get user media
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      videoElement.srcObject = stream;
      
      // Set up camera utils
      camera = new window.Camera(videoElement, {
        onFrame: async () => {
          await pose.send({image: videoElement});
        },
        width: 640,
        height: 480
      });
      
      camera.start();
      
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
  const videoElement = document.querySelector('.input_video');
  
  // Stop the camera stream
  if (videoElement && videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
  }
  
  // Clear analysis interval
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }
}

// Reset data function - only handles camera-specific reset
function resetData() {
  try {
    stopCamera();
    // Reset dashboard-specific elements if they exist
    const smoothnessScore = document.getElementById('smoothness-score');
    const postureAnalysis = document.getElementById('posture-analysis');
    const movementAnalysis = document.getElementById('movement-analysis');
    const recommendations = document.getElementById('recommendations');
    const landmarkData = document.getElementById('landmark-data');
    
    if (smoothnessScore) smoothnessScore.textContent = '0%';
    if (postureAnalysis) postureAnalysis.textContent = 'Start analysis to see results...';
    if (movementAnalysis) movementAnalysis.textContent = 'Start analysis to see results...';
    if (recommendations) recommendations.textContent = 'Start analysis to see recommendations...';
    if (landmarkData) landmarkData.innerHTML = '';
    
    console.log('Camera data reset successfully');
  } catch (error) {
    console.warn('Error in camera reset:', error.message);
  }
}

export {
  startCamera,
  stopCamera,
  resetData
};