import { initializeCharts } from './chart_manager.js';
import { initializeButtons } from './button_manager.js';

// Global variables
let poseHistory = [];
const MAX_HISTORY = 100;
let charts = {};
let timerSeconds = 0;
let timerInterval = null;

// DOM elements cache
let domElements = {};

// Safely get DOM element with caching
function getElement(id, cache = true) {
  if (cache && domElements[id]) {
    return domElements[id];
  }
  
  const element = document.getElementById(id);
  if (cache && element) {
    domElements[id] = element;
  }
  
  return element;
}

// Safely query selector
function querySelector(selector) {
  try {
    return document.querySelector(selector);
  } catch (error) {
    console.warn(`Error querying selector ${selector}:`, error);
    return null;
  }
}

// Initialize all DOM elements with error handling
export function initializeDOMElements() {
  const elements = {
    // Camera elements
    'video': '.input_video',
    'canvas': '.output_canvas',
    
    // Status elements
    'camera-status': 'camera-status',
    'skeleton-status': 'skeleton-status',
    'landmarks-count': 'landmarks-count',
    'confidence-score': 'confidence-score',
    'frame-rate': 'frame-rate',
    
    // Score elements
    'posture-score': 'posture-score',
    'balance-score': 'balance-score',
    'symmetry-score': 'symmetry-score',
    'motion-score': 'motion-score',
    'smoothness-score': 'smoothness-score',
    
    // Progress bars
    'posture-progress': 'posture-progress',
    'balance-progress': 'balance-progress',
    'symmetry-progress': 'symmetry-progress',
    'motion-progress': 'motion-progress',
    'smoothness-progress': 'smoothness-progress',
    
    // Overlays
    'camera-overlay': 'camera-overlay',
    'skeleton-overlay': 'skeleton-overlay',
    
    // Buttons
    'rotate-view': 'rotate-view',
    'toggle-3d': 'toggle-3d',
    'start-camera': 'start-camera',
    'stop-camera': 'stop-camera',
    
    // Timer
    'analysis-timer': 'analysis-timer',
    
    // Table
    'landmark-data': 'landmark-data'
  };
  
  // Initialize elements
  Object.entries(elements).forEach(([key, selector]) => {
    if (selector.startsWith('.')) {
      domElements[key] = querySelector(selector);
    } else {
      domElements[key] = getElement(selector, false);
    }
  });
  
  // Initialize canvas context
  if (domElements.canvas) {
    domElements.canvasCtx = domElements.canvas.getContext('2d');
  }
  
  console.log('DOM elements initialized');
  return true;
}

// Set canvas dimensions dynamically
export function onResize() {
  try {
    if (domElements.video && domElements.canvas) {
      domElements.canvas.width = domElements.video.videoWidth;
      domElements.canvas.height = domElements.video.videoHeight;
    }
  } catch (error) {
    console.warn('Error resizing canvas:', error);
  }
}

// Update progress bar with safety check
function updateProgressBar(progressId, value) {
  const progressBar = getElement(progressId);
  if (progressBar && progressBar.style) {
    progressBar.style.width = Math.max(0, Math.min(100, value)) + '%';
  }
}

// Update score display with safety check
function updateScoreDisplay(scoreId, value) {
  const scoreElement = getElement(scoreId);
  if (scoreElement) {
    scoreElement.textContent = Math.round(value) + '%';
  }
}

// Update individual metrics
function updatePostureMetrics(torsoStability) {
  updateScoreDisplay('posture-score', torsoStability);
  updateProgressBar('posture-progress', torsoStability);
}

function updateBalanceMetrics(balance) {
  updateScoreDisplay('balance-score', balance);
  updateProgressBar('balance-progress', balance);
}

function updateSymmetryMetrics(symmetry) {
  updateScoreDisplay('symmetry-score', symmetry);
  updateProgressBar('symmetry-progress', symmetry);
}

function updateMotionMetrics(motionQuality) {
  updateScoreDisplay('motion-score', motionQuality);
  updateProgressBar('motion-progress', motionQuality);
}

function updateSmoothnessMetrics() {
  if (poseHistory.length > 5) {
    const recentAngles = poseHistory.slice(-5).map(a => a.angles?.leftElbow || 0);
    const differences = recentAngles.slice(1).map((val, i) => Math.abs(val - recentAngles[i]));
    const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
    const smoothness = Math.max(0, 100 - avgDifference * 2);
    
    updateScoreDisplay('smoothness-score', smoothness);
    updateProgressBar('smoothness-progress', smoothness);
  }
}

// Update all metrics with error handling
export function updateMetrics(analysis) {
  if (!analysis) return;
  
  try {
    updatePostureMetrics(analysis.torsoStability);
    updateBalanceMetrics(analysis.balance);
    updateSymmetryMetrics(analysis.symmetry);
    updateMotionMetrics(analysis.motionQuality);
    updateSmoothnessMetrics();
    
    // Update landmarks count with visible count
    if (analysis.landmarks) {
      const visibleCount = analysis.landmarks.filter(l => l.visibility > 0.5).length;
      const landmarksCountEl = getElement('landmarks-count');
      if (landmarksCountEl) {
        landmarksCountEl.textContent = `${visibleCount}/${analysis.landmarks.length}`;
      }
    }
    
  } catch (error) {
    console.warn('Error updating metrics:', error);
  }
}

