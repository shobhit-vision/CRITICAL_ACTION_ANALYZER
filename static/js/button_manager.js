import { startCamera, stopCamera, resetData } from './camera_manager.js';
import { 
  startAnalysisTimer, 
  stopAnalysisTimer,
  cameraOverlay,
  poseHistory,
  charts
} from './ui.js';

// Global variables for button states
let isCameraRunning = false;
let analysisTimer = null;

// Initialize all button functionality
function initializeButtons() {
  try {
    // Get button references
    const startButton = document.getElementById('start-camera');
    const stopButton = document.getElementById('stop-camera');
    const resetButton = document.getElementById('reset-data');
    const captureButton = document.getElementById('capture-frame');
    const overlayStartBtn = document.getElementById('overlay-start-btn');
    const heroAnalysisBtn = document.getElementById('hero-analysis-btn');

    // Set up event listeners for existing buttons
    if (startButton) {
      startButton.addEventListener('click', handleStart);
    }
    
    if (stopButton) {
      stopButton.addEventListener('click', handleStop);
      stopButton.disabled = true;
    }
    
    if (resetButton) {
      resetButton.addEventListener('click', handleReset);
    }
    
    if (captureButton) {
      captureButton.disabled = true;
      // Add capture functionality if needed
      // captureButton.addEventListener('click', handleCapture);
    }
    
    // Overlay start button (index page)
    if (overlayStartBtn) {
      overlayStartBtn.addEventListener('click', () => {
        if (startButton) startButton.click();
      });
    }
    
    // Hero analysis button (index page)
    if (heroAnalysisBtn) {
      heroAnalysisBtn.addEventListener('click', () => {
        const analysisSection = document.getElementById('analysis');
        if (analysisSection) {
          analysisSection.scrollIntoView({ behavior: 'smooth' });
          setTimeout(() => {
            if (startButton) startButton.click();
          }, 1000);
        }
      });
    }
    
    console.log('Button functionality initialized successfully');
  } catch (error) {
    console.warn('Error initializing buttons:', error.message);
  }
}

// Handle start button click
function handleStart() {
  try {
    startCamera();
    if (cameraOverlay) cameraOverlay.classList.add("hidden");
    startAnalysisTimer();
    
    // Update button states
    const stopButton = document.getElementById('stop-camera');
    const startButton = document.getElementById('start-camera');
    const captureButton = document.getElementById('capture-frame');
    
    if (stopButton) stopButton.disabled = false;
    if (startButton) startButton.disabled = true;
    if (captureButton) captureButton.disabled = false;
    
    isCameraRunning = true;
  } catch (error) {
    console.warn('Error starting camera:', error.message);
  }
}

// Handle stop button click
function handleStop() {
  try {
    stopCamera();
    if (cameraOverlay) cameraOverlay.classList.remove("hidden");
    stopAnalysisTimer();
    
    // Update button states
    const stopButton = document.getElementById('stop-camera');
    const startButton = document.getElementById('start-camera');
    const captureButton = document.getElementById('capture-frame');
    
    if (stopButton) stopButton.disabled = true;
    if (startButton) startButton.disabled = false;
    if (captureButton) captureButton.disabled = true;
    
    isCameraRunning = false;
  } catch (error) {
    console.warn('Error stopping camera:', error.message);
  }
}

// Handle reset button click
function handleReset() {
  try {
    // Clear pose history
    if (poseHistory && poseHistory.length) {
      poseHistory.length = 0;
    }
    
    resetData();
    handleStop(); // Stop camera when resetting
    
    // Reset metrics on index page if elements exist
    const postureScore = document.getElementById('posture-score');
    const balanceScore = document.getElementById('balance-score');
    const symmetryScore = document.getElementById('symmetry-score');
    const motionScore = document.getElementById('motion-score');
    
    if (postureScore) postureScore.textContent = '0%';
    if (balanceScore) balanceScore.textContent = '0%';
    if (symmetryScore) symmetryScore.textContent = '0%';
    if (motionScore) motionScore.textContent = '0%';
    
    // Reset progress bars
    const postureProgress = document.getElementById('posture-progress');
    const balanceProgress = document.getElementById('balance-progress');
    const symmetryProgress = document.getElementById('symmetry-progress');
    const motionProgress = document.getElementById('motion-progress');
    
    if (postureProgress) postureProgress.style.width = '0%';
    if (balanceProgress) balanceProgress.style.width = '0%';
    if (symmetryProgress) symmetryProgress.style.width = '0%';
    if (motionProgress) motionProgress.style.width = '0%';
    
    // Reset charts if on dashboard page (check if charts exist)
    resetCharts();
    
    console.log('Data reset successfully');
  } catch (error) {
    console.warn('Error resetting data:', error.message);
  }
}

// Reset charts function (only for dashboard page)
function resetCharts() {
  try {
    // Check if we're on the dashboard page by looking for chart elements
    const angleChart = document.getElementById('angle-chart');
    const movementChart = document.getElementById('movement-chart');
    const velocityChart = document.getElementById('velocity-chart');
    const stabilityChart = document.getElementById('stability-chart');
    
    // Reset charts only if they exist (dashboard page)
    if (angleChart || movementChart || velocityChart || stabilityChart) {
      // Reset each chart if it exists in the charts object
      if (charts.angle) {
        charts.angle.data.datasets.forEach(dataset => {
          dataset.data = [];
        });
        charts.angle.update();
      }
      
      if (charts.movement) {
        charts.movement.data.datasets.forEach(dataset => {
          dataset.data = [];
        });
        charts.movement.update();
      }
      
      if (charts.velocity) {
        charts.velocity.data.datasets.forEach(dataset => {
          dataset.data = [];
        });
        charts.velocity.update();
      }
      
      if (charts.stability) {
        charts.stability.data.datasets.forEach(dataset => {
          dataset.data = [];
        });
        charts.stability.update();
      }
      
      console.log('Charts reset successfully');
    }
  } catch (error) {
    console.warn('Error resetting charts:', error.message);
  }
}

// Get camera running state
function getCameraState() {
  return isCameraRunning;
}

export {
  initializeButtons,
  handleStart,
  handleStop,
  handleReset,
  getCameraState
};