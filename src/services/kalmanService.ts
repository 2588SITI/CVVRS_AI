/**
 * Kalman Filter implementation for smoothing locomotive speed detections.
 * Reconciles noisy digital OCR data and needle angle observations.
 */

export interface KalmanState {
  speed: number;       // Estmated speed (km/h)
  uncertainty: number; // Estimation error covariance
}

export class LocoSpeedKalmanFilter {
  private state: KalmanState;
  private processNoise: number;    // Q: How much we expect speed to change naturally
  private measurementNoise: number; // R: Confidence in the sensor/observation

  constructor(initialSpeed = 0, initialUncertainty = 10) {
    this.state = {
      speed: initialSpeed,
      uncertainty: initialUncertainty,
    };
    // Adjust these parameters based on locomotive dynamics
    this.processNoise = 0.5;    // Locomotive speed doesn't jump instantly
    this.measurementNoise = 2.0; // Measurement noise (higher = more smoothing)
  }

  /**
   * Predict the next state (Time Update)
   */
  predict(): void {
    // x = x (assuming constant velocity over short interval if no acceleration model)
    // p = p + Q
    this.state.uncertainty += this.processNoise;
  }

  /**
   * Update state with a new measurement (Measurement Update)
   * @param z Measured speed from sensor (e.g. OCR or Needle Angle)
   * @param specificNoise Optional specific noise for this source (e.g., OCR is more reliable than Needle)
   */
  update(z: number, specificNoise?: number): void {
    const r = specificNoise ?? this.measurementNoise;

    // Kalman Gain: K = p / (p + r)
    const k = this.state.uncertainty / (this.state.uncertainty + r);

    // Update estimation: x = x + K * (z - x)
    this.state.speed += k * (z - this.state.speed);

    // Update uncertainty: p = (1 - K) * p
    this.state.uncertainty = (1 - k) * this.state.uncertainty;
  }

  getSpeed(): number {
    return Math.max(0, this.state.speed);
  }

  getState(): KalmanState {
    return { ...this.state };
  }

  /**
   * Static helper to reconcile multiple speed inputs using a Kalman approach.
   * @param observations List of observations from different sensors
   */
  static reconcileSpeed(
    lastSpeed: number,
    analogNeedle: number | null,
    digitalOCR: number | null,
    motionDetected: boolean
  ): number {
    const filter = new LocoSpeedKalmanFilter(lastSpeed);
    
    // Time predict
    filter.predict();

    // Measurement Updates with varying noise (confidence)
    if (analogNeedle !== null) {
      // Needle angle on circular dial is the ULTIMATE TRUTH (highly reliable, R=0.5)
      filter.update(analogNeedle, 0.5);
    }

    if (digitalOCR !== null) {
      // Digital displays are often frozen, lagged, or incorrect (prone to lag/freeze, R=15.0)
      filter.update(digitalOCR, 15.0);
    }

    let finalSpeed = filter.getSpeed();

    // Sanity check: if NO motion detected anywhere, speed is 0
    if (!motionDetected && finalSpeed < 5) {
      return 0;
    }

    // If motion IS detected but speed is near 0 (OCR/Needle registered low or lagged), 
    // predict a slow rolling speed of 5 to 8 km/h (e.g. 6.5 km/h) instead of dropping to 0
    if (motionDetected && finalSpeed < 5) {
      return Math.max(lastSpeed > 0 ? lastSpeed : 6.5, 6.5); // Predict slow crawl of 5 to 8 km/h
    }

    return finalSpeed;
  }
}
