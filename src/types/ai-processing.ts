export interface ProcessingProgress {
  stage: string;
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

export interface AIModelConfig {
  name: string;
  endpoint: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  supportedFormats: string[];
}

export interface ProcessingResult {
  success: boolean;
  imageData?: ImageData;
  canvas?: HTMLCanvasElement;
  error?: string;
  processingTime: number;
}

export interface AIServiceResponse {
  success: boolean;
  data?: ArrayBuffer | Blob;
  error?: string;
  processingId?: string;
}

export interface ProcessingQueue {
  id: string;
  type: 'smart_remove' | 'background_removal' | 'segmentation';
  imageData: ImageData;
  maskPoints: Point[];
  priority: number;
  timestamp: number;
  retryCount: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Selection {
  points: Point[];
  isComplete: boolean;
}