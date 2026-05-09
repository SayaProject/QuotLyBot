const DEFAULT_QUOTE_CONFIG = {
  globalStickerSet: {
    name: '',
    save_sticker_count: 10
  }
}

function normalizeQuoteConfig (input = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const sourceStickerSet = source.globalStickerSet && typeof source.globalStickerSet === 'object'
    ? source.globalStickerSet
    : {}

  const saveStickerCount = Number.parseInt(
    sourceStickerSet.save_sticker_count ?? DEFAULT_QUOTE_CONFIG.globalStickerSet.save_sticker_count,
    10
  )

  return {
    ...DEFAULT_QUOTE_CONFIG,
    ...source,
    globalStickerSet: {
      ...DEFAULT_QUOTE_CONFIG.globalStickerSet,
      ...sourceStickerSet,
      save_sticker_count: Number.isFinite(saveStickerCount) && saveStickerCount > 0
        ? saveStickerCount
        : DEFAULT_QUOTE_CONFIG.globalStickerSet.save_sticker_count
    }
  }
}

function isStickerCleanupEnabled (input = {}) {
  const stickerSet = input?.globalStickerSet
  if (!stickerSet || typeof stickerSet.name !== 'string') return false

  return stickerSet.name.trim().length > 0 && stickerSet.cleanup_enabled !== false
}

function getStickerCleanupSetName (input, botUsername) {
  if (!botUsername || !isStickerCleanupEnabled(input)) return null
  return `${input.globalStickerSet.name.trim()}${botUsername}`
}

module.exports = {
  DEFAULT_QUOTE_CONFIG,
  getStickerCleanupSetName,
  isStickerCleanupEnabled,
  normalizeQuoteConfig
}
