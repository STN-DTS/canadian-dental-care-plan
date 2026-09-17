import { RouterContextProvider } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { applicantContext, programApplicantContext } from '~/.server/context/applicant-context';
import type { ApplicantDto, ProgramApplicantDto } from '~/.server/domain/dtos';
import type { SecurityHandler } from '~/.server/routes/security';
import type { Session } from '~/.server/web/session';
import { applicantMiddleware, programApplicantMiddleware } from '~/middlewares/applicant.server';

describe('applicant middleware', () => {
  const session = mock<Session>();
  const securityHandler = mock<SecurityHandler>();
  const appContainer = mock<AppContainerProvider>();

  beforeEach(() => {
    vi.resetAllMocks();
    appContainer.get.calledWith(TYPES.SecurityHandler).mockReturnValue(securityHandler);
  });

  function createMiddlewareArgs(): {
    args: Parameters<typeof applicantMiddleware>[0];
    url: URL;
  } {
    const context = new RouterContextProvider();
    const url = new URL('https://localhost:3000/en/protected/documents');
    context.set(appContext, { appContainer, session });

    return {
      args: {
        context,
        params: { id: 'application-123' },
        request: new Request(url),
        url,
        pattern: '',
      },
      url,
    };
  }

  it('sets applicant context before continuing', async () => {
    const applicant = mock<ApplicantDto>();
    const response = new Response(null, { status: 204 });
    const { args, url } = createMiddlewareArgs();
    securityHandler.requireApplicant.mockResolvedValue(applicant);
    const next = vi.fn(async () => {
      expect(args.context.get(applicantContext)).toBe(applicant);
      return await Promise.resolve(response);
    });

    const result = await applicantMiddleware(args, next);

    expect(securityHandler.requireApplicant).toHaveBeenCalledWith({ params: args.params, requestUrl: url, session });
    expect(next).toHaveBeenCalledOnce();
    expect(result).toBe(response);
  });

  it('propagates applicant resolution failure without continuing', async () => {
    const error = new Response(null, { status: 404 });
    const next = vi.fn();
    securityHandler.requireApplicant.mockRejectedValue(error);

    await expect(applicantMiddleware(createMiddlewareArgs().args, next)).rejects.toBe(error);

    expect(next).not.toHaveBeenCalled();
  });

  it('sets program applicant context before continuing', async () => {
    const programApplicant = mock<ProgramApplicantDto>();
    const response = new Response(null, { status: 204 });
    const { args, url } = createMiddlewareArgs();
    securityHandler.requireProgramApplicant.mockResolvedValue(programApplicant);
    const next = vi.fn(async () => {
      expect(args.context.get(programApplicantContext)).toBe(programApplicant);
      return await Promise.resolve(response);
    });

    const result = await programApplicantMiddleware(args, next);

    expect(securityHandler.requireProgramApplicant).toHaveBeenCalledWith({ params: args.params, requestUrl: url, session });
    expect(next).toHaveBeenCalledOnce();
    expect(result).toBe(response);
  });

  it('propagates program applicant resolution failure without continuing', async () => {
    const error = new Response(null, { status: 404 });
    const next = vi.fn();
    securityHandler.requireProgramApplicant.mockRejectedValue(error);

    await expect(programApplicantMiddleware(createMiddlewareArgs().args, next)).rejects.toBe(error);

    expect(next).not.toHaveBeenCalled();
  });
});