// Update landmark table with visible landmarks
export function updateLandmarkTable(landmarks) {
  if (!landmarks) return;
  
  try {
    const tableBody = getElement('landmark-data');
    if (!tableBody) return;
    
    // Clear table
    tableBody.innerHTML = '';
    
    // Key landmarks to display
    const keyLandmarks = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    
    keyLandmarks.forEach(index => {
      const landmark = landmarks[index];
      if (!landmark) return;
      
      const isVisible = landmark.visibility > 0.5;
      const visibilityText = isVisible ? 'Visible' : 'Low Visibility';
      const rowClass = isVisible ? 'visible-landmark' : 'low-visibility-landmark';
      
      const row = document.createElement('tr');
      row.className = rowClass;
      
      row.innerHTML = `
        <td>${index}</td>
        <td>${landmark.x.toFixed(4)}</td>
        <td>${landmark.y.toFixed(4)}</td>
        <td>${landmark.z ? landmark.z.toFixed(4) : 'N/A'}</td>
        <td>${landmark.visibility ? landmark.visibility.toFixed(2) : 'N/A'}</td>
        <td>${visibilityText}</td>
      `;
      
      tableBody.appendChild(row);
    });
    
  } catch (error) {
    console.warn('Error updating landmark table:', error);
  }
}

// Generate insights based on recent pose history
export function generateInsights() {
  if (poseHistory.length < 10) {
    return 'Need more data for analysis (minimum 10 frames)';
  }
  
  try {
    const recentAnalyses = poseHistory.slice(-10);
    const avgSymmetry = recentAnalyses.reduce((sum, a) => sum + a.symmetry, 0) / recentAnalyses.length;
    const avgBalance = recentAnalyses.reduce((sum, a) => sum + a.balance, 0) / recentAnalyses.length;
    const avgTorsoStability = recentAnalyses.reduce((sum, a) => sum + a.torsoStability, 0) / recentAnalyses.length;
    
    return {
      posture: getPostureAnalysis(avgTorsoStability),
      movement: getMovementAnalysis(avgSymmetry),
      recommendations: getRecommendations(avgBalance, avgSymmetry, avgTorsoStability)
    };
    
  } catch (error) {
    console.warn('Error generating insights:', error);
    return null;
  }
}

// Helper functions for insights
function getPostureAnalysis(avgTorsoStability) {
  if (avgTorsoStability > 80) {
    return 'Your posture is excellent! You maintain a stable and aligned torso position.';
  } else if (avgTorsoStability > 60) {
    return 'Your posture is good but could be improved. Try to keep your shoulders back and avoid slouching.';
  } else {
    return 'Your posture needs attention. Focus on aligning your ears, shoulders, and hips. Consider exercises to strengthen your core.';
  }
}

function getMovementAnalysis(avgSymmetry) {
  if (avgSymmetry > 85) {
    return 'Your movements show good symmetry between left and right sides.';
  } else if (avgSymmetry > 70) {
    return 'Your movements show moderate symmetry. Try to balance effort between both sides of your body.';
  } else {
    return 'Your movements show significant asymmetry. This may lead to muscle imbalances over time.';
  }
}

function getRecommendations(avgBalance, avgSymmetry, avgTorsoStability) {
  const recommendations = [];
  
  if (avgBalance < 70) {
    recommendations.push('Practice balance exercises like standing on one leg');
  }
  if (avgSymmetry < 75) {
    recommendations.push('Incorporate unilateral exercises to address imbalances');
  }
  if (avgTorsoStability < 70) {
    recommendations.push('Focus on core strengthening exercises like planks and bird-dogs');
  }
  
  return recommendations.length > 0 ? recommendations : ['Keep up the good work! Your movement quality is generally good.'];
}

// Timer functions
export function startAnalysisTimer() {
  try {
    stopAnalysisTimer(); // Clear existing timer
    
    timerSeconds = 0;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
      timerSeconds++;
      updateTimerDisplay();
    }, 1000);
    
    return timerInterval;
  } catch (error) {
    console.warn('Error starting analysis timer:', error);
    return null;
  }
}

export function stopAnalysisTimer() {
  try {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  } catch (error) {
    console.warn('Error stopping analysis timer:', error);
  }
}

function updateTimerDisplay() {
  const timerDisplay = getElement('analysis-timer');
  if (!timerDisplay) return;
  
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Status update functions
export function updateCameraStatus(status) {
  const statusElement = getElement('camera-status');
  const indicatorDot = document.querySelector('.camera-indicator .indicator-dot');
  
  if (statusElement) statusElement.textContent = status;
  
  if (indicatorDot) {
    indicatorDot.style.backgroundColor = status === 'Camera Active' ? '#4ade80' : '#ef4444';
  }
}

export function updateSkeletonStatus(status) {
  const indicatorDot = document.querySelector('.skeleton-indicator .indicator-dot');
  if (indicatorDot) {
    indicatorDot.style.backgroundColor = status === 'Tracking' ? '#4ade80' : '#ef4444';
  }
}

// Overlay functions
export function toggleCameraOverlay(show) {
  const overlay = getElement('camera-overlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

export function toggleSkeletonOverlay(show) {
  const overlay = getElement('skeleton-overlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

// Tab functionality
function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  if (tabs.length === 0) return;
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show active tab pane
      tabPanes.forEach(pane => pane.classList.remove('active'));
      const activePane = document.getElementById(`${tabId}-tab`);
      if (activePane) activePane.classList.add('active');
    });
  });
}

// Initialize the application
export function initializeApp() {
  try {
    initializeDOMElements();
    initializeButtons();
    initializeTabs();
    
    // Initialize charts if on dashboard page
    if (getElement('angle-chart')) {
      initializeCharts();
    }
    
    // Handle window resize
    window.addEventListener('resize', onResize);
    
    // Set initial canvas size
    setTimeout(onResize, 100);
    
    console.log('Application initialized successfully');
    return true;
    
  } catch (error) {
    console.error('Error initializing application:', error);
    return false;
  }
}

// Export pose history for other modules
export { poseHistory, MAX_HISTORY, charts };