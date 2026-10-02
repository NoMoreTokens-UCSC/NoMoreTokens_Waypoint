import { formatLongDate, formatWeekday } from '../../../../domain/calendar'
import { useBusinessClock } from '../../../session/useBusinessClock'
import { ActionLink, Callout, PageIntro, Pill, StorePage, Tile } from '../components/StoreKit'
import { quantityText, temperatures, totals } from '../lib/orderView'
import { useStoreDrafts, useStoreOutlet, useStoreProfile } from '../lib/useStore'

/** Draft saved for the next run: saved, not submitted, and no vehicle or window promised. */
export default function DraftSavedPage() {
  const clock = useBusinessClock()
  const outletId = useStoreOutlet()
  const { drafts } = useStoreDrafts()
  const brand = useStoreProfile().profile?.brand ?? 'Fresh'
  // The latest draft of each temperature is the one that will be offered at the next intake.
  const latest = temperatures
    .map((temperature) => drafts.filter((draft) => draft.temperature === temperature).at(-1))
    .filter((draft) => draft !== undefined)
  const sum = totals(
    latest.map((draft) => ({ ...draft, weight: draft.weight ?? 0, volume: draft.volume ?? 0 })),
  )
  const next = formatWeekday(clock.nextRunDate)
  return (
    <StorePage>
      <PageIntro
        title="Draft saved for next run"
        context={`${latest.length === 1 ? `1 ${brand} order` : `${latest.length} separate ${brand} orders`} · Not submitted · ${outletId}`}
      />
      <section className="sm-panel" aria-label="Saved draft">
        <Pill>Draft saved</Pill>
        <h2>Ready for {next}’s intake.</h2>
        <Tile size="sm" big label="Next eligible run" value={formatLongDate(clock.nextRunDate)} />
        <p className="sm-muted">
          {latest.length ? quantityText({ ...sum, brand }) : 'No draft saved yet'}
          {brand === 'Fresh' && (
            <>
              <br />
              Fresh chilled and Fresh dry remain separate records.
            </>
          )}
        </p>
        <Callout title="Confirmation still required">
          This draft is saved, not submitted. Review the new date and receiving windows during the
          next intake period.
        </Callout>
        <div className="sm-actions">
          <ActionLink variant="outline" to="/store-manager/orders/confirmed">
            View existing confirmed orders
          </ActionLink>
          <ActionLink variant="outline" to="/store-manager/orders/new">
            Back to cutoff details
          </ActionLink>
        </div>
      </section>
    </StorePage>
  )
}
