import { DeviceMotion, DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useState } from 'react';

export interface TiltData {
  x: number; // Pitch (forward/backward tilt) -1 to 1
  y: number; // Roll (left/right tilt) -1 to 1
  z: number; // Yaw (rotation) -1 to 1
}

export interface MotionConfig {
  updateInterval: number; // milliseconds
  sensitivity: number; // 0.1 to 2.0 (multiplier for tilt effects)
  smoothing: number; // 0.1 to 0.9 (higher = more smoothing)
}

const DEFAULT_CONFIG: MotionConfig = {
  updateInterval: 16, // ~60fps
  sensitivity: 1.0,
  smoothing: 0.7,
};

class DeviceMotionService {
  private subscription: any = null;
  private listeners: ((tilt: TiltData) => void)[] = [];
  private currentTilt: TiltData = { x: 0, y: 0, z: 0 };
  private smoothedTilt: TiltData = { x: 0, y: 0, z: 0 };
  private config: MotionConfig = DEFAULT_CONFIG;
  private isAvailable = false;

  async initialize(config?: Partial<MotionConfig>): Promise<boolean> {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    try {
      this.isAvailable = await DeviceMotion.isAvailableAsync();
      
      if (!this.isAvailable) {
        console.warn('DeviceMotion not available on this device');
        return false;
      }

      DeviceMotion.setUpdateInterval(this.config.updateInterval);
      return true;
    } catch (error) {
      console.error('Failed to initialize DeviceMotion:', error);
      return false;
    }
  }

  startListening(): void {
    if (!this.isAvailable || this.subscription) return;

    this.subscription = DeviceMotion.addListener((motionData: DeviceMotionMeasurement) => {
      this.processMotionData(motionData);
    });
  }

  stopListening(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  private processMotionData(data: DeviceMotionMeasurement): void {
    if (!data.rotation) return;

    // Convert rotation data to normalized tilt values (-1 to 1)
    const rawTilt: TiltData = {
      x: this.clampAndScale(data.rotation.beta || 0, Math.PI / 4), // Pitch
      y: this.clampAndScale(data.rotation.gamma || 0, Math.PI / 4), // Roll
      z: this.clampAndScale(data.rotation.alpha || 0, Math.PI), // Yaw
    };

    // Apply sensitivity multiplier
    rawTilt.x *= this.config.sensitivity;
    rawTilt.y *= this.config.sensitivity;
    rawTilt.z *= this.config.sensitivity;

    // Apply smoothing filter
    this.smoothedTilt = {
      x: this.lerp(this.smoothedTilt.x, rawTilt.x, 1 - this.config.smoothing),
      y: this.lerp(this.smoothedTilt.y, rawTilt.y, 1 - this.config.smoothing),
      z: this.lerp(this.smoothedTilt.z, rawTilt.z, 1 - this.config.smoothing),
    };

    this.currentTilt = this.smoothedTilt;
    this.notifyListeners();
  }

  private clampAndScale(value: number, maxRadians: number): number {
    // Clamp to max range and normalize to -1 to 1
    const clamped = Math.max(-maxRadians, Math.min(maxRadians, value));
    return clamped / maxRadians;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentTilt));
  }

  addListener(callback: (tilt: TiltData) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getCurrentTilt(): TiltData {
    return { ...this.currentTilt };
  }

  updateConfig(config: Partial<MotionConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.subscription) {
      DeviceMotion.setUpdateInterval(this.config.updateInterval);
    }
  }

  getIsAvailable(): boolean {
    return this.isAvailable;
  }
}

// Singleton instance
export const deviceMotionService = new DeviceMotionService();

// React hook for easy component integration
export function useDeviceMotion(config?: Partial<MotionConfig>): {
  tilt: TiltData;
  isAvailable: boolean;
  isListening: boolean;
} {
  const [tilt, setTilt] = useState<TiltData>({ x: 0, y: 0, z: 0 });
  const [isAvailable, setIsAvailable] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeMotion = async () => {
      const available = await deviceMotionService.initialize(config);
      setIsAvailable(available);

      if (available) {
        unsubscribe = deviceMotionService.addListener(setTilt);
        deviceMotionService.startListening();
        setIsListening(true);
      }
    };

    initializeMotion();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      deviceMotionService.stopListening();
      setIsListening(false);
    };
  }, []);

  return { tilt, isAvailable, isListening };
}
