import { AIModelConfig, AIServiceResponse, ProcessingProgress, ProcessingResult, Point, DetectedObject, HuggingFaceModel } from '../types/ai-processing';

class AIProcessingService {
  private static instance: AIProcessingService;
  private processingQueue: Map<string, AbortController> = new Map();
  private memoryUsage: number = 0;
  private readonly MAX_MEMORY_MB = 512;
  private readonly CHUNK_SIZE = 1024 * 1024;

  // Hugging Face Models Configuration
  private readonly HUGGINGFACE_MODELS: Record<string, HuggingFaceModel> = {
    segformer: {
      id: 'nvidia/segformer-b1-finetuned-cityscapes-1024-1024',
      name: 'SegFormer B1',
      type: 'segformer',
      endpoint: '/api/ai/huggingface/segformer',
      description: 'Efficient semantic segmentation with Transformer architecture',
      bestFor: ['general objects', 'urban scenes', 'background removal']
    },
    detr_panoptic: {
      id: 'facebook/detr-resnet-50-panoptic',
      name: 'DETR Panoptic',
      type: 'detr',
      endpoint: '/api/ai/huggingface/detr-panoptic',
      description: 'Object detection and panoptic segmentation',
      bestFor: ['multiple objects', 'complex scenes', 'instance segmentation']
    },
    mask2former: {
      id: 'facebook/mask2former-swin-tiny-ade-semantic',
      name: 'Mask2Former',
      type: 'mask2former',
      endpoint: '/api/ai/huggingface/mask2former',
      description: 'State-of-the-art panoptic segmentation',
      bestFor: ['high precision', 'detailed masks', 'complex objects']
    },
    sam: {
      id: 'facebook/sam-vit-base',
      name: 'Segment Anything Model',
      type: 'sam',
      endpoint: '/api/ai/huggingface/sam',
      description: 'Universal segmentation model for any object',
      bestFor: ['point prompts', 'any object', 'interactive segmentation']
    }
  };

  // Legacy AI Models
  private readonly AI_MODELS: Record<string, AIModelConfig> = {
    u2net: {
      name: 'U2Net Background Removal',
      endpoint: '/api/ai/u2net',
      timeout: 30000,
      maxRetries: 3,
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      type: 'background_removal'
    },
    deeplab: {
      name: 'DeepLab Semantic Segmentation',
      endpoint: '/api/ai/deeplab',
      timeout: 45000,
      maxRetries: 2,
      supportedFormats: ['image/jpeg', 'image/png'],
      type: 'segmentation'
    },
    rembg: {
      name: 'RemBG Background Removal',
      endpoint: '/api/ai/rembg',
      timeout: 25000,
      maxRetries: 3,
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      type: 'background_removal'
    }
  };

  public static getInstance(): AIProcessingService {
    if (!AIProcessingService.instance) {
      AIProcessingService.instance = new AIProcessingService();
    }
    return AIProcessingService.instance;
  }

  private constructor() {
    this.startMemoryMonitoring();
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      if ('memory' in performance) {
        const memInfo = (performance as any).memory;
        this.memoryUsage = memInfo.usedJSHeapSize / (1024 * 1024);
        
        if (this.memoryUsage > this.MAX_MEMORY_MB) {
          console.warn('High memory usage detected, triggering cleanup');
          this.forceGarbageCollection();
        }
      }
    }, 5000);
  }

  private forceGarbageCollection(): void {
    this.processingQueue.forEach((controller, id) => {
      if (controller.signal.aborted) {
        this.processingQueue.delete(id);
      }
    });

    if ('gc' in window) {
      (window as any).gc();
    }
  }

  public async detectObjects(
    imageData: ImageData,
    clickPoint?: Point,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<DetectedObject[]> {
    const processingId = `object_detection_${Date.now()}`;
    const abortController = new AbortController();
    this.processingQueue.set(processingId, abortController);

    try {
      onProgress?.({
        stage: 'initialization',
        progress: 0,
        message: 'Initializing object detection...'
      });

      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      // Try Hugging Face models first
      const detectedObjects = await this.tryHuggingFaceDetection(
        blob, 
        clickPoint, 
        onProgress, 
        abortController.signal
      );

      if (detectedObjects.length > 0) {
        return detectedObjects;
      }

      // Fallback to local object detection
      return await this.fallbackObjectDetection(imageData, clickPoint);

    } catch (error) {
      console.error('Object detection failed:', error);
      return [];
    } finally {
      this.processingQueue.delete(processingId);
    }
  }

  private async tryHuggingFaceDetection(
    imageBlob: Blob,
    clickPoint?: Point,
    onProgress?: (progress: ProcessingProgress) => void,
    signal?: AbortSignal
  ): Promise<DetectedObject[]> {
    // Try different models based on use case
    const models = clickPoint 
      ? ['sam', 'mask2former', 'detr_panoptic'] // Point-based detection
      : ['detr_panoptic', 'mask2former', 'segformer']; // General detection

    for (const modelKey of models) {
      if (signal?.aborted) break;

      const model = this.HUGGINGFACE_MODELS[modelKey];
      onProgress?.({
        stage: 'ai_processing',
        progress: 30,
        message: `Detecting objects with ${model.name}...`
      });

      try {
        const result = await this.callHuggingFaceService(model, imageBlob, clickPoint, signal);
        if (result.success && result.detectedObjects) {
          return result.detectedObjects;
        }
      } catch (error) {
        console.warn(`${model.name} detection failed:`, error);
        continue;
      }
    }

    return [];
  }

  private async callHuggingFaceService(
    model: HuggingFaceModel,
    imageBlob: Blob,
    clickPoint?: Point,
    signal?: AbortSignal
  ): Promise<AIServiceResponse> {
    const formData = new FormData();
    formData.append('image', imageBlob);
    formData.append('model_id', model.id);
    formData.append('model_type', model.type);
    
    if (clickPoint) {
      formData.append('click_point', JSON.stringify(clickPoint));
    }

    try {
      const response = await fetch(model.endpoint, {
        method: 'POST',
        body: formData,
        signal,
        headers: {
          'X-API-Key': import.meta.env.VITE_HUGGINGFACE_API_KEY || '',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Parse Hugging Face response format
      const detectedObjects = this.parseHuggingFaceResponse(result, model.type);
      
      return { 
        success: true, 
        detectedObjects 
      };

    } catch (error) {
      throw error;
    }
  }

  private parseHuggingFaceResponse(response: any, modelType: string): DetectedObject[] {
    const objects: DetectedObject[] = [];
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

    switch (modelType) {
      case 'detr':
        if (response.predictions) {
          response.predictions.forEach((pred: any, index: number) => {
            objects.push({
              id: `detr_${index}`,
              label: pred.label,
              confidence: pred.score,
              bbox: {
                x: pred.box.xmin,
                y: pred.box.ymin,
                width: pred.box.xmax - pred.box.xmin,
                height: pred.box.ymax - pred.box.ymin
              },
              color: colors[index % colors.length]
            });
          });
        }
        break;

      case 'segformer':
      case 'mask2former':
        if (response.segments) {
          response.segments.forEach((segment: any, index: number) => {
            objects.push({
              id: `${modelType}_${index}`,
              label: segment.label,
              confidence: segment.score || 0.8,
              bbox: segment.bbox || { x: 0, y: 0, width: 100, height: 100 },
              mask: segment.mask,
              color: colors[index % colors.length]
            });
          });
        }
        break;

      case 'sam':
        if (response.masks) {
          response.masks.forEach((mask: any, index: number) => {
            objects.push({
              id: `sam_${index}`,
              label: 'Detected Object',
              confidence: mask.score || 0.9,
              bbox: mask.bbox,
              mask: mask.segmentation,
              color: colors[index % colors.length]
            });
          });
        }
        break;
    }

    return objects;
  }

  private async fallbackObjectDetection(imageData: ImageData, clickPoint?: Point): Promise<DetectedObject[]> {
    // Simple edge-based object detection as fallback
    if (!clickPoint) return [];

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    // Simple flood fill to detect connected regions
    const visited = new Set<string>();
    const region = this.floodFill(imageData, clickPoint.x, clickPoint.y, visited);

    if (region.length > 100) { // Minimum region size
      const bbox = this.calculateBoundingBox(region);
      return [{
        id: 'fallback_0',
        label: 'Detected Region',
        confidence: 0.7,
        bbox,
        color: '#FF6B6B'
      }];
    }

    return [];
  }

  private floodFill(imageData: ImageData, startX: number, startY: number, visited: Set<string>): Point[] {
    const region: Point[] = [];
    const stack: Point[] = [{ x: startX, y: startY }];
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Get reference color
    const refIndex = (startY * width + startX) * 4;
    const refR = data[refIndex];
    const refG = data[refIndex + 1];
    const refB = data[refIndex + 2];

    while (stack.length > 0 && region.length < 10000) { // Limit region size
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }

      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      // Color similarity threshold
      const colorDiff = Math.abs(r - refR) + Math.abs(g - refG) + Math.abs(b - refB);
      if (colorDiff > 50) continue;

      visited.add(key);
      region.push({ x, y });

      // Add neighbors
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    return region;
  }

  private calculateBoundingBox(points: Point[]): { x: number; y: number; width: number; height: number } {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  public async processSmartRemoval(
    imageData: ImageData,
    maskPoints: Point[],
    selectedObject?: DetectedObject,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult> {
    const processingId = `smart_remove_${Date.now()}`;
    const abortController = new AbortController();
    this.processingQueue.set(processingId, abortController);

    try {
      onProgress?.({
        stage: 'initialization',
        progress: 0,
        message: 'Initializing AI-powered removal...'
      });

      if (this.memoryUsage > this.MAX_MEMORY_MB * 0.8) {
        throw new Error('Insufficient memory for processing. Please close other tabs and try again.');
      }

      // Try Hugging Face models for removal
      if (selectedObject) {
        const hfResult = await this.tryHuggingFaceRemoval(
          imageData, 
          selectedObject, 
          onProgress, 
          abortController.signal
        );
        if (hfResult.success) {
          return hfResult;
        }
      }

      // Try legacy AI models
      const aiResult = await this.tryAIRemoval(imageData, maskPoints, onProgress, abortController.signal);
      if (aiResult.success) {
        return aiResult;
      }

      // Fallback to advanced local processing
      onProgress?.({
        stage: 'fallback',
        progress: 50,
        message: 'AI service unavailable, using advanced local processing...'
      });

      return await this.advancedLocalRemoval(imageData, maskPoints, onProgress, abortController.signal);

    } catch (error) {
      console.error('Smart removal failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: 0
      };
    } finally {
      this.processingQueue.delete(processingId);
    }
  }

  private async tryHuggingFaceRemoval(
    imageData: ImageData,
    selectedObject: DetectedObject,
    onProgress?: (progress: ProcessingProgress) => void,
    signal?: AbortSignal
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      onProgress?.({
        stage: 'ai_processing',
        progress: 40,
        message: 'Processing with Hugging Face inpainting models...'
      });

      // Use inpainting endpoint
      const formData = new FormData();
      formData.append('image', blob);
      formData.append('object_data', JSON.stringify(selectedObject));
      formData.append('task', 'inpainting');

      const response = await fetch('/api/ai/huggingface/inpainting', {
        method: 'POST',
        body: formData,
        signal,
        headers: {
          'X-API-Key': import.meta.env.VITE_HUGGINGFACE_API_KEY || '',
        }
      });

      if (response.ok) {
        const resultBlob = await response.blob();
        const processedCanvas = await this.blobToCanvas(resultBlob);
        
        return {
          success: true,
          canvas: processedCanvas,
          processingTime: Date.now() - startTime
        };
      }

      throw new Error('Hugging Face inpainting failed');

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hugging Face processing failed',
        processingTime: Date.now() - startTime
      };
    }
  }

  private async blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load processed image'));
      img.src = URL.createObjectURL(blob);
    });
  }

  private async tryAIRemoval(
    imageData: ImageData,
    maskPoints: Point[],
    onProgress?: (progress: ProcessingProgress) => void,
    signal?: AbortSignal
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);

      onProgress?.({
        stage: 'preparation',
        progress: 10,
        message: 'Preparing image for AI processing...'
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      const models = ['rembg', 'u2net', 'deeplab'];
      
      for (const modelKey of models) {
        if (signal?.aborted) throw new Error('Processing cancelled');

        const model = this.AI_MODELS[modelKey];
        onProgress?.({
          stage: 'ai_processing',
          progress: 30,
          message: `Trying ${model.name}...`
        });

        try {
          const result = await this.callAIService(model, blob, maskPoints, signal);
          if (result.success && result.data) {
            onProgress?.({
              stage: 'finalization',
              progress: 90,
              message: 'Finalizing AI results...'
            });

            const processedCanvas = await this.processAIResponse(result.data);
            return {
              success: true,
              canvas: processedCanvas,
              processingTime: Date.now() - startTime
            };
          }
        } catch (modelError) {
          console.warn(`${model.name} failed:`, modelError);
          continue;
        }
      }

      throw new Error('All AI models failed or are unavailable');

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI processing failed',
        processingTime: Date.now() - startTime
      };
    }
  }

  private async callAIService(
    model: AIModelConfig,
    imageBlob: Blob,
    maskPoints: Point[],
    signal?: AbortSignal
  ): Promise<AIServiceResponse> {
    const formData = new FormData();
    formData.append('image', imageBlob);
    formData.append('mask_points', JSON.stringify(maskPoints));
    formData.append('model', model.name);

    let retryCount = 0;
    
    while (retryCount < model.maxRetries) {
      try {
        const response = await fetch(model.endpoint, {
          method: 'POST',
          body: formData,
          signal,
          headers: {
            'X-API-Key': model.apiKey || '',
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.arrayBuffer();
        return { success: true, data };

      } catch (error) {
        retryCount++;
        if (retryCount >= model.maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    throw new Error(`Failed after ${model.maxRetries} retries`);
  }

  private async processAIResponse(data: ArrayBuffer): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([data], { type: 'image/png' });
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      
      img.onerror = () => reject(new Error('Failed to process AI response'));
      img.src = URL.createObjectURL(blob);
    });
  }

  private async advancedLocalRemoval(
    imageData: ImageData,
    maskPoints: Point[],
    onProgress?: (progress: ProcessingProgress) => void,
    signal?: AbortSignal
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);

      const chunks = this.createProcessingChunks(imageData, maskPoints);
      
      for (let i = 0; i < chunks.length; i++) {
        if (signal?.aborted) throw new Error('Processing cancelled');

        onProgress?.({
          stage: 'local_processing',
          progress: 60 + (i / chunks.length) * 30,
          message: `Processing chunk ${i + 1} of ${chunks.length}...`
        });

        await this.processChunk(ctx, chunks[i]);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      onProgress?.({
        stage: 'completion',
        progress: 100,
        message: 'Processing complete!'
      });

      return {
        success: true,
        canvas,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Local processing failed',
        processingTime: Date.now() - startTime
      };
    }
  }

  private createProcessingChunks(imageData: ImageData, maskPoints: Point[]): any[] {
    const chunkSize = 100;
    const chunks = [];
    
    for (let y = 0; y < imageData.height; y += chunkSize) {
      for (let x = 0; x < imageData.width; x += chunkSize) {
        chunks.push({
          x,
          y,
          width: Math.min(chunkSize, imageData.width - x),
          height: Math.min(chunkSize, imageData.height - y),
          maskPoints
        });
      }
    }
    
    return chunks;
  }

  private async processChunk(ctx: CanvasRenderingContext2D, chunk: any): Promise<void> {
    const imageData = ctx.getImageData(chunk.x, chunk.y, chunk.width, chunk.height);
    const data = imageData.data;
    
    this.applyContentAwareFill(data, chunk.width, chunk.height, chunk.maskPoints);
    
    ctx.putImageData(imageData, chunk.x, chunk.y);
  }

  private applyContentAwareFill(data: Uint8ClampedArray, width: number, height: number, maskPoints: Point[]): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        const samples = this.sampleSurroundingPixels(data, x, y, width, height);
        if (samples.length > 0) {
          const avg = this.calculateWeightedAverage(samples);
          data[idx] = avg.r;
          data[idx + 1] = avg.g;
          data[idx + 2] = avg.b;
          data[idx + 3] = avg.a;
        }
      }
    }
  }

  private sampleSurroundingPixels(data: Uint8ClampedArray, x: number, y: number, width: number, height: number): any[] {
    const samples = [];
    const radius = 5;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = (ny * width + nx) * 4;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const weight = 1 / (1 + distance);
          
          samples.push({
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: data[idx + 3],
            weight
          });
        }
      }
    }
    
    return samples;
  }

  private calculateWeightedAverage(samples: any[]): { r: number; g: number; b: number; a: number } {
    let totalWeight = 0;
    let r = 0, g = 0, b = 0, a = 0;
    
    samples.forEach(sample => {
      r += sample.r * sample.weight;
      g += sample.g * sample.weight;
      b += sample.b * sample.weight;
      a += sample.a * sample.weight;
      totalWeight += sample.weight;
    });
    
    return {
      r: Math.round(r / totalWeight),
      g: Math.round(g / totalWeight),
      b: Math.round(b / totalWeight),
      a: Math.round(a / totalWeight)
    };
  }

  public cancelProcessing(processingId: string): void {
    const controller = this.processingQueue.get(processingId);
    if (controller) {
      controller.abort();
      this.processingQueue.delete(processingId);
    }
  }

  public getMemoryUsage(): number {
    return this.memoryUsage;
  }

  public getAvailableModels(): { huggingface: HuggingFaceModel[]; legacy: AIModelConfig[] } {
    return {
      huggingface: Object.values(this.HUGGINGFACE_MODELS),
      legacy: Object.values(this.AI_MODELS)
    };
  }

  public cleanup(): void {
    this.processingQueue.forEach(controller => controller.abort());
    this.processingQueue.clear();
    this.forceGarbageCollection();
  }
}

export default AIProcessingService;