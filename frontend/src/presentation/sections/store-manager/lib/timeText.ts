import { formatClock } from '../../../../domain/calendar'
import type { Order } from '../../../../domain/models'
import { windowEnd } from './orderView'
import { formatTime12 } from './windows'

/** A moment as 12-hour clock text: "5:41 AM". Stored times stay 24-hour. */
export const clock12 = (at: string) => formatTime12(formatClock(at))

/** A receiving window as 12-hour text: "5:30 AM – 7:30 AM". */
export const windowText12 = (order: Pick<Order, 'window' | 'windowEnd'>) =>
  `${formatTime12(order.window)} – ${formatTime12(windowEnd(order))}`
