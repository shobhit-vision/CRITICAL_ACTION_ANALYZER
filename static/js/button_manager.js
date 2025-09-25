// button_manager.js
import { startCamera, stopCamera, resetData, isCameraActive, stopCameraAnalysis } from './camera_manager.js';
import { 
  startAnalysisTimer, 
  stopAnalysisTimer as stopUITimer,
  toggleCameraOverlay,
  poseHistory,
  charts,
  generateInsights
} from './ui.js';
import { resetPoseData, initializePoseFeatureAnalysis } from './pose_feature.js';

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
  const resetButton = getElement('reset-data');

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

  if (resetButton) {
    resetButton.disabled = false; // Reset is always available
    resetButton.style.opacity = '1';
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
      if (element && element.style) element.style.width = '0%';
    });

    // Reset landmarks count
    const landmarksCount = getElement('landmarks-count');
    if (landmarksCount) landmarksCount.textContent = '0/33';

    // Reset confidence score
    const confidenceScore = getElement('confidence-score');
    if (confidenceScore) confidenceScore.textContent = '0%';

    // Reset frame rate
    const frameRate = getElement('frame-rate');
    if (frameRate) frameRate.textContent = '0 FPS';

    // Reset landmark table
    const landmarkTable = getElement('landmark-data');
    if (landmarkTable) landmarkTable.innerHTML = '';

    // Reset insights displays
    const insightElements = [
      'posture-analysis',
      'movement-analysis',
      'recommendations'
    ];
    insightElements.forEach(id => {
      const element = getElement(id);
      if (element) {
        if (id === 'recommendations') {
          element.innerHTML = '<li>Start analysis to see recommendations...</li>';
        } else {
          element.textContent = 'Start analysis to see results...';
        }
      }
    });

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

    // Reinitialize charts if on dashboard page (angle-chart exists)
    const angleChartContainer = getElement('angle-chart');
    if (angleChartContainer) {
      import('./chart_manager.js').then(module => {
        if (module && module.initializeCharts) {
          module.initializeCharts();
        }
      }).catch(error => {
        console.warn('Error reinitializing charts:', error);
      });
    }

  } catch (error) {
    console.warn('Error resetting charts:', error);
  }
}

// Handle start button click
async function handleStart() {
  try {
    if (isCameraActive()) {
      console.log('Camera is already active');
      return;
    }

    console.log('Starting camera analysis...');
    
    // Initialize pose feature analysis before starting
    initializePoseFeatureAnalysis();
    
    // Show loading state on buttons
    const startButton = getElement('start-camera');
    if (startButton) {
      startButton.disabled = true;
      startButton.textContent = 'Starting...';
    }
    
    updateButtonStates();
    
    // Hide camera overlay
    toggleCameraOverlay(false);
    
    // Start camera and pose processing
    await startCamera();
    
    // Start UI analysis timer (fallback if timeReportManager not available)
    if (window.timeReportManager) {
      window.timeReportManager.startAnalysisTimerWithDuration();
    } else {
      startAnalysisTimer();
    }
    
    // Update button states after start
    setTimeout(() => {
      if (startButton) {
        startButton.textContent = 'Stop Analysis'; // Or original text
      }
      updateButtonStates();
    }, 500);
    
    console.log('Camera analysis started successfully');

  } catch (error) {
    console.error('Error starting camera analysis:', error);
    
    // Revert button state on error
    const startButton = getElement('start-camera');
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent = 'Start Analysis'; // Reset text
    }
    
    toggleCameraOverlay(true);
    updateButtonStates();
    
    // Show error overlay if available
    const errorOverlay = getElement('camera-error');
    if (errorOverlay) {
      errorOverlay.style.display = 'block';
      errorOverlay.textContent = `Failed to start: ${error.message}`;
      setTimeout(() => {
        errorOverlay.style.display = 'none';
      }, 5000);
    }
  }
}

// Handle stop button click
function handleStop() {
  try {
    if (!isCameraActive()) {
      console.log('Camera is not active');
      return;
    }

    console.log('Stopping camera analysis...');
    
    // Stop camera processing
    stopCamera();
    
    // Stop analysis timers
    if (window.timeReportManager) {
      window.timeReportManager.stopAnalysisTimer();
    }
    stopUITimer();
    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = null;
    }
    
    // Show camera overlay
    toggleCameraOverlay(true);
    
    // Update button states
    const stopButton = getElement('stop-camera');
    if (stopButton) {
      stopButton.textContent = 'Stop Analysis'; // Reset if changed
    }
    updateButtonStates();
    
    // Hide report button if shown
    if (window.timeReportManager) {
      window.timeReportManager.hideReportButton();
    }
    
    console.log('Camera analysis stopped successfully');

  } catch (error) {
    console.error('Error stopping camera analysis:', error);
    updateButtonStates();
  }
}

