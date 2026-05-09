function getTelegramErrorDescription (error) {
  return String(error?.description || error?.response?.description || error?.message || '')
}

function isStickerSetInvalidError (error) {
  return getTelegramErrorDescription(error).toLowerCase().includes('stickerset_invalid')
}

module.exports = {
  getTelegramErrorDescription,
  isStickerSetInvalidError
}
