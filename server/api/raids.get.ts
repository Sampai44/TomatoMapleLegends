import { listRaids } from '../utils/raids'

export default defineEventHandler(async (event) => {
  return await listRaids(event)
})
