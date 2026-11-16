import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'accent' | 'link' | 'danger';
type Size = 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  children: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    to?: undefined;
    loading?: boolean;
    loadingText?: string;
  };

type ButtonAsLink = CommonProps & {
  to: string;
  'aria-label'?: string;
  onClick?: () => void;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function classes({ variant = 'primary', size = 'md', block, className }: CommonProps) {
  return [styles.button, styles[variant], styles[size], block && styles.block, className]
    .filter(Boolean)
    .join(' ');
}

export function Button(props: ButtonProps) {
  const { iconStart, iconEnd, children } = props;

  if (props.to !== undefined) {
    const { to, onClick } = props;
    return (
      <Link to={to} className={classes(props)} onClick={onClick} aria-label={props['aria-label']}>
        {iconStart}
        <span>{children}</span>
        {iconEnd}
      </Link>
    );
  }

  const {
    variant: _v,
    size: _s,
    block: _b,
    className: _c,
    iconStart: _is,
    iconEnd: _ie,
    loading = false,
    loadingText,
    disabled,
    type = 'button',
    ...rest
  } = props;

  return (
    <button
      {...rest}
      type={type}
      className={classes(props)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner size={18} /> : iconStart}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && iconEnd}
    </button>
  );
}
