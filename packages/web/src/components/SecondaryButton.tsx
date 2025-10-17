import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function SecondaryButton({ label, className = '', ...props }: Props) {
  return (
    <button
      className={`rounded-xl bg-brand-secondary-light px-4 py-2 text-white transition
                  hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/30
                  disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {label}
    </button>
  );
}
