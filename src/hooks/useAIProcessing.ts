import { useState, useCallback, useRef } from 'react';
import AIProcessingService from '../services/ai-processing';
import { ProcessingProgress, ProcessingResult, Point } from '../types/ai-processing';

export const useAIProcessing = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  
  const processingIdRef = useRef<string | null>(null);
  const aiService = AIProcessingService.getInstance();

  const processSmartRemoval = useCallback(async (
    imageData: ImageData,
    maskPoints: Point[]
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

  return {
    isProcessing,
    progress,
    error,
    result,
    processSmartRemoval,
    cancelProcessing,
    clearError,
    clearResult,
    memoryUsage: aiService.getMemoryUsage()
  };
};