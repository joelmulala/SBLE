const {
  CourseModule,
  CourseModuleItem,
  Material,
  Assignment,
  Quiz,
  Exam,
  Room
} = require('../../models');

const isLecturerRole = (role) => role === 'lecturer' || role === 'admin';

const RESOURCE_MODELS = {
  material: Material,
  assignment: Assignment,
  quiz: Quiz,
  exam: Exam
};

function mapMaterial(row) {
  return {
    type: 'material',
    id: row.id,
    title: row.title,
    sortOrder: row.module_sort_order || 0,
    meta: { fileName: row.file_name, fileType: row.file_type }
  };
}

function mapAssignment(row) {
  return {
    type: 'assignment',
    id: row.id,
    title: row.title,
    sortOrder: row.module_sort_order || 0,
    meta: { dueDate: row.due_date }
  };
}

function mapQuiz(row) {
  return {
    type: 'quiz',
    id: row.id,
    title: row.title,
    sortOrder: row.module_sort_order || 0,
    meta: { isPublished: row.is_published, timeLimitMinutes: row.time_limit_minutes }
  };
}

function mapExam(row) {
  return {
    type: 'exam',
    id: row.id,
    title: row.title,
    sortOrder: row.module_sort_order || 0,
    meta: { scheduledAt: row.scheduled_at, isReleased: row.is_released }
  };
}

function mapModuleItem(row) {
  return {
    type: row.item_type,
    id: row.id,
    title: row.title,
    sortOrder: row.sort_order || 0,
    meta: { linkUrl: row.link_url }
  };
}

function sortItems(items) {
  return items.sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.title).localeCompare(String(b.title)));
}

async function getCourseStructure(courseId, { role, studentFilters = true }) {
  const moduleWhere = { course_id: courseId };
  if (!isLecturerRole(role)) {
    moduleWhere.is_published = true;
  }

  const modules = await CourseModule.findAll({
    where: moduleWhere,
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
    include: [{ model: CourseModuleItem, as: 'items', required: false }]
  });

  const materialWhere = { course_id: courseId };
  const assignmentWhere = { course_id: courseId };
  const quizWhere = { course_id: courseId };
  const examWhere = { course_id: courseId };

  if (!isLecturerRole(role) && studentFilters) {
    quizWhere.is_published = true;
    examWhere.is_released = true;
  }

  const [materials, assignments, quizzes, exams, activeRooms] = await Promise.all([
    Material.findAll({ where: materialWhere, order: [['module_sort_order', 'ASC'], ['created_at', 'ASC']] }),
    Assignment.findAll({ where: assignmentWhere, order: [['module_sort_order', 'ASC'], ['created_at', 'ASC']] }),
    Quiz.findAll({ where: quizWhere, order: [['module_sort_order', 'ASC'], ['created_at', 'ASC']] }),
    Exam.findAll({ where: examWhere, order: [['module_sort_order', 'ASC'], ['created_at', 'ASC']] }),
    Room.findAll({
      where: { course_id: courseId, is_active: true },
      attributes: ['id', 'title', 'room_token', 'created_at'],
      order: [['created_at', 'DESC']]
    })
  ]);

  const unassigned = {
    materials: [],
    assignments: [],
    quizzes: [],
    exams: []
  };

  const byModuleId = new Map();

  const register = (moduleId, item) => {
    if (!moduleId) return;
    if (!byModuleId.has(moduleId)) byModuleId.set(moduleId, []);
    byModuleId.get(moduleId).push(item);
  };

  materials.forEach((row) => {
    const item = mapMaterial(row);
    if (row.module_id) register(row.module_id, item);
    else unassigned.materials.push(item);
  });

  assignments.forEach((row) => {
    const item = mapAssignment(row);
    if (row.module_id) register(row.module_id, item);
    else unassigned.assignments.push(item);
  });

  quizzes.forEach((row) => {
    const item = mapQuiz(row);
    if (row.module_id) register(row.module_id, item);
    else unassigned.quizzes.push(item);
  });

  exams.forEach((row) => {
    const item = mapExam(row);
    if (row.module_id) register(row.module_id, item);
    else unassigned.exams.push(item);
  });

  const structuredModules = modules.map((mod) => {
    const plain = mod.toJSON ? mod.toJSON() : mod;
    const resourceItems = sortItems(byModuleId.get(plain.id) || []);
    const placeholderItems = sortItems((plain.items || []).map(mapModuleItem));

    if (isLecturerRole(role) && activeRooms.length > 0 && placeholderItems.every((i) => i.type !== 'live')) {
      // Surface active live sessions at course level in overview only — not auto-injected per module
    }

    return {
      id: plain.id,
      title: plain.title,
      description: plain.description,
      sortOrder: plain.sort_order,
      isPublished: plain.is_published,
      items: sortItems([...resourceItems, ...placeholderItems])
    };
  });

  Object.keys(unassigned).forEach((key) => {
    unassigned[key] = sortItems(unassigned[key]);
  });

  return {
    modules: structuredModules,
    unassigned,
    liveSessions: activeRooms.map((room) => ({
      id: room.id,
      title: room.title || 'Live class',
      roomToken: room.room_token,
      startedAt: room.created_at
    }))
  };
}

