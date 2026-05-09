const { OpenAI } = require('openai')

let client = null
let clientApiKey = null

function getOpenRouterClient (env = process.env) {
  const apiKey = env.OPENAI_API_KEY

  if (!apiKey) {
    client = null
    clientApiKey = null
    return null
  }

  if (!client || clientApiKey !== apiKey) {
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://quotlybot.t.me/',
        'X-Title': 'Quotly Bot'
      }
    })
    clientApiKey = apiKey
  }

  return client
}

module.exports = {
  getOpenRouterClient
}
