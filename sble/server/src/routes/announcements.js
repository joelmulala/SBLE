const router = require('express').Router();

const path = require('path');

const fs = require('fs');

const multer = require('multer');

const keycloak = require('../config/keycloak');

const { attachUser, requireLecturer, authorizeCourseAccess, audit } = require('../middleware/auth');

const { Announcement, User, Course } = require('../models');

const { announcementVisibilityWhere, notifyCourseStudents, isLecturerRole } = require('../services/communication/communicationService');

const { ALLOWED_TYPES } = require('../services/storage/uploadService');

const { sanitizeFilename } = require('../utils/validation');



const guard = [keycloak.protect(), attachUser];



const uploadDir = path.join(__dirname, '../../uploads/announcements');

if (!fs.existsSync(uploadDir)) {

  fs.mkdirSync(uploadDir, { recursive: true });

}



const upload = multer({

  storage: multer.diskStorage({

    destination: uploadDir,

    filename: (_req, file, cb) => {

      const safe = sanitizeFilename(file.originalname, 'attachment');

      cb(null, `${Date.now()}-${safe}`);

    }

  }),

  limits: { fileSize: 10 * 1024 * 1024 },

  fileFilter: (_req, file, cb) => {

    if (ALLOWED_TYPES.includes(file.mimetype)) {

      cb(null, true);

    } else {

      cb(new Error(`File type not allowed: ${file.mimetype}`), false);

    }

  }

});



const sanitizeText = (value, maxLen) => {

  const text = String(value || '').trim();

  if (!text) return '';

  return text.slice(0, maxLen);

};



const parsePublishAt = (value) => {

  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;

};



const includeAuthor = [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }];



const loadAnnouncementForManager = async (id, user) => {

  const announcement = await Announcement.findByPk(id);

  if (!announcement) {

    const err = new Error('Announcement not found');

    err.status = 404;

    throw err;

  }

  const course = await Course.findByPk(announcement.course_id);

  if (!course) {

    const err = new Error('Course not found');

    err.status = 404;

    throw err;

  }

  if (user.role !== 'admin' && String(course.lecturer_id) !== String(user.id)) {

    const err = new Error('Forbidden: only the assigned lecturer can manage this announcement');

    err.status = 403;

    throw err;

  }

  return announcement;

};



const resolveAttachmentPath = (filename) => {

  const safeName = path.basename(String(filename || ''));

  const filePath = path.join(uploadDir, safeName);

  const resolved = path.resolve(filePath);

  const root = path.resolve(uploadDir);

  if (!resolved.startsWith(root)) {

    const err = new Error('Invalid attachment path');

    err.status = 400;

    throw err;

  }

  return resolved;

};



router.get('/course/:courseId', ...guard, authorizeCourseAccess((req) => req.params.courseId), async (req, res) => {

  try {

    const announcements = await Announcement.findAll({

      where: { course_id: req.params.courseId, ...announcementVisibilityWhere(req.user.role) },

      include: includeAuthor,

      order: [['is_pinned', 'DESC'], ['created_at', 'DESC']]

    });

    res.json(announcements);

  } catch (err) {

    res.status(err.status || 500).json({ error: err.message });

  }

});



