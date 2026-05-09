// Resolves ctx.session.userInfo for the current user. For brand-new users
// performs an immediate insert (we need the _id for downstream handlers).
// For existing users, profile field syncing (first_name/last_name/etc.) is
// done by handler.js middleware via targeted User.updateOne — never by
// full-doc save() on this cached mongoose doc, which would race with
// concurrent updates from other workers handling parallel updates from
// the same user (VersionError).

function getTelegramId (ctx) {
  const telegramId = ctx?.from?.id
  return typeof telegramId === 'number' && Number.isFinite(telegramId)
    ? telegramId
    : null
}

function buildUserInsert (ctx, telegramId) {
  const fullName = `${ctx.from.first_name}${ctx.from.last_name ? ` ${ctx.from.last_name}` : ''}`
  const user = {
    telegram_id: telegramId,
    first_name: ctx.from.first_name,
    last_name: ctx.from.last_name,
    full_name: fullName,
    username: ctx.from.username
  }

  if (ctx.chat && ctx.chat.type === 'private') user.status = 'member'
  return user
}

async function findOrCreateUser (ctx, telegramId) {
  try {
    return await ctx.db.User.findOneAndUpdate(
      { telegram_id: telegramId },
      { $setOnInsert: buildUserInsert(ctx, telegramId) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  } catch (error) {
    if (error?.code !== 11000) throw error

    return ctx.db.User.findOne({ telegram_id: telegramId })
  }
}

async function getUser (ctx) {
  const telegramId = getTelegramId(ctx)
  if (telegramId === null) return false

  let user = ctx.session.userInfo

  if (!ctx.session.userInfo) {
    user = await findOrCreateUser(ctx, telegramId)
  }

  ctx.session.userInfo = user

  if (ctx.session.userInfo.settings && ctx.session.userInfo.settings.locale) {
    ctx.i18n.locale(ctx.session.userInfo.settings.locale)
  }

  return true
}

module.exports = getUser
module.exports.buildUserInsert = buildUserInsert
module.exports.findOrCreateUser = findOrCreateUser
module.exports.getTelegramId = getTelegramId
