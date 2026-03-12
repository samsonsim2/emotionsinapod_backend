// routes/index.js
import { Router } from 'express';
import upload from '../middleware/upload.js';

import { healthCheck } from '../controllers/healthController.js';
import { debugS3 } from '../controllers/debugController.js';
import { uploadVideo } from '../controllers/uploadController.js';
import { getFiles, getVideoUrlById } from '../controllers/fileController.js';
import {
  getDashboardFiles,
  deleteDashboardFile,
} from '../controllers/dashboardController.js';

const router = Router();

router.get('/health', healthCheck);
router.get('/debug/s3', debugS3);

router.post('/upload', upload.single('video'), uploadVideo);

router.get('/files', getFiles);

// fetch video by session id
router.get('/videos/:id/url', getVideoUrlById);

// dashboard routes
router.get('/dashboard/files', getDashboardFiles);
router.delete('/dashboard/files', deleteDashboardFile);

export default router;