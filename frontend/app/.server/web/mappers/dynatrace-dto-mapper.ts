import { XMLParser } from 'fast-xml-parser';
import { injectable } from 'inversify';
import * as z from 'zod';

import { throwAppError } from '~/.server/utils/error-utils';
import type { DynatraceRumScriptDto } from '~/.server/web/dtos';
import { ErrorCodes } from '~/errors/error-codes';

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
      throwAppError('RUM script validation failed.', ErrorCodes.API_RUM_SCRIPT_INVALID);
    }

    const { script } = validatedScript.data;
    return script;
  }
}
