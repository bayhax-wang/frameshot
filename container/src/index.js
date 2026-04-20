const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Ensure tmp dir exists
fs.mkdir('/tmp/frameshot', { recursive: true }).catch(() => {});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: '/tmp/frameshot',
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Run ffmpeg as child process with timeout
function runFfmpeg(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const proc = execFile('ffmpeg', args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg failed: ${stderr || error.message}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

app.post('/extract', upload.single('file'), async (req, res) => {
  let localVideoPath = null;
  let outputPath = null;
  
  try {
    const { url, timestamp = 'auto', format = 'jpg', width = 1280 } = req.body;
    const seekTime = timestamp === 'auto' ? '0' : String(timestamp);
    const outputFilename = `${uuidv4()}.${format}`;
    outputPath = `/tmp/frameshot/${outputFilename}`;

    if (url) {
      // ffmpeg reads URL directly with -ss before -i (input seek = fast, downloads only what's needed)
      const args = [
        '-ss', seekTime,
        '-i', url,
        '-vframes', '1',
        '-vf', `scale=${width}:-1`,
        '-f', 'image2',
        '-y',
        outputPath
      ];
      await runFfmpeg(args, 30000);

    } else if (req.file) {
      localVideoPath = req.file.path;
      const args = [
        '-ss', seekTime,
        '-i', localVideoPath,
        '-vframes', '1',
        '-vf', `scale=${width}:-1`,
        '-f', 'image2',
        '-y',
        outputPath
      ];
      await runFfmpeg(args, 30000);

    } else {
      return res.status(400).json({ error: 'Either url or file must be provided' });
    }

    const thumbnailBuffer = await fs.readFile(outputPath);
    const thumbnailBase64 = thumbnailBuffer.toString('base64');
    
    res.json({ 
      success: true,
      image_data: thumbnailBase64,
      filename: outputFilename,
      format,
      size: thumbnailBuffer.length
    });

  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ error: 'Frame extraction failed', details: error.message });
  } finally {
    try {
      if (localVideoPath) await fs.unlink(localVideoPath).catch(() => {});
      if (outputPath) await fs.unlink(outputPath).catch(() => {});
    } catch (e) {}
  }
});

app.listen(PORT, () => {
  console.log(`Frameshot processor running on port ${PORT}`);
});
