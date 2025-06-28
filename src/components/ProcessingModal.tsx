import React from 'react';
import { X, AlertTriangle, Cpu, Zap } from 'lucide-react';
import { ProcessingProgress } from '../types/ai-processing';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: ProcessingProgress | null;
  onCancel: () => void;
  memoryUsage: number;
}

const ProcessingModal: React.FC<ProcessingModalProps> = ({
  isOpen,
  progress,
  onCancel,
  memoryUsage
}) => {
  if (!isOpen) return null;

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'initialization':
      case 'preparation':
        return <Cpu className="w-5 h-5 text-blue-400" />;
      case 'ai_processing':
        return <Zap className="w-5 h-5 text-purple-400" />;
      case 'local_processing':
      case 'fallback':
        return <Cpu className="w-5 h-5 text-cyan-400" />;
      default:
        return <Cpu className="w-5 h-5 text-gray-400" />;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress < 30) return 'bg-blue-500';
    if (progress < 70) return 'bg-purple-500';
    return 'bg-green-500';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">AI Processing</h3>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Progress Section */}
        {progress && (
          <div className="space-y-4">
            {/* Stage Indicator */}
            <div className="flex items-center gap-3">
              {getStageIcon(progress.stage)}
              <div className="flex-1">
                <p className="text-white font-medium capitalize">
                  {progress.stage.replace('_', ' ')}
                </p>
                <p className="text-sm text-gray-400">{progress.message}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Progress</span>
                <span className="text-white">{Math.round(progress.progress)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(progress.progress)}`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>

            {/* Time Estimate */}
            {progress.estimatedTimeRemaining && (
              <div className="text-sm text-gray-400">
                Estimated time remaining: {Math.round(progress.estimatedTimeRemaining / 1000)}s
              </div>
            )}
          </div>
        )}

        {/* Memory Usage Warning */}
        {memoryUsage > 400 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-medium text-sm">High Memory Usage</p>
              <p className="text-yellow-300 text-xs mt-1">
                Memory usage: {Math.round(memoryUsage)}MB. Consider closing other tabs if processing fails.
              </p>
            </div>
          </div>
        )}

        {/* Processing Info */}
        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-2">Processing Pipeline</h4>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>AI-powered background removal (U2Net, DeepLab, RemBG)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
              <span>Advanced local processing (fallback)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Edge smoothing and optimization</span>
            </div>
          </div>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="w-full mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Cancel Processing
        </button>
      </div>
    </div>
  );
};

export default ProcessingModal;