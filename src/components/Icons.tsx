import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="11" cy="11" r="7" strokeWidth="1.6" />
      <path d="M16.5 16.5L21 21" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function GithubIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.38 6.84 9.74.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.5.47-3.15-.63-3.35-1.2-.11-.29-.6-1.2-1.03-1.44-.35-.2-.85-.7-.01-.71.79-.01 1.36.74 1.55 1.05.9 1.55 2.34 1.11 2.91.85.09-.67.35-1.11.64-1.36-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05a9.17 9.17 0 0 1 5 0c1.91-1.34 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.93-2.34 4.8-4.57 5.06.36.32.68.93.68 1.88 0 1.36-.01 2.45-.01 2.79 0 .27.18.6.69.49A10.07 10.07 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="4" strokeWidth="1.6" />
      <path d="M12 2v2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 20v2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4.93 4.93l1.41 1.41" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.66 17.66l1.41 1.41" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2 12h2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20 12h2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4.93 19.07l1.41-1.41" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.66 6.34l1.41-1.41" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M15 18l-6-6 6-6" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M12 4v9" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 8l4-4 4 4" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 20h16" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