// Handle reset button click
function handleReset() {
  try {
    console.log('Resetting all analysis data...');
    
    // Stop camera if running
    if (isCameraActive()) {
      handleStop();
    }
    
    // Clear pose history from UI
    if (poseHistory && Array.isArray(poseHistory)) {
      poseHistory.length = 0;
    }
    
    // Reset pose feature data from pose_feature.js
    resetPoseData();
    
    // Reset camera manager data
    resetData();
    
    // Hide report button
    if (window.timeReportManager) {
      window.timeReportManager.hideReportButton();
    }
    
    // Reset UI displays and metrics
    resetMetricsDisplay();
    resetCharts();
    
    // Clear any ongoing insights generation
    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = null;
    }
    
    // Reset timer display
    const timerDisplay = getElement('analysis-timer');
    if (timerDisplay) {
      timerDisplay.textContent = '00:00';
    }
    
    console.log('All analysis data reset successfully');

  } catch (error) {
    console.error('Error resetting analysis data:', error);
  }
}

// Handle capture frame (placeholder for future functionality - e.g., save current frame data)
function handleCapture() {
  if (!isCameraActive()) {
    console.log('Cannot capture: Camera not active');
    return;
  }
  
  try {
    console.log('Capturing current frame data...');
    
    // Example: Get current analysis data and log/save it
    const currentAnalysis = generateInsights();
    if (currentAnalysis) {
      console.log('Captured Analysis:', currentAnalysis);
      
      // Optional: Show a success message or download data
      const captureMsg = getElement('capture-message'); // Assume an element exists
      if (captureMsg) {
        captureMsg.style.display = 'block';
        captureMsg.textContent = 'Frame captured and logged to console!';
        setTimeout(() => {
          captureMsg.style.display = 'none';
        }, 3000);
      }
    } else {
      console.log('No analysis data available for capture');
    }
    
  } catch (error) {
    console.error('Error capturing frame:', error);
  }
}

// Initialize all button functionality
export function initializeButtons() {
  try {
    // Initialize pose feature analysis on app start
    initializePoseFeatureAnalysis();
    
    // Critical buttons (always expected - log warnings if missing)
    const criticalButtons = {
      'start-camera': handleStart,
      'stop-camera': handleStop,
      'reset-data': handleReset,
      'capture-frame': handleCapture
    };

    // Optional buttons (e.g., overlays, hero buttons - no warnings if missing)
    const optionalButtons = {
      'overlay-start-btn': () => {
        const startBtn = getElement('start-camera');
        if (startBtn) startBtn.click();
      },
      'hero-analysis-btn': handleHeroAnalysis
    };

    // Initialize critical buttons
    Object.entries(criticalButtons).forEach(([id, handler]) => {
      const button = getElement(id);
      if (button) {
        // Remove existing listeners to avoid duplicates
        const newHandler = (e) => {
          e.preventDefault();
          handler();
        };
        button.removeEventListener('click', handler);
        button.addEventListener('click', newHandler);
        console.log(`Critical button ${id} initialized`);
      } else {
        console.warn(`Critical button element ${id} not found - this may break functionality`);
      }
    });

    // Initialize optional buttons (silently skip if not found)
    Object.entries(optionalButtons).forEach(([id, handler]) => {
      const button = getElement(id);
      if (button) {
        // Remove existing listeners to avoid duplicates
        const newHandler = (e) => {
          e.preventDefault();
          handler();
        };
        button.removeEventListener('click', handler);
        button.addEventListener('click', newHandler);
        console.log(`Optional button ${id} initialized`);
      }
      // No warning - these may not exist in all layouts
    });

    // Set initial button states
    updateButtonStates();

    // Optional: Start periodic insights generation if camera is active
    if (isCameraActive()) {
      analysisTimer = setInterval(() => {
        generateInsights();
      }, 3000);
    }

    console.log('All buttons initialized successfully');

  } catch (error) {
    console.error('Error initializing buttons:', error);
  }
}

// Handle hero analysis button click (scroll to analysis section and start)
function handleHeroAnalysis() {
  try {
    const analysisSection = getElement('analysis');
    if (analysisSection) {
      analysisSection.scrollIntoView({ behavior: 'smooth' });
      // Delay start to allow scroll to complete
      setTimeout(() => {
        handleStart();
      }, 800);
    } else {
      // If no section, just start
      handleStart();
    }
  } catch (error) {
    console.error('Error handling hero analysis button:', error);
    handleStart(); // Fallback to direct start
  }
}

// Handle page visibility change (pause/resume camera)
function handleVisibilityChange() {
  if (document.hidden && isCameraActive()) {
    console.log('Page hidden - pausing camera to save resources');
    handleStop();
  } else if (!document.hidden && !isCameraActive()) {
    console.log('Page visible - ready to resume');
    // Optionally auto-resume, but for now just log
  }
}

// Initialize visibility change handler
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (isCameraActive()) {
      handleStop();
    }
    // Clear intervals
    if (analysisTimer) {
      clearInterval(analysisTimer);
    }
  });
}

// Get camera running state (exported for external use)
export function getCameraState() {
  return isCameraActive();
}

// Export key functions for external modules
export {
  handleStart,
  handleStop,
  handleReset,
  updateButtonStates
};