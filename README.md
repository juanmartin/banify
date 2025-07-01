Otro experimento Vibe Coded, este de hecho fue el primero.

La idea es quitar o filtrar determinado elemento de una imagen o video, ya sea una persona u objeto. Se edita con la UI y se baja el resultado.
Sólo lo probé con imágenes. Básicamente hacés un recorte con unos nodos y aplica unos filtros o borra. Estuve agregando cosas tipo AI smart selection o que use modelos de HuggingFace para procesar el contenido pero necesito una API key o pagar porque tiene poco límite, estoy buscando otro provider o ver qué se hace. Ni lo hostié aún.

------
# De ahora en mas es IA
---------

# Black Mirror Media Editor

Advanced AI-powered media manipulation tool with intelligent background removal and image processing capabilities powered by Hugging Face models.

## Features

### 🤖 AI-Powered Processing
- **Smart Selection**: AI-powered object detection using Hugging Face models
- **Manual Selection**: Precise point-by-point selection system
- **Intelligent Removal**: Advanced content-aware removal using multiple AI models
- **Fallback Processing**: Local processing when AI services are unavailable
- **Memory Management**: Automatic memory monitoring and cleanup
- **Error Recovery**: Robust error handling with user-friendly messages

### 🎨 Image Processing
- **Dual Selection Modes**: Smart AI detection or manual precision control
- **Object Detection**: Real-time object detection with bounding boxes
- **Multiple Filters**: Black Mirror-inspired effects (blur, noise, dystopian)
- **Background Removal**: Clean cutouts with transparent backgrounds
- **Edge Smoothing**: Professional-grade anti-aliasing

### 🛠️ Technical Features
- **Async Processing**: Non-blocking operations with progress indicators
- **Memory Optimization**: Chunked processing to prevent browser crashes
- **Queue Management**: Processing queue with retry mechanisms
- **Real-time Feedback**: Live progress updates and system status

## Hugging Face Integration

### Supported Models

1. **SegFormer (nvidia/segformer-b1-finetuned-cityscapes-1024-1024)**
   - **Type**: Semantic Segmentation
   - **Best for**: General objects, urban scenes, background removal
   - **Description**: Efficient semantic segmentation with Transformer architecture

2. **DETR Panoptic (facebook/detr-resnet-50-panoptic)**
   - **Type**: Object Detection & Panoptic Segmentation
   - **Best for**: Multiple objects, complex scenes, instance segmentation
   - **Description**: Object detection and panoptic segmentation

3. **Mask2Former (facebook/mask2former-swin-tiny-ade-semantic)**
   - **Type**: Panoptic Segmentation
   - **Best for**: High precision, detailed masks, complex objects
   - **Description**: State-of-the-art panoptic segmentation

4. **Segment Anything Model (facebook/sam-vit-base)**
   - **Type**: Universal Segmentation
   - **Best for**: Point prompts, any object, interactive segmentation
   - **Description**: Universal segmentation model for any object

### Backend API Endpoints

The application expects the following Hugging Face integration endpoints:

#### POST `/api/ai/huggingface/segformer`
```typescript
// Request
FormData {
  image: File,
  model_id: string,
  model_type: 'segformer'
}

// Response
{
  segments: Array<{
    label: string,
    score: number,
    bbox: { x: number, y: number, width: number, height: number },
    mask?: number[][]
  }>
}
```

#### POST `/api/ai/huggingface/detr-panoptic`
```typescript
// Request
FormData {
  image: File,
  model_id: string,
  model_type: 'detr'
}

// Response
{
  predictions: Array<{
    label: string,
    score: number,
    box: { xmin: number, ymin: number, xmax: number, ymax: number }
  }>
}
```

#### POST `/api/ai/huggingface/mask2former`
```typescript
// Request
FormData {
  image: File,
  model_id: string,
  model_type: 'mask2former'
}

// Response
{
  segments: Array<{
    label: string,
    score: number,
    bbox: { x: number, y: number, width: number, height: number },
    mask: number[][]
  }>
}
```

#### POST `/api/ai/huggingface/sam`
```typescript
// Request
FormData {
  image: File,
  model_id: string,
  model_type: 'sam',
  click_point?: string // JSON: { x: number, y: number }
}

// Response
{
  masks: Array<{
    score: number,
    bbox: { x: number, y: number, width: number, height: number },
    segmentation: number[][]
  }>
}
```

#### POST `/api/ai/huggingface/inpainting`
```typescript
// Request
FormData {
  image: File,
  object_data: string, // JSON: DetectedObject
  task: 'inpainting'
}

// Response
ArrayBuffer // Processed image data
```

## Environment Configuration

Copy `.env.example` to `.env` and configure your API endpoints:

