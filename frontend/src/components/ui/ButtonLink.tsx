import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../../lib/cn';
import { buttonVariants, type ButtonProps } from './Button';

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}

/** A react-router Link styled as a Button. */
export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
