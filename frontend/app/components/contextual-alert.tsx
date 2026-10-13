import type { ComponentProps, ReactNode } from 'react';

import { faCommentDots } from '@fortawesome/free-regular-svg-icons';
import { faCheckCircle, faCircleInfo, faExclamationCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { cn } from '~/utils/tw-utils';

export type AlertType = 'warning' | 'success' | 'danger' | 'info' | 'comment';

type ContextualAlertProps = ComponentProps<'div'> & {
  children: ReactNode;
  type: AlertType;
};

const alertBackgroundColors: Partial<Record<AlertType, string>> & { default: string } = {
  comment: 'bg-sky-50',
  default: 'bg-white',
};

const alertBorderColors: Partial<Record<AlertType, string>> & { default: string } = {
  comment: 'border-l-sky-800',
  danger: 'border-l-red-700',
  default: 'border-l-gray-700',
  info: 'border-l-cyan-700',
  warning: 'border-l-amber-700',
  success: 'border-l-green-700',
};

export function ContextualAlert({ children, className, type, ...props }: ContextualAlertProps) {
  const alertBackgroundColor = alertBackgroundColors[type] ?? alertBackgroundColors.default;
  const alertBorderColor = alertBorderColors[type] ?? alertBorderColors.default;

  return (
    <div className={cn('relative pl-4 sm:pl-6', alertBackgroundColor, className)} aria-atomic="true" {...props}>
      <div className={cn('absolute top-3 left-1.5 pt-1 sm:left-3.5', alertBackgroundColor)}>
        <Icon type={type} />
      </div>
      <div className={cn('overflow-auto border-l-4 pt-4 pb-2.5 pl-6', alertBorderColor)}>{children}</div>
    </div>
  );
}

function Icon({ type }: { type: AlertType }) {
  switch (type) {
    case 'warning': {
      return <FontAwesomeIcon icon={faExclamationTriangle} className="h-6 w-6 text-amber-700" />;
    }

    case 'success': {
      return <FontAwesomeIcon icon={faCheckCircle} className="h-6 w-6 text-green-700" />;
    }

    case 'danger': {
      return <FontAwesomeIcon icon={faExclamationCircle} className="h-6 w-6 text-red-700" />;
    }

    case 'info': {
      return <FontAwesomeIcon icon={faCircleInfo} className="h-6 w-6 text-cyan-700" />;
    }

    case 'comment': {
      return <FontAwesomeIcon icon={faCommentDots} className="h-6 w-6 text-sky-800" />;
    }

    default: {
      break;
    }
  }
}
