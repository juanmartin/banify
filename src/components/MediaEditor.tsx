import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, RotateCcw, Eye, EyeOff, Trash2, Sparkles, Undo2, Wand2, Scissors, AlertCircle, Brain, Target, Zap } from 'lucide-react';
import { useAIProcessing } from '../hooks/useAIProcessing';
import ProcessingModal from './ProcessingModal';
import { Point, Selection, DetectedObject } from '../types/ai-processing';

const MediaEditor: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [selection, setSelection] = useState<Selection>({ points: [], isComplete: false });
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [showOriginal, setShowOriginal] = useState(false);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [smartSelectionMode, setSmartSelectionMode] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    isProcessing,
    isDetecting,
    progress,
    error: processingError,
    result,
    detectedObjects,
    detectObjects,
    processSmartRemoval,
    cancelProcessing,
    clearError,
    clearDetectedObjects,
    selectObject,
    memoryUsage,
    availableModels
  } = useAIProcessing();

  const filters = [
    { id: 'none', name: 'Original', icon: Eye },
    { id: 'blur', name: 'Black Mirror Blur', icon: Sparkles },
    { id: 'noise', name: 'Digital Noise', icon: Sparkles },
    { id: 'desaturate', name: 'Dystopian', icon: Sparkles },
    { id: 'smart_remove', name: 'AI Smart Remove', icon: Brain, isAI: true },
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
      setSmartSelectionMode(false);
      setSelectedObjectId(null);
      clearError();
      clearDetectedObjects();
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setUploadedFile(file);
      setSelection({ points: [], isComplete: false });
      setActiveFilter('none');
      setSmartSelectionMode(false);
      setSelectedObjectId(null);
      clearError();
      clearDetectedObjects();
    }
  };

  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current || isDragging || isProcessing || isDetecting) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const actualX = clickX * scaleX;
    const actualY = clickY * scaleY;

    const clickPoint = { x: actualX, y: actualY };

    if (smartSelectionMode) {
      // Smart object detection mode
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        await detectObjects(imageData, clickPoint);
      }
    } else {
      // Manual point selection mode
      const newPoint = clickPoint;
      const newPoints = [...selection.points, newPoint];

      setSelection({
        points: newPoints,
        isComplete: newPoints.length >= 3
      });
    }
  };

  const handleObjectSelect = (objectId: string) => {
    setSelectedObjectId(objectId);
    const selectedObj = selectObject(objectId);
    if (selectedObj) {
      // Convert bounding box to selection points
      const bbox = selectedObj.bbox;
      const points: Point[] = [
        { x: bbox.x, y: bbox.y },
        { x: bbox.x + bbox.width, y: bbox.y },
        { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
        { x: bbox.x, y: bbox.y + bbox.height }
      ];
      
      setSelection({
        points,
        isComplete: true,
        selectedObjectId: objectId
      });
    }
  };

  const toggleSmartSelection = () => {
    setSmartSelectionMode(!smartSelectionMode);
    if (!smartSelectionMode) {
      clearDetectedObjects();
      setSelectedObjectId(null);
      setSelection({ points: [], isComplete: false });
    }
  };

  const handlePointMouseDown = (event: React.MouseEvent, pointIndex: number) => {
    if (isProcessing || isDetecting || smartSelectionMode) return;
    event.stopPropagation();
    setDraggedPointIndex(pointIndex);
    setIsDragging(true);
  };

  const handlePointDoubleClick = (event: React.MouseEvent, pointIndex: number) => {
    if (isProcessing || isDetecting || smartSelectionMode) return;
    event.stopPropagation();
    
    const newPoints = selection.points.filter((_, index) => index !== pointIndex);
    
    setSelection({
      points: newPoints,
      isComplete: newPoints.length >= 3
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draggedPointIndex === null || !canvasRef.current || !isDragging || isProcessing || isDetecting || smartSelectionMode) return;

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
    if (selection.points.length === 0 || isProcessing || isDetecting || smartSelectionMode) return;
    
    const newPoints = selection.points.slice(0, -1);
    setSelection({
      points: newPoints,
      isComplete: newPoints.length >= 3
    });
  };

  const clearSelection = () => {
    if (isProcessing || isDetecting) return;
    setSelection({ points: [], isComplete: false });
    setSelectedObjectId(null);
    clearDetectedObjects();
    setSmartSelectionMode(false);
  };

  const applyFilter = async (filterId: string) => {
    if (!canvasRef.current || !imageRef.current || isProcessing || isDetecting) return;

    setActiveFilter(filterId);
    clearError();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!originalCanvasRef.current) {
      originalCanvasRef.current = document.createElement('canvas');
      originalCanvasRef.current.width = canvas.width;
      originalCanvasRef.current.height = canvas.height;
      const originalCtx = originalCanvasRef.current.getContext('2d')!;
      originalCtx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    if (selection.isComplete && filterId !== 'none') {
      if (filterId === 'smart_remove') {
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const selectedObj = selectedObjectId ? selectObject(selectedObjectId) : undefined;
          await processSmartRemoval(imageData, selection.points, selectedObj);
        } catch (error) {
          console.error('Smart removal failed:', error);
        }
      } else {
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
  };

  useEffect(() => {
    updateCanvasScale();
    window.addEventListener('resize', updateCanvasScale);
    return () => window.removeEventListener('resize', updateCanvasScale);
  }, [imageUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      <ProcessingModal
        isOpen={isProcessing || isDetecting}
        progress={progress}
        onCancel={cancelProcessing}
        memoryUsage={memoryUsage}
      />

      <div className="bg-black/50 backdrop-blur-lg border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Black Mirror Editor
          </h1>
          <p className="text-gray-400 text-sm mt-1">Advanced AI-powered media manipulation with Hugging Face integration</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
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
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">AI-Powered Editor Canvas</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSmartSelection}
                      disabled={isProcessing || isDetecting}
                      className={`p-2 rounded-lg transition-all duration-300 disabled:opacity-50 ${
                        smartSelectionMode 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                          : 'bg-gray-700/50 hover:bg-gray-600/50'
                      }`}
                      title={smartSelectionMode ? "Disable Smart Selection" : "Enable Smart Selection"}
                    >
                      <Brain className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowOriginal(!showOriginal)}
                      disabled={isProcessing || isDetecting}
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                      title={showOriginal ? "Hide Original" : "Show Original"}
                    >
                      {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={undoLastPoint}
                      disabled={selection.points.length === 0 || isProcessing || isDetecting || smartSelectionMode}
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Undo Last Point"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={clearSelection}
                      disabled={isProcessing || isDetecting}
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors disabled:opacity-50"
                      title="Clear Selection"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={downloadImage}
                      disabled={isProcessing || isDetecting}
                      className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 transition-all duration-300 disabled:opacity-50"
                      title="Download Edited Image"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div 
                  className={`relative bg-black rounded-lg overflow-hidden ${
                    isProcessing || isDetecting ? 'pointer-events-none' : ''
                  }`}
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
                    className={`w-full h-auto ${
                      isProcessing || isDetecting ? 'cursor-wait' : 
                      smartSelectionMode ? 'cursor-crosshair' : 'cursor-crosshair'
                    } ${showOriginal ? 'hidden' : 'block'} ${isDragging ? 'cursor-grabbing' : ''}`}
                  />

                  {/* Detected Objects Overlay */}
                  {detectedObjects.map((obj) => {
                    if (!canvasRef.current) return null;
                    const rect = canvasRef.current.getBoundingClientRect();
                    const scaleX = rect.width / canvasRef.current.width;
                    const scaleY = rect.height / canvasRef.current.height;
                    
                    const displayX = obj.bbox.x * scaleX;
                    const displayY = obj.bbox.y * scaleY;
                    const displayWidth = obj.bbox.width * scaleX;
                    const displayHeight = obj.bbox.height * scaleY;
                    
                    return (
                      <div
                        key={obj.id}
                        className={`absolute border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedObjectId === obj.id 
                            ? 'border-purple-400 bg-purple-400/20' 
                            : 'border-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20'
                        }`}
                        style={{
                          left: `${displayX}px`,
                          top: `${displayY}px`,
                          width: `${displayWidth}px`,
                          height: `${displayHeight}px`,
                          borderColor: obj.color,
                          zIndex: 5
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleObjectSelect(obj.id);
                        }}
                      >
                        <div 
                          className="absolute -top-6 left-0 px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: obj.color }}
                        >
                          {obj.label} ({Math.round(obj.confidence * 100)}%)
                        </div>
                      </div>
                    );
                  })}

                  {/* Manual Selection Points */}
                  {!smartSelectionMode && selection.points.map((point, index) => {
                    if (!canvasRef.current) return null;
                    const rect = canvasRef.current.getBoundingClientRect();
                    const displayX = (point.x / canvasRef.current.width) * rect.width;
                    const displayY = (point.y / canvasRef.current.height) * rect.height;
                    
                    return (
                      <div
                        key={index}
                        className={`absolute w-4 h-4 bg-cyan-400 rounded-full border-2 border-white transform -translate-x-2 -translate-y-2 ${
                          isProcessing || isDetecting ? 'cursor-wait' : 'cursor-grab hover:bg-cyan-300 hover:scale-110'
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
                  {!smartSelectionMode && selection.points.length > 1 && (
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

                {/* Selection Status */}
                <div className="text-sm text-gray-400 mt-3 space-y-1">
                  {smartSelectionMode ? (
                    <div className="space-y-1">
                      <p className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-purple-400" />
                        <strong className="text-purple-400">Smart Selection Mode:</strong> 
                        Click on objects to detect and select them automatically
                      </p>
                      {detectedObjects.length > 0 && (
                        <p className="text-green-400">
                          ✓ Detected {detectedObjects.length} object{detectedObjects.length !== 1 ? 's' : ''}. 
                          Click on highlighted objects to select them.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p>
                        {selection.points.length < 3 
                          ? `Click ${3 - selection.points.length} more points to complete selection`
                          : "Selection complete! Choose an AI filter to apply advanced processing."
                        }
                      </p>
                      <p className="text-xs text-gray-500">
                        💡 <strong>Manual Mode:</strong> Click = Add point • Drag = Move point • Double-click = Remove point
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Selection Mode Toggle */}
              <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
                <h3 className="text-lg font-semibold mb-4 text-white">Selection Mode</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setSmartSelectionMode(false)}
                    disabled={isProcessing || isDetecting}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                      !smartSelectionMode
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/50'
                        : 'bg-gray-700/30 hover:bg-gray-600/40 border border-transparent'
                    } ${isProcessing || isDetecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Target className="w-5 h-5 text-cyan-400" />
                    <div className="text-left flex-1">
                      <span className="text-white block">Manual Selection</span>
                      <span className="text-xs text-cyan-300">Point-by-point selection</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setSmartSelectionMode(true)}
                    disabled={isProcessing || isDetecting}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                      smartSelectionMode
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/50'
                        : 'bg-gray-700/30 hover:bg-gray-600/40 border border-transparent'
                    } ${isProcessing || isDetecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Brain className="w-5 h-5 text-purple-400" />
                    <div className="text-left flex-1">
                      <span className="text-white block">Smart Selection</span>
                      <span className="text-xs text-purple-300">AI-powered object detection</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Detected Objects Panel */}
              {detectedObjects.length > 0 && (
                <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/50">
                  <h3 className="text-lg font-semibold mb-4 text-white">Detected Objects</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detectedObjects.map((obj) => (
                      <button
                        key={obj.id}
                        onClick={() => handleObjectSelect(obj.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 text-left ${
                          selectedObjectId === obj.id
                            ? 'bg-purple-500/20 border border-purple-400/50'
                            : 'bg-gray-700/30 hover:bg-gray-600/40 border border-transparent'
                        }`}
                      >
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: obj.color }}
                        />
                        <div className="flex-1">
                          <span className="text-white block font-medium">{obj.label}</span>
                          <span className="text-xs text-gray-400">
                            Confidence: {Math.round(obj.confidence * 100)}%
                          </span>
                        </div>
                        {selectedObjectId === obj.id && (
                          <Zap className="w-4 h-4 text-purple-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                        disabled={isDisabled || isProcessing || isDetecting}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                          activeFilter === filter.id
                            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50'
                            : 'bg-gray-700/30 hover:bg-gray-600/40 border border-transparent'
                        } ${
                          isDisabled || isProcessing || isDetecting
                            ? 'opacity-50 cursor-not-allowed'
                            : 'cursor-pointer'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isAdvanced ? 'text-purple-400' : 'text-cyan-400'}`} />
                        <div className="text-left flex-1">
                          <span className="text-white block">{filter.name}</span>
                          {isAdvanced && (
                            <span className="text-xs text-purple-300">Hugging Face AI</span>
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
                    <span className="text-gray-400">Hugging Face Models:</span>
                    <span className="text-purple-400">{availableModels.huggingface.length} Available</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Processing:</span>
                    <span className={isProcessing || isDetecting ? 'text-blue-400' : 'text-green-400'}>
                      {isProcessing || isDetecting ? 'Active' : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-gray-800/30 rounded-2xl p-6 backdrop-blur-sm border border-gray-700/30">
                <h3 className="text-lg font-semibold mb-4 text-white">How to Use</h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">1</div>
                    <p><strong>Choose Selection Mode:</strong> Smart Selection for AI detection or Manual for precise control</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">2</div>
                    <p><strong>Smart Mode:</strong> Click on objects to detect them automatically</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">3</div>
                    <p><strong>Manual Mode:</strong> Click to add points, drag to move, double-click to remove</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0">4</div>
                    <p>Apply AI filters powered by Hugging Face models</p>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="text-xs text-purple-300">
                    <strong>Hugging Face Integration:</strong> Uses SegFormer, DETR, Mask2Former, and SAM models for state-of-the-art object detection and segmentation.
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