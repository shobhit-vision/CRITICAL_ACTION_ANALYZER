// pose_feature.js - Comprehensive pose feature extraction and analysis

// Constants
const FPS = 30; // Target frames per second
const MAX_HISTORY = 1000; // Maximum frames to store
const LANDMARK_NAMES = {
    0: 'nose', 1: 'left_eye_inner', 2: 'left_eye', 3: 'left_eye_outer',
    4: 'right_eye_inner', 5: 'right_eye', 6: 'right_eye_outer',
    7: 'left_ear', 8: 'right_ear', 9: 'mouth_left', 10: 'mouth_right',
    11: 'left_shoulder', 12: 'right_shoulder', 13: 'left_elbow', 14: 'right_elbow',
    15: 'left_wrist', 16: 'right_wrist', 17: 'left_pinky', 18: 'right_pinky',
    19: 'left_index', 20: 'right_index', 21: 'left_thumb', 22: 'right_thumb',
    23: 'left_hip', 24: 'right_hip', 25: 'left_knee', 26: 'right_knee',
    27: 'left_ankle', 28: 'right_ankle', 29: 'left_heel', 30: 'right_heel',
    31: 'left_foot_index', 32: 'right_foot_index'
};

// Global storage for pose data
let poseDataHistory = [];
let currentSecondData = [];
let analysisStartTime = null;
let frameCount = 0;
let secondCount = 0;

// Initialize pose feature analysis
export function initializePoseFeatureAnalysis() {
    resetPoseData();
    console.log('Pose Feature Analysis initialized');
}

