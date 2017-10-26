const { BotTextMessage } = require('../messages');

class TextView {
  render(botId, userId, key, parameters) {
    console.log('TextView.render');
    return this.getText(botId, userId, key, parameters);
  }

  getText(botId, userId) {
    return new BotTextMessage(botId, userId, 'TextView text message');
  }
}

module.exports = TextView;
