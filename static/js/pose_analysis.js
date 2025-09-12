import { poseHistory, updateMetrics, updateLandmarkTable } from './ui.js';
import { updateCharts } from './chart_manager.js';

// max history defining
 const MAX_HISTORY = 100;

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
    timestamp: Date.now()
  };
}

// Process pose results
function onResultsPose(results) {
  const canvasElement = document.querySelector('.output_canvas');
  const canvasCtx = canvasElement.getContext('2d');
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  
  if (results.poseLandmarks) {
    // Draw landmarks and connections
    window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 2
    });
    window.drawLandmarks(canvasCtx, results.poseLandmarks, {
      color: '#FF0000',
      lineWidth: 1,
      radius: 2
    });
    
    // Analyze pose
    const analysis = analyzePose(results.poseLandmarks);
    if (analysis) {
      poseHistory.push(analysis);
      if (poseHistory.length > MAX_HISTORY) {
        poseHistory.shift();
      }
      
      updateCharts(analysis);
      updateMetrics(analysis);
      updateLandmarkTable(results.poseLandmarks);
    }
  }
  
  canvasCtx.restore();
}

// Initialize MediaPipe Pose
function initializePose() {
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
  calculateDistance
};