import { generateInsights } from './ui.js';
import { initializePose, onResultsPose } from './pose_analysis.js';

let camera = null;
let pose = null;
let analysisInterval = null;
let preciseTimerInterval = null; // New: For precise time checking
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

// Update button states (Start/Stop Analysis buttons) - Fixed with flexible selectors and debug
function updateButtonStates(running) {
  // Use classes for flexibility (change to IDs if needed, e.g., '#start-analysis-btn')
  const startBtn = getElement('.start-analysis-btn');
  const stopBtn = getElement('.stop-analysis-btn');

  if (!startBtn || !stopBtn) {
    // Debug: Log all potential button elements to help identify correct selectors
    const allButtons = document.querySelectorAll('button');
    const buttonTexts = Array.from(allButtons).map(btn => `${btn.id || btn.className || 'no-id'}: "${btn.textContent.trim()}"`).join(', ');
    console.warn('Start/Stop buttons not found - skipping state update. Found buttons:', buttonTexts || 'None');
    console.warn('Suggestion: Add classes "start-analysis-btn" and "stop-analysis-btn" to your HTML buttons, or update selectors in updateButtonStates().');
    return;
  }

  if (running) {
    // Starting: Disable start, enable stop, add active class to stop
    startBtn.disabled = true;
    startBtn.classList.remove('active');
    stopBtn.disabled = false;
    stopBtn.classList.add('active');
    console.log('Button states updated: Start disabled, Stop enabled');
  } else {
    // Stopping: Enable start, disable stop, remove active classes
    startBtn.disabled = false;
    startBtn.classList.add('active'); // Optional: Highlight start as ready
    stopBtn.disabled = true;
    stopBtn.classList.remove('active');
    console.log('Button states updated: Start enabled, Stop disabled');
  }
}

// Start precise timer interval for accurate duration checking
function startPreciseTimerCheck(duration) {
  if (preciseTimerInterval) {
    clearInterval(preciseTimerInterval);
  }

  console.log(`Starting precise timer check every 500ms for ${duration}s duration`);
  preciseTimerInterval = setInterval(() => {
    if (!isCameraRunning || !window.analysisStartTime) return;

    const elapsed = (Date.now() - window.analysisStartTime) / 1000;
    console.log(`Precise timer check: ${elapsed.toFixed(2)}s elapsed`);
    
    if (elapsed >= duration) {
      console.log(`Precise timer: ${elapsed.toFixed(2)}s >= ${duration}s - stopping camera`);
      stopCameraAnalysis();
      clearInterval(preciseTimerInterval);
      preciseTimerInterval = null;
    }
  }, 500); // Check every 500ms for precision within 0.5s
}

