/** Iconos de la barra inferior. SVG inline: sin dependencias ni peticiones extra. */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};

export function IconHome() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}

export function IconPeople() {
  return (
    <svg {...base} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.3a3.2 3.2 0 0 1 0 6.2M17.5 14.9c2.1.6 3.5 2.4 3.5 5.1" />
    </svg>
  );
}

export function IconCalendar() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconChart() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M5 20V11M12 20V5M19 20v-6" />
    </svg>
  );
}

export function IconGear() {
  return (
    <svg {...base} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
    </svg>
  );
}

/** Campanita: mandar el turno al calendario del teléfono con alarma. */
export function IconBell() {
  return (
    <svg {...base} width="15" height="15" aria-hidden="true" viewBox="0 0 24 24">
      <path d="M18 15V10a6 6 0 0 0-12 0v5l-2 3h16Z" />
      <path d="M10 21a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}
