// feature.js - MediaPipe Landmark Feature Extraction
class MovementAnalyzer {
    constructor() {
        this.landmarksHistory = [];
        this.maxHistorySize = 90; // 3 seconds at 30fps
    }

    // Add new frame landmarks to history
    addLandmarks(landmarks) {
        this.landmarksHistory.push(landmarks);
        if (this.landmarksHistory.length > this.maxHistorySize) {
            this.landmarksHistory.shift();
        }
    }

    // Calculate angle between three points
    calculateAngle(a, b, c) {
        const ab = [a.x - b.x, a.y - b.y, a.z - b.z];
        const bc = [c.x - b.x, c.y - b.y, c.z - b.z];
        
        const dotProduct = ab[0]*bc[0] + ab[1]*bc[1] + ab[2]*bc[2];
        const magAB = Math.sqrt(ab[0]**2 + ab[1]**2 + ab[2]**2);
        const magBC = Math.sqrt(bc[0]**2 + bc[1]**2 + bc[2]**2);
        
        return Math.acos(dotProduct / (magAB * magBC)) * (180 / Math.PI);
    }

    // Calculate distance between two points
    calculateDistance(a, b) {
        return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2 + (a.z - b.z)**2);
    }

    // Detect visible body regions
    getVisibleRegions(landmarks) {
        const regions = {
            'upper_body': false,
            'lower_body': false,
            'full_body': false
        };

        // Check upper body visibility (shoulders, elbows, wrists)
        const upperBodyPoints = [11, 12, 13, 14, 15, 16]; // shoulders, elbows, wrists
        const upperBodyVisible = upperBodyPoints.every(idx => 
            landmarks[idx] && landmarks[idx].visibility > 0.5
        );

        // Check lower body visibility (hips, knees, ankles)
        const lowerBodyPoints = [23, 24, 25, 26, 27, 28]; // hips, knees, ankles
        const lowerBodyVisible = lowerBodyPoints.every(idx => 
            landmarks[idx] && landmarks[idx].visibility > 0.5
        );

        if (upperBodyVisible && lowerBodyVisible) {
            regions.full_body = true;
        } else if (upperBodyVisible) {
            regions.upper_body = true;
        } else if (lowerBodyVisible) {
            regions.lower_body = true;
        }

        return regions;
    }

    // Count bending movements
    countBendingMovements() {
        if (this.landmarksHistory.length < 10) return { left: 0, right: 0 };

        let leftBendCount = 0;
        let rightBendCount = 0;
        let bendingLeft = false;
        let bendingRight = false;

        const bendingThreshold = 20; // degrees

        for (let i = 5; i < this.landmarksHistory.length - 5; i++) {
            const landmarks = this.landmarksHistory[i];
            
            // Calculate torso lean angle
            const shoulderMid = {
                x: (landmarks[11].x + landmarks[12].x) / 2,
                y: (landmarks[11].y + landmarks[12].y) / 2,
                z: (landmarks[11].z + landmarks[12].z) / 2
            };
            
            const hipMid = {
                x: (landmarks[23].x + landmarks[24].x) / 2,
                y: (landmarks[23].y + landmarks[24].y) / 2,
                z: (landmarks[23].z + landmarks[24].z) / 2
            };

            const verticalReference = { x: shoulderMid.x, y: shoulderMid.y - 1, z: shoulderMid.z };
            const leanAngle = this.calculateAngle(hipMid, shoulderMid, verticalReference);

            // Determine bend direction
            const leftRightBalance = landmarks[11].x - landmarks[12].x;
            
            if (leanAngle > bendingThreshold) {
                if (leftRightBalance > 0.02 && !bendingLeft) {
                    leftBendCount++;
                    bendingLeft = true;
                    bendingRight = false;
                } else if (leftRightBalance < -0.02 && !bendingRight) {
                    rightBendCount++;
                    bendingRight = true;
                    bendingLeft = false;
                }
            } else {
                bendingLeft = false;
                bendingRight = false;
            }
        }

        return { left: leftBendCount, right: rightBendCount };
    }

    // Analyze movement patterns
    analyzeMovementPatterns() {
        const patterns = {
            has_patterns: false,
            is_random: false,
            riskable_movements: [],
            symmetry_score: 0
        };

        if (this.landmarksHistory.length < 30) return patterns;

        // Calculate symmetry between left and right sides
        const leftRightDifferences = [];
        for (let i = 0; i < this.landmarksHistory.length; i++) {
            const landmarks = this.landmarksHistory[i];
            
            // Compare left vs right shoulder, elbow, hip, knee angles
            const leftShoulderAngle = this.calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
            const rightShoulderAngle = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
            
            const leftHipAngle = this.calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
            const rightHipAngle = this.calculateAngle(landmarks[24], landmarks[26], landmarks[28]);

            leftRightDifferences.push(
                Math.abs(leftShoulderAngle - rightShoulderAngle) +
                Math.abs(leftHipAngle - rightHipAngle)
            );
        }

        patterns.symmetry_score = 100 - (leftRightDifferences.reduce((a, b) => a + b, 0) / leftRightDifferences.length);

        // Detect riskable movements
        this.detectRiskableMovements(patterns);

        // Pattern detection (simple periodicity check)
        patterns.has_patterns = this.detectPeriodicMovements();
        patterns.is_random = !patterns.has_patterns && patterns.riskable_movements.length === 0;

        return patterns;
    }

    detectRiskableMovements(patterns) {
        const riskThresholds = {
            extreme_bend: 60, // degrees
            rapid_movement: 0.1, // speed threshold
            asymmetric_load: 30 // angle difference
        };

        for (let i = 1; i < this.landmarksHistory.length; i++) {
            const current = this.landmarksHistory[i];
            const previous = this.landmarksHistory[i-1];

            // Extreme bending detection
            const spineAngle = this.calculateAngle(
                {x: current[23].x, y: current[23].y, z: current[23].z},
                {x: current[11].x, y: current[11].y, z: current[11].z},
                {x: current[11].x, y: current[11].y - 1, z: current[11].z}
            );

            if (spineAngle > riskThresholds.extreme_bend) {
                patterns.riskable_movements.push('extreme_spine_bending');
            }

            // Rapid movement detection
            const movementSpeed = this.calculateDistance(current[0], previous[0]); // Using nose as reference
            if (movementSpeed > riskThresholds.rapid_movement) {
                patterns.riskable_movements.push('rapid_jerky_movements');
            }
        }

        // Remove duplicates
        patterns.riskable_movements = [...new Set(patterns.riskable_movements)];
    }

    detectPeriodicMovements() {
        // Simple periodicity detection using autocorrelation
        const data = this.landmarksHistory.map(l => l[0].y); // Use nose y-position
        
        if (data.length < 10) return false;

        let maxCorrelation = 0;
        for (let lag = 5; lag < 15; lag++) {
            let correlation = 0;
            for (let i = 0; i < data.length - lag; i++) {
                correlation += data[i] * data[i + lag];
            }
            maxCorrelation = Math.max(maxCorrelation, correlation);
        }

        return maxCorrelation > 0.5;
    }

    // Main feature extraction function
    extractFeatures(landmarks) {
        this.addLandmarks(landmarks);

        const visibleRegions = this.getVisibleRegions(landmarks);
        const bendingCounts = this.countBendingMovements();
        const movementPatterns = this.analyzeMovementPatterns();

        return {
            timestamp: new Date().toISOString(),
            visible_regions: visibleRegions,
            movement_counts: {
                left_bends: bendingCounts.left,
                right_bends: bendingCounts.right,
                total_movements: this.landmarksHistory.length
            },
            movement_patterns: movementPatterns,
            joint_angles: {
                left_elbow: this.calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
                right_elbow: this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
                left_knee: this.calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
                right_knee: this.calculateAngle(landmarks[24], landmarks[26], landmarks[28]),
                torso_lean: this.calculateAngle(
                    {x: landmarks[23].x, y: landmarks[23].y, z: landmarks[23].z},
                    {x: landmarks[11].x, y: landmarks[11].y, z: landmarks[11].z},
                    {x: landmarks[11].x, y: landmarks[11].y-1, z: landmarks[11].z}
                )
            },
            stability_metrics: {
                overall_stability: this.calculateStability(),
                symmetry_score: movementPatterns.symmetry_score
            }
        };
    }

    calculateStability() {
        if (this.landmarksHistory.length < 10) return 100;
        
        const centerOfMassMovements = [];
        for (let i = 1; i < this.landmarksHistory.length; i++) {
            const com1 = this.calculateCenterOfMass(this.landmarksHistory[i-1]);
            const com2 = this.calculateCenterOfMass(this.landmarksHistory[i]);
            centerOfMassMovements.push(this.calculateDistance(com1, com2));
        }
        
        const avgMovement = centerOfMassMovements.reduce((a, b) => a + b, 0) / centerOfMassMovements.length;
        return Math.max(0, 100 - (avgMovement * 1000));
    }

    calculateCenterOfMass(landmarks) {
        const keyPoints = [11, 12, 23, 24]; // shoulders and hips
        const com = { x: 0, y: 0, z: 0 };
        
        keyPoints.forEach(idx => {
            com.x += landmarks[idx].x;
            com.y += landmarks[idx].y;
            com.z += landmarks[idx].z;
        });
        
        com.x /= keyPoints.length;
        com.y /= keyPoints.length;
        com.z /= keyPoints.length;
        
        return com;
    }

    // Generate LLM prompt from features
    generateLLMPrompt(features, userContext = {}) {
        return {
            system_prompt: `You are a professional physiotherapist and movement analysis expert. Analyze the movement data and provide a comprehensive report in JSON format.`,
            user_prompt: `
MOVEMENT ANALYSIS DATA:
${JSON.stringify(features, null, 2)}

USER CONTEXT:
${JSON.stringify(userContext, null, 2)}

Generate a comprehensive movement analysis report with the following structure:

1. VISIBLE_BODY_REGIONS: Which body parts were visible and analyzed
2. MOVEMENT_SUMMARY: General movement statistics and counts
3. MOVEMENT_PATTERNS_ANALYSIS: Pattern detection and risk assessment
4. RISK_ASSESSMENT: Specific risky movements and injury probability by body part
5. MEDICAL_INSIGHTS: Potential medical issues related to the movements
6. PHYSICAL_BENEFITS: Positive aspects and benefits of the movements
7. RECOMMENDATIONS: Actionable advice for improvement

Format the response as valid JSON. Be professional, accurate, and supportive.`
        };
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MovementAnalyzer;
}