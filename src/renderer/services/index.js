/**
 * Services Module Exports
 *
 * Centralized exports for all services
 */

const { ProjectService, projectService } = require('./projectService');
const { UserService, userService } = require('./userService');
const { GroupService, groupService } = require('./groupService');
const { ImageService, imageService } = require('./imageService');

module.exports = {
  // Classes
  ProjectService,
  UserService,
  GroupService,
  ImageService,

  // Singleton instances
  projectService,
  userService,
  groupService,
  imageService
};
