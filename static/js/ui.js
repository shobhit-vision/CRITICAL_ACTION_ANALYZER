// ui.js
import { initializeCharts } from './chart_manager.js';
import { initializeButtons } from './button_manager.js';

// Global variables
let poseHistory = [];
const MAX_HISTORY = 1000;
let charts = {};
let timerSeconds = 0;
let timerInterval = null;

// DOM elements cache
let domElements = {};

// Safely get DOM element with caching
function getElement(id, cache = true) {
  if (cache && domElements[id]) return domElements[id];

  const element = document.getElementById(id);
  if (cache && element) domElements[id] = element;

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

// Initialize DOM elements
export function initializeDOMElements() {
  const elements = {
    // Camera
    'video': '.input_video',
    'canvas': '.output_canvas',

    // Status
    'camera-status': 'camera-status',
    'skeleton-status': 'skeleton-status',
    'landmarks-count': 'landmarks-count',
    'confidence-score': 'confidence-score',
    'frame-rate': 'frame-rate',

    // Scores
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

  Object.entries(elements).forEach(([key, selector]) => {
    if (selector.startsWith('.')) {
      domElements[key] = querySelector(selector);
    } else {
      domElements[key] = getElement(selector, false);
    }
  });

  if (domElements.canvas) domElements.canvasCtx = domElements.canvas.getContext('2d');

  console.log('DOM elements initialized');
  return true;
}

// Resize canvas dynamically
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

// Update progress bar
function updateProgressBar(progressId, value) {
  const bar = getElement(progressId);
  if (bar && bar.style) bar.style.width = Math.max(0, Math.min(100, value)) + '%';
}

// Update score display
function updateScoreDisplay(scoreId, value) {
  const el = getElement(scoreId);
  if (el) el.textContent = Math.round(value) + '%';
}

// Individual metric updates
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

// Update all metrics
export function updateMetrics(analysis) {
  if (!analysis) return;

  try {
    if (analysis && analysis.landmarks && window.timeReportManager) {
      window.timeReportManager.showReportButton();
    }

    updatePostureMetrics(analysis.torsoStability);
    updateBalanceMetrics(analysis.balance);
    updateSymmetryMetrics(analysis.symmetry);
    updateMotionMetrics(analysis.motionQuality);
    updateSmoothnessMetrics();

    // Update landmark count
    if (analysis.landmarks) {
      const visibleCount = analysis.landmarks.filter(l => l.visibility > 0.5).length;
      const el = getElement('landmarks-count');
      if (el) el.textContent = `${visibleCount}/${analysis.landmarks.length}`;
    }

    // Log full JSON safely
    console.log('Full Analysis Data:', JSON.stringify(analysis, null, 2));

  } catch (error) {
    console.warn('Error updating metrics:', error);
  }
}

// Update landmark table
export function updateLandmarkTable(landmarks) {
  if (!landmarks) return;

  try {
    const tableBody = getElement('landmark-data');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    const keyLandmarks = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

    keyLandmarks.forEach(index => {
      const lm = landmarks[index];
      if (!lm) return;

      const isVisible = lm.visibility > 0.5;
      const row = document.createElement('tr');
      row.className = isVisible ? 'visible-landmark' : 'low-visibility-landmark';
      row.innerHTML = `
        <td>${index}</td>
        <td>${lm.x.toFixed(4)}</td>
        <td>${lm.y.toFixed(4)}</td>
        <td>${lm.z ? lm.z.toFixed(4) : 'N/A'}</td>
        <td>${lm.visibility ? lm.visibility.toFixed(2) : 'N/A'}</td>
        <td>${isVisible ? 'Visible' : 'Low Visibility'}</td>
      `;
      tableBody.appendChild(row);
    });

  } catch (error) {
    console.warn('Error updating landmark table:', error);
  }
}

// Insights
export function generateInsights() {
  if (poseHistory.length < 10) return 'Need more data (minimum 10 frames)';

  try {
    const recent = poseHistory.slice(-10);
    const avgSymmetry = recent.reduce((s, a) => s + a.symmetry, 0) / recent.length;
    const avgBalance = recent.reduce((s, a) => s + a.balance, 0) / recent.length;
    const avgTorsoStability = recent.reduce((s, a) => s + a.torsoStability, 0) / recent.length;

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

function getPostureAnalysis(avgTorsoStability) {
  if (avgTorsoStability > 80) return 'Excellent posture!';
  if (avgTorsoStability > 60) return 'Good posture but can improve.';
  return 'Posture needs attention.';
}

function getMovementAnalysis(avgSymmetry) {
  if (avgSymmetry > 85) return 'Good symmetry.';
  if (avgSymmetry > 70) return 'Moderate symmetry.';
  return 'Significant asymmetry.';
}

function getRecommendations(avgBalance, avgSymmetry, avgTorsoStability) {
  const recs = [];
  if (avgBalance < 70) recs.push('Practice balance exercises.');
  if (avgSymmetry < 75) recs.push('Do unilateral exercises.');
  if (avgTorsoStability < 70) recs.push('Focus on core strengthening.');
  return recs.length ? recs : ['Keep up the good work!'];
}

// Timer
export function startAnalysisTimer() {
  stopAnalysisTimer();
  timerSeconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
  return timerInterval;
}

export function stopAnalysisTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const display = getElement('analysis-timer');
  if (!display) return;
  const min = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const sec = String(timerSeconds % 60).padStart(2, '0');
  display.textContent = `${min}:${sec}`;
}

// Status and overlays
export function updateCameraStatus(status) {
  const el = getElement('camera-status');
  const dot = document.querySelector('.camera-indicator .indicator-dot');
  if (el) el.textContent = status;
  if (dot) dot.style.backgroundColor = status === 'Camera Active' ? '#4ade80' : '#ef4444';
}

export function updateSkeletonStatus(status) {
  const dot = document.querySelector('.skeleton-indicator .indicator-dot');
  if (dot) dot.style.backgroundColor = status === 'Tracking' ? '#4ade80' : '#ef4444';
}

export function toggleCameraOverlay(show) {
  const overlay = getElement('camera-overlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

export function toggleSkeletonOverlay(show) {
  const overlay = getElement('skeleton-overlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

// Tabs
function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panes = document.querySelectorAll('.tab-pane');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      panes.forEach(p => p.classList.remove('active'));
      const pane = document.getElementById(`${id}-tab`);
      if (pane) pane.classList.add('active');
    });
  });
}

// Initialize App
export function initializeApp() {
  try {
    initializeDOMElements();
    initializeButtons();
    initializeTabs();
    if (getElement('angle-chart')) initializeCharts();
    window.addEventListener('resize', onResize);
    setTimeout(onResize, 100);
    console.log('Application initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing application:', error);
    return false;
  }
}

// Export globals
export { poseHistory, MAX_HISTORY, charts };
