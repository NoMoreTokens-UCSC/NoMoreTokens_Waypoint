/** Shell icons drawn after the design's header assets. Colours follow `currentColor` / props. */

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path
        d="M0 8C0 3.58172 3.58172 0 8 0H20C24.4183 0 28 3.58172 28 8V20C28 24.4183 24.4183 28 20 28H8C3.58172 28 0 24.4183 0 20V8Z"
        fill="#22252A"
      />
      <path
        d="M14 5.66675L20.6667 20.6667L14 17.3334L7.33337 20.6667L14 5.66675Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="14 13 16 18" fill="none" aria-hidden="true">
      <path
        d="M20.3337 29.5H23.667M16.167 26.1667H27.8337L26.167 23.6667V19.5C26.167 18.395 25.728 17.3352 24.9466 16.5538C24.1652 15.7724 23.1054 15.3334 22.0003 15.3334C20.8953 15.3334 19.8354 15.7724 19.054 16.5538C18.2726 17.3352 17.8337 18.395 17.8337 19.5V23.6667L16.167 26.1667Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ProfileIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="14 14 16 18" fill="none" aria-hidden="true">
      <path
        d="M21.9993 22C23.8403 22 25.3327 20.5077 25.3327 18.6667C25.3327 16.8258 23.8403 15.3334 21.9993 15.3334C20.1584 15.3334 18.666 16.8258 18.666 18.6667C18.666 20.5077 20.1584 22 21.9993 22Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.333 30.3334V27.8334C15.333 26.0653 16.0354 24.3696 17.2856 23.1194C18.5359 21.8691 20.2316 21.1667 21.9997 21.1667C23.7678 21.1667 25.4635 21.8691 26.7137 23.1194C27.964 24.3696 28.6663 26.0653 28.6663 27.8334V30.3334"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BackIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.0002 3.33325L5.3335 7.99992L10.0002 12.6666"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
