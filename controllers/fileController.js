import { listRecentFiles, getPresignedVideoUrl } from '../services/s3FileService.js';
import { getVideoSessionById } from '../services/videoSessionStore.js';

export async function getFiles(req, res) {
  try {
    const files = await listRecentFiles(12);
    res.json({ count: files.length, files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files', details: err.message });
  }
}

export async function getVideoUrlById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Missing video id' });
    }

    const record = await getVideoSessionById(id);

    if (!record) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const presignedUrl = await getPresignedVideoUrl(record.key, 300);

    return res.json({
      id: record.id,
      key: record.key,
      presignedUrl,
      contentType: record.contentType,
      size: record.size,
      createdAt: record.createdAt,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to get video URL',
      details: err.message,
    });
  }
}