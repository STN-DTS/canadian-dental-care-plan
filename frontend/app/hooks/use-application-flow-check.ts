import { useEffect, useRef } from 'react';

import { useNavigate, useNavigation } from 'react-router';

import { useApplicationFlowStorage } from '~/hooks';

type UseApplicationFlowCheckArgs = {
  /**
   * The application ID to check the flow state for. This should be the same ID used when setting the flow state to
   * active in storage.
   */
  id: string;

  /**
   * The path to the application index page to redirect to if the flow is not active. This should be the path of
   * the index route for the current application type (public or protected).
   */
  indexRoutePath: string;
};

/**
 * Checks the application flow state on initial load and redirects to the index page if the flow is not active.
 * Use this on all application pages to prevent direct access without starting a flow.
 *
 * **Don't use this on the index page itself, as that would cause an infinite redirect loop.**
 *
 * @param id - The application ID to check the flow state for.
 * @param indexRoutePath - Path to the application index page.
 */
export function useApplicationFlowCheck({ id, indexRoutePath }: UseApplicationFlowCheckArgs) {
  const isApplicationFlowCheckCompletedRef = useRef(false);
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isIdle = navigation.state === 'idle';
  const { enabled: applicationFlowStorageEnabled, value: applicationFlowStorageValue } = useApplicationFlowStorage(id);

  useEffect(() => {
    // reset the check completion status when the application ID changes, allowing the flow check
    // to run again for the new ID
    isApplicationFlowCheckCompletedRef.current = false;
  }, [id]);

  useEffect(() => {
    const shouldCheckApplicationFlow =
      isIdle && // wait for the router to be idle to avoid interrupting ongoing navigations
      applicationFlowStorageEnabled && // skip if flow storage is not available
      !isApplicationFlowCheckCompletedRef.current; // skip if already checked

    if (!shouldCheckApplicationFlow) return;

    if (applicationFlowStorageValue !== 'active') {
      void navigate(indexRoutePath, { replace: true });
    }

    isApplicationFlowCheckCompletedRef.current = true;
  }, [applicationFlowStorageEnabled, applicationFlowStorageValue, indexRoutePath, isIdle, navigate]);
}