```bash
# Hugging Face Configuration
VITE_HUGGINGFACE_API_KEY=your-huggingface-api-key
VITE_HUGGINGFACE_ENDPOINT=https://your-backend.com/api/ai/huggingface

# Legacy AI Service Configuration
VITE_AI_SERVICE_URL=https://your-ai-service.com/api
VITE_AI_API_KEY=your-api-key-here

# Individual Service Endpoints
VITE_U2NET_ENDPOINT=https://api.remove.bg/v1.0/removebg
VITE_U2NET_API_KEY=your-removebg-api-key

VITE_DEEPLAB_ENDPOINT=https://your-deeplab-service.com/api/segment
VITE_DEEPLAB_API_KEY=your-deeplab-api-key

VITE_REMBG_ENDPOINT=https://api.rembg.com/v1/remove
VITE_REMBG_API_KEY=your-rembg-api-key
```

## Backend Implementation Guide

### Python Backend with Hugging Face Transformers

```python
from transformers import pipeline
from PIL import Image
import torch
import numpy as np

# Initialize models
segformer = pipeline("image-segmentation", model="nvidia/segformer-b1-finetuned-cityscapes-1024-1024")
detr = pipeline("object-detection", model="facebook/detr-resnet-50")
mask2former = pipeline("image-segmentation", model="facebook/mask2former-swin-tiny-ade-semantic")

@app.route('/api/ai/huggingface/segformer', methods=['POST'])
def segformer_endpoint():
    image = Image.open(request.files['image'])
    results = segformer(image)
    
    segments = []
    for result in results:
        segments.append({
            'label': result['label'],
            'score': result.get('score', 0.8),
            'bbox': calculate_bbox(result['mask']),
            'mask': mask_to_array(result['mask'])
        })
    
    return {'segments': segments}

@app.route('/api/ai/huggingface/detr-panoptic', methods=['POST'])
def detr_endpoint():
    image = Image.open(request.files['image'])
    results = detr(image)
    
    predictions = []
    for result in results:
        predictions.append({
            'label': result['label'],
            'score': result['score'],
            'box': result['box']
        })
    
    return {'predictions': predictions}
```

### Docker Deployment

```dockerfile
FROM python:3.9-slim

RUN pip install transformers torch torchvision pillow flask

COPY . /app
WORKDIR /app

EXPOSE 5000
CMD ["python", "app.py"]
```

## Usage Guide

### Smart Selection Mode
1. Click the **Brain** icon to enable Smart Selection
2. Click anywhere on the image to trigger AI object detection
3. Detected objects will appear with colored bounding boxes
4. Click on any detected object to select it
5. Apply AI filters for advanced processing

### Manual Selection Mode
1. Click points around the object you want to select
2. Minimum 3 points required to complete selection
3. Drag points to adjust position
4. Double-click points to remove them
5. Apply filters once selection is complete

### AI Processing Pipeline
1. **Object Detection**: Uses Hugging Face models to identify objects
2. **Segmentation**: Creates precise masks for selected objects
3. **Inpainting**: Removes objects and fills background intelligently
4. **Fallback**: Local processing if AI services are unavailable

## Development

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Configure your Hugging Face API key
3. Set up backend endpoints
4. Adjust memory and timeout settings as needed

## Architecture

### Core Components

- **AIProcessingService**: Singleton service managing AI operations with Hugging Face integration
- **useAIProcessing**: React hook for AI processing state management
- **ProcessingModal**: Real-time processing feedback UI
- **ErrorBoundary**: Application-level error handling
- **MediaEditor**: Main editor interface with dual selection modes

### Memory Management

- **Automatic Monitoring**: Tracks memory usage every 5 seconds
- **Garbage Collection**: Forces cleanup when memory exceeds limits
- **Chunked Processing**: Breaks large operations into smaller chunks
- **Resource Cleanup**: Automatic cleanup of processing operations

### Error Recovery

- **Graceful Degradation**: Falls back to local processing if AI fails
- **Retry Mechanisms**: Automatic retries with exponential backoff
- **User Feedback**: Clear error messages with troubleshooting tips
- **Memory Warnings**: Alerts users about high memory usage

## Performance Optimization

### Memory Limits
- Default limit: 512MB
- Configurable via `VITE_MAX_MEMORY_MB`
- Automatic cleanup when approaching limits

### Processing Optimization
- Chunked processing for large images
- Non-blocking operations with progress indicators
- Intelligent model selection based on use case
- Progressive loading for better UX

## Troubleshooting

### Common Issues

1. **Browser Tab Crashes**
   - Reduce image size
   - Close other browser tabs
   - Lower memory limit in configuration

2. **AI Service Failures**
   - Check Hugging Face API key configuration
   - Verify backend endpoint URLs
   - Monitor rate limits and quotas

3. **Slow Processing**
   - Use smaller images
   - Reduce selection complexity
   - Check network connectivity to backend

### Debug Mode

Enable debug logging by setting:
```bash
VITE_DEBUG_MODE=true
```

## Future Enhancements

- [ ] Web Workers for background processing
- [ ] Progressive Web App (PWA) support
- [ ] Offline processing capabilities
- [ ] Real-time collaboration features
- [ ] Mobile app development
- [ ] Custom model fine-tuning interface
- [ ] Batch processing capabilities

## License

MIT License - see LICENSE file for details.
