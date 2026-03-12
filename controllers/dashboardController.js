import { listFilesPaginated, deleteFileFromS3 } from '../services/s3FileService.js';
import { deleteVideoSessionsByKey } from '../services/videoSessionStore.js';

export async function getDashboardFiles(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 8);

    const result = await listFilesPaginated(page, limit);

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to load dashboard files',
      details: err.message,
    });
  }
}

export async function deleteDashboardFile(req, res) {
  try {
    const { key } = req.body;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid key' });
    }

    await deleteFileFromS3(key);
    await deleteVideoSessionsByKey(key);

    return res.json({
      success: true,
      deletedKey: key,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to delete file',
      details: err.message,
    });
  }
}