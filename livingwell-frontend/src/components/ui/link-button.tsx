import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { VariantProps } from "class-variance-authority";

interface LinkButtonProps extends VariantProps<typeof buttonVariants> {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function LinkButton({ href, variant, size, className, children }: LinkButtonProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
