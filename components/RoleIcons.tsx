// Small line icons: a sprout for agents (matches the favicon), a shield for admins.
type IconProps = { className?: string };

export function AgentIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 21v-9" />
      <path d="M12 12c0-4-3-6.5-7-6.5 0 4 3 6.5 7 6.5z" />
      <path d="M12 10c0-3.5 2.5-6 7-6 0 4-2.5 6.5-7 6z" />
    </svg>
  );
}

export function AdminIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
