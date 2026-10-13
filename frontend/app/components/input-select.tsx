import type { ComponentProps, ReactNode } from 'react';

import { InputError } from '~/components/input-error';
import { InputHelp } from '~/components/input-help';
import { InputLabel } from '~/components/input-label';
import { InputOption } from '~/components/input-option';
import { cn } from '~/utils/tw-utils';

interface InputSelectProps extends OmitStrict<ComponentProps<'select'>, 'aria-describedby' | 'aria-errormessage' | 'aria-invalid' | 'aria-labelledby' | 'aria-required'> {
  errorMessage?: string;
  helpMessage?: ReactNode;
  id: string;
  label: string;
  name: string;
  options: OmitStrict<ComponentProps<typeof InputOption>, 'id'>[];
}

export function InputSelect(props: InputSelectProps) {
  const { errorMessage, helpMessage, id, label, options, className, required, ...restInputProps } = props;

  const inputErrorId = `input-${id}-error`;
  const inputHelpMessageId = `input-${id}-help`;
  const inputLabelId = `input-${id}-label`;
  const inputWrapperId = `input-${id}`;

  const ariaDescribedbyIds =
    [!!helpMessage && inputHelpMessageId]
      .filter(Boolean) //
      .join(' ') || undefined;

  return (
    <div id={inputWrapperId}>
      <InputLabel id={inputLabelId} htmlFor={id} className="mb-2">
        {label}
      </InputLabel>
      {errorMessage && <InputError id={inputErrorId} fieldId={id} message={errorMessage} className="mb-2" />}
      <select
        aria-describedby={ariaDescribedbyIds}
        aria-errormessage={errorMessage && inputErrorId}
        aria-invalid={!!errorMessage}
        aria-labelledby={inputLabelId}
        aria-required={required}
        className={cn(
          'block rounded-lg border-gray-500 focus:border-blue-500 focus:ring-3 focus:ring-blue-500 focus:outline-hidden', //
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-70',
          errorMessage && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className,
        )}
        id={id}
        required={required}
        {...restInputProps}
      >
        {options.map((optionProps, index) => {
          const inputOptionId = `${id}-select-option-${index}`;
          return <InputOption id={inputOptionId} key={optionProps.value} {...optionProps} />;
        })}
      </select>
      {helpMessage && (
        <InputHelp id={inputHelpMessageId} className="mt-2">
          {helpMessage}
        </InputHelp>
      )}
    </div>
  );
}
