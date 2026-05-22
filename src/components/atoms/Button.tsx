import { Spinner } from "./Spinner";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  type = "button",
  variant = "primary",
  loading = false,
  children,
  className = "",
  ...props
}) => {
  const base =
    "px-4 py-2 rounded-xl font-semibold inline-flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed";

  const color =
    variant === "primary"
      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-md shadow-primary/15 hover:brightness-105 active:translate-y-[1px] focus:ring-primary/40"
      : variant === "secondary"
        ? "bg-white text-text border border-primary/15 hover:border-primary/30 hover:bg-primary/5 dark:bg-accent dark:text-white dark:border-white/10 dark:hover:bg-white/10 focus:ring-primary/25"
        : "bg-transparent text-primary hover:bg-primary/10 dark:hover:bg-white/10 focus:ring-primary/15";

  return (
    <button
      type={type}
      className={`${base} ${color} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
};
