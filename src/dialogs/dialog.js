const ViewsManager = require('../views_manager');

/**
 * Generates messages.
 */
class Dialog {
  static STATUS_BLOCKED = 'blocked';
  static STATUS_COMPLETED = 'completed';
  static STATUS_DISCARDED = 'discarded';
  static STATUS_READY = 'ready';
  static STATUS_WAITING = 'waiting';

  /**
   * Constructor.
   * @param {Object} parameters the dialog parameters
   */
  constructor(config, brain, parameters = {}) {
    console.log('Dialog.constructor', parameters);
    this.maxComplexity = Number.MAX_SAFE_INTEGER;
    this.config = config;
    this.brain = brain;
    this.parameters = parameters;
    this.viewsManager = new ViewsManager(config);
    this.name = this.getDialogName();
    console.log('Dialog.constructor: name', this.name);
  }

  pushMessages(responses, messages) {
    for (const message of messages) {
      responses.push(message);
    }
  }

  pushMessage(responses, message) {
    responses.push(message);
  }

  getDialogName() {
    return this.constructor.name.toLowerCase().replace(/dialog/g, '');
  }
}

module.exports = Dialog;
