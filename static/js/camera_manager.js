import { generateInsights } from './ui.js';
import { initializePose, onResultsPose } from './pose_analysis.js';

let camera = null;
let pose = null;
let analysisInterval = null;
let isCameraRunning = false;
let manualFrameInterval = null; // For fallback method

// Safely get DOM element
function getElement(selector) {
  try {
    return document.querySelector(selector);
  } catch (error) {
    console.warn(`Error getting element ${selector}:`, error);
    return null;
  }
}

// Start camera function
export async function startCamera() {
  try {
    if (isCameraRunning) {
      console.log('Camera is already running');
      return;
    }

    console.log('Starting camera...');
    
    // Initialize pose if not already done
    if (!pose) {
      pose = initializePose();
      if (!pose) {
        throw new Error('Failed to initialize MediaPipe Pose');
      }
    }
    
    const videoElement = getElement('.input_video');
    if (!videoElement) {
      throw new Error('Video element not found');
    }
    
    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 }, 
        height: { ideal: 480 },
        facingMode: 'user'
      } 
    });
    
    videoElement.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve();
      };
    });
    
    // Set up camera utils with proper error handling
    if (window.Camera) {
      camera = new window.Camera(videoElement, {
        onFrame: async () => {
          try {
            // Only send frame if pose is initialized and camera is running
            if (pose && isCameraRunning && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
              await pose.send({ image: videoElement });
            }
          } catch (error) {
            console.error('Error processing frame:', error);
          }
        },
        width: 640,
        height: 480
      });
      
      await camera.start();
      console.log('Camera started with MediaPipe Camera utils');
    } else {
      console.warn('Camera utils not available, using fallback method');
      // Fallback: manually process frames
      startManualFrameProcessing(videoElement);
    }
    
    isCameraRunning = true;
    
    // Start periodic analysis
    analysisInterval = setInterval(() => {
      try {
        generateInsights();
      } catch (error) {
        console.error('Error generating insights:', error);
      }
    }, 3000);
    
    console.log('Camera started successfully');
    
  } catch (error) {
    console.error("Error starting camera: ", error);
    isCameraRunning = false;
    
    // Show user-friendly error message
    const errorOverlay = document.getElementById('camera-error');
    if (errorOverlay) {
      errorOverlay.style.display = 'block';
      errorOverlay.innerHTML = `Cannot access camera: ${error.message}`;
    }
    
    throw error;
  }
}

// Fallback frame processing when Camera utils not available
function startManualFrameProcessing(videoElement) {
  // Clear any existing interval
  if (manualFrameInterval) {
    clearInterval(manualFrameInterval);
  }
  
  let processing = false;
  
  const processFrame = async () => {
    if (!isCameraRunning || processing) return;
    
    processing = true;
    try {
      if (pose && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        await pose.send({ image: videoElement });
      }
    } catch (error) {
      console.error('Error in manual frame processing:', error);
    }
    processing = false;
  };
  
  // Process frames at ~30fps
  manualFrameInterval = setInterval(processFrame, 33);
}

// Stop manual frame processing
function stopManualFrameProcessing() {
  if (manualFrameInterval) {
    clearInterval(manualFrameInterval);
    manualFrameInterval = null;
  }
}

// Stop camera function
export function stopCamera() {
  try {
    if (!isCameraRunning) {
      console.log('Camera is not running');
      return;
    }
    
    console.log('Stopping camera...');
    
    isCameraRunning = false;
    
    const videoElement = getElement('.input_video');
    
    // Stop the camera stream
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach(track => {
        track.stop();
      });
      videoElement.srcObject = null;
    }
    
    // Stop camera utils if available and properly initialized
    if (camera && typeof camera.stop === 'function') {
      camera.stop();
      console.log('MediaPipe Camera utils stopped');
    }
    
    // Stop manual frame processing
    stopManualFrameProcessing();
    
    // Clear analysis interval
    if (analysisInterval) {
      clearInterval(analysisInterval);
      analysisInterval = null;
    }
    
    // Reset camera variable
    camera = null;
    
    console.log('Camera stopped successfully');
    
  } catch (error) {
    console.error('Error stopping camera:', error);
  }
}

// Reset data function
export function resetData() {
  try {
    console.log('Resetting camera data...');
    
    stopCamera();
    
    // Reset pose instance
    pose = null;
    
    // Reset dashboard-specific elements if they exist
    const elementsToReset = {
      'smoothness-score': '0%',
      'posture-analysis': 'Start analysis to see results...',
      'movement-analysis': 'Start analysis to see results...',
      'recommendations': 'Start analysis to see recommendations...'
    };
    
    Object.entries(elementsToReset).forEach(([id, text]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    });
    
    // Clear landmark table
    const landmarkData = document.getElementById('landmark-data');
    if (landmarkData) landmarkData.innerHTML = '';
    
    console.log('Camera data reset successfully');
    
  } catch (error) {
    console.error('Error in camera reset:', error);
  }
}

// Get camera running state
export function isCameraActive() {
  return isCameraRunning;
}

export {
  pose,
  camera
};