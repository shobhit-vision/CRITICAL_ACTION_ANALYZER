import { startCamera, stopCamera, resetData, isCameraActive } from './camera_manager.js';
import { 
  startAnalysisTimer, 
  stopAnalysisTimer,
  toggleCameraOverlay,
  poseHistory,
  charts
} from './ui.js';

// Global variables for button states
let analysisTimer = null;

// Safely get DOM element
function getElement(id) {
  try {
    return document.getElementById(id);
  } catch (error) {
    console.warn(`Error getting element ${id}:`, error);
    return null;
  }
}

// Update button states
function updateButtonStates() {
  const isRunning = isCameraActive();
  const stopButton = getElement('stop-camera');
  const startButton = getElement('start-camera');
  const captureButton = getElement('capture-frame');

  if (stopButton) {
    stopButton.disabled = !isRunning;
    stopButton.style.opacity = isRunning ? '1' : '0.5';
  }

  if (startButton) {
    startButton.disabled = isRunning;
    startButton.style.opacity = isRunning ? '0.5' : '1';
  }

  if (captureButton) {
    captureButton.disabled = !isRunning;
    captureButton.style.opacity = isRunning ? '1' : '0.5';
  }
}

// Reset metrics display
function resetMetricsDisplay() {
  try {
    // Reset score displays
    const scoreElements = {
      'posture-score': '0%',
      'balance-score': '0%', 
      'symmetry-score': '0%',
      'motion-score': '0%',
      'smoothness-score': '0%'
    };

    Object.entries(scoreElements).forEach(([id, value]) => {
      const element = getElement(id);
      if (element) element.textContent = value;
    });

    // Reset progress bars
    const progressBars = [
      'posture-progress',
      'balance-progress', 
      'symmetry-progress',
      'motion-progress',
      'smoothness-progress'
    ];

    progressBars.forEach(id => {
      const element = getElement(id);
      if (element) element.style.width = '0%';
    });

    // Reset landmarks count
    const landmarksCount = getElement('landmarks-count');
    if (landmarksCount) landmarksCount.textContent = '0/0';

    // Reset confidence score
    const confidenceScore = getElement('confidence-score');
    if (confidenceScore) confidenceScore.textContent = '0%';

    // Reset landmark table
    const landmarkTable = getElement('landmark-data');
    if (landmarkTable) landmarkTable.innerHTML = '';

  } catch (error) {
    console.warn('Error resetting metrics display:', error);
  }
}

// Reset charts function
function resetCharts() {
  try {
    // Check if charts object exists and has chart instances
    if (charts && typeof charts === 'object') {
      Object.values(charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
          chart.destroy();
        }
      });
      
      // Clear charts object
      Object.keys(charts).forEach(key => {
        delete charts[key];
      });
    }

    // Reinitialize charts if on dashboard page
    const angleChart = getElement('angle-chart');
    if (angleChart) {
      import('./chart_manager.js').then(module => {
        if (module.initializeCharts) {
          module.initializeCharts();
        }
      });
    }

  } catch (error) {
    console.warn('Error resetting charts:', error);
  }
}

// Handle start button click
async function handleStart() {
  try {
    if (isCameraActive()) return;

    console.log('Starting camera...');
    
    // Show loading state
    updateButtonStates();
    
    // Hide camera overlay
    toggleCameraOverlay(false);
    
    // Start camera
    await startCamera();
    
    // Start analysis timer
    analysisTimer = startAnalysisTimer();
    
    // Update button states
    updateButtonStates();
    
    console.log('Camera started successfully');

  } catch (error) {
    console.error('Error starting camera:', error);
    toggleCameraOverlay(true);
    updateButtonStates();
  }
}

// Handle stop button click
function handleStop() {
  try {
    if (!isCameraActive()) return;

    console.log('Stopping camera...');
    
    // Stop camera
    stopCamera();
    
    // Stop analysis timer
    stopAnalysisTimer();
    analysisTimer = null;
    
    // Show camera overlay
    toggleCameraOverlay(true);
    
    // Update button states
    updateButtonStates();
    
    console.log('Camera stopped successfully');

  } catch (error) {
    console.error('Error stopping camera:', error);
  }
}

// Handle reset button click
function handleReset() {
  try {
    console.log('Resetting data...');
    
    // Stop camera if running
    if (isCameraActive()) {
      handleStop();
    }
    
    // Clear pose history
    if (poseHistory && Array.isArray(poseHistory)) {
      poseHistory.length = 0;
    }
    
    // Reset data in camera manager
    resetData();
    
    // Reset UI displays
    resetMetricsDisplay();
    resetCharts();
    
    console.log('Data reset successfully');

  } catch (error) {
    console.error('Error resetting data:', error);
  }
}

// Handle capture frame (placeholder for future functionality)
function handleCapture() {
  if (!isCameraActive()) return;
  
  try {
    console.log('Capture frame functionality to be implemented');
    
  } catch (error) {
    console.error('Error capturing frame:', error);
  }
}

// Initialize all button functionality
function initializeButtons() {
  try {
    // Get button references
    const buttons = {
      'start-camera': handleStart,
      'stop-camera': handleStop,
      'reset-data': handleReset,
      'capture-frame': handleCapture,
      'overlay-start-btn': () => getElement('start-camera')?.click(),
      'hero-analysis-btn': handleHeroAnalysis
    };

    // Set up event listeners for existing buttons
    Object.entries(buttons).forEach(([id, handler]) => {
      const button = getElement(id);
      if (button) {
        button.addEventListener('click', handler);
        console.log(`Button ${id} initialized`);
      }
    });

    // Set initial button states
    updateButtonStates();

    console.log('All buttons initialized successfully');

  } catch (error) {
    console.error('Error initializing buttons:', error);
  }
}

// Handle hero analysis button click
function handleHeroAnalysis() {
  try {
    const analysisSection = getElement('analysis');
    if (analysisSection) {
      analysisSection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        handleStart();
      }, 1000);
    } else {
      handleStart();
    }
  } catch (error) {
    console.error('Error handling hero analysis:', error);
  }
}

// Handle page visibility change
function handleVisibilityChange() {
  if (document.hidden && isCameraActive()) {
    console.log('Page hidden, stopping camera to save resources');
    handleStop();
  }
}

// Initialize visibility change handler
document.addEventListener('visibilitychange', handleVisibilityChange);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (isCameraActive()) {
    handleStop();
  }
});

// Get camera running state
function getCameraState() {
  return isCameraActive();
}

export {
  initializeButtons,
  handleStart,
  handleStop,
  handleReset,
  getCameraState,
  updateButtonStates
};