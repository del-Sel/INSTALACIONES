function AppIcon({ name, size = 20, strokeWidth = 1.8, className = '' }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    className,
  }

  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/></>,
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
    installations: <><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    edit: <><path d="M4 20h4l10.8-10.8a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.7 6.3 4 4"/></>,
    guides: <><path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></>,
    upload: <><path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 14v5h14v-5"/></>,
    pending: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
    logout: <><path d="M10 5H5v14h5"/><path d="M13 8l4 4-4 4M17 12H9"/></>,
    truck: <><path d="M3.5 6.5h10v9h-10z"/><path d="M13.5 10h3.8l3.2 3.2v2.3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></>,
    photo: <><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m5.5 17 4.5-4.5 3 3 2.2-2.2 3.3 3.7"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    check: <path d="m5 12 4 4 10-10"/>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    trash: <><path d="M4.5 7h15"/><path d="M9 7V4.5h6V7"/><path d="M7 7l.8 13h8.4L17 7"/><path d="M10 10.5v6M14 10.5v6"/></>,
  }

  return <svg {...common}>{paths[name] || paths.installations}</svg>
}

export default AppIcon