// Reset all pose data
export function resetPoseData() {
    poseDataHistory = [];
    currentSecondData = [];
    analysisStartTime = null;
    frameCount = 0;
    secondCount = 0;
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

// Calculate Euclidean distance in 3D
export function calculateDistance3D(a, b) {
    try {
        if (!a.z || !b.z) return calculateDistance(a, b);
        return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
    } catch (error) {
        console.error('Error calculating 3D distance:', error);
        return 0;
    }
}

// Calculate velocity between two points over time
export function calculateVelocity(point1, point2, timeDiff) {
    try {
        if (timeDiff === 0) return 0;
        const distance = calculateDistance(point1, point2);
        return distance / timeDiff;
    } catch (error) {
        console.error('Error calculating velocity:', error);
        return 0;
    }
}

// Calculate acceleration between three points over time
export function calculateAcceleration(point1, point2, point3, timeDiff) {
    try {
        if (timeDiff === 0) return 0;
        const vel1 = calculateVelocity(point1, point2, timeDiff);
        const vel2 = calculateVelocity(point2, point3, timeDiff);
        return (vel2 - vel1) / timeDiff;
    } catch (error) {
        console.error('Error calculating acceleration:', error);
        return 0;
    }
}

// Get visible landmarks with original names
export function getVisibleLandmarks(landmarks, visibilityThreshold = 0.5) {
    const visibleLandmarks = {};
    
    landmarks.forEach((landmark, index) => {
        if (landmark.visibility > visibilityThreshold) {
            const landmarkName = LANDMARK_NAMES[index] || `landmark_${index}`;
            visibleLandmarks[landmarkName] = {
                x: landmark.x,
                y: landmark.y,
                z: landmark.z || 0,
                visibility: landmark.visibility
            };
        }
    });
    
    return visibleLandmarks;
}

// Calculate all key angles for pose analysis (with snake_case and camelCase for compatibility)
export function calculateAllAngles(landmarks) {
    const angles = {};
    
    try {
        // Upper body angles
        angles.left_elbow = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
        angles.right_elbow = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        angles.left_shoulder = calculateAngle(landmarks[13], landmarks[11], landmarks[23]);
        angles.right_shoulder = calculateAngle(landmarks[14], landmarks[12], landmarks[24]);
        
        // Lower body angles
        angles.left_knee = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
        angles.right_knee = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
        angles.left_hip = calculateAngle(landmarks[11], landmarks[23], landmarks[25]);
        angles.right_hip = calculateAngle(landmarks[12], landmarks[24], landmarks[26]);
        
        // Torso angles
        angles.torso_vertical = calculateAngle(
            {x: landmarks[11].x, y: landmarks[11].y - 1}, // Point above left shoulder
            landmarks[11],
            landmarks[23]
        );

        // Add camelCase aliases for UI compatibility (e.g., leftElbow)
        angles.leftElbow = angles.left_elbow;
        angles.rightElbow = angles.right_elbow;
        angles.leftKnee = angles.left_knee;
        angles.rightKnee = angles.right_knee;
        angles.leftShoulder = angles.left_shoulder;
        angles.rightShoulder = angles.right_shoulder;
        angles.leftHip = angles.left_hip;
        angles.rightHip = angles.right_hip;
        angles.torsoVertical = angles.torso_vertical;
        
    } catch (error) {
        console.error('Error calculating angles:', error);
    }
    
    return angles;
}

// Calculate symmetry scores
export function calculateSymmetryScores(angles) {
    const symmetry = {};
    
    try {
        symmetry.elbow = 100 - Math.abs(angles.left_elbow - angles.right_elbow);
        symmetry.shoulder = 100 - Math.abs(angles.left_shoulder - angles.right_shoulder);
        symmetry.knee = 100 - Math.abs(angles.left_knee - angles.right_knee);
        symmetry.hip = 100 - Math.abs(angles.left_hip - angles.right_hip);
        
        symmetry.overall = (symmetry.elbow + symmetry.shoulder + symmetry.knee + symmetry.hip) / 4;
        
    } catch (error) {
        console.error('Error calculating symmetry scores:', error);
    }
    
    return symmetry;
}

// Calculate balance metrics
export function calculateBalanceMetrics(landmarks) {
    const balance = {};
    
    try {
        const left_ankle = landmarks[27];
        const right_ankle = landmarks[28];
        const mid_hip = {
            x: (landmarks[23].x + landmarks[24].x) / 2,
            y: (landmarks[23].y + landmarks[24].y) / 2
        };
        
        const shoulder_width = calculateDistance(landmarks[11], landmarks[12]);
        if (shoulder_width > 0) {
            balance.lateral_balance = 100 - Math.abs(
                (mid_hip.x - (left_ankle.x + right_ankle.x) / 2) / shoulder_width * 100
            );
        }
        
        // Center of mass stability
        const com_x = (landmarks[11].x + landmarks[12].x + landmarks[23].x + landmarks[24].x) / 4;
        const base_center_x = (left_ankle.x + right_ankle.x) / 2;
        balance.com_stability = 100 - Math.abs(com_x - base_center_x) * 100;
        
    } catch (error) {
        console.error('Error calculating balance metrics:', error);
    }
    
    return balance;
}

// Calculate motion quality metrics (fixed to use visible_landmarks object)
export function calculateMotionQuality(poseHistory, currentPose) {
    const motion = {
        smoothness: 85,
        consistency: 80,
        stability: 75
    };
    
    try {
        if (!poseHistory || poseHistory.length < 5) {
            console.warn('Insufficient history for motion quality calculation');
            return motion;
        }
        
        // Smoothness - based on angle changes (use snake_case or camelCase safely)
        const recentAngles = poseHistory.slice(-5).map(p => (p.angles && (p.angles.left_elbow || p.angles.leftElbow)) || 0);
        if (recentAngles.length < 2) return motion;
        const differences = recentAngles.slice(1).map((val, i) => Math.abs(val - recentAngles[i]));
        const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length;
        motion.smoothness = Math.max(0, 100 - avgDifference * 2);
        
        // Consistency - variation in key angles
        const elbowAngles = poseHistory.slice(-10).map(p => (p.angles && (p.angles.left_elbow || p.angles.leftElbow)) || 0);
        if (elbowAngles.length > 0) {
            const elbowStd = calculateStandardDeviation(elbowAngles);
            motion.consistency = Math.max(0, 100 - elbowStd * 5);
        }
        
        // Stability - torso movement (use visible_landmarks object, map indices to names)
        const torsoPositions = poseHistory.slice(-10).map(p => {
            const leftShoulder = p.visible_landmarks && p.visible_landmarks[LANDMARK_NAMES[11]];
            const rightShoulder = p.visible_landmarks && p.visible_landmarks[LANDMARK_NAMES[12]];
            
            // Fallback if landmarks missing
            const ls = leftShoulder || { x: 0, y: 0 };
            const rs = rightShoulder || { x: 0, y: 0 };
            
            return {
                x: (ls.x + rs.x) / 2,
                y: (ls.y + rs.y) / 2
            };
        });
        
        if (torsoPositions.length < 2) return motion;
        
        const torsoMovement = torsoPositions.slice(1).reduce((sum, pos, i) => {
            return sum + calculateDistance(torsoPositions[i], pos);
        }, 0) / (torsoPositions.length - 1); // Average movement
        
        motion.stability = Math.max(0, 100 - torsoMovement * 100);
        
    } catch (error) {
        console.error('Error calculating motion quality:', error);
        // Return defaults on error
    }
    
    return motion;
}

// Calculate standard deviation
function calculateStandardDeviation(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
}

// Calculate torso stability
export function calculateTorsoStability(landmarks) {
    try {
        const shoulder_width = calculateDistance(landmarks[11], landmarks[12]);
        const hip_width = calculateDistance(landmarks[23], landmarks[24]);
        
        if (shoulder_width === 0) return 100;
        
        const stability = 100 - Math.abs(shoulder_width - hip_width) / shoulder_width * 100;
        return Math.max(0, Math.min(100, stability));
    } catch (error) {
        console.error('Error calculating torso stability:', error);
        return 100;
    }
}

// Extract comprehensive features from landmarks (add raw_landmarks for compatibility)
export function extractPoseFeatures(landmarks, timestamp) {
    if (!landmarks || landmarks.length < 33) {
        return null;
    }
    
    try {
        const visibleLandmarksObj = getVisibleLandmarks(landmarks);
        const angles = calculateAllAngles(landmarks); // Now includes camelCase

        const features = {
            timestamp: timestamp,
            frame_number: frameCount,
            second_number: secondCount,
            raw_landmarks: landmarks, // Add raw array for compatibility
            visible_landmarks: visibleLandmarksObj,
            angles: angles,
            symmetry: calculateSymmetryScores(angles),
            balance: calculateBalanceMetrics(landmarks),
            torso_stability: calculateTorsoStability(landmarks),
            distances: calculateKeyDistances(landmarks),
            mathematical_features: calculateMathematicalFeatures(landmarks)
        };
        
        // Add motion quality if we have history
        if (poseDataHistory.length > 0) {
            features.motion_quality = calculateMotionQuality(poseDataHistory, features);
        }
        
        return features;
        
    } catch (error) {
        console.error('Error extracting pose features:', error);
        return null;
    }
}

// Calculate key distances between landmarks
export function calculateKeyDistances(landmarks) {
    const distances = {};
    
    try {
        distances.shoulder_width = calculateDistance(landmarks[11], landmarks[12]);
        distances.hip_width = calculateDistance(landmarks[23], landmarks[24]);
        distances.torso_height = calculateDistance(
            {x: (landmarks[11].x + landmarks[12].x) / 2, y: (landmarks[11].y + landmarks[12].y) / 2},
            {x: (landmarks[23].x + landmarks[24].x) / 2, y: (landmarks[23].y + landmarks[24].y) / 2}
        );
        distances.arm_length_left = calculateDistance(landmarks[11], landmarks[13]) + 
                                   calculateDistance(landmarks[13], landmarks[15]);
        distances.arm_length_right = calculateDistance(landmarks[12], landmarks[14]) + 
                                    calculateDistance(landmarks[14], landmarks[16]);
        
    } catch (error) {
        console.error('Error calculating key distances:', error);
    }
    
    return distances;
}

// Calculate mathematical features (statistical measures)
export function calculateMathematicalFeatures(landmarks) {
    const mathFeatures = {};
    
    try {
        const visiblePoints = landmarks.filter(l => l.visibility > 0.5);
        
        if (visiblePoints.length > 0) {
            // Basic statistics
            const xs = visiblePoints.map(p => p.x);
            const ys = visiblePoints.map(p => p.y);
            const zs = visiblePoints.filter(p => p.z).map(p => p.z);
            
            mathFeatures.mean_x = xs.reduce((a, b) => a + b, 0) / xs.length;
            mathFeatures.mean_y = ys.reduce((a, b) => a + b, 0) / ys.length;
            mathFeatures.variance_x = calculateVariance(xs);
            mathFeatures.variance_y = calculateVariance(ys);
            
            // Centroid
            mathFeatures.centroid = {
                x: mathFeatures.mean_x,
                y: mathFeatures.mean_y
            };
            
            // Bounding box
            mathFeatures.bounding_box = {
                min_x: Math.min(...xs),
                max_x: Math.max(...xs),
                min_y: Math.min(...ys),
                max_y: Math.max(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
            };
            
            // Additional statistical measures
            mathFeatures.visible_points_count = visiblePoints.length;
            mathFeatures.visibility_score = visiblePoints.reduce((sum, p) => sum + p.visibility, 0) / visiblePoints.length;
        }
        
    } catch (error) {
        console.error('Error calculating mathematical features:', error);
    }
    
    return mathFeatures;
}

// Calculate variance
function calculateVariance(values) {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
}

// Process pose data for each frame
export function processPoseFrame(landmarks) {
    if (!landmarks) return null;
    
    const timestamp = Date.now();
    
    // Initialize analysis start time
    if (!analysisStartTime) {
        analysisStartTime = timestamp;
        secondCount = 0;
        frameCount = 0;
    }
    
    // Calculate current second
    const elapsedSeconds = Math.floor((timestamp - analysisStartTime) / 1000);
    
    // Check if we've moved to a new second
    if (elapsedSeconds > secondCount) {
        // Save current second data and start new second
        if (currentSecondData.length > 0) {
            saveSecondData(secondCount, currentSecondData);
            currentSecondData = [];
        }
        secondCount = elapsedSeconds;
    }
    
    // Extract features for current frame
    const features = extractPoseFeatures(landmarks, timestamp);
    if (features) {
        frameCount++;
        currentSecondData.push(features);
        
        // Add to history (limit to MAX_HISTORY)
        poseDataHistory.push(features);
        if (poseDataHistory.length > MAX_HISTORY) {
            poseDataHistory.shift();
        }
    }
    
    return features;
}

// Save data for a completed second
function saveSecondData(secondNumber, secondData) {
    if (secondData.length === 0) return;
    
    // Calculate aggregated features for the second
    const aggregatedData = aggregateSecondData(secondNumber, secondData);
    
    console.log(`Second ${secondNumber} completed:`, aggregatedData);
    
    // Store for final report
    if (!window.poseAnalysisData) {
        window.poseAnalysisData = {};
    }
    window.poseAnalysisData[`${secondNumber}_second`] = aggregatedData;
}

// Aggregate data for a complete second
function aggregateSecondData(secondNumber, frameData) {
    const aggregated = {
        second_number: secondNumber,
        frame_count: frameData.length,
        timestamp_start: frameData[0].timestamp,
        timestamp_end: frameData[frameData.length - 1].timestamp,
        visible_landmarks: {},
        average_angles: {},
        average_symmetry: {},
        average_balance: {},
        statistical_features: {}
    };
    
    try {
        // Aggregate angles
        const angleSums = {};
        const angleCounts = {};
        
        frameData.forEach(frame => {
            // Visible landmarks (union of all frames)
            Object.assign(aggregated.visible_landmarks, frame.visible_landmarks);
            
            // Angles
            Object.entries(frame.angles).forEach(([angleName, value]) => {
                if (!angleSums[angleName]) {
                    angleSums[angleName] = 0;
                    angleCounts[angleName] = 0;
                }
                angleSums[angleName] += value;
                angleCounts[angleName]++;
            });
            
            // Symmetry
            Object.entries(frame.symmetry).forEach(([symName, value]) => {
                if (!aggregated.average_symmetry[symName]) {
                    aggregated.average_symmetry[symName] = 0;
                }
                aggregated.average_symmetry[symName] += value;
            });
            
            // Balance
            Object.entries(frame.balance).forEach(([balanceName, value]) => {
                if (!aggregated.average_balance[balanceName]) {
                    aggregated.average_balance[balanceName] = 0;
                }
                aggregated.average_balance[balanceName] += value;
            });
        });
        
        // Calculate averages
        Object.entries(angleSums).forEach(([angleName, sum]) => {
            aggregated.average_angles[angleName] = sum / angleCounts[angleName];
        });
        
        Object.keys(aggregated.average_symmetry).forEach(symName => {
            aggregated.average_symmetry[symName] /= frameData.length;
        });
        
        Object.keys(aggregated.average_balance).forEach(balanceName => {
            aggregated.average_balance[balanceName] /= frameData.length;
        });
        
        // Statistical features from the last frame
        if (frameData.length > 0) {
            const lastFrame = frameData[frameData.length - 1];
            aggregated.statistical_features = lastFrame.mathematical_features;
            aggregated.torso_stability = lastFrame.torso_stability;
        }
        
    } catch (error) {
        console.error('Error aggregating second data:', error);
    }
    
    return aggregated;
}

// Get complete analysis data
export function getCompleteAnalysisData() {
    // Save any remaining data for current second
    if (currentSecondData.length > 0) {
        saveSecondData(secondCount, currentSecondData);
    }
    
    return window.poseAnalysisData || {};
}

// Check if analysis duration is complete
export function isAnalysisDurationComplete(selectedDuration) {
    if (!analysisStartTime) return false;
    
    const elapsedSeconds = Math.floor((Date.now() - analysisStartTime) / 1000);
    return elapsedSeconds >= selectedDuration;
}

// Get current analysis progress
export function getAnalysisProgress(selectedDuration) {
    if (!analysisStartTime) return 0;
    
    const elapsedSeconds = (Date.now() - analysisStartTime) / 1000;
    return Math.min(100, (elapsedSeconds / selectedDuration) * 100);
}

export {
    poseDataHistory,
    currentSecondData,
    analysisStartTime,
    frameCount,
    secondCount
};