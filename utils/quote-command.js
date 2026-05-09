function getDirectQuoteText (messageText) {
  if (typeof messageText !== 'string') return ''

  const match = messageText.match(/^\/q(?:@\w+)?(?:\s+([\s\S]+))?$/)
  if (!match) return ''

  return (match[1] || '').trim()
}

function buildDirectQuoteMessage (ctx, text) {
  return {
    message_id: ctx.message.message_id,
    date: ctx.message.date,
    chat: ctx.chat,
    from: ctx.from,
    text
  }
}

module.exports = {
  buildDirectQuoteMessage,
  getDirectQuoteText
}
