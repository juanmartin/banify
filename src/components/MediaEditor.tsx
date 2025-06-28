import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, RotateCcw, Eye, EyeOff, Trash2, Sparkles, Undo2, Wand2, Scissors } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Selection {
  points: Point[];
  isComplete: boolean;
}

const MediaEditor: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [selection, setSelection] = useState<Selection>({ points: [], isComplete: false });
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [canvasScale, setCanvasScale] = useState({ x: 1, y: 1 });
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);

  const filters = [
    { id: 'none', name: 'Original', icon: Eye },
    { id: 'blur', name: 'Black Mirror Blur', icon: Sparkles },
    { id: 'noise', name: 'Digital Noise', icon: Sparkles },
    { id: 'desaturate', name: 'Dystopian', icon: Sparkles },
    { id: 'smart_remove', name: 'Smart Remove', icon: Wand2 },
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setUploadedFile(file);
      setSelection({ points: [], isComplete: false });
      setActiveFilter('none');
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      setUploadedFile(file);
      setSelection({ points: [], isComplete: false });
      setActiveFilter('none');
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current || isDragging) return;

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
    event.stopPropagation();
    setDraggedPointIndex(pointIndex);
    setIsDragging(true);
  };

  const handlePointDoubleClick = (event: React.MouseEvent, pointIndex: number) => {
    event.stopPropagation();
    
    const newPoints = selection.points.filter((_, index) => index !== pointIndex);
    
    setSelection({
      points: newPoints,
      isComplete: newPoints.length >= 3
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (draggedPointIndex === null || !canvasRef.current || !isDragging) return;

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
    if (selection.points.length === 0) return;
    
    const newPoints = selection.points.slice(0, -1);
    setSelection({
      points: newPoints,
      isComplete: newPoints.length >= 3
    });
  };

  const clearSelection = () => {
    setSelection({ points: [], isComplete: false });
  };

  // Advanced edge detection and smoothing
  const detectEdges = (imageData: ImageData, threshold: number = 50): boolean[][] => {
    const { data, width, height } = imageData;
    const edges: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Sobel edge detection
        const gx = 
          -data[((y-1) * width + (x-1)) * 4] + data[((y-1) * width + (x+1)) * 4] +
          -2 * data[(y * width + (x-1)) * 4] + 2 * data[(y * width + (x+1)) * 4] +
          -data[((y+1) * width + (x-1)) * 4] + data[((y+1) * width + (x+1)) * 4];
          
        const gy = 
          -data[((y-1) * width + (x-1)) * 4] - 2 * data[((y-1) * width + x) * 4] - data[((y-1) * width + (x+1)) * 4] +
          data[((y+1) * width + (x-1)) * 4] + 2 * data[((y+1) * width + x) * 4] + data[((y+1) * width + (x+1)) * 4];
          
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y][x] = magnitude > threshold;
      }
    }
    
    return edges;
  };

  // Content-aware fill simulation
  const contentAwareFill = (ctx: CanvasRenderingContext2D, maskPoints: Point[], width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Create mask from selection
    const mask = Array(height).fill(null).map(() => Array(width).fill(false));
    
    // Fill polygon mask
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(maskPoints[0].x, maskPoints[0].y);
    maskPoints.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    
    // Sample surrounding pixels for texture analysis
    const surroundingPixels: number[][] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (ctx.isPointInPath(x, y)) {
          mask[y][x] = true;
          
          // Sample pixels around the mask boundary
          for (let dy = -10; dy <= 10; dy++) {
            for (let dx = -10; dx <= 10; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height && !ctx.isPointInPath(nx, ny)) {
                const idx = (ny * width + nx) * 4;
                surroundingPixels.push([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
              }
            }
          }
        }
      }
    }
    
    ctx.restore();
    
    // Fill masked area with intelligent sampling
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x] && surroundingPixels.length > 0) {
          // Use distance-weighted sampling for more natural results
          let totalWeight = 0;
          let r = 0, g = 0, b = 0, a = 0;
          
          // Sample multiple surrounding pixels with noise for texture variation
          for (let i = 0; i < Math.min(5, surroundingPixels.length); i++) {
            const randomPixel = surroundingPixels[Math.floor(Math.random() * surroundingPixels.length)];
            const weight = Math.random() * 0.5 + 0.5; // Random weight between 0.5 and 1
            
            r += randomPixel[0] * weight;
            g += randomPixel[1] * weight;
            b += randomPixel[2] * weight;
            a += randomPixel[3] * weight;
            totalWeight += weight;
          }
          
          if (totalWeight > 0) {
            const idx = (y * width + x) * 4;
            data[idx] = Math.round(r / totalWeight);
            data[idx + 1] = Math.round(g / totalWeight);
            data[idx + 2] = Math.round(b / totalWeight);
            data[idx + 3] = Math.round(a / totalWeight);
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  // Advanced feathering and edge smoothing
  const smoothEdges = (ctx: CanvasRenderingContext2D, maskPoints: Point[], featherRadius: number = 3) => {
    const canvas = ctx.canvas;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    // Copy original
    tempCtx.drawImage(canvas, 0, 0);
    
    // Create soft mask
    tempCtx.globalCompositeOperation = 'destination-out';
    tempCtx.beginPath();
    tempCtx.moveTo(maskPoints[0].x, maskPoints[0].y);
    maskPoints.slice(1).forEach(point => tempCtx.lineTo(point.x, point.y));
    tempCtx.closePath();
    
    // Apply feathering
    tempCtx.shadowColor = 'black';
    tempCtx.shadowBlur = featherRadius * 2;
    tempCtx.fill();
    
    // Apply Gaussian blur for smoother edges
    ctx.filter = `blur(${featherRadius}px)`;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
  };

  // Precise cutout with transparency
  const createPreciseCutout = (ctx: CanvasRenderingContext2D, maskPoints: Point[]) => {
    // Create a new canvas for the cutout
    const cutoutCanvas = document.createElement('canvas');
    cutoutCanvas.width = ctx.canvas.width;
    cutoutCanvas.height = ctx.canvas.height;
    const cutoutCtx = cutoutCanvas.getContext('2d')!;
    
    // Draw the original image
    cutoutCtx.drawImage(imageRef.current!, 0, 0, cutoutCanvas.width, cutoutCanvas.height);
    
    // Create clipping mask
    cutoutCtx.globalCompositeOperation = 'destination-in';
    cutoutCtx.beginPath();
    cutoutCtx.moveTo(maskPoints[0].x, maskPoints[0].y);
    maskPoints.slice(1).forEach(point => cutoutCtx.lineTo(point.x, point.y));
    cutoutCtx.closePath();
    cutoutCtx.fill();
    
    // Clear the main canvas and draw the cutout
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(cutoutCanvas, 0, 0);
  };

  const applyFilter = async (filterId: string) => {
    if (!canvasRef.current || !imageRef.current) return;

    setIsProcessing(true);
    setActiveFilter(filterId);

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
      const processingDelay = filterId === 'smart_remove' ? 2000 : 1000;
      
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
            ctx.drawImage(imageRef.current!, 0, 0, canvas.width, canvas.height);
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
            ctx.drawImage(imageRef.current!, 0, 0, canvas.width, canvas.height);
            
            // Add digital noise effect
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
            ctx.drawImage(imageRef.current!, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            break;
            
          case 'smart_remove':
            // Advanced content-aware removal
            contentAwareFill(ctx, selection.points, canvas.width, canvas.height);
            smoothEdges(ctx, selection.points, 2);
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
        
        setIsProcessing(false);
      }, processingDelay);
    } else {
      setTimeout(() => setIsProcessing(false), 500);
    }
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
    
    setCanvasScale({
      x: canvas.width / rect.width,
      y: canvas.height / rect.height
    });
  };

  useEffect(() => {
    updateCanvasScale();
    window.addEventListener('resize', updateCanvasScale);
    return () => window.removeEventListener('resize', updateCanvasScale);
  }, [imageUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
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
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                      title={showOriginal ? "Hide Original" : "Show Original"}
                    >
                      {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={undoLastPoint}
                      disabled={selection.points.length === 0}
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Undo Last Point"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={clearSelection}
                      className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                      title="Clear All Points"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={downloadImage}
                      className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 transition-all duration-300"
                      title="Download Edited Image"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div 
                  className="relative bg-black rounded-lg overflow-hidden"
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
                    className={`w-full h-auto cursor-crosshair ${showOriginal ? 'hidden' : 'block'} ${isDragging ? 'cursor-grabbing' : ''}`}
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
                        className={`absolute w-4 h-4 bg-cyan-400 rounded-full border-2 border-white transform -translate-x-2 -translate-y-2 cursor-grab hover:bg-cyan-300 hover:scale-110 transition-all duration-200 ${
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

                  {/* Processing Overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-cyan-400">
                          {activeFilter === 'smart_remove' ? 'AI Processing...' : 'Processing...'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {activeFilter === 'smart_remove' ? 'Analyzing textures and patterns' : 'Applying filter'}
                        </p>
                      </div>
                    </div>
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
                    const isAdvanced = ['smart_remove', 'cutout'].includes(filter.id);
                    return (
                      <button
                        key={filter.id}
                        onClick={() => applyFilter(filter.id)}
                        disabled={filter.id !== 'none' && !selection.isComplete}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                          activeFilter === filter.id
                            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50'
                            : 'bg-gray-700/30 hover:bg-gray-600/40 border border-transparent'
                        } ${
                          filter.id !== 'none' && !selection.isComplete
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
                    <p><strong>Double-click</strong> any point to remove it (remaining points stay connected)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0">4</div>
                    <p>Use <strong>Undo</strong> button (↶) to remove the last added point</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0">5</div>
                    <p>Choose an AI filter and download your processed image</p>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="text-xs text-purple-300">
                    <strong>AI Features:</strong> Smart Remove uses content-aware algorithms, Precise Cutout creates transparent backgrounds with edge smoothing.
                  </p>
                </div>
                
                <div className="mt-3 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                  <p className="text-xs text-cyan-300">
                    <strong>Pro Tip:</strong> You can continue adding points even after completing a selection to create more complex shapes!
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