const router = require('express').Router();
const multer = require('multer');
const { Op } = require('sequelize');
const keycloak = require('../config/keycloak');
const logger = require('../config/logger');
const { attachUser, requireLecturer, requireStudent, authorizeCourseAccess, audit } = require('../middleware/auth');
const { Course, Enrollment, User, Discussion, sequelize } = require('../models');

const guard = [keycloak.protect(), attachUser];
const PERFORMANCE_SERVICE_URL = process.env.PERFORMANCE_SERVICE_URL || 'http://localhost:8000/analyze-performance';
const PERFORMANCE_SERVICE_TIMEOUT_MS = Number.parseInt(process.env.PERFORMANCE_SERVICE_TIMEOUT_MS || '3000', 10);
const { getCoursePerformance } = require('../services/academic/gradebookService');
const { buildDiscussionThreads, notifyCourseStudents } = require('../services/communication/communicationService');
const {
  getCourseStructure,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  createModuleItem,
  deleteModuleItem,
  assignResourceToModule,
  reorderModuleItems
} = require('../services/academic/courseModuleService');

const sanitizeMessage = (value) => String(value || '')
  .replace(/[<>]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 8000);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsv = file?.mimetype === 'text/csv'
      || file?.mimetype === 'application/vnd.ms-excel'
      || file?.originalname?.toLowerCase().endsWith('.csv');

    if (!isCsv) return cb(new Error('Only CSV files are allowed'));
    cb(null, true);
  }
});

const uploadEnrollmentCsv = (req, res, next) => {
  csvUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

const getManagedCourse = async (courseId, user) => {
  const course = await Course.findByPk(courseId);
  if (!course || !course.is_active) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }

  if (user.role === 'admin') {
    return course;
  }

  if (user.role !== 'lecturer') {
    const err = new Error('Forbidden: only the assigned lecturer can manage enrollments');
    err.status = 403;
    throw err;
  }

  if (String(course.lecturer_id) !== String(user.id)) {
    const err = new Error('Forbidden: course not assigned to this lecturer');
    err.status = 403;
    throw err;
  }

  return course;
};

const findStudentRecord = async (identifier) => {
  const value = String(identifier || '').trim();
  if (!value) return null;

  return User.findOne({
    where: {
      [Op.or]: [{ student_id: value }, { id: value }],
      role: 'student',
      is_active: true
    }
  });
};

const createEnrollmentRecord = async (courseId, studentId) => Enrollment.findOrCreate({
  where: { course_id: courseId, student_id: studentId },
  defaults: { course_id: courseId, student_id: studentId }
});

