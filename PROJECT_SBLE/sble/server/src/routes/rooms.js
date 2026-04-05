const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const keycloak = require('../config/keycloak');
const { attachUser, requireRole } = require('../middleware/auth');
const { Room } = require('../models');

const guard = [keycloak.protect(), attachUser];

// Create a collaboration room (lecturers only)
router.post('/', ...guard, requireRole('lecturer', 'admin'), async (req, res) => {
  try {
    const { course_id, title } = req.body;
    const room = await Room.create({
      course_id, title,
      room_token: uuidv4(),
      created_by: req.user.id,
      is_active: true
    });
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active rooms for a course
router.get('/course/:courseId', ...guard, async (req, res) => {
  try {
    const rooms = await Room.findAll({
      where: { course_id: req.params.courseId, is_active: true }
    });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close a room
router.patch('/:id/close', ...guard, requireRole('lecturer', 'admin'), async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    await room.update({ is_active: false });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
