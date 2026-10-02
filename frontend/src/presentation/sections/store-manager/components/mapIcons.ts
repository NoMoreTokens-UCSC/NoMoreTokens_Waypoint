import { divIcon } from 'leaflet'

/** Markers drawn after the design: the green vehicle, the dark parcel for the outlet, a depot dot. */
const vehicle = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
  <circle cx="20" cy="20" r="18.5" fill="#1E8A57" stroke="white" stroke-width="3"/>
  <path d="M25 28V17H14V28H25ZM25 28H32V25L29 21H25" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="18" cy="29" r="2" stroke="white" stroke-width="1.8"/>
  <circle cx="29" cy="29" r="2" stroke="white" stroke-width="1.8"/>
</svg>`
const outlet = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
  <circle cx="14" cy="14" r="14" fill="#22252A"/>
  <path d="M8 11.33v6L14 20.67l6-3.34v-6L14 8l-6 3.33ZM20 11.33l-6 3.34M14 20.67v-6M8 11.33l6 3.34M11 9.67 17 13" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
const depot = `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
  <circle cx="9" cy="9" r="7" fill="#F26A2E" stroke="white" stroke-width="3"/>
</svg>`

const icon = (html: string, size: number) =>
  divIcon({
    html,
    className: 'sm-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })

export const vehicleIcon = icon(vehicle, 40)
export const outletIcon = icon(outlet, 28)
export const depotIcon = icon(depot, 18)
