const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const Report = require('../models/Report');

// @desc    Create a new report
// @route   POST /api/reports
// @access  Private
router.post('/', protect, async (req, res) => {
  const { reportedItem, onModel, reason } = req.body;

  try {
    const report = new Report({
      reporter: req.user._id,
      reportedItem,
      onModel,
      reason,
    });

    const createdReport = await report.save();
    res.status(201).json(createdReport);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Get all reports (Admin only)
// @route   GET /api/reports
// @access  Private/Admin
router.get('/', protect, authorize(['admin']), async (req, res) => {
  try {
    const reports = await Report.find({}).populate('reporter', 'name email').populate('reportedItem');
    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update report status (Admin only)
// @route   PUT /api/reports/:id
// @access  Private/Admin
router.put('/:id', protect, authorize(['admin']), async (req, res) => {
  const { status, notes } = req.body;

  try {
    const report = await Report.findById(req.params.id);

    if (report) {
      report.status = status || report.status;
      report.notes = notes || report.notes;

      const updatedReport = await report.save();
      res.json(updatedReport);
    } else {
      res.status(404).json({ message: 'Report not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;