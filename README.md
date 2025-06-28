# Black Mirror Media Editor

Advanced AI-powered media manipulation tool with intelligent background removal and image processing capabilities.

## Features

### 🤖 AI-Powered Processing
- **Smart Remove**: Advanced content-aware removal using AI models (U2Net, DeepLab, RemBG)
- **Intelligent Fallback**: Local processing when AI services are unavailable
- **Memory Management**: Automatic memory monitoring and cleanup
- **Error Recovery**: Robust error handling with user-friendly messages

### 🎨 Image Processing
- **Precise Selection**: Click-and-drag point selection system
- **Multiple Filters**: Black Mirror-inspired effects (blur, noise, dystopian)
- **Background Removal**: Clean cutouts with transparent backgrounds
- **Edge Smoothing**: Professional-grade anti-aliasing

### 🛠️ Technical Features
- **Async Processing**: Non-blocking operations with progress indicators
- **Memory Optimization**: Chunked processing to prevent browser crashes
- **Queue Management**: Processing queue with retry mechanisms
- **Real-time Feedback**: Live progress updates and system status

## AI Service Integration

### Supported AI Models

1. **U2Net Background Removal**
   - Endpoint: `/api/ai/u2net`
   - Best for: General background removal
   - Timeout: 30 seconds

2. **DeepLab Semantic Segmentation**
   - Endpoint: `/api/ai/deeplab`
   - Best for: Precise object segmentation
   - Timeout: 45 seconds

3. **RemBG Background Removal**
   - Endpoint: `/api/ai/rembg`
   - Best for: Fast background removal
   - Timeout: 25 seconds

### Environment Configuration

Copy `.env.example` to `.env` and configure your API endpoints:

```bash
# AI Service Configuration
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

## Backend Requirements

### AI Processing Endpoints

The application expects the following backend endpoints:

#### POST `/api/ai/u2net`
```typescript
// Request
FormData {
  image: File,
  mask_points: string, // JSON array of {x, y} points
  model: string
}

// Response
ArrayBuffer // Processed image data
```

#### POST `/api/ai/deeplab`
```typescript
// Request
FormData {
  image: File,
  mask_points: string,
  model: string
}

// Response
ArrayBuffer // Segmented image data
```

#### POST `/api/ai/rembg`
```typescript
// Request
FormData {
  image: File,
  mask_points: string,
  model: string
}

// Response
ArrayBuffer // Background removed image
```

### Error Handling

All endpoints should return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid image format, etc.)
- `429`: Rate limit exceeded
- `500`: Internal server error
- `503`: Service unavailable

### Security Considerations

1. **API Key Management**: Store API keys securely in environment variables
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **File Validation**: Validate uploaded files for type and size
4. **CORS Configuration**: Configure CORS for your domain
5. **Request Size Limits**: Set appropriate limits for image uploads

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
2. Configure your AI service endpoints
3. Add your API keys
4. Adjust memory and timeout settings as needed

## Architecture

### Core Components

- **AIProcessingService**: Singleton service managing AI operations
- **useAIProcessing**: React hook for AI processing state management
- **ProcessingModal**: Real-time processing feedback UI
- **ErrorBoundary**: Application-level error handling
- **MediaEditor**: Main editor interface

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
- Non-blocking operations with Web Workers (future enhancement)
- Intelligent caching of processed results
- Progressive loading for better UX

## Troubleshooting

### Common Issues

1. **Browser Tab Crashes**
   - Reduce image size
   - Close other browser tabs
   - Lower memory limit in configuration

2. **AI Service Failures**
   - Check API key configuration
   - Verify endpoint URLs
   - Monitor rate limits

3. **Slow Processing**
   - Use smaller images
   - Reduce selection complexity
   - Check network connectivity

### Debug Mode

Enable debug logging by setting:
```bash
VITE_DEBUG_MODE=true
```

## Future Enhancements

- [ ] Web Workers for background processing
- [ ] Progressive Web App (PWA) support
- [ ] Offline processing capabilities
- [ ] Advanced AI model integration
- [ ] Real-time collaboration features
- [ ] Mobile app development

## License

MIT License - see LICENSE file for details.