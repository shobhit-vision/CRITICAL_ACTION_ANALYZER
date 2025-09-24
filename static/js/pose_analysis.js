import { poseHistory, updateMetrics, updateLandmarkTable, updateSkeletonStatus, toggleSkeletonOverlay } from './ui.js';
import { updateCharts } from './chart_manager.js';

// Constants
const MAX_HISTORY = 100;

// Global variables
let skeletonCanvas = null;
let skeletonCtx = null;
let skeletonOverlay = null;
let hasSkeletonCanvas = false;

// Initialize skeleton canvas with error handling
export function initializeSkeletonCanvas() {
  try {
    skeletonCanvas = document.getElementById('skeleton-canvas');
    
    // Check if skeleton canvas exists on this page
    if (!skeletonCanvas) {
      console.log('Skeleton canvas not found on this page - skipping initialization');
      hasSkeletonCanvas = false;
      return true; // Return true because it's not an error, just not needed
    }
    
    skeletonCtx = skeletonCanvas.getContext('2d');
    setSkeletonCanvasSize();
    
    skeletonOverlay = document.getElementById('skeleton-overlay');
    hasSkeletonCanvas = true;
    
    console.log('Skeleton canvas initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing skeleton canvas:', error);
    hasSkeletonCanvas = false;
    return false;
  }
}

// Set canvas dimensions dynamically
function setSkeletonCanvasSize() {
  if (!skeletonCanvas) return;
  
  const container = skeletonCanvas.parentElement;
  if (container) {
    skeletonCanvas.width = container.clientWidth || 400;
    skeletonCanvas.height = container.clientHeight || 500;
  } else {
    skeletonCanvas.width = 400;
    skeletonCanvas.height = 500;
  }
}