router.post('/course/:courseId', ...guard, requireLecturer,

  authorizeCourseAccess((req) => req.params.courseId, {

    managerOnly: true,

    managerMessage: 'Forbidden: only the assigned lecturer can post announcements'

  }),

  upload.single('attachment'),

  audit('CREATE_ANNOUNCEMENT', 'announcement'),

  async (req, res) => {

    try {

      const title = sanitizeText(req.body?.title, 255);

      const body = sanitizeText(req.body?.body, 8000);

      if (!title || !body) {

        return res.status(400).json({ error: 'Title and body are required' });

      }



      const publishAt = parsePublishAt(req.body?.publish_at);

      const isHidden = Boolean(req.body?.is_hidden === true || req.body?.is_hidden === 'true');

      const shouldNotify = !isHidden && (!publishAt || publishAt <= new Date());



      const announcement = await Announcement.create({

        course_id: req.params.courseId,

        author_id: req.user.id,

        title,

        body,

        is_pinned: Boolean(req.body?.is_pinned === true || req.body?.is_pinned === 'true'),

        link_url: sanitizeText(req.body?.link_url, 500) || null,

        attachment_name: req.file ? sanitizeFilename(req.file.originalname) : null,

        attachment_path: req.file ? req.file.filename : null,

        publish_at: publishAt,

        is_hidden: isHidden

      });



      const created = await Announcement.findByPk(announcement.id, { include: includeAuthor });



      if (shouldNotify) {

        await notifyCourseStudents(req.params.courseId, 'announcement', {

          type: 'announcement',

          title: 'New course announcement',

          message: title,

          courseId: Number(req.params.courseId),

          announcementId: created.id

        });

      }



      res.status(201).json(created);

    } catch (err) {

      res.status(err.status || 500).json({ error: err.message });

    }

  }

);



router.patch('/:id', ...guard, requireLecturer, upload.single('attachment'), audit('UPDATE_ANNOUNCEMENT', 'announcement'), async (req, res) => {

  try {

    const announcement = await loadAnnouncementForManager(req.params.id, req.user);



    if (req.body?.title !== undefined) announcement.title = sanitizeText(req.body.title, 255);

    if (req.body?.body !== undefined) announcement.body = sanitizeText(req.body.body, 8000);

    if (req.body?.is_pinned !== undefined) {

      announcement.is_pinned = Boolean(req.body.is_pinned === true || req.body.is_pinned === 'true');

    }

    if (req.body?.link_url !== undefined) announcement.link_url = sanitizeText(req.body.link_url, 500) || null;

    if (req.body?.publish_at !== undefined) announcement.publish_at = parsePublishAt(req.body.publish_at);

    if (req.body?.is_hidden !== undefined) {

      announcement.is_hidden = Boolean(req.body.is_hidden === true || req.body.is_hidden === 'true');

    }

    if (req.file) {

      announcement.attachment_name = sanitizeFilename(req.file.originalname);

      announcement.attachment_path = req.file.filename;

    }



    await announcement.save();

    const updated = await Announcement.findByPk(announcement.id, { include: includeAuthor });

    res.json(updated);

  } catch (err) {

    res.status(err.status || 500).json({ error: err.message });

  }

});



router.get('/:id/attachment', ...guard,

  authorizeCourseAccess(async (req) => {

    const announcement = await Announcement.findByPk(req.params.id);

    if (!announcement) {

      const err = new Error('Announcement not found');

      err.status = 404;

      throw err;

    }

    req.announcement = announcement;

    return announcement.course_id;

  }),

  async (req, res) => {

    try {

      const announcement = req.announcement;

      if (!announcement?.attachment_path) return res.status(404).json({ error: 'No attachment' });



      const visible = isLecturerRole(req.user.role)

        || (!announcement.is_hidden && (!announcement.publish_at || new Date(announcement.publish_at) <= new Date()));



      if (!visible) return res.status(403).json({ error: 'Announcement not available' });



      const filePath = resolveAttachmentPath(announcement.attachment_path);

      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });



      res.download(filePath, announcement.attachment_name || 'attachment');

    } catch (err) {

      res.status(err.status || 500).json({ error: err.message });

    }

  }

);



router.delete('/:id', ...guard, requireLecturer, audit('DELETE_ANNOUNCEMENT', 'announcement'), async (req, res) => {

  try {

    const announcement = await loadAnnouncementForManager(req.params.id, req.user);

    await announcement.destroy();

    res.json({ success: true });

  } catch (err) {

    res.status(err.status || 500).json({ error: err.message });

  }

});



module.exports = router;

