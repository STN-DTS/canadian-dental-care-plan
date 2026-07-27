import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/tooltip';

/** Props for {@link DateTimeDisplay}. */
interface DateTimeDisplayProps {
  /**
   * Compact, localized text rendered in the page layout.
   * Example: `July 15, 2024`.
   */
  children: React.ReactNode;

  /**
   * ISO 8601 timestamp representing the same instant as `children`.
   * Passed to the semantic `<time dateTime>` attribute.
   * Example: `2024-07-15T23:15:00.000Z`.
   */
  isoTimestamp: string;

  /**
   * Complete localized date-time text shown in the tooltip and announced by
   * assistive technology.
   * Example: `July 15, 2024 at 7:15 p.m. Eastern Daylight Time (EDT)`.
   */
  tooltipText: string;
}

/**
 * Renders compact date-time text with semantic markup and an expanded tooltip.
 *
 * @param props Component props.
 * @returns A tooltip trigger containing a semantic `<time>` element.
 */
export function DateTimeDisplay({ isoTimestamp, children, tooltipText }: DateTimeDisplayProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={tooltipText}>
          <time className="whitespace-nowrap" dateTime={isoTimestamp}>
            {children}
          </time>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