// Calculate scaling factors for skeleton drawing
function calculateScalingFactors(landmarks) {
  if (!landmarks || landmarks.length === 0) return null;
  
  const xs = landmarks.map(l => l.x);
  const ys = landmarks.map(l => l.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  if (width === 0 || height === 0) return null;
  
  const scale = Math.min(
    skeletonCanvas.width * 0.8 / width,
    skeletonCanvas.height * 0.8 / height
  );
  
  const offsetX = (skeletonCanvas.width - width * scale) / 2 - minX * scale;
  const offsetY = (skeletonCanvas.height - height * scale) / 2 - minY * scale;
  
  return { scale, offsetX, offsetY };
}

// Draw skeleton connections
function drawSkeletonConnections(landmarks, scaling) {
  if (!window.POSE_CONNECTIONS || !skeletonCtx) return;
  
  window.POSE_CONNECTIONS.forEach(([start, end]) => {
    if (landmarks[start] && landmarks[end]) {
      skeletonCtx.beginPath();
      skeletonCtx.moveTo(
        landmarks[start].x * scaling.scale + scaling.offsetX,
        landmarks[start].y * scaling.scale + scaling.offsetY
      );
      skeletonCtx.lineTo(
        landmarks[end].x * scaling.scale + scaling.offsetX,
        landmarks[end].y * scaling.scale + scaling.offsetY
      );
      skeletonCtx.strokeStyle = '#4a6bff';
      skeletonCtx.lineWidth = 3;
      skeletonCtx.stroke();
    }
  });
}

// Draw skeleton landmarks
function drawSkeletonLandmarks(landmarks, scaling) {
  if (!skeletonCtx) return;
  
  landmarks.forEach(landmark => {
    skeletonCtx.beginPath();
    skeletonCtx.arc(
      landmark.x * scaling.scale + scaling.offsetX,
      landmark.y * scaling.scale + scaling.offsetY,
      4, 0, 2 * Math.PI
    );
    skeletonCtx.fillStyle = '#FF0000';
    skeletonCtx.fill();
  });
}

// Update skeleton information display
function updateSkeletonInfo(landmarks) {
  if (!landmarks) return;
  
  // Update landmarks count
  const landmarksCountEl = document.getElementById('landmarks-count');
  if (landmarksCountEl) {
    const visibleLandmarks = landmarks.filter(l => l.visibility > 0.5).length;
    landmarksCountEl.textContent = `${visibleLandmarks}/${landmarks.length}`;
  }
  
  // Update confidence score
  const confidenceScoreEl = document.getElementById('confidence-score');
  if (confidenceScoreEl) {
    const avgConfidence = landmarks.reduce((sum, l) => sum + (l.visibility || 0), 0) / landmarks.length;
    confidenceScoreEl.textContent = `${Math.round(avgConfidence * 100)}%`;
  }
}

// Main skeleton drawing function
export function drawSkeleton(landmarks) {
  // Only draw if skeleton canvas exists on this page
  if (!hasSkeletonCanvas || !landmarks || !skeletonCanvas || !skeletonCtx) {
    toggleSkeletonOverlay(true);
    updateSkeletonStatus('Not Tracking');
    return;
  }
  
  try {
    // Clear canvas
    skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
    
    // Calculate scaling
    const scaling = calculateScalingFactors(landmarks);
    if (!scaling) {
      console.warn('Could not calculate scaling factors');
      return;
    }
    
    // Draw skeleton
    drawSkeletonConnections(landmarks, scaling);
    drawSkeletonLandmarks(landmarks, scaling);
    
    // Update information displays
    updateSkeletonInfo(landmarks);
    updateSkeletonStatus('Tracking');
    toggleSkeletonOverlay(false);
    
  } catch (error) {
    console.error('Error drawing skeleton:', error);
    toggleSkeletonOverlay(true);
    updateSkeletonStatus('Error');
  }
}

// Calculate angle between three points
export function calculateAngle(a, b, c) {
  try {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    return angle > 180.0 ? 360 - angle : angle;
  } catch (error) {
    console.error('Error calculating angle:', error);
    return 0;
  }
}

// Calculate distance between two points
export function calculateDistance(a, b) {
  try {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  } catch (error) {
    console.error('Error calculating distance:', error);
    return 0;
  }
}

// Calculate symmetry score
function calculateSymmetry(leftAngle, rightAngle) {
  const difference = Math.abs(leftAngle - rightAngle);
  return Math.max(0, 100 - (difference / 180 * 100));
}

// Calculate torso stability
function calculateTorsoStability(landmarks) {
  try {
    const shoulderWidth = calculateDistance(landmarks[11], landmarks[12]);
    const hipWidth = calculateDistance(landmarks[23], landmarks[24]);
    
    if (shoulderWidth === 0) return 100;
    
    const stability = 100 - Math.abs(shoulderWidth - hipWidth) / shoulderWidth * 100;
    return Math.max(0, Math.min(100, stability));
  } catch (error) {
    console.error('Error calculating torso stability:', error);
    return 100;
  }
}

// Calculate balance score
function calculateBalance(landmarks) {
  try {
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const midHip = {
      x: (landmarks[23].x + landmarks[24].x) / 2,
      y: (landmarks[23].y + landmarks[24].y) / 2
    };
    
    const shoulderWidth = calculateDistance(landmarks[11], landmarks[12]);
    if (shoulderWidth === 0) return 100;
    
    const balance = 100 - Math.abs(
      (midHip.x - (leftAnkle.x + rightAnkle.x) / 2) / shoulderWidth * 100
    );
    
    return Math.max(0, Math.min(100, balance));
  } catch (error) {
    console.error('Error calculating balance:', error);
    return 100;
  }
}

// Calculate motion quality
function calculateMotionQuality() {
  try {
    if (poseHistory.length < 5) return 85;
    
    const recentAngles = poseHistory.slice(-5).map(a => a.angles.leftElbow);
    const differences = recentAngles.slice(1).map((val, i) => Math.abs(val - recentAngles[i]));
    const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
    
    return Math.max(0, 100 - avgDifference * 2);
  } catch (error) {
    console.error('Error calculating motion quality:', error);
    return 85;
  }
}

// Main pose analysis function
export function analyzePose(landmarks) {
  if (!landmarks || landmarks.length < 33) {
    console.warn('Invalid landmarks data');
    return null;
  }
  
  try {
    // Calculate key angles
    const angles = {
      leftElbow: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
      rightElbow: calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
      leftKnee: calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
      rightKnee: calculateAngle(landmarks[24], landmarks[26], landmarks[28])
    };
    
    // Calculate metrics
    const analysis = {
      angles: angles,
      symmetry: calculateSymmetry(angles.leftElbow, angles.rightElbow),
      torsoStability: calculateTorsoStability(landmarks),
      balance: calculateBalance(landmarks),
      motionQuality: calculateMotionQuality(),
      landmarks: landmarks,
      timestamp: Date.now()
    };
    
    return analysis;
    
  } catch (error) {
    console.error('Error analyzing pose:', error);
    return null;
  }
}

// Process pose results from MediaPipe
export function onResultsPose(results) {
  const canvasElement = document.querySelector('.output_canvas');
  if (!canvasElement) {
    console.warn('Output canvas not found');
    return;
  }
  
  try {
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw camera feed
    if (results.image) {
      canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }
    
    // Process pose landmarks
    if (results.poseLandmarks) {
      drawSkeleton(results.poseLandmarks);
      
      const analysis = analyzePose(results.poseLandmarks);
      if (analysis) {
        // Update pose history
        poseHistory.push(analysis);
        if (poseHistory.length > MAX_HISTORY) {
          poseHistory.shift();
        }
        
        // Update UI components
        updateMetrics(analysis);
        updateLandmarkTable(results.poseLandmarks);
        
        // Update charts if available
        if (typeof updateCharts === 'function') {
          updateCharts(analysis);
        }
      }
    } else {
      toggleSkeletonOverlay(true);
      updateSkeletonStatus('Not Tracking');
    }
    
    canvasCtx.restore();
    
  } catch (error) {
    console.error('Error processing pose results:', error);
  }
}

// Check if MediaPipe is loaded properly
function checkMediaPipeLoaded() {
  if (typeof window.Pose === 'undefined') {
    console.error('MediaPipe Pose not loaded correctly');
    
    // Show error message to user
    const errorOverlay = document.getElementById('mediapipe-error');
    if (errorOverlay) {
      errorOverlay.style.display = 'block';
    }
    
    // Disable camera buttons
    ['start-camera', 'stop-camera'].forEach(btnId => {
      const button = document.getElementById(btnId);
      if (button) button.disabled = true;
    });
    
    return false;
  }
  return true;
}

// Initialize MediaPipe Pose
export function initializePose() {
  // Initialize skeleton canvas (will handle pages without skeleton canvas)
  initializeSkeletonCanvas();
  
  if (!checkMediaPipeLoaded()) {
    return null;
  }
  
  try {
    const pose = new window.Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.2/${file}`;
      }
    });
    
    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    pose.onResults(onResultsPose);
    return pose;
    
  } catch (error) {
    console.error('Error initializing MediaPipe Pose:', error);
    return null;
  }
}

// Check if skeleton canvas exists on current page
export function hasSkeletonCanvasElement() {
  return hasSkeletonCanvas;
}