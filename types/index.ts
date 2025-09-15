export interface Vehicle {
  vin: string;
  make: string;
  model: string;
  year: number;
  trim?: string;
  engine?: string;
  bodyStyle?: string;
  drivetrain?: string;
  market?: string;
  steering?: string;
}

export interface RepairTask {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  toolsRequired: Tool[];
  steps: RepairStep[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  required: boolean;
  checked?: boolean;
}

export interface RepairStep {
  id: string;
  stepNumber: number;
  instruction: string;
  toolRequired?: string;
  partName: string;
  audioScript: string;
}

export interface RepairSession {
  id: string;
  vehicleVin: string;
  taskId: string;
  taskName: string;
  startTime: string;
  endTime?: string;
  status: 'in_progress' | 'paused' | 'completed' | 'cancelled';
  currentStepIndex: number;
  stepsCompleted: number;
  totalSteps: number;
  voiceTranscript: VoiceLog[];
  stepLog: string[];
}

export interface VehicleIdentification {
  vin: string;
  year: number;
  make: string;
  model: string;
  engine?: string;
  drivetrain?: string;
}

export interface VoiceLog {
  id: string;
  timestamp: string;
  type: 'user' | 'assistant';
  text: string;
  audioGenerated?: boolean;
  stepIndex?: number;        // Track which step this was for
  repairTask?: string;       // Track which repair this was for
  confidence?: number;       // For speech recognition confidence
}

export interface VoiceCommand {
  id: string;
  timestamp: Date;
  transcription: string;
  confidence: number;
  action?: string;         // Parsed action from command
  parameters?: any;        // Action parameters
  repairTask?: string;       // Track which repair this was for
}

// High-precision coordinate system for overlay parts (0.001 precision)
export interface PrecisionCoordinate {
  x: number; // 0.000 to 1.000 (normalized)
  y: number; // 0.000 to 1.000 (normalized)
}

// Individual part definition within an overlay pack
export interface OverlayPart {
  polygon: PrecisionCoordinate[];
  glow_color: string;
  part_type: string;
  accessibility: 'easy' | 'moderate' | 'difficult';
}

// Animated access path for reaching parts
export interface AccessPath {
  polyline: PrecisionCoordinate[];
  animation_duration: number; // milliseconds
  stroke_width: number;
  dash_pattern: string;
}

// Cutaway layer for hidden parts
export interface OverlayLayer {
  polygon: PrecisionCoordinate[];
  color_tint: string;
  opacity_cutaway: number;
  layer_name: string;
}

// Complete overlay pack for a vehicle family + workspace combination
export interface OverlayPack {
  id: string;
  vehicle_family: string;
  workspace_type: string;
  workspace_svg?: string | null; // Legacy SVG support
  image_url: string; // Direct PNG overlay URL from DALL-E 3
  baseline_dimensions: { width: number; height: number };
  parts: Record<string, OverlayPart>;
  access_paths?: Record<string, AccessPath>;
  layers?: Record<string, OverlayLayer>;
  generated_at: string;
  gpt_model: string;
  usage_count: number;
}

// Vehicle classification for overlay compatibility
export interface VehicleClassification {
  family: string;
  platform: string;
  engine_layout: string;
  body_style: string;
  confidence: number;
}

// Workspace Overlay Renderer Props
export interface WorkspaceRendererProps {
  overlayPack: OverlayPack;
  activePartName: string;
  screenDimensions: {
    width: number;
    height: number;
  };
  cutawayMode?: boolean;
  animationEnabled?: boolean;
}
