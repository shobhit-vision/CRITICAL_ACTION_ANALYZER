import { initializeCharts } from './chart_manager.js';
import { startCamera, stopCamera, resetData } from './camera_manager.js';

// Global variables
let poseHistory = [];
const MAX_HISTORY = 100;
let charts = {};
let analysisTimer = null;
let timerSeconds = 0;

// DOM elements - will be dynamically initialized
let videoElement, canvasElement, canvasCtx;
let startButton, stopButton, resetButton, captureButton;
let tabs, tabPanes;
let cameraStatus, skeletonStatus;
let landmarksCount, confidenceScore, frameRate;
let postureScore, balanceScore, symmetryScore, motionScore;
let postureProgress, balanceProgress, symmetryProgress, motionProgress;
let postureTrend, balanceTrend, symmetryTrend, motionTrend;
let cameraOverlay, skeletonOverlay;
let rotateViewBtn, toggle3dBtn;

// Initialize all DOM elements dynamically with error handling
function initializeDOMElements() {
  try {
    // Common elements
    videoElement = document.querySelector('.input_video');
    canvasElement = document.querySelector('.output_canvas');
    
    if (canvasElement) {
      canvasCtx = canvasElement.getContext('2d');
    }
    
    startButton = document.getElementById('start-camera');
    stopButton = document.getElementById('stop-camera');
    resetButton = document.getElementById('reset-data');
    
    // Index page specific elements
    cameraStatus = document.getElementById('camera-status');
    skeletonStatus = document.getElementById('skeleton-status');
    landmarksCount = document.getElementById('landmarks-count');
    confidenceScore = document.getElementById('confidence-score');
    frameRate = document.getElementById('frame-rate');
    
    postureScore = document.getElementById('posture-score');
    balanceScore = document.getElementById('balance-score');
    symmetryScore = document.getElementById('symmetry-score');
    motionScore = document.getElementById('motion-score');
    
    postureProgress = document.getElementById('posture-progress');
    balanceProgress = document.getElementById('balance-progress');
    symmetryProgress = document.getElementById('symmetry-progress');
    motionProgress = document.getElementById('motion-progress');
    
    postureTrend = document.getElementById('posture-trend');
    balanceTrend = document.getElementById('balance-trend');
    symmetryTrend = document.getElementById('symmetry-trend');
    motionTrend = document.getElementById('motion-trend');
    
    cameraOverlay = document.getElementById('camera-overlay');
    skeletonOverlay = document.getElementById('skeleton-overlay');
    
    captureButton = document.getElementById('capture-frame');
    rotateViewBtn = document.getElementById('rotate-view');
    toggle3dBtn = document.getElementById('toggle-3d');
    
    // Dashboard page specific elements
    tabs = document.querySelectorAll('.tab');
    tabPanes = document.querySelectorAll('.tab-pane');
    
    console.log('DOM elements initialized successfully');
  } catch (error) {
    console.warn('Error initializing DOM elements:', error.message);
  }
}

// Set canvas dimensions with error handling
function onResize() {
  try {
    if (videoElement && canvasElement) {
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
    }
  } catch (error) {
    console.warn('Error resizing canvas:', error.message);
  }
}

