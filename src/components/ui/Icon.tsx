import type { SVGProps } from 'react';

/**
 * Stroke/fill icons. Paths are taken from the Pawhaven Figma file so they
 * match the design exactly, but they use `currentColor` so they can be
 * themed by the surrounding text colour.
 */
const paths = {
  paw: (
    <g fill="currentColor" stroke="none">
      <path d="M19.99 14.67c2.63.27 5.13-2.23 5.57-5.6.44-3.37-1.33-6.32-3.97-6.6-2.63-.28-5.12 2.23-5.57 5.6-.44 3.37 1.34 6.32 3.97 6.6Z" />
      <path d="M10.44 19c2 0 3.63-2.17 3.64-4.87.01-2.7-1.6-4.9-3.6-4.9s-3.63 2.17-3.64 4.87c-.01 2.7 1.6 4.89 3.6 4.9Z" />
      <path d="M28.94 19.6c2.06.45 4.34-1.42 5.1-4.16.75-2.75-.3-5.34-2.36-5.79-2.06-.45-4.34 1.42-5.1 4.16-.75 2.75.3 5.34 2.36 5.79Z" />
      <path d="M9.84 27.47c.05-4.32 5-10.02 9.88-9.97 4.88.05 9.7 5.87 9.65 10.19-.06 5.76-6.52 1.37-9.78 1.33-3.25-.04-9.81 4.21-9.75-1.55Z" />
    </g>
  ),
  arrowRight: <path d="M3.33 10h13.34M11.67 15l5-5-5-5" />,
  arrowLeft: <path d="M16.67 10H3.33M8.33 5l-5 5 5 5" />,
  arrowUpRight: <path d="M6 14 14 6M7.5 6H14v6.5" />,
  chevronDown: <path d="M5.83 8.33 10 12.5l4.17-4.17" />,
  chevronRight: <path d="M7.5 4.17 12.5 10l-5 5.83" />,
  search: (
    <>
      <path d="M14.17 8.75a5.42 5.42 0 1 1-10.84 0 5.42 5.42 0 0 1 10.84 0Z" />
      <path d="m13.33 13.33 4.17 4.17" />
    </>
  ),
  pin: (
    <>
      <path d="M15.83 8.33C15.83 12.5 10 17.5 10 17.5S4.17 12.5 4.17 8.33a5.83 5.83 0 1 1 11.66 0Z" />
      <path d="M11.92 8.33a1.92 1.92 0 1 1-3.84 0 1.92 1.92 0 0 1 3.84 0Z" />
    </>
  ),
  heart: (
    <path d="M17.33 4a4.58 4.58 0 0 0-6.5 0L10 5l-.92-1a4.6 4.6 0 0 0-6.5 6.5L10 17.5l7.33-7a4.58 4.58 0 0 0 0-6.5Z" />
  ),
  eye: (
    <>
      <path d="M1.67 10S4.17 4.17 10 4.17 18.33 10 18.33 10 15.83 15.83 10 15.83 1.67 10 1.67 10Z" />
      <path d="M12.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M8.2 4.36A8.3 8.3 0 0 1 10 4.17C15.83 4.17 18.33 10 18.33 10a14.6 14.6 0 0 1-2.14 3.2M12.1 12.1a2.92 2.92 0 0 1-4.2-4.2M5.47 5.47C3.08 7.07 1.67 10 1.67 10s2.5 5.83 8.33 5.83a8.4 8.4 0 0 0 4.53-1.3" />
      <path d="m2.5 2.5 15 15" />
    </>
  ),
  menu: <path d="M3.33 5.83h13.34M3.33 10h13.34M3.33 14.17h13.34" />,
  close: <path d="m5 5 10 10M15 5 5 15" />,
  check: <path d="m4.17 10.42 3.75 3.75 7.91-8.34" />,
  alert: (
    <>
      <path d="M10 18.33a8.33 8.33 0 1 0 0-16.66 8.33 8.33 0 0 0 0 16.66Z" />
      <path d="M10 6.67V10M10 13.33h.01" />
    </>
  ),
  info: (
    <>
      <path d="M10 18.33a8.33 8.33 0 1 0 0-16.66 8.33 8.33 0 0 0 0 16.66Z" />
      <path d="M10 13.33V10M10 6.67h.01" />
    </>
  ),
  locate: (
    <>
      <path d="M10 15.83a5.83 5.83 0 1 0 0-11.66 5.83 5.83 0 0 0 0 11.66Z" />
      <path d="M10 1.67v2.5M10 15.83v2.5M1.67 10h2.5M15.83 10h2.5" />
    </>
  ),
  logout: <path d="M7.5 17.5H4.17a1.67 1.67 0 0 1-1.67-1.67V4.17A1.67 1.67 0 0 1 4.17 2.5H7.5M13.33 14.17 17.5 10l-4.17-4.17M17.5 10h-10" />,
  plus: <path d="M10 4.17v11.66M4.17 10h11.66" />,
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Accessible label. When omitted the icon is treated as decorative. */
  label?: string;
}

export function Icon({ name, size = 20, label, strokeWidth = 1.7, ...rest }: IconProps) {
  const isPaw = name === 'paw';
  return (
    <svg
      width={size}
      height={size}
      viewBox={isPaw ? '0 0 40 35' : '0 0 20 20'}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
