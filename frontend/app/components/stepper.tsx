import type { ComponentProps, ReactNode } from 'react';

import { faCircle, faCircleDot } from '@fortawesome/free-regular-svg-icons';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useTranslation } from 'react-i18next';
import type { ReadonlyDeep } from 'type-fest';

import { cn } from '~/utils/tw-utils';

export type Step = ReadonlyDeep<{
  /**
   * Unique identifier for the step
   */
  id?: string | number;

  /**
   * Label for the step
   */
  label: string;

  /**
   * Allows passing custom icons or descriptions per step
   */
  icon?: ReactNode;
}>;

type StepperProps = ComponentProps<'ol'> & {
  /**
   * Array of steps to display in the stepper
   */
  steps: ReadonlyArray<Step>;

  /**
   * The currently active step (1-based index). Use -1 to mark all steps as completed.
   */
  activeStep: number;
};

/**
 * Stepper Component for displaying progress through a sequence of steps.
 */
export function Stepper({ steps, activeStep, className, ...props }: StepperProps) {
  const getStatus = (index: number) => {
    const stepNumber = index + 1;
    if (activeStep === -1 || stepNumber < activeStep) return 'completed';
    if (stepNumber === activeStep) return 'current';
    return 'upcoming';
  };

  return (
    <ol className={cn('relative flex w-full flex-col items-stretch gap-4 sm:flex-row sm:gap-2', className)} {...props}>
      {steps.map((step, index) => {
        const status = getStatus(index);
        const isLast = index === steps.length - 1;
        return <StepItem key={step.id ?? step.label} label={step.label} status={status} isLast={isLast} customIcon={step.icon} />;
      })}
    </ol>
  );
}

// Internal Composable Item
interface StepItemProps {
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  isLast: boolean;
  customIcon?: ReactNode;
}

function StepItem({ label, status, isLast, customIcon }: StepItemProps) {
  const { t } = useTranslation('common');

  return (
    <li className="relative flex grow items-start gap-3 sm:min-w-0 sm:flex-1 sm:flex-col" aria-current={status === 'current' ? 'true' : undefined}>
      {/* Connection Line */}
      {!isLast && <div className={cn('absolute top-2.5 left-2.25 z-0 mt-2.5 h-full w-0.5 bg-gray-300 transition-colors duration-200 sm:top-2.75 sm:mt-auto sm:ml-2.5 sm:h-0.5 sm:w-full', status === 'completed' && 'bg-green-700')} aria-hidden="true" />}
      {/* Indicator Box */}
      <div
        className={cn(
          'z-10 flex shrink-0 items-center justify-center rounded-full bg-white ring-4 ring-white transition-all duration-200 [&>svg]:size-5 sm:[&>svg]:size-6',
          status === 'upcoming' && 'text-gray-300',
          status === 'current' && 'text-blue-600',
          status === 'completed' && 'text-green-700',
        )}
        aria-hidden="true"
      >
        {customIcon ?? (
          <>
            {status === 'current' && <FontAwesomeIcon icon={faCircleDot} />}
            {status === 'completed' && <FontAwesomeIcon icon={faCircleCheck} />}
            {status === 'upcoming' && <FontAwesomeIcon icon={faCircle} />}
          </>
        )}
      </div>
      {/* Label */}
      <span
        className={cn(
          'grow overflow-hidden text-left text-sm font-medium text-nowrap text-ellipsis transition-colors duration-200 sm:overflow-auto sm:text-wrap',
          status === 'upcoming' && 'text-black/60',
          status === 'current' && 'font-semibold text-blue-600',
        )}
      >
        {label}
        {status === 'completed' && <span className="sr-only">{t(($) => $.stepper.status.completed)}</span>}
        {status === 'upcoming' && <span className="sr-only">{t(($) => $.stepper.status.upcoming)}</span>}
      </span>
    </li>
  );
}