const parseStudentIdsFromCsv = (buffer) => {
  const lines = String(buffer || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const firstLine = lines[0].toLowerCase();
  const dataLines = firstLine.includes('student_id') ? lines.slice(1) : lines;

  return [...new Set(dataLines.map(line => line.split(',')[0].trim()).filter(Boolean))];
};

// Get all courses (admins see all, lecturers see their own, students see enrolled)
router.get('/', ...guard, async (req, res) => {
  try {
    const { id, role } = req.user;
    let courses;

    if (role === 'admin') {
      courses = await Course.findAll({
        where: { is_active: true },
        include: [{ model: User, as: 'lecturer' }]
      });
    } else if (role === 'lecturer') {
      courses = await Course.findAll({
        where: { lecturer_id: id, is_active: true },
        include: [{ model: User, as: 'lecturer' }]
      });
    } else {
      const enrollments = await Enrollment.findAll({
        where: { student_id: id },
        include: [{ model: Course, include: [{ model: User, as: 'lecturer' }] }]
      });
      courses = enrollments.map(e => e.Course).filter(Boolean);
    }

    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create course (lecturers/admins only)
router.post('/', ...guard, requireLecturer, audit('CREATE_COURSE', 'course'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const course = await Course.create({ title, description, lecturer_id: req.user.id });
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enroll student in course (owner lecturer only; add by student_id)
router.post('/:id/enroll', ...guard, requireLecturer, audit('ENROLL_COURSE', 'course'), async (req, res) => {
  try {
    await getManagedCourse(req.params.id, req.user);

    const studentIdentifier = String(req.body?.student_id || '').trim();
    if (!studentIdentifier) {
      return res.status(400).json({ error: 'student_id is required' });
    }

    const student = await findStudentRecord(studentIdentifier);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const [enrollment, created] = await createEnrollmentRecord(req.params.id, student.id);
    if (!created) {
      return res.status(409).json({ error: 'Student already enrolled in this course' });
    }

    res.status(201).json({
      enrollment,
      student: {
        id: student.id,
        student_id: student.student_id,
        full_name: student.full_name,
        email: student.email
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// List enrollments for a course (assigned lecturer/admin only)
router.get('/:id/enrollments', ...guard, requireLecturer,
  authorizeCourseAccess(req => req.params.id, {
    managerOnly: true,
    managerMessage: 'Forbidden: only the assigned lecturer or admin can view enrollments'
  }),
  async (req, res) => {
    try {
      const enrollments = await Enrollment.findAll({
        where: { course_id: req.params.id },
        include: [{
          model: User,
          as: 'student',
          attributes: ['id', 'student_id', 'full_name', 'email', 'program', 'year_of_study', 'mode']
        }],
        order: [['id', 'DESC']]
      });

      res.json(enrollments.map((enrollment) => ({
        id: enrollment.id,
        course_id: enrollment.course_id,
        student_id: enrollment.student?.student_id || enrollment.student_id,
        student: enrollment.student || null
      })));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// List students available for enrollment in a course (assigned lecturer/admin only)
router.get('/:id/enrollment-candidates', ...guard, requireLecturer,
  authorizeCourseAccess(req => req.params.id, {
    managerOnly: true,
    managerMessage: 'Forbidden: only the assigned lecturer or admin can manage enrollments'
  }),
  async (req, res) => {
    try {
      const search = String(req.query?.q || '').trim();
      const limit = Math.min(200, Math.max(1, Number.parseInt(req.query?.limit || '100', 10) || 100));

      const existingEnrollments = await Enrollment.findAll({
        where: { course_id: req.params.id },
        attributes: ['student_id']
      });

      const enrolledIds = existingEnrollments.map((row) => row.student_id).filter(Boolean);
      const where = {
        role: 'student',
        is_active: true,
        ...(enrolledIds.length ? { id: { [Op.notIn]: enrolledIds } } : {})
      };

      if (search) {
        where[Op.or] = [
          { student_id: { [Op.iLike]: `%${search}%` } },
          { full_name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const students = await User.findAll({
        where,
        attributes: ['id', 'student_id', 'full_name', 'email', 'program', 'year_of_study', 'mode'],
        order: [['student_id', 'ASC'], ['full_name', 'ASC']],
        limit
      });

      return res.json(students);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// Batch enroll students from CSV (assigned lecturer/admin only)
router.post('/:id/enroll/csv', ...guard, requireLecturer, uploadEnrollmentCsv, audit('BATCH_ENROLL_COURSE', 'course'), async (req, res) => {
  try {
    await getManagedCourse(req.params.id, req.user);

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const studentIds = parseStudentIdsFromCsv(req.file.buffer);
    if (!studentIds.length) {
      return res.status(400).json({ error: 'No student_id values found in CSV' });
    }

    const result = {
      processed: studentIds.length,
      enrolled: [],
      alreadyEnrolled: [],
      notFound: []
    };

    for (const studentId of studentIds) {
      const student = await findStudentRecord(studentId);
      if (!student) {
        result.notFound.push(studentId);
        continue;
      }

      const [enrollment, created] = await createEnrollmentRecord(req.params.id, student.id);
      const summary = {
        id: student.id,
        student_id: student.student_id,
        full_name: student.full_name,
        email: student.email,
        enrollment_id: enrollment.id
      };

      if (created) result.enrolled.push(summary);
      else result.alreadyEnrolled.push(summary);
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Remove student from course (assigned lecturer/admin only)
router.delete('/:id/enroll/:studentId', ...guard, requireLecturer, audit('REMOVE_ENROLLMENT', 'course'), async (req, res) => {
  try {
    await getManagedCourse(req.params.id, req.user);

    const student = await findStudentRecord(req.params.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const deleted = await Enrollment.destroy({
      where: {
        course_id: req.params.id,
        student_id: student.id
      }
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({
      removed: true,
      course_id: Number(req.params.id),
      student_id: student.id
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Update course (assigned lecturer/admin only)
router.put('/:id', ...guard, requireLecturer, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    if (req.user.role === 'lecturer' && String(course.lecturer_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: course not assigned to this lecturer' });
    }

    const { title, description } = req.body;

    if (title !== undefined && (!String(title).trim() || String(title).trim().length < 3)) {
      return res.status(400).json({ error: 'Title must be at least 3 characters long' });
    }

    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ error: 'Description must be a string' });
    }

    await course.update({
      title: title !== undefined ? String(title).trim() : course.title,
      description: description !== undefined ? description.trim() : course.description
    });

    const updatedCourse = await Course.findByPk(req.params.id, {
      include: [{ model: User, as: 'lecturer' }]
    });

    res.json(updatedCourse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List course discussions (course members only)
router.get('/:id/discussions', ...guard, authorizeCourseAccess(req => req.params.id), async (req, res) => {
  try {
    const discussions = await Discussion.findAll({
      where: { course_id: req.params.id },
      include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }],
      order: [['created_at', 'ASC']]
    });

    if (req.query.threaded === 'true') {
      return res.json(buildDiscussionThreads(discussions));
    }

    res.json(discussions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post to course discussions (course members only)
router.post('/:id/discussions', ...guard, authorizeCourseAccess(req => req.params.id), audit('CREATE_DISCUSSION', 'discussion'), async (req, res) => {
  try {
    const message = sanitizeMessage(req.body?.message);
    if (!message) {
      return res.status(400).json({ error: 'Message must not be empty' });
    }

    const parentId = req.body?.parent_id ? Number.parseInt(req.body.parent_id, 10) : null;
    if (parentId) {
      const parent = await Discussion.findOne({
        where: { id: parentId, course_id: req.params.id }
      });
      if (!parent) return res.status(400).json({ error: 'Parent discussion not found in this course' });
    }

    const discussion = await Discussion.create({
      course_id: req.params.id,
      user_id: req.user.id,
      parent_id: parentId,
      message
    });

    const createdDiscussion = await Discussion.findByPk(discussion.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }]
    });

    if (parentId) {
      await notifyCourseStudents(req.params.id, 'discussion-reply', {
        type: 'discussion_reply',
        message: 'New reply in course discussion',
        courseId: Number(req.params.id),
        discussionId: createdDiscussion.id,
        parentId
      });
    }

    res.status(201).json(createdDiscussion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:courseId/discussions/:discussionId', ...guard, authorizeCourseAccess((req) => req.params.courseId), async (req, res) => {
  try {
    const discussion = await Discussion.findOne({
      where: { id: req.params.discussionId, course_id: req.params.courseId }
    });
    if (!discussion) return res.status(404).json({ error: 'Discussion not found' });

    const isOwner = String(discussion.user_id) === String(req.user.id);
    const isManager = req.user.role === 'lecturer' || req.user.role === 'admin';
    if (!isOwner && !isManager) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await discussion.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single course with RBAC-aware access control
router.get('/:id/performance', ...guard, requireLecturer,
  authorizeCourseAccess(req => req.params.id, {
    managerOnly: true,
    managerMessage: 'Forbidden: only the assigned lecturer or admin can view course performance'
  }),
  async (req, res) => {
    try {
      const courseId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(courseId)) {
        return res.status(400).json({ error: 'Invalid course id' });
      }

      const enrichedPayload = await getCoursePerformance(courseId);
      // Keep optional integration hook: if the service is reachable and supports
      // this payload shape, it may post-process further. Otherwise return Node.js result.
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PERFORMANCE_SERVICE_TIMEOUT_MS);
        const response = await fetch(PERFORMANCE_SERVICE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const serviceData = await response.json();
            if (Array.isArray(serviceData?.performance)) {
              return res.json({
                ...serviceData,
                assessment_metrics: serviceData.assessment_metrics ?? enrichedPayload.assessment_metrics
              });
            }
          }
        }
      } catch (serviceError) {
        logger.error(`Performance service unavailable, returning Node.js analytics: ${serviceError.message}`);
      }

      return res.json(enrichedPayload);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.get('/:id/structure', ...guard, authorizeCourseAccess((req) => req.params.id), async (req, res) => {
  try {
    const structure = await getCourseStructure(req.params.id, { role: req.user.role });
    res.json(structure);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id/modules', ...guard, authorizeCourseAccess((req) => req.params.id), async (req, res) => {
  try {
    const structure = await getCourseStructure(req.params.id, { role: req.user.role });
    res.json(structure.modules);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/modules', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.id, { managerOnly: true }),
  audit('CREATE_COURSE_MODULE', 'course_module'),
  async (req, res) => {
    try {
      const title = String(req.body?.title || '').trim();
      if (!title) return res.status(400).json({ error: 'Module title is required' });
      const created = await createModule(req.params.id, req.body);
      res.status(201).json(created);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.patch('/:id/modules/:moduleId', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.id, { managerOnly: true }),
  audit('UPDATE_COURSE_MODULE', 'course_module'),
  async (req, res) => {
    try {
      const updated = await updateModule(req.params.id, req.params.moduleId, req.body);
      res.json(updated);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.delete('/:id/modules/:moduleId', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.id, { managerOnly: true }),
  audit('DELETE_COURSE_MODULE', 'course_module'),
  async (req, res) => {
    try {
      await deleteModule(req.params.id, req.params.moduleId);
      res.json({ success: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.put('/:id/modules/reorder', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.id, { managerOnly: true }),
  async (req, res) => {
    try {
      await reorderModules(req.params.id, req.body?.moduleIds || req.body?.module_ids);
      const structure = await getCourseStructure(req.params.id, { role: req.user.role });
      res.json(structure.modules);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.post('/:id/modules/:moduleId/items', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.id, { managerOnly: true }),
  async (req, res) => {
    try {
      const created = await createModuleItem(req.params.id, req.params.moduleId, req.body);
      res.status(201).json(created);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.delete('/:id/modules/:moduleId/items/:itemId', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.id, { managerOnly: true }),
  async (req, res) => {
    try {
      await deleteModuleItem(req.params.id, req.params.moduleId, req.params.itemId);
      res.json({ success: true });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.patch('/:id/modules/assign', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.id, { managerOnly: true }),
  async (req, res) => {
    try {
      const itemType = req.body?.itemType || req.body?.item_type;
      const itemId = req.body?.itemId || req.body?.item_id;
      const moduleId = req.body?.moduleId ?? req.body?.module_id ?? null;
      if (!itemType || !itemId) {
        return res.status(400).json({ error: 'itemType and itemId are required' });
      }
      const updated = await assignResourceToModule(req.params.id, {
        itemType,
        itemId,
        moduleId: moduleId === null || moduleId === '' ? null : moduleId,
        sortOrder: req.body?.sortOrder ?? req.body?.sort_order
      });
      res.json(updated);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.put('/:id/modules/:moduleId/items/reorder', ...guard, requireLecturer,
  authorizeCourseAccess((req) => req.params.id, { managerOnly: true }),
  async (req, res) => {
    try {
      await reorderModuleItems(
        req.params.id,
        req.params.moduleId,
        req.body?.items || req.body?.orderedItems
      );
      const structure = await getCourseStructure(req.params.id, { role: req.user.role });
      res.json(structure);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.get('/:id', ...guard, async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id, { include: [{ model: User, as: 'lecturer' }] });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { role } = req.user;
    if (role === 'admin') return res.json(course);

    if (role === 'lecturer') {
      if (String(course.lecturer_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Forbidden: course not assigned to this lecturer' });
      }
      return res.json(course);
    }

    const enrollment = await Enrollment.findOne({
      where: { course_id: req.params.id, student_id: req.user.id }
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'Forbidden: not enrolled in this course' });
    }

    res.json(course);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
