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
  type: 'segmentation' | 'background_removal' | 'object_detection';
}

export interface ProcessingResult {
  success: boolean;
  imageData?: ImageData;
  canvas?: HTMLCanvasElement;
  error?: string;
  processingTime: number;
  detectedObjects?: DetectedObject[];
}

export interface AIServiceResponse {
  success: boolean;
  data?: ArrayBuffer | Blob;
  error?: string;
  processingId?: string;
  detectedObjects?: DetectedObject[];
}

export interface ProcessingQueue {
  id: string;
  type: 'smart_remove' | 'background_removal' | 'segmentation' | 'object_detection';
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
  detectedObjects?: DetectedObject[];
  selectedObjectId?: string;
}

export interface DetectedObject {
  id: string;
  label: string;
  confidence: number;
  bbox: BoundingBox;
  mask?: number[][];
  segmentationMask?: ImageData;
  color: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HuggingFaceModel {
  id: string;
  name: string;
  type: 'segformer' | 'detr' | 'mask2former' | 'sam';
  endpoint: string;
  description: string;
  bestFor: string[];
}