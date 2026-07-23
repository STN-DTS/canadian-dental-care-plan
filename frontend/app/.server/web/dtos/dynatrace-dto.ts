/**
 * Represents a Data Transfer Object (DTO) for a Dynatrace Real User Monitoring (RUM) script configuration.
 */
export type DynatraceRumScriptDto = Readonly<{
  /**
   * The URL source of the Dynatrace RUM script. This is the `src` attribute
   * for the `<script>` tag, which will load the Dynatrace RUM script on the page.
   */
  src: string;

  /**
   * The configuration for the Dynatrace RUM script, typically passed as a data attribute
   * (`data-dtconfig`) for further customizations or settings specific to the RUM script.
   */
  'data-dtconfig': string;
}>;
