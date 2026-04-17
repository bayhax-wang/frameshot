const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: '/tmp/frameshot',
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Check if file is video
    const videoMimeTypes = [
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
      'video/flv', 'video/webm', 'video/mkv'
    ];
    
    if (videoMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Extract frame endpoint
app.post('/extract', upload.single('file'), async (req, res) => {
  let videoPath = null;
  let outputPath = null;
  
  try {
    const { url, timestamp = 'auto', format = 'jpg', width = 1280 } = req.body;
    
    // Handle URL or uploaded file
    if (url) {
      // Download video from URL
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(400).json({ error: 'Failed to download video from URL' });
      }
      
      const buffer = await response.arrayBuffer();
      videoPath = `/tmp/frameshot/${uuidv4()}.mp4`;
      await fs.writeFile(videoPath, Buffer.from(buffer));
    } else if (req.file) {
      videoPath = req.file.path;
    } else {
      return res.status(400).json({ error: 'Either url or file must be provided' });
    }

    // Generate output filename
    const outputFilename = `${uuidv4()}.${format}`;
    outputPath = `/tmp/frameshot/${outputFilename}`;

    // Extract frame with ffmpeg
    await new Promise((resolve, reject) => {
      let command = ffmpeg(videoPath)
        .screenshots({
          count: 1,
          timemarks: timestamp === 'auto' ? ['0'] : [timestamp],
          filename: outputFilename,
          folder: '/tmp/frameshot',
          size: `${width}x?`
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Upload to R2 (simulated - in real deployment, use R2 API)
    const thumbnailBuffer = await fs.readFile(outputPath);
    
    // For now, return a placeholder URL
    // In real deployment, upload to R2 and return actual URL
    const thumbnailUrl = `https://r2.frameshot.dev/${outputFilename}`;

    res.json({ thumbnail_url: thumbnailUrl });

  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ error: 'Frame extraction failed', details: error.message });
  } finally {
    // Clean up temporary files
    try {
      if (videoPath && req.body.url) {
        await fs.unlink(videoPath);
      }
      if (outputPath) {
        await fs.unlink(outputPath);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Frameshot processor running on port ${PORT}`);
});