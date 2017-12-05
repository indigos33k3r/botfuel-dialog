/**
 * Copyright (c) 2017 - present, Botfuel (https://www.botfuel.io).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const rp = require('request-promise');
const logger = require('logtown')('MessengerAdapter');
const { PostbackMessage, UserImageMessage, UserTextMessage } = require('../messages');
const WebAdapter = require('./web-adapter');

/**
 * Adapter for the Facebook Messenger messaging platform.
 * @extends WebAdapter
 */
class MessengerAdapter extends WebAdapter {
  /** @inheritDoc */
  createRoutes(app) {
    logger.debug('createRoutes');
    super.createRoutes(app);
    app.get('/webhook', (req, res) => this.validateWebhook(req, res));
  }

  /**
   * Webhook used by Facebook Messenger to validate the bot.
   * @async
   * @private
   * @param {Object} req - the request object
   * @param {Object} res - the response object
   * @returns {Promise.<void>}
   */
  async validateWebhook(req, res) {
    logger.debug('validateWebhook');
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.FB_VERIFY_TOKEN) {
      logger.debug('validateWebhook: OK!');
      res.status(200).send(req.query['hub.challenge']);
    } else {
      console.error('validateWebhook: KO!');
      res.sendStatus(403);
    }
  }

  /** @inheritDoc */
  async handleMessage(req, res) {
    logger.debug('handleMessage');
    const { object, entry } = req.body.data;
    if (object === 'page') {
      // @TODO: implement the method getUserProfile here
      entry.forEach((entryItem) => {
        entryItem.messaging.forEach(async (event) => {
          logger.debug('handleMessage: event', JSON.stringify(event));
          await this.processEvent(event);
        });
      });
      res.sendStatus(200);
    }
  }

  /**
   * Processes a received event (message, postback, ...).
   * @async
   * @param {Object} event - the messenger event
   * @returns {Promise.<void>}
   */
  async processEvent(event) {
    const { sender, message, postback } = event;
    const userId = sender.id; // messenger user id
    logger.debug('processEvent', userId, this.bot.id, JSON.stringify(event));
    // init user if necessary
    await this.bot.brain.initUserIfNecessary(userId);
    // set userMessage
    let userMessage = null;
    if (message) {
      const { text, attachments } = message;
      // user send attachments
      if (attachments.length > 0 && attachments[0].type === 'image') {
        userMessage = new UserImageMessage(attachments[0].payload);
      } else {
        userMessage = new UserTextMessage(text);
      }
    } else if (postback) {
      const { dialog, entities } = JSON.parse(postback.payload);
      userMessage = new PostbackMessage(dialog, entities);
    }
    await this.bot.respond(userMessage.toJson(this.bot.id, userId));
  }

  /** @inheritDoc */
  getUri() {
    return 'https://graph.facebook.com/v2.6/me/messages';
  }

  /** @inheritDoc */
  getQs() {
    return {
      access_token: process.env.FB_PAGE_ACCESS_TOKEN,
    };
  }

  /** @inheritDoc */
  getBody(botMessage) {
    const message = this.adapt(botMessage);
    return {
      recipient: {
        id: botMessage.user,
      },
      message,
    };
  }

  /**
   * @private
   * @param {Object} payload - the payload
   * @returns {Object} the text
   */
  adaptText(payload) {
    return {
      text: payload.value,
    };
  }

  /**
   * @private
   * @param {Object} payload - the payload
   * @returns {Object} the quickreplies
   */
  adaptQuickreplies(payload) {
    return {
      text: payload.options.text,
      quick_replies: payload.value.map(qr => ({
        content_type: 'text',
        title: qr,
        payload: qr,
      })),
    };
  }

  /**
   * @private
   * @param {Object} payload - the payload
   * @returns {Object} the image
   */
  adaptImage(payload) {
    return {
      attachment: {
        type: 'image',
        payload: {
          url: payload.value,
        },
      },
    };
  }

  /**
   * @private
   * @param {Object} payload - the payload
   * @returns {Object} the actions
   */
  adaptActions(payload) {
    logger.debug('adaptActions', payload);
    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: payload.options.text,
          buttons: payload.value.map(MessengerAdapter.adaptAction),
        },
      },
    };
  }

  /**
   * @private
   * @param {Object} payload - the payload
   * @returns {Object} the cards
   */
  adaptCards(payload) {
    logger.debug('adaptCards', payload);
    const elements = payload.value.map((card) => {
      const buttons = card.buttons.map(MessengerAdapter.adaptAction);
      return Object.assign(card, { buttons });
    });
    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements,
        },
      },
    };
  }

  /**
   * Adapts payload.
   * @private
   * @param {Object} botMessage - the bot message
   * @returns {Object} the adapted message
   */
  adapt(botMessage) {
    logger.debug('adapt', botMessage);
    const payload = botMessage.payload;
    switch (botMessage.type) {
      case 'text':
        return this.adaptText(payload);
      case 'quickreplies':
        return this.adaptQuickreplies(payload);
      case 'image':
        return this.adaptImage(payload);
      case 'actions':
        return this.adaptActions(payload);
      case 'cards':
        return this.adaptCards(payload);
      default:
        return null;
    }
  }

  /**
   * @private
   * @static
   * @param {Object} action - the action object
   * @returns {Object|null} the adapted action or null if action type is not valid
   */
  static adaptAction(action) {
    logger.debug('adaptAction', action);
    switch (action.type) {
      case 'postback':
        return {
          type: 'postback',
          title: action.text,
          payload: JSON.stringify(action.value),
        };
      case 'link':
        return {
          type: 'web_url',
          title: action.text,
          url: action.value,
        };
      default:
        return null;
    }
  }

  /**
   * Get user profile informations and store it into the brain
   * @param {String} userId - the user id
   * @returns {void}
   */
  static async getUserProfile(userId) {
    const requestOptions = {
      method: 'GET',
      json: true,
      uri: `https://graph.facebook.com/v2.6/${userId}`,
      qs: {
        fields: 'first_name,last_name,gender',
        access_token: process.env.FB_PAGE_ACCESS_TOKEN,
      },
    };
    try {
      const res = await rp(requestOptions);
      logger.debug('getUserProfile: res', res);
    } catch (error) {
      logger.error('getUserProfile: error', error.message || error.error || error);
    }
  }
}

module.exports = MessengerAdapter;