// Stop precise timer interval
function stopPreciseTimerCheck() {
  if (preciseTimerInterval) {
    clearInterval(preciseTimerInterval);
    preciseTimerInterval = null;
    console.log('Precise timer interval stopped');
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
    
    // Update button states on start
    updateButtonStates(true);
    
    // Set global start time immediately for sync (before camera init)
    if (window.timeReportManager && typeof window.timeReportManager.startAnalysisTimerWithDuration === 'function') {
      window.timeReportManager.startAnalysisTimerWithDuration(); // This sets window.analysisStartTime
    } else {
      // Fallback: Set start time manually
      window.analysisStartTime = Date.now();
      console.warn('timeReportManager not available - setting manual start time');
    }
    
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

    // START ANALYSIS TIMER WITH SELECTED DURATION
    let duration = 30; // Default
    if (window.timeReportManager && typeof window.timeReportManager.getAnalysisDuration === 'function') {
      duration = window.timeReportManager.getAnalysisDuration();
      console.log(`Starting analysis timer for ${duration} seconds`);
    } else {
      console.warn('timeReportManager not available - using default 30s timer');
    }

    // Start precise timer check for accurate stopping
    startPreciseTimerCheck(duration);
    
    // Start periodic analysis (reduced to 1s, with integrated time check as backup)
    analysisInterval = setInterval(() => {
      try {
        generateInsights();
        // Backup time check (now every 1s)
        if (window.analysisStartTime) {
          const elapsed = (Date.now() - window.analysisStartTime) / 1000;
          if (elapsed >= duration && isCameraActive()) {
            console.log(`Backup timer check: ${elapsed}s >= ${duration}s - stopping`);
            stopCameraAnalysis();
          }
        }
      } catch (error) {
        console.error('Error generating insights:', error);
      }
    }, 1000); // Reduced from 3000ms to 1000ms for better precision
    
    console.log('Camera started successfully');
    
  } catch (error) {
    console.error("Error starting camera: ", error);
    isCameraRunning = false;
    // Revert button states on error
    updateButtonStates(false);
    // Stop precise timer on error
    stopPreciseTimerCheck();
    
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

    // Update button states on stop
    updateButtonStates(false);

    // Stop precise timer check
    stopPreciseTimerCheck();

    // STOP ANALYSIS TIMER - Use global function
    if (window.timeReportManager && typeof window.timeReportManager.stopAnalysisTimer === 'function') {
      window.timeReportManager.stopAnalysisTimer();
    }
    
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
    
    // Stop precise timer on reset
    stopPreciseTimerCheck();
    
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
    
    // Hide report button on reset
    if (window.timeReportManager && typeof window.timeReportManager.hideReportButton === 'function') {
      window.timeReportManager.hideReportButton();
    }
    
    console.log('Camera data reset successfully');
    
  } catch (error) {
    console.error('Error in camera reset:', error);
  }
}

// Get camera running state
export function isCameraActive() {
  return isCameraRunning;
}

// Function to stop camera analysis (called automatically when duration completes)
export function stopCameraAnalysis() {
  console.log('Automatically stopping camera analysis due to duration completion');
  
  // Log final elapsed time for debugging
  if (window.analysisStartTime) {
    const finalElapsed = (Date.now() - window.analysisStartTime) / 1000;
    console.log(`Final elapsed time on stop: ${finalElapsed.toFixed(2)}s`);
  }
  
  // Ensure data availability flag is set (for report button)
  if (window.timeReportManager) {
    window.timeReportManager.isAnalysisDataAvailable = true; // Force true if data collected
    // Show/ensure report button visibility after auto-stop
    if (typeof window.timeReportManager.showReportButton === 'function') {
      window.timeReportManager.showReportButton();
    }
  }
  
  // Check if pose data was collected (e.g., history length > 0)
  if (window.poseHistory && window.poseHistory.length > 0) {
    console.log(`Analysis data collected: ${window.poseHistory.length} frames`);
  }
  
  // Get complete analysis data before stopping (fixed to use correct method)
  let analysisData = {};
  if (window.timeReportManager && typeof window.timeReportManager.collectReportData === 'function') {
    try {
      analysisData = window.timeReportManager.collectReportData();
    } catch (error) {
      console.warn('Error collecting report data:', error);
    }
  } else {
    console.warn('timeReportManager.collectReportData not available');
  }
  
  console.log('Complete Analysis Data:', JSON.stringify(analysisData, null, 2));
  
  stopCamera(); // This will update button states and stop timers
  
  // Show completion message
  const completionMessage = document.getElementById('analysis-completion-message');
  if (completionMessage) {
    const duration = window.timeReportManager ? window.timeReportManager.getAnalysisDuration() : 5;
    completionMessage.style.display = 'block';
    completionMessage.textContent = `Analysis completed successfully (${duration} seconds). Data logged to console. Generate report below.`;
    
    // Hide message after 5 seconds
    setTimeout(() => {
      completionMessage.style.display = 'none';
    }, 5000);
  }
  
  // DO NOT hide report button here - keep it visible for user to generate report
  // (Only hide on explicit reset)
}

// Make camera state available globally
window.isCameraActive = isCameraActive;
window.stopCameraAnalysis = stopCameraAnalysis;

export {
  pose,
  camera,
  updateButtonStates // Export for use in ui.js if needed
};