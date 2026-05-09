function getTelegramErrorDescription (error) {
  return String(error?.description || error?.response?.description || error?.message || '')
}

function isStickerSetInvalidError (error) {
  return getTelegramErrorDescription(error).toLowerCase().includes('stickerset_invalid')
}

function isTelegramConflictError (error) {
  return error?.code === 409 || getTelegramErrorDescription(error).includes('Conflict:')
}

module.exports = {
  getTelegramErrorDescription,
  isTelegramConflictError,
  isStickerSetInvalidError
}
