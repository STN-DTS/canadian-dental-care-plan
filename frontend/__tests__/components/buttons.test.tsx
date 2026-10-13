import { fireEvent, render } from '@testing-library/react';

import { createRoutesStub } from 'react-router';

import { describe, expect, it, vi } from 'vitest';

import { Button, ButtonLink, buttonSizeStyles, buttonVariantStyles } from '~/components/buttons';

const variantKeys = Object.entries(buttonVariantStyles) as [keyof typeof buttonVariantStyles, string][];
const pillOptions = [false, true] as const;
const disabledOptions = [false, true] as const;
const sizeKeys = Object.entries(buttonSizeStyles) as [keyof typeof buttonSizeStyles, string][];

type StyleCombination = [(typeof pillOptions)[number], (typeof disabledOptions)[number], keyof typeof buttonSizeStyles];
const styleCombinations: StyleCombination[] = [];

for (const pill of pillOptions) {
  for (const disabled of disabledOptions) {
    for (const [sizeKey] of sizeKeys) {
      styleCombinations.push([pill, disabled, sizeKey]);
    }
  }
}

describe('Button Component', () => {
  it('renders button with default props', () => {
    const { getByText } = render(<Button variant="primary">Click me</Button>);
    const button = getByText('Click me');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toEqual('BUTTON');
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center', 'rounded-sm', 'border-2', 'align-middle', 'font-lato', 'outline-offset-4');
  });

  it('renders button with custom size and variant', () => {
    const { getByText } = render(
      <Button size="lg" variant="primary">
        Click me
      </Button>,
    );
    const button = getByText('Click me');
    expect(button).toHaveClass('px-5', 'py-3', 'text-base', 'bg-[#26374A]', 'text-white', 'hover:bg-[#2B4380]');
  });

  it('renders disabled button', () => {
    const { getByText } = render(
      <Button variant="primary" disabled>
        Click me
      </Button>,
    );
    const button = getByText('Click me') as HTMLButtonElement;
    expect(button.disabled).toEqual(true);
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:cursor-not-allowed', 'disabled:opacity-70');
  });

  it('renders pill button', () => {
    const { getByText } = render(
      <Button variant="primary" pill>
        Click me
      </Button>,
    );
    const button = getByText('Click me');
    expect(button).toHaveClass('rounded-full');
  });

  it('executes onClick handler', () => {
    const handleClick = vi.fn();
    const { getByText } = render(
      <Button variant="primary" onClick={handleClick}>
        Click me
      </Button>,
    );
    const button = getByText('Click me');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it.each(variantKeys)('should render the Button style combinations for variant: %s', (variant) => {
    const { container } = render(
      <>
        {styleCombinations.map(([pill, disabled, size]) => {
          const id = `${variant}_pill_${pill}_disabled_${disabled}_${size}`;
          return (
            <Button key={id} id={id} variant={variant} pill={pill} disabled={disabled} size={size}>
              Click me
            </Button>
          );
        })}
      </>,
    );
    expect(container).toMatchSnapshot('expected html');
  });
});

describe('ButtonLink Component', () => {
  it('renders link with default props', () => {
    const RoutesStub = createRoutesStub([
      {
        Component: () => (
          <ButtonLink variant="primary" to="/">
            Click me
          </ButtonLink>
        ),
        path: '/',
      },
    ]);

    const { getByText } = render(<RoutesStub />);
    const link = getByText('Click me');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toEqual('A');
    expect(link).toHaveClass('inline-flex', 'items-center', 'justify-center', 'rounded-sm', 'border-2', 'align-middle', 'font-lato', 'outline-offset-4');
  });

  it('renders link with custom size and variant', () => {
    const RoutesStub = createRoutesStub([
      {
        Component: () => (
          <ButtonLink size="lg" variant="primary" to="/">
            Click me
          </ButtonLink>
        ),
        path: '/',
      },
    ]);

    const { getByText } = render(<RoutesStub />);
    const link = getByText('Click me');
    expect(link).toHaveClass('px-5', 'py-3', 'text-base', 'bg-[#26374A]', 'text-white', 'hover:bg-[#2B4380]');
  });

  it('renders pill link', () => {
    const RoutesStub = createRoutesStub([
      {
        Component: () => (
          <ButtonLink variant="primary" pill to="/">
            Click me
          </ButtonLink>
        ),
        path: '/',
      },
    ]);

    const { getByText } = render(<RoutesStub />);
    const link = getByText('Click me');
    expect(link).toHaveClass('rounded-full');
  });

  it('renders disabled link', () => {
    const { getByText } = render(
      <ButtonLink variant="primary" disabled to="/">
        Click me
      </ButtonLink>,
    );
    const button = getByText('Click me') as HTMLButtonElement;
    expect(button.role).toEqual('link');
    expect(button.ariaDisabled).toEqual('true');
    expect(button).toHaveClass('pointer-events-none', 'cursor-not-allowed', 'opacity-70');
  });

  it.each(variantKeys)('should render the ButtonLink style combinations for variant: %s', (variant) => {
    const RoutesStub = createRoutesStub([
      {
        Component: () => (
          <>
            {styleCombinations.map(([pill, disabled, size]) => {
              const id = `${variant}_pill_${pill}_disabled_${disabled}_${size}`;
              return (
                <ButtonLink key={id} id={id} variant={variant} pill={pill} disabled={disabled} size={size} to="/">
                  Click me
                </ButtonLink>
              );
            })}
          </>
        ),
        path: '/',
      },
    ]);

    const { container } = render(<RoutesStub />);
    expect(container).toMatchSnapshot('expected html');
  });
});
