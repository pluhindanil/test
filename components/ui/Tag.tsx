type TagVariant = "violet" | "pink" | "cyan" | "amber" | "green";

interface TagProps {
  variant?: TagVariant;
  children: React.ReactNode;
}

export function Tag({ variant = "violet", children }: TagProps) {
  return (
    <span className={`lm-tag tag-${variant}`}>{children}</span>
  );
}
