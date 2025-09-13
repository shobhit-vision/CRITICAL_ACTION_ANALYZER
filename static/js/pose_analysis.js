import { poseHistory, updateMetrics, updateLandmarkTable, updateSkeletonStatus, toggleSkeletonOverlay } from './ui.js';
import { updateCharts } from './chart_manager.js';

// max history defining
const MAX_HISTORY = 100;

// Skeleton canvas setup
let skeletonCanvas, skeletonCtx, skeletonOverlay;

// Initialize skeleton canvas
function initializeSkeletonCanvas() {
  skeletonCanvas = document.getElementById('skeleton-canvas');
  if (skeletonCanvas) {
    skeletonCtx = skeletonCanvas.getContext('2d');
    setSkeletonCanvasSize();
  }
  
  skeletonOverlay = document.getElementById('skeleton-overlay');
}

// Set canvas dimensions
function setSkeletonCanvasSize() {
  if (skeletonCanvas) {
    skeletonCanvas.width = 400;
    skeletonCanvas.height = 500;
  }
}

// Draw skeleton function
function drawSkeleton(landmarks) {
  if (!landmarks || !skeletonCanvas || !skeletonCtx) return;
  
  skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
  
  // Calculate scaling to fit the skeleton in the canvas
  const minX = Math.min(...landmarks.map(l => l.x));
  const maxX = Math.max(...landmarks.map(l => l.x));
  const minY = Math.min(...landmarks.map(l => l.y));
  const maxY = Math.max(...landmarks.map(l => l.y));
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  const scale = Math.min(
    skeletonCanvas.width * 0.8 / width,
    skeletonCanvas.height * 0.8 / height
  );
  
  const offsetX = (skeletonCanvas.width - width * scale) / 2 - minX * scale;
  const offsetY = (skeletonCanvas.height - height * scale) / 2 - minY * scale;
  
  // Draw connections
  if (window.POSE_CONNECTIONS) {
    window.POSE_CONNECTIONS.forEach(([start, end]) => {
      if (landmarks[start] && landmarks[end]) {
        skeletonCtx.beginPath();
        skeletonCtx.moveTo(
          landmarks[start].x * scale + offsetX,
          landmarks[start].y * scale + offsetY
        );
        skeletonCtx.lineTo(
          landmarks[end].x * scale + offsetX,
          landmarks[end].y * scale + offsetY
        );
        skeletonCtx.strokeStyle = '#4a6bff';
        skeletonCtx.lineWidth = 3;
        skeletonCtx.stroke();
      }
    });
  }
  
  // Draw landmarks
  landmarks.forEach(landmark => {
    skeletonCtx.beginPath();
    skeletonCtx.arc(
      landmark.x * scale + offsetX,
      landmark.y * scale + offsetY,
      4, 0, 2 * Math.PI
    );
    skeletonCtx.fillStyle = '#FF0000';
    skeletonCtx.fill();
  });
  
  // Update skeleton info if elements exist
  const landmarksCountEl = document.getElementById('landmarks-count');
  if (landmarksCountEl) {
    landmarksCountEl.textContent = landmarks.length;
  }
  
  // Calculate average confidence
  const avgConfidence = landmarks.reduce((sum, l) => sum + (l.visibility || 0), 0) / landmarks.length;
  const confidenceScoreEl = document.getElementById('confidence-score');
  if (confidenceScoreEl) {
    confidenceScoreEl.textContent = `${Math.round(avgConfidence * 100)}%`;
  }
  
  // Show active tracking indicator
  updateSkeletonStatus('Tracking');
  
  // Hide overlay if visible
  toggleSkeletonOverlay(false);
}

// Calculate angle between three points
function calculateAngle(a, b, c) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}

// Calculate distance between two points
function calculateDistance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