async function assertModuleInCourse(moduleId, courseId) {
  const mod = await CourseModule.findOne({ where: { id: moduleId, course_id: courseId } });
  if (!mod) {
    const err = new Error('Module not found in this course');
    err.status = 404;
    throw err;
  }
  return mod;
}

async function createModule(courseId, payload) {
  const maxOrder = await CourseModule.max('sort_order', { where: { course_id: courseId } });
  const sortOrder = Number.isFinite(maxOrder) ? maxOrder + 1 : 0;

  return CourseModule.create({
    course_id: courseId,
    title: String(payload.title || '').trim().slice(0, 255),
    description: payload.description ? String(payload.description).trim().slice(0, 4000) : null,
    sort_order: sortOrder,
    is_published: payload.is_published !== false && payload.is_published !== 'false'
  });
}

async function updateModule(courseId, moduleId, payload) {
  const mod = await assertModuleInCourse(moduleId, courseId);
  if (payload.title !== undefined) mod.title = String(payload.title).trim().slice(0, 255);
  if (payload.description !== undefined) {
    mod.description = payload.description ? String(payload.description).trim().slice(0, 4000) : null;
  }
  if (payload.is_published !== undefined) {
    mod.is_published = Boolean(payload.is_published === true || payload.is_published === 'true');
  }
  if (payload.sort_order !== undefined) mod.sort_order = Number.parseInt(payload.sort_order, 10) || 0;
  await mod.save();
  return mod;
}

async function deleteModule(courseId, moduleId) {
  const mod = await assertModuleInCourse(moduleId, courseId);
  await mod.destroy();
}

async function reorderModules(courseId, moduleIds = []) {
  const ids = Array.isArray(moduleIds) ? moduleIds.map((id) => Number.parseInt(id, 10)).filter(Boolean) : [];
  await Promise.all(ids.map((id, index) => CourseModule.update(
    { sort_order: index },
    { where: { id, course_id: courseId } }
  )));
}

async function createModuleItem(courseId, moduleId, payload) {
  await assertModuleInCourse(moduleId, courseId);
  const itemType = String(payload.item_type || payload.itemType || 'link').toLowerCase();
  const allowed = ['link', 'communications', 'live'];
  if (!allowed.includes(itemType)) {
    const err = new Error(`Invalid item type. Allowed: ${allowed.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const maxOrder = await CourseModuleItem.max('sort_order', { where: { module_id: moduleId } });
  return CourseModuleItem.create({
    module_id: moduleId,
    item_type: itemType,
    title: String(payload.title || '').trim().slice(0, 255) || defaultItemTitle(itemType),
    link_url: payload.link_url || payload.linkUrl || null,
    sort_order: Number.isFinite(maxOrder) ? maxOrder + 1 : 0
  });
}

function defaultItemTitle(itemType) {
  if (itemType === 'communications') return 'Course announcements';
  if (itemType === 'live') return 'Join live class';
  return 'Resource link';
}

async function deleteModuleItem(courseId, moduleId, itemId) {
  await assertModuleInCourse(moduleId, courseId);
  const item = await CourseModuleItem.findOne({ where: { id: itemId, module_id: moduleId } });
  if (!item) {
    const err = new Error('Module item not found');
    err.status = 404;
    throw err;
  }
  await item.destroy();
}

async function assignResourceToModule(courseId, { itemType, itemId, moduleId, sortOrder }) {
  const Model = RESOURCE_MODELS[itemType];
  if (!Model) {
    const err = new Error('Invalid resource type');
    err.status = 400;
    throw err;
  }

  const resource = await Model.findOne({ where: { id: itemId, course_id: courseId } });
  if (!resource) {
    const err = new Error('Resource not found in this course');
    err.status = 404;
    throw err;
  }

  if (moduleId) {
    await assertModuleInCourse(moduleId, courseId);
    resource.module_id = moduleId;
    if (sortOrder !== undefined) {
      resource.module_sort_order = Number.parseInt(sortOrder, 10) || 0;
    } else {
      const maxOrder = await Model.max('module_sort_order', { where: { module_id: moduleId, course_id: courseId } });
      resource.module_sort_order = Number.isFinite(maxOrder) ? maxOrder + 1 : 0;
    }
  } else {
    resource.module_id = null;
    resource.module_sort_order = 0;
  }

  await resource.save();
  return resource;
}

async function reorderModuleItems(courseId, moduleId, orderedItems = []) {
  await assertModuleInCourse(moduleId, courseId);

  for (let index = 0; index < orderedItems.length; index += 1) {
    const entry = orderedItems[index];
    const type = String(entry.type || entry.itemType || '').toLowerCase();
    const id = Number.parseInt(entry.id, 10);
    if (!id) continue;

    if (['material', 'assignment', 'quiz', 'exam'].includes(type)) {
      const Model = RESOURCE_MODELS[type];
      await Model.update(
        { module_sort_order: index, module_id: moduleId },
        { where: { id, course_id: courseId } }
      );
    } else {
      await CourseModuleItem.update(
        { sort_order: index },
        { where: { id, module_id: moduleId } }
      );
    }
  }
}

module.exports = {
  getCourseStructure,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  createModuleItem,
  deleteModuleItem,
  assignResourceToModule,
  reorderModuleItems,
  assertModuleInCourse,
  isLecturerRole
};
