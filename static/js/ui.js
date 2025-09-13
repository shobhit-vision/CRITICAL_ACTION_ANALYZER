import { initializeCharts } from './chart_manager.js';
import { startCamera, stopCamera, resetData } from './camera_manager.js';

// Global variables
let poseHistory = [];
const MAX_HISTORY = 100;
let charts = {};

// DOM elements
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('start-camera');
const stopButton = document.getElementById('stop-camera');
const resetButton = document.getElementById('reset-data');
const tabs = document.querySelectorAll('.tab');
const tabPanes = document.querySelectorAll('.tab-pane');

// Initialize Vanta.js background
// function initializeVanta() {
//   VANTA.NET({
//     el: "#vanta-container",
//     mouseControls: true,
//     touchControls: true,
//     gyroControls: false,
//     minHeight: 100.00,
//     minWidth: 100.00,
//     scale: 1.00,
//     scaleMobile: 1.00,
//     color: 0x4a6bff,
//     backgroundColor: 0xf8f9fa
//   });
// }

// Set canvas dimensions
function onResize() {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
}

// Update metrics display
function updateMetrics(analysis) {
  if (!analysis) return;
  
  document.getElementById('posture-score').textContent = Math.round(analysis.torsoStability) + '%';
  document.getElementById('balance-score').textContent = Math.round(analysis.balance) + '%';
  document.getElementById('symmetry-score').textContent = Math.round(analysis.symmetry) + '%';
  
  // Calculate smoothness (simplified)
  if (poseHistory.length > 5) {
    const recentAngles = poseHistory.slice(-5).map(a => a.angles.leftElbow);
    const differences = [];
    for (let i = 1; i < recentAngles.length; i++) {
      differences.push(Math.abs(recentAngles[i] - recentAngles[i-1]));
    }
    const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
    const smoothness = Math.max(0, 100 - avgDifference * 2);
    document.getElementById('smoothness-score').textContent = Math.round(smoothness) + '%';
  }
}

// Update landmark table
function updateLandmarkTable(landmarks) {
  if (!landmarks) return;
  
  const tableBody = document.getElementById('landmark-data');
  tableBody.innerHTML = '';
  
  // Show key landmarks only for performance
  const keyLandmarks = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  
  keyLandmarks.forEach(index => {
    const landmark = landmarks[index];
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${index}</td>
      <td>${landmark.x.toFixed(4)}</td>
      <td>${landmark.y.toFixed(4)}</td>
      <td>${landmark.z ? landmark.z.toFixed(4) : 'N/A'}</td>
      <td>${landmark.visibility ? landmark.visibility.toFixed(2) : 'N/A'}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

// Generate analysis insights
function generateInsights() {
  if (poseHistory.length < 10) return;
  
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
  
  // Update DOM
  document.getElementById('posture-analysis').innerHTML = postureAnalysis;
  document.getElementById('movement-analysis').innerHTML = movementAnalysis;
  document.getElementById('recommendations').innerHTML = recommendations;
}

// Initialize the application
function initializeApp() {
  // initializeVanta();
  initializeCharts();
  stopButton.disabled = true;
  
  // Set initial canvas size
  setTimeout(onResize, 100);
  
  // Event listeners
  startButton.addEventListener('click', startCamera);
  stopButton.addEventListener('click', stopCamera);
  resetButton.addEventListener('click', resetData);
  
  // Tab functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show active tab pane
      tabPanes.forEach(pane => pane.classList.remove('active'));
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
  
  // Handle window resize
  window.addEventListener('resize', onResize);
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
  onResize
};