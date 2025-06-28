import { useState, useCallback, useRef } from 'react';
import AIProcessingService from '../services/ai-processing';
import { ProcessingProgress, ProcessingResult, Point, DetectedObject } from '../types/ai-processing';

export const useAIProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  
  const processingIdRef = useRef<string | null>(null);
  const aiService = AIProcessingService.getInstance();

  const detectObjects = useCallback(async (
    imageData: ImageData,
    clickPoint?: Point
  ): Promise<DetectedObject[]> => {
    if (isDetecting || isProcessing) {
      console.warn('Detection already in progress');
      return [];
    }

    setIsDetecting(true);
    setError(null);

    try {
      const objects = await aiService.detectObjects(
        imageData,
        clickPoint,
        (progressUpdate) => {
          setProgress(progressUpdate);
        }
      );

      setDetectedObjects(objects);
      return objects;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Object detection failed';
      setError(errorMessage);
      return [];
    } finally {
      setIsDetecting(false);
      setProgress(null);
    }
  }, [isDetecting, isProcessing, aiService]);

  const processSmartRemoval = useCallback(async (
    imageData: ImageData,
    maskPoints: Point[],
    selectedObject?: DetectedObject
  ): Promise<ProcessingResult | null> => {
    if (isProcessing) {
      console.warn('Processing already in progress');
      return null;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      const result = await aiService.processSmartRemoval(
        imageData,
        maskPoints,
        selectedObject,
        (progressUpdate) => {
          setProgress(progressUpdate);
        }
      );

      setResult(result);
      
      if (!result.success) {
        setError(result.error || 'Processing failed');
      }

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        processingTime: 0
      };
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [isProcessing, aiService]);

  const cancelProcessing = useCallback(() => {
    if (processingIdRef.current) {
      aiService.cancelProcessing(processingIdRef.current);
      setIsProcessing(false);
      setIsDetecting(false);
      setProgress(null);
      setError('Processing cancelled by user');
    }
  }, [aiService]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  const clearDetectedObjects = useCallback(() => {
    setDetectedObjects([]);
  }, []);

  const selectObject = useCallback((objectId: string) => {
    const selectedObj = detectedObjects.find(obj => obj.id === objectId);
    return selectedObj || null;
  }, [detectedObjects]);

  return {
    isProcessing,
    isDetecting,
    progress,
    error,
    result,
    detectedObjects,
    detectObjects,
    processSmartRemoval,
    cancelProcessing,
    clearError,
    clearResult,
    clearDetectedObjects,
    selectObject,
    memoryUsage: aiService.getMemoryUsage(),
    availableModels: aiService.getAvailableModels()
  };
};