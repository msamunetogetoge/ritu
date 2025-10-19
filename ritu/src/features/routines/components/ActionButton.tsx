interface ActionButtonProps {
  readonly variant?: "primary" | "secondary" | "danger";
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly children: React.ReactNode;
}

export function ActionButton(
  { variant = "secondary", disabled, onClick, children }: ActionButtonProps,
): JSX.Element {
  const className = `dialog-button ${variant}`;
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