// Update metrics display with error handling
function updateMetrics(analysis) {
  if (!analysis) return;
  
  try {
    // Update scores if elements exist
    if (postureScore) {
      postureScore.textContent = Math.round(analysis.torsoStability) + '%';
      if (postureProgress) postureProgress.style.width = analysis.torsoStability + '%';
    }
    
    if (balanceScore) {
      balanceScore.textContent = Math.round(analysis.balance) + '%';
      if (balanceProgress) balanceProgress.style.width = analysis.balance + '%';
    }
    
    if (symmetryScore) {
      symmetryScore.textContent = Math.round(analysis.symmetry) + '%';
      if (symmetryProgress) symmetryProgress.style.width = analysis.symmetry + '%';
    }
    
    // Dashboard page has smoothness-score instead of motion-score
    try {
      const smoothnessScore = document.getElementById('smoothness-score');
      if (smoothnessScore) {
        if (poseHistory.length > 5) {
          const recentAngles = poseHistory.slice(-5).map(a => a.angles?.leftElbow || 0);
          const differences = [];
          for (let i = 1; i < recentAngles.length; i++) {
            differences.push(Math.abs(recentAngles[i] - recentAngles[i-1]));
          }
          const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
          const smoothness = Math.max(0, 100 - avgDifference * 2);
          smoothnessScore.textContent = Math.round(smoothness) + '%';
          
          const smoothnessProgress = document.getElementById('smoothness-progress');
          if (smoothnessProgress) smoothnessProgress.style.width = smoothness + '%';
        }
      }
    } catch (error) {
      console.warn('Error updating smoothness score:', error.message);
    }
    
    // Index page has motion-score
    if (motionScore) {
      motionScore.textContent = Math.round(analysis.motionQuality || analysis.symmetry) + '%';
      if (motionProgress) motionProgress.style.width = (analysis.motionQuality || analysis.symmetry) + '%';
    }
    
    // Update skeleton stats if on index page
    if (landmarksCount && analysis.landmarks) {
      landmarksCount.textContent = analysis.landmarks.length;
    }
    
    if (confidenceScore && analysis.confidence) {
      confidenceScore.textContent = Math.round(analysis.confidence * 100) + '%';
    }
  } catch (error) {
    console.warn('Error updating metrics:', error.message);
  }
}

