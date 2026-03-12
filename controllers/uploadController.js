import { uploadVideoToS3 } from '../services/s3FileService.js';
import { upsertVideoSession } from '../services/videoSessionStore.js';

function isValidSessionId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9-_]+$/.test(value);
}

export async function uploadVideo(req, res) {
  try {
    const source = req.get('X-Client-Source');
    const sessionId = req.get('X-Session-Id');

    if (source !== 'stickers-recorder') {
      return res.status(400).json({ error: 'Invalid upload source' });
    }

    if (!sessionId || !isValidSessionId(sessionId)) {
      return res.status(400).json({ error: 'Missing or invalid session id' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    if (!req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({ error: 'File must be a video.' });
    }

    const result = await uploadVideoToS3(req.file);

    const createdAt = new Date().toISOString();

    await upsertVideoSession({
      id: sessionId,
      key: result.key,
      contentType: result.contentType,
      size: result.size,
      createdAt,
      source,
    });

    res.json({
      message: 'Upload successful',
      id: sessionId,
      key: result.key,
      presignedUrl: result.presignedUrl,
      contentType: result.contentType,
      size: result.size,
      source,
      createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
}