// Analyze pose and extract metrics
function analyzePose(landmarks) {
  if (!landmarks) return null;
  
  // Calculate key angles
  const leftElbowAngle = calculateAngle(
    landmarks[11], landmarks[13], landmarks[15] // shoulder, elbow, wrist
  );
  
  const rightElbowAngle = calculateAngle(
    landmarks[12], landmarks[14], landmarks[16] // shoulder, elbow, wrist
  );
  
  const leftKneeAngle = calculateAngle(
    landmarks[23], landmarks[25], landmarks[27] // hip, knee, ankle
  );
  
  const rightKneeAngle = calculateAngle(
    landmarks[24], landmarks[26], landmarks[28] // hip, knee, ankle
  );
  
  // Calculate symmetry (comparing left and right sides)
  const symmetryScore = 100 - Math.abs(leftElbowAngle - rightElbowAngle) / 180 * 100;
  
  // Calculate torso movement (distance between shoulders and hips)
  const shoulderWidth = calculateDistance(landmarks[11], landmarks[12]);
  const hipWidth = calculateDistance(landmarks[23], landmarks[24]);
  const torsoStability = 100 - Math.abs(shoulderWidth - hipWidth) / shoulderWidth * 100;
  
  // Calculate balance (center of mass between feet)
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const midHip = {
    x: (landmarks[23].x + landmarks[24].x) / 2,
    y: (landmarks[23].y + landmarks[24].y) / 2
  };
  
  const balanceScore = 100 - Math.abs(
    (midHip.x - (leftAnkle.x + rightAnkle.x) / 2) / shoulderWidth * 100
  );
  
  // Calculate motion quality (simplified)
  let motionQuality = 85;
  if (poseHistory.length > 5) {
    const recentAngles = poseHistory.slice(-5).map(a => a.angles.leftElbow);
    const differences = [];
    for (let i = 1; i < recentAngles.length; i++) {
      differences.push(Math.abs(recentAngles[i] - recentAngles[i-1]));
    }
    const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
    motionQuality = Math.max(0, 100 - avgDifference * 2);
  }
  
  return {
    angles: {
      leftElbow: leftElbowAngle,
      rightElbow: rightElbowAngle,
      leftKnee: leftKneeAngle,
      rightKnee: rightKneeAngle
    },
    symmetry: Math.max(0, Math.min(100, symmetryScore)),
    torsoStability: Math.max(0, Math.min(100, torsoStability)),
    balance: Math.max(0, Math.min(100, balanceScore)),
    motionQuality: Math.max(0, Math.min(100, motionQuality)),
    landmarks: landmarks,
    timestamp: Date.now()
  };
}

// Process pose results
function onResultsPose(results) {
  const canvasElement = document.querySelector('.output_canvas');
  if (!canvasElement) return;
  
  const canvasCtx = canvasElement.getContext('2d');
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  
  if (results.poseLandmarks) {
    // Draw landmarks and connections on camera feed
    // if (window.drawConnectors && window.drawLandmarks) {
    //   window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, {
    //     color: '#00FF00',
    //     lineWidth: 2
    //   });
    //   window.drawLandmarks(canvasCtx, results.poseLandmarks, {
    //     color: '#FF0000',
    //     lineWidth: 1,
    //     radius: 2
    //   });
    // }
    
    // Draw skeleton visualization
    drawSkeleton(results.poseLandmarks);
    
    // Analyze pose
    const analysis = analyzePose(results.poseLandmarks);
    if (analysis) {
      poseHistory.push(analysis);
      if (poseHistory.length > MAX_HISTORY) {
        poseHistory.shift();
      }
      
      // Update charts if they exist
      if (typeof updateCharts === 'function') {
        updateCharts(analysis);
      }
      
      updateMetrics(analysis);
      updateLandmarkTable(results.poseLandmarks);
    }
  } else {
    // Show overlay if no landmarks detected
    toggleSkeletonOverlay(true);
    updateSkeletonStatus('Not Tracking');
  }
  
  canvasCtx.restore();
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
    const startButton = document.getElementById('start-camera');
    const stopButton = document.getElementById('stop-camera');
    if (startButton) startButton.disabled = true;
    if (stopButton) stopButton.disabled = true;
    
    return false;
  }
  return true;
}

// Initialize MediaPipe Pose
function initializePose() {
  // Initialize skeleton canvas
  initializeSkeletonCanvas();

  // Check if MediaPipe is loaded
  if (!checkMediaPipeLoaded()) {
    return null;
  }
  
  // Check if Pose is available
  if (typeof window.Pose === 'undefined') {
    console.error('MediaPipe Pose not loaded');
    return null;
  }

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
}

export {
  analyzePose,
  onResultsPose,
  initializePose,
  calculateAngle,
  calculateDistance,
  drawSkeleton,
  initializeSkeletonCanvas
};