/**
 * Modals Module Exports
 *
 * Centralized exports for all modal components
 */

const { NewProjectModal } = require('./NewProjectModal');
const { ConfirmModal } = require('./ConfirmModal');
const { InfoModal } = require('./InfoModal');
const { ExportOptionsModal } = require('./ExportOptionsModal');
const { AddTagModal } = require('./AddTagModal');

module.exports = {
  // Modals
  NewProjectModal,
  ConfirmModal,
  InfoModal,
  ExportOptionsModal,
  AddTagModal
};
