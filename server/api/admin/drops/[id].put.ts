import { getSupabaseAdmin } from '../../../utils/supabase'
import { requireAdmin } from '../../../utils/auth'
import { validateDropPayload } from '../../../utils/raids'
import { publishRaidChange } from '../../../utils/realtime'

/**
 * Jr master only: update a drop. Any of item / disposition / price /
 * soldPrice / soldTo / keptBy can change — price changes on FM items flow
 * straight into the live split calculation.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  const client = getSupabaseAdmin()
  const { data: existing } = await client.from('raid_drops').select('*').eq('id', id).maybeSingle()
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Drop not found' })

  const body = (await readBody(event).catch(() => ({}))) ?? {}
  const next: Record<string, unknown> = {
    item: existing.item,
    disposition: existing.disposition,
    price: existing.price,
    sold_price: existing.sold_price,
    sold_to: existing.sold_to,
    kept_by: existing.kept_by
  }

  // Merge only the fields the client actually sent so partial updates work.
  if (body.item !== undefined) next.item = body.item
  if (body.disposition !== undefined) next.disposition = body.disposition
  if (body.price !== undefined) next.price = body.price
  if (body.soldPrice !== undefined) next.soldPrice = body.soldPrice
  if (body.soldTo !== undefined) next.soldTo = body.soldTo
  if (body.keptBy !== undefined) next.keptBy = body.keptBy

  const drop = validateDropPayload(next)
  const { error } = await client
    .from('raid_drops')
    .update({ ...drop, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  await publishRaidChange()
  return { ok: true }
})