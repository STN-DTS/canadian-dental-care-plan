/**
 * A basic readiness endpoint to be used by kubernetes container probes
 *
 * @see https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-readiness-probes
 */
import type { Route } from './+types/readyz';

export function loader({ context, request }: Route.LoaderArgs) {
  return Response.json({ ready: true });
}
