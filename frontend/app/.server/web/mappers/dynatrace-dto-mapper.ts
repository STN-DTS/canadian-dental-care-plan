import { XMLParser } from 'fast-xml-parser';
import { injectable } from 'inversify';
import * as z from 'zod';

import type { DynatraceRumScriptDto } from '~/.server/web/dtos';

export interface DynatraceDtoMapper {
  /**
   * Maps a Dynatrace RUM script in XML format to a DynatraceRumScriptDto object.
   *
   * @param dynatraceRumScript - The XML string representation of a Dynatrace RUM script.
   * @returns A `DynatraceRumScriptDto` object if the script is valid.
   */
  mapDynatraceRumScriptToDynatraceRumScriptDto(dynatraceRumScript: string): DynatraceRumScriptDto | null;
}

@injectable()
export class DefaultDynatraceDtoMapper implements DynatraceDtoMapper {
  mapDynatraceRumScriptToDynatraceRumScriptDto(dynatraceRumScript: string): DynatraceRumScriptDto | null {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', allowBooleanAttributes: true });
    const xmlParsedScript = parser.parse(dynatraceRumScript);

    // script validation schema
    const scriptSchema = z.object({
      script: z.object({
        src: z.string().regex(/^\/\w*\.js$/),
        'data-dtconfig': z.string(),
      }),
    });

    const validatedScript = scriptSchema.safeParse(xmlParsedScript);

    if (!validatedScript.success) {
      throw new Error(`Mapping validation failed for Dynatrace RUM Script: [${dynatraceRumScript}]`);
    }

    const { script } = validatedScript.data;
    return script;
  }
}
