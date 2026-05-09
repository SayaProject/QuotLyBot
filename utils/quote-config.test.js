const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getStickerCleanupSetName,
  isStickerCleanupEnabled,
  normalizeQuoteConfig
} = require('./quote-config')

test('normalizes missing quote config with safe defaults', () => {
  const config = normalizeQuoteConfig()

  assert.equal(config.globalStickerSet.name, '')
  assert.equal(config.globalStickerSet.cleanup_enabled, false)
  assert.equal(config.globalStickerSet.save_sticker_count, 10)
  assert.equal(isStickerCleanupEnabled(config), false)
})

test('normalizes invalid save count back to the default', () => {
  const config = normalizeQuoteConfig({
    globalStickerSet: {
      name: 'created_by_',
      save_sticker_count: 'bad'
    }
  })

  assert.equal(config.globalStickerSet.save_sticker_count, 10)
})

test('keeps sticker cleanup disabled unless explicitly enabled', () => {
  const config = normalizeQuoteConfig({
    globalStickerSet: {
      name: 'created_by_',
      save_sticker_count: 1
    }
  })

  assert.equal(isStickerCleanupEnabled(config), false)
  assert.equal(getStickerCleanupSetName(config, 'SexySayaBot'), null)
})

test('enables sticker cleanup only for an explicitly named and enabled pack', () => {
  const config = normalizeQuoteConfig({
    globalStickerSet: {
      name: 'created_by_',
      cleanup_enabled: true,
      save_sticker_count: 1
    }
  })

  assert.equal(isStickerCleanupEnabled(config), true)
  assert.equal(getStickerCleanupSetName(config, 'SexySayaBot'), 'created_by_SexySayaBot')
})

test('does not append bot username when the configured sticker pack already includes it', () => {
  const config = normalizeQuoteConfig({
    globalStickerSet: {
      name: 'created_by_SexySayaBot',
      cleanup_enabled: true,
      save_sticker_count: 1
    }
  })

  assert.equal(getStickerCleanupSetName(config, 'SexySayaBot'), 'created_by_SexySayaBot')
})

test('allows sticker cleanup to be disabled even when a pack is named', () => {
  const config = normalizeQuoteConfig({
    globalStickerSet: {
      name: 'created_by_',
      cleanup_enabled: false
    }
  })

  assert.equal(isStickerCleanupEnabled(config), false)
  assert.equal(getStickerCleanupSetName(config, 'SexySayaBot'), null)
})
