import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, RotateCcw, Eye, EyeOff, Trash2, Sparkles, Undo2, Wand2, Scissors, AlertCircle } from 'lucide-react';
import { useAIProcessing } from '../hooks/useAIProcessing';
import ProcessingModal from './ProcessingModal';
import { Point, Selection } from '../types/ai-processing';

const MediaEditor: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [selection, setSelection] = useState<Selection>({ points: [], isComplete: false });
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [showOriginal, setShowOriginal] = useState(false);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    isProcessing,
    progress,
    error: processingError,
    result,
    processSmartRemoval,
    cancelProcessing,
    clearError,
    memoryUsage
  } = useAIProcessing();

  const filters = [
    { id: 'none', name: 'Original', icon: Eye },
    { id: 'blur', name: 'Black Mirror Blur', icon: Sparkles },
    { id: 'noise', name: 'Digital Noise', icon: Sparkles },
    { id: 'desaturate', name: 'Dystopian', icon: Sparkles },
    { id: 'smart_remove', name: 'AI Smart Remove', icon: Wand2, isAI: true },
    { id: 'cutout', name: 'Precise Cutout', icon: Scissors },
    { id: 'remove', name: 'Simple Remove', icon: Trash2 },
  ];

  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [uploadedFile]);

  // Handle AI processing result
  useEffect(() => {
    if (result && result.success && result.canvas && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(result.canvas, 0, 0);
      }
    }
  }, [result]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setUploadedFile(file);
      setSelection({ points: [], isComplete: false });
      setActiveFilter('none');
      clearError();
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setUploadedFile(file);
      setSelection({ points: [], isComplete: false });
      setActiveFilter('none');
      clearError();
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current || isDragging || isProcessing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const actualX = clickX * scaleX;
    const actualY = clickY * scaleY;

    const newPoint = { x: actualX, y: actualY };
    const newPoints = [...selection.points, newPoint];

    setSelection({
      points: newPoints,
      isComplete: newPoints.length >= 3
    });
  };

  const handlePointMouseDown = (event: React.MouseEvent, pointIndex: number) => {
    if (isProcessing) return;
    event.stopPropagation();
    setDraggedPointIndex(pointIndex);
    setIsDragging(true);
  };

  const handlePointDoubleClick = (event: React.MouseEvent, pointIndex: number) => {
    if (isProcessing) return;
    event.stopPropagation();
    
    const newPoints = selection.points.filter((_, index) => index !== pointIndex);
    
    setSelection({
      points: newPoints,
      isComplete: newPoints.length >= 3
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draggedPointIndex === null || !canvasRef.current || !isDragging || isProcessing) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const actualX = Math.max(0, Math.min(canvas.width, clickX * scaleX));
    const actualY = Math.max(0, Math.min(canvas.height, clickY * scaleY));

    const newPoints = [...selection.points];
    newPoints[draggedPointIndex] = { x: actualX, y: actualY };

    setSelection({
      points: newPoints,
      isComplete: newPoints.length >= 3
    });
  };

  const handleMouseUp = () => {
    setDraggedPointIndex(null);
    setIsDragging(false);
  };

  const undoLastPoint = () => {
    if (selection.points.length === 0 || isProcessing) return;
    
    const newPoints = selection.points.slice(0, -1);
    setSelection({
      points: newPoints,
      isComplete: newPoints.length >= 3
    });
  };

  const clearSelection = () => {
    if (isProcessing) return;
    setSelection({ points: [], isComplete: false });
  };

  const applyFilter = async (filterId: string) => {
    if (!canvasRef.current || !imageRef.current || isProcessing) return;

    setActiveFilter(filterId);
    clearError();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Store original image data
    if (!originalCanvasRef.current) {
      originalCanvasRef.current = document.createElement('canvas');
      originalCanvasRef.current.width = canvas.width;
      originalCanvasRef.current.height = canvas.height;
      const originalCtx = originalCanvasRef.current.getContext('2d')!;
      originalCtx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }

    // Draw original image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    if (selection.isComplete && filterId !== 'none') {
      if (filterId === 'smart_remove') {
        // Use AI processing service
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          await processSmartRemoval(imageData, selection.points);
        } catch (error) {
          console.error('Smart removal failed:', error);
        }
      } else {
        // Apply other filters with error handling
        try {
          await applyStandardFilter(ctx, filterId);
        } catch (error) {
          console.error('Filter application failed:', error);
        }
      }
    }
  };

  const applyStandardFilter = async (ctx: CanvasRenderingContext2D, filterId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        setTimeout(() => {
          switch (filterId) {
            case 'blur':
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(selection.points[0].x, selection.points[0].y);
              selection.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
              ctx.closePath();
              ctx.clip();
              ctx.filter = 'blur(8px) brightness(0.7) contrast(1.2)';
              ctx.drawImage(imageRef.current!, 0, 0, ctx.canvas.width, ctx.canvas.height);
              ctx.restore();
              break;
              
            case 'noise':
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(selection.points[0].x, selection.points[0].y);
              selection.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
              ctx.closePath();
              ctx.clip();
              ctx.filter = 'contrast(1.5) brightness(0.8) saturate(0.5)';
              ctx.drawImage(imageRef.current!, 0, 0, ctx.canvas.width, ctx.canvas.height);
              
              // Add digital noise effect
              const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * 30;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
              }
              ctx.putImageData(imageData, 0, 0);
              ctx.restore();
              break;
              
            case 'desaturate':
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(selection.points[0].x, selection.points[0].y);
              selection.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
              ctx.closePath();
              ctx.clip();
              ctx.filter = 'grayscale(100%) contrast(1.3) brightness(0.6)';
              ctx.drawImage(imageRef.current!, 0, 0, ctx.canvas.width, ctx.canvas.height);
              ctx.restore();
              break;
              
            case 'cutout':
              createPreciseCutout(ctx, selection.points);
              break;
              
            case 'remove':
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(selection.points[0].x, selection.points[0].y);
              selection.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
              ctx.closePath();
              ctx.fillStyle = '#000';
              ctx.fill();
              ctx.restore();
              break;
          }
          resolve();
        }, 500);
      } catch (error) {
        reject(error);
      }
    });
  };

  const createPreciseCutout = (ctx: CanvasRenderingContext2D, maskPoints: Point[]) => {
    const cutoutCanvas = document.createElement('canvas');
    cutoutCanvas.width = ctx.canvas.width;
    cutoutCanvas.height = ctx.canvas.height;
    const cutoutCtx = cutoutCanvas.getContext('2d')!;
    
    cutoutCtx.drawImage(imageRef.current!, 0, 0, cutoutCanvas.width, cutoutCanvas.height);
    
    cutoutCtx.globalCompositeOperation = 'destination-in';
    cutoutCtx.beginPath();
    cutoutCtx.moveTo(maskPoints[0].x, maskPoints[0].y);
    maskPoints.slice(1).forEach(point => cutoutCtx.lineTo(point.x, point.y));
    cutoutCtx.closePath();
    cutoutCtx.fill();
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(cutoutCanvas, 0, 0);
  };

  const downloadImage = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `edited-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const updateCanvasScale = () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
  };

  useEffect(() => {
    updateCanvasScale();
    window.addEventListener('resize', updateCanvasScale);
    return () => window.removeEventListener('resize', updateCanvasScale);
  }, [imageUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      {/* Processing Modal */}
      <ProcessingModal
        isOpen={isProcessing}
        progress={progress}
        onCancel={cancelProcessing}
        memoryUsage={memoryUsage}
      />

      {/* Header */}
      <div className="bg-black/50 backdrop-blur-lg border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Black Mirror Editor
          </h1>
          <p className="text-gray-400 text-sm mt-1">Advanced AI-powered media manipulation with intelligent algorithms</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Display */}
        {processingError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-red-400 font-medium">Processing Error</h3>
              <p className="text-red-300 text-sm mt-1">{processingError}</p>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-300 text-sm underline mt-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!uploadedFile ? (
          // Upload Area
          <div
            className="border-2 border-dashed border-cyan-500/30 rounded-2xl p-12 text-center hover:border-cyan-400/50 transition-colors duration-300 bg-gradient-to-br from-gray-800/30 to-gray-900/30 backdrop-blur-sm"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="w-16 h-16 mx-auto mb-6 text-cyan-400" />
            <h3 className="text-xl font-semibold mb-3 text-white">Upload Media</h3>
            <p className="text-gray-400 mb-6">Drag and drop an image or video, or click to browse</p>
            <label className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-medium hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 cursor-pointer transform hover:scale-105">
              <Upload className="w-5 h-5 mr-2" />
              Choose File
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          // Editor Interface
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Canvas Area */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">AI-Powered Editor Canvas</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowOriginal(!showOriginal)}
                      disabled={isProcessing}
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                      title={showOriginal ? "Hide Original" : "Show Original"}
                    >
                      {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={undoLastPoint}
                      disabled={selection.points.length === 0 || isProcessing}
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Undo Last Point"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={clearSelection}
                      disabled={isProcessing}
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                      title="Clear All Points"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={downloadImage}
                      disabled={isProcessing}
                      className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 disabled:opacity-50"
                      title="Download Edited Image"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div 
                  className={`relative bg-black rounded-lg overflow-hidden ${isProcessing ? 'pointer-events-none' : ''}`}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Original"
                    className={`w-full h-auto ${showOriginal ? 'block' : 'hidden'}`}
                    onLoad={() => {
                      if (canvasRef.current && imageRef.current) {
                        canvasRef.current.width = imageRef.current.naturalWidth;
                        canvasRef.current.height = imageRef.current.naturalHeight;
                        const ctx = canvasRef.current.getContext('2d');
                        ctx?.drawImage(imageRef.current, 0, 0);
                        updateCanvasScale();
                      }
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className={`w-full h-auto ${isProcessing ? 'cursor-wait' : 'cursor-crosshair'} ${showOriginal ? 'hidden' : 'block'} ${isDragging ? 'cursor-grabbing' : ''}`}
                  />

                  {/* Selection Points */}
                  {selection.points.map((point, index) => {
                    if (!canvasRef.current) return null;
                    const rect = canvasRef.current.getBoundingClientRect();
                    const displayX = (point.x / canvasRef.current.width) * rect.width;
                    const displayY = (point.y / canvasRef.current.height) * rect.height;
                    
                    return (
                      <div
                        key={index}
                        className={`absolute w-4 h-4 bg-cyan-400 rounded-full border-2 border-white transform -translate-x-2 -translate-y-2 ${
                          isProcessing ? 'cursor-wait' : 'cursor-grab hover:bg-cyan-300 hover:scale-110'
                        } transition-all duration-200 ${
                          draggedPointIndex === index ? 'animate-pulse scale-125 cursor-grabbing' : 'animate-pulse'
                        }`}
                        style={{
                          left: `${displayX}px`,
                          top: `${displayY}px`,
                          zIndex: 10
                        }}
                        onMouseDown={(e) => handlePointMouseDown(e, index)}
                        onDoubleClick={(e) => handlePointDoubleClick(e, index)}
                        title={`Point ${index + 1} - Drag to move • Double-click to remove`}
                      />
                    );
                  })}

                  {/* Selection Lines */}
                  {selection.points.length > 1 && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ zIndex: 1 }}
                    >
                      {selection.points.map((point, index) => {
                        if (index === 0 || !canvasRef.current) return null;
                        const rect = canvasRef.current.getBoundingClientRect();
                        const prevPoint = selection.points[index - 1];
                        const x1 = (prevPoint.x / canvasRef.current.width) * rect.width;
                        const y1 = (prevPoint.y / canvasRef.current.height) * rect.height;
                        const x2 = (point.x / canvasRef.current.width) * rect.width;
                        const y2 = (point.y / canvasRef.current.height) * rect.height;
                        
                        return (
                          <line
                            key={index}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="#00D4FF"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                          />
                        );
                      })}
                      {/* Close the polygon if complete */}
                      {selection.isComplete && selection.points.length > 2 && canvasRef.current && (
                        <line
                          x1={(selection.points[selection.points.length - 1].x / canvasRef.current.width) * canvasRef.current.getBoundingClientRect().width}
                          y1={(selection.points[selection.points.length - 1].y / canvasRef.current.height) * canvasRef.current.getBoundingClientRect().height}
                          x2={(selection.points[0].x / canvasRef.current.width) * canvasRef.current.getBoundingClientRect().width}
                          y2={(selection.points[0].y / canvasRef.current.height) * canvasRef.current.getBoundingClientRect().height}
                          stroke="#00D4FF"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                      )}
                    </svg>
                  )}
                </div>

                {selection.points.length > 0 && (
                  <div className="text-sm text-gray-400 mt-3 space-y-1">
                    <p>
                      {selection.points.length < 3 
                        ? `Click ${3 - selection.points.length} more points to complete selection`
                        : "Selection complete! Choose an AI filter to apply advanced processing."
                      }
                    </p>
                    <p className="text-xs text-gray-500">
                      💡 <strong>Controls:</strong> Click = Add point • Drag = Move point • Double-click = Remove point • Undo = Remove last point
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Controls Panel */}
            <div className="space-y-6">
              {/* Filter Selection */}
              <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
                <h3 className="text-lg font-semibold mb-4 text-white">AI Filters & Tools</h3>
                <div className="space-y-3">
                  {filters.map((filter) => {
                    const Icon = filter.icon;
                    const isAdvanced = filter.isAI || ['cutout'].includes(filter.id);
                    const isDisabled = filter.id !== 'none' && !selection.isComplete;
                    
                    return (
                      <button
                        key={filter.id}
                        onClick={() => applyFilter(filter.id)}
                        disabled={isDisabled || isProcessing}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                          activeFilter === filter.id
                            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50'
                            : 'bg-gray-700/30 hover:bg-gray-600/40 border border-transparent'
                        } ${
                          isDisabled || isProcessing
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isAdvanced ? 'text-purple-400' : 'text-cyan-400'}`} />
                        <div className="text-left flex-1">
                          <span className="text-white block">{filter.name}</span>
                          {isAdvanced && (
                            <span className="text-xs text-purple-300">Advanced AI</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* System Status */}
              <div className="bg-gray-800/30 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/30">
                <h3 className="text-lg font-semibold mb-4 text-white">System Status</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Memory Usage:</span>
                    <span className={`${memoryUsage > 400 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {Math.round(memoryUsage)}MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">AI Services:</span>
                    <span className="text-yellow-400">Fallback Mode</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Processing:</span>
                    <span className={isProcessing ? 'text-blue-400' : 'text-green-400'}>
                      {isProcessing ? 'Active' : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-gray-800/30 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/30">
                <h3 className="text-lg font-semibold mb-4 text-white">How to Use</h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0">1</div>
                    <p><strong>Click</strong> on the image to add selection points (minimum 3 points needed)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0">2</div>
                    <p><strong>Drag</strong> any point to move it to a better position</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0">3</div>
                    <p><strong>Double-click</strong> any point to remove it</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0">4</div>
                    <p>Choose an AI filter and wait for processing</p>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="text-xs text-purple-300">
                    <strong>AI Smart Remove:</strong> Uses advanced algorithms with fallback to local processing if AI services are unavailable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaEditor;