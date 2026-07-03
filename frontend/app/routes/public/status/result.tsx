import { redirect, useFetcher } from 'react-router';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/result';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clearStatusState, getStatusStateIdFromUrl, loadStatusState } from '~/.server/routes/helpers/status-route-helpers';
import { getContextualAlertType } from '~/.server/utils/application-code.utils';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { Button } from '~/components/buttons';
import { ClientFriendlyStatusMarkdown } from '~/components/client-friendly-status-markdown';
import { ContextualAlert } from '~/components/contextual-alert';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const FORM_ACTION = {
  cancel: 'cancel',
  exit: 'exit',
} as const;

export const handle = {
  pageIdentifier: pageIds.public.status.result,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('status');

  const statusStateId = getStatusStateIdFromUrl(request.url);
  const { statusCheckResult } = loadStatusState({ id: statusStateId, params, session });

  const locale = getLocale(request);

  const t = await getFixedT(request, ['status', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.result.pageTitle) }),
  };

  const statusId = statusCheckResult.statusId ?? null;
  const alertType = getContextualAlertType(statusId);
  const clientFriendlyStatus = statusId ? await appContainer.get(TYPES.ClientFriendlyStatusService).getLocalizedClientFriendlyStatusById(statusId, locale) : null;

  return {
    statusResult: { alertType, clientFriendlyStatus },
    meta,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('status');
  securityHandler.validateCsrfToken({ formData, session });

  const statusStateId = getStatusStateIdFromUrl(request.url);
  const { id } = loadStatusState({ id: statusStateId, params, session });

  const t = await getFixedT(request, 'status');

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.cancel) {
    return redirect(getPathById('public/status/index', params));
  }

  clearStatusState({ id, params, session });
  return redirect(t(($) => $.result.exitLink));
}

export default function StatusCheckerResult({ loaderData, params }: Route.ComponentProps) {
  const { statusResult } = loaderData;
  const { t } = useTranslation('status');
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  return (
    <>
      <AppPageTitle>{t(($) => $.result.pageTitle)}</AppPageTitle>
      <fetcher.Form method="post" noValidate autoComplete="off" data-gc-analytics-formname="ESDC-EDSC: Canadian Dental Care Plan Status Checker">
        <CsrfTokenInput />
        <div className="max-w-prose">
          {statusResult.clientFriendlyStatus ? (
            <ContextualAlert type={statusResult.alertType}>
              <h2 className="mb-2 font-bold">{t(($) => $.result.statusHeading)}</h2>
              <ClientFriendlyStatusMarkdown content={statusResult.clientFriendlyStatus.name} />
            </ContextualAlert>
          ) : (
            <StatusNotFound />
          )}
          <div className="mt-12">
            <Button id="cancel-button" name="_action" value={FORM_ACTION.cancel} disabled={isSubmitting} variant="primary" endIcon={faChevronRight}>
              {t(($) => $.result.checkAnother)}
            </Button>
          </div>
          <div className="mt-6">
            <Button id="exit-button" name="_action" value={FORM_ACTION.exit} disabled={isSubmitting} className="mt-6" variant="secondary">
              {t(($) => $.result.exitBtn)}
            </Button>
          </div>
        </div>
      </fetcher.Form>
    </>
  );
}

function StatusNotFound() {
  const { t } = useTranslation('status');
  const noWrap = <span className="whitespace-nowrap" />;
  return (
    <div className="mb-4">
      <ContextualAlert type="danger">
        <h2 className="mb-2 font-bold">{t(($) => $.result.statusNotFound.heading)}</h2>
        <p className="mb-2">{t(($) => $.result.statusNotFound.pleaseReview)}</p>
        <p className="mb-2">{t(($) => $.result.statusNotFound.ifSubmitted)}</p>
        <p>
          <Trans ns="status" i18nKey={($) => $.result.statusNotFound.contactServiceCanada} components={{ noWrap }} />
        </p>
      </ContextualAlert>
    </div>
  );
}