// Update landmark table (dashboard page) with error handling
function updateLandmarkTable(landmarks) {
  if (!landmarks) return;
  
  try {
    const tableBody = document.getElementById('landmark-data');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Show key landmarks only for performance
    const keyLandmarks = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    
    keyLandmarks.forEach(index => {
      const landmark = landmarks[index];
      if (!landmark) return;
      
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${index}</td>
        <td>${landmark.x.toFixed(4)}</td>
        <td>${landmark.y.toFixed(4)}</td>
        <td>${landmark.z ? landmark.z.toFixed(4) : 'N/A'}</td>
        <td>${landmark.visibility ? landmark.visibility.toFixed(2) : 'N/A'}</td>
        <td>${landmark.visibility > 0.5 ? 'Visible' : 'Low Visibility'}</td>
      `;
      
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.warn('Error updating landmark table:', error.message);
  }
}

// Generate analysis insights (dashboard page) with error handling
function generateInsights() {
  if (poseHistory.length < 10) return;
  
  try {
    const recentAnalyses = poseHistory.slice(-10);
    const avgSymmetry = recentAnalyses.reduce((sum, a) => sum + a.symmetry, 0) / recentAnalyses.length;
    const avgBalance = recentAnalyses.reduce((sum, a) => sum + a.balance, 0) / recentAnalyses.length;
    const avgTorsoStability = recentAnalyses.reduce((sum, a) => sum + a.torsoStability, 0) / recentAnalyses.length;
    
    // Posture analysis
    let postureAnalysis = '';
    if (avgTorsoStability > 80) {
      postureAnalysis = 'Your posture is excellent! You maintain a stable and aligned torso position.';
    } else if (avgTorsoStability > 60) {
      postureAnalysis = 'Your posture is good but could be improved. Try to keep your shoulders back and avoid slouching.';
    } else {
      postureAnalysis = 'Your posture needs attention. Focus on aligning your ears, shoulders, and hips. Consider exercises to strengthen your core.';
    }
    
    // Movement analysis
    let movementAnalysis = '';
    if (avgSymmetry > 85) {
      movementAnalysis = 'Your movements show good symmetry between left and right sides.';
    } else if (avgSymmetry > 70) {
      movementAnalysis = 'Your movements show moderate symmetry. Try to balance effort between both sides of your body.';
    } else {
      movementAnalysis = 'Your movements show significant asymmetry. This may lead to muscle imbalances over time.';
    }
    
    // Recommendations
    let recommendations = '';
    if (avgBalance < 70) {
      recommendations += '• Practice balance exercises like standing on one leg.<br>';
    }
    if (avgSymmetry < 75) {
      recommendations += '• Incorporate unilateral exercises to address imbalances.<br>';
    }
    if (avgTorsoStability < 70) {
      recommendations += '• Focus on core strengthening exercises like planks and bird-dogs.<br>';
    }
    
    if (!recommendations) {
      recommendations = 'Keep up the good work! Your movement quality is generally good.';
    }
    
    // Update DOM if elements exist
    const postureAnalysisEl = document.getElementById('posture-analysis');
    const movementAnalysisEl = document.getElementById('movement-analysis');
    const recommendationsEl = document.getElementById('recommendations');
    
    if (postureAnalysisEl) postureAnalysisEl.innerHTML = postureAnalysis;
    if (movementAnalysisEl) movementAnalysisEl.innerHTML = movementAnalysis;
    if (recommendationsEl) recommendationsEl.innerHTML = recommendations;
  } catch (error) {
    console.warn('Error generating insights:', error.message);
  }
}

// Start/stop analysis timer (dashboard page) with error handling
function startAnalysisTimer() {
  try {
    if (analysisTimer) clearInterval(analysisTimer);
    timerSeconds = 0;
    
    analysisTimer = setInterval(() => {
      try {
        timerSeconds++;
        const minutes = Math.floor(timerSeconds / 60);
        const seconds = timerSeconds % 60;
        
        const timerDisplay = document.getElementById('analysis-timer');
        if (timerDisplay) {
          timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      } catch (error) {
        console.warn('Error in timer callback:', error.message);
      }
    }, 1000);
  } catch (error) {
    console.warn('Error starting analysis timer:', error.message);
  }
}

function stopAnalysisTimer() {
  try {
    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = null;
    }
  } catch (error) {
    console.warn('Error stopping analysis timer:', error.message);
  }
}

// Update camera status indicator with error handling
function updateCameraStatus(status) {
  try {
    if (!cameraStatus) return;
    
    cameraStatus.textContent = status;
    const indicatorDot = document.querySelector('.camera-indicator .indicator-dot');
    
    if (indicatorDot) {
      if (status === 'Camera Active') {
        indicatorDot.style.backgroundColor = '#4ade80';
      } else {
        indicatorDot.style.backgroundColor = '#ef4444';
      }
    }
  } catch (error) {
    console.warn('Error updating camera status:', error.message);
  }
}

// Update skeleton status indicator with error handling
function updateSkeletonStatus(status) {
  try {
    if (!skeletonStatus) return;
    
    const indicatorDot = document.querySelector('.skeleton-indicator .indicator-dot');
    
    if (indicatorDot) {
      if (status === 'Tracking') {
        indicatorDot.style.backgroundColor = '#4ade80';
      } else {
        indicatorDot.style.backgroundColor = '#ef4444';
      }
    }
  } catch (error) {
    console.warn('Error updating skeleton status:', error.message);
  }
}

// Toggle camera overlay visibility with error handling
function toggleCameraOverlay(show) {
  try {
    if (!cameraOverlay) return;
    
    if (show) {
      cameraOverlay.style.display = 'flex';
    } else {
      cameraOverlay.style.display = 'none';
    }
  } catch (error) {
    console.warn('Error toggling camera overlay:', error.message);
  }
}

// Toggle skeleton overlay visibility with error handling
function toggleSkeletonOverlay(show) {
  try {
    if (!skeletonOverlay) return;
    
    if (show) {
      skeletonOverlay.style.display = 'flex';
    } else {
      skeletonOverlay.style.display = 'none';
    }
  } catch (error) {
    console.warn('Error toggling skeleton overlay:', error.message);
  }
}

// Initialize the application with comprehensive error handling
function initializeApp() {
  try {
    initializeDOMElements();
    
    // Initialize charts if on dashboard page
    try {
      if (document.getElementById('angle-chart')) {
        initializeCharts();
      }
    } catch (error) {
      console.warn('Error initializing charts:', error.message);
    }
    
    // Set up event listeners for existing buttons
    if (startButton) {
      startButton.addEventListener('click', () => {
        try {
          startCamera();
          startAnalysisTimer();
          if (stopButton) stopButton.disabled = false;
          if (startButton) startButton.disabled = true;
          if (captureButton) captureButton.disabled = false;
        } catch (error) {
          console.warn('Error starting camera:', error.message);
        }
      });
    }
    
    if (stopButton) {
      stopButton.addEventListener('click', () => {
        try {
          stopCamera();
          stopAnalysisTimer();
          if (stopButton) stopButton.disabled = true;
          if (startButton) startButton.disabled = false;
          if (captureButton) captureButton.disabled = true;
        } catch (error) {
          console.warn('Error stopping camera:', error.message);
        }
      });
      if (stopButton) stopButton.disabled = true;
    }
    
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        try {
          resetData();
        } catch (error) {
          console.warn('Error resetting data:', error.message);
        }
      });
    }
    
    if (captureButton) {
      captureButton.disabled = true;
    }
    
    // Tab functionality (dashboard page)
    if (tabs && tabs.length > 0) {
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          try {
            const tabId = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show active tab pane
            tabPanes.forEach(pane => pane.classList.remove('active'));
            const tabPane = document.getElementById(`${tabId}-tab`);
            if (tabPane) tabPane.classList.add('active');
          } catch (error) {
            console.warn('Error handling tab click:', error.message);
          }
        });
      });
    }
    
    // 3D view controls (index page)
    if (rotateViewBtn) {
      rotateViewBtn.addEventListener('click', () => {
        try {
          // Implement rotation logic
          console.log('Rotate view clicked');
        } catch (error) {
          console.warn('Error in rotate view:', error.message);
        }
      });
    }
    
    if (toggle3dBtn) {
      toggle3dBtn.addEventListener('click', () => {
        try {
          // Implement 3D toggle logic
          console.log('Toggle 3D view clicked');
        } catch (error) {
          console.warn('Error in 3D toggle:', error.message);
        }
      });
    }
    
    // Overlay start button (index page)
    const overlayStartBtn = document.getElementById('overlay-start-btn');
    if (overlayStartBtn) {
      overlayStartBtn.addEventListener('click', () => {
        try {
          if (startButton) startButton.click();
        } catch (error) {
          console.warn('Error in overlay start button:', error.message);
        }
      });
    }
    
    // Hero analysis button (index page)
    const heroAnalysisBtn = document.getElementById('hero-analysis-btn');
    if (heroAnalysisBtn) {
      heroAnalysisBtn.addEventListener('click', () => {
        try {
          const analysisSection = document.getElementById('analysis');
          if (analysisSection) {
            analysisSection.scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => {
              if (startButton) startButton.click();
            }, 1000);
          }
        } catch (error) {
          console.warn('Error in hero analysis button:', error.message);
        }
      });
    }
    
    // Handle window resize
    window.addEventListener('resize', onResize);
    
    // Set initial canvas size
    setTimeout(onResize, 100);
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Error initializing application:', error.message);
  }
}

// Export functions for use in other modules
export {
  initializeApp,
  poseHistory,
  MAX_HISTORY,
  charts,
  videoElement,
  canvasElement,
  canvasCtx,
  updateMetrics,
  updateLandmarkTable,
  generateInsights,
  onResize,
  updateCameraStatus,
  updateSkeletonStatus,
  toggleCameraOverlay,
  toggleSkeletonOverlay,
  startAnalysisTimer,
  stopAnalysisTimer
};