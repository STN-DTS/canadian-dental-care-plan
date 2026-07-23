import type { ServerBuild, matchRoutes } from 'react-router';

type ServerRouteManifest = ServerBuild['routes'];
export type ServerRouteManifestEntry = NonNullable<ServerRouteManifest[string]>;
export type ServerRoute = ServerRouteManifestEntry & {
  children: ServerRoute[];
};

/**
 * Creates a hierarchical array of server routes (ServerRoute[]) from a flat manifest (ServerRouteManifest).
 * It first groups the routes by their `parentId` for efficient tree construction,
 * then recursively builds the tree structure starting from the specified root.
 *
 * @param serverRouteManifest The flat route manifest object from the server build.
 * @returns An array of root ServerRoute objects, each potentially containing nested children,
 *          representing the route hierarchy.
 */
export function createServerRoutes(serverRouteManifest: ServerRouteManifest): ServerRoute[] {
  const routesByParentId = groupServerRoutesByParentId(serverRouteManifest);
  return buildRouteTreeRecursive('', routesByParentId);
}

/**
 * Recursively builds the hierarchical route tree.
 * This function assumes `routesByParentId` has already been computed.
 * It finds all children for a given `parentId`, constructs their `ServerRoute` objects,
 * and recursively calls itself to build the children for each of those routes.
 *
 * @param parentId The ID of the parent route whose children are being sought.
 * @param routesByParentId A pre-computed map where keys are parent IDs and values are arrays
 *                         of corresponding child route manifest entries.
 * @returns An array of `ServerRoute` objects representing the children of the given `parentId`.
 */
function buildRouteTreeRecursive(parentId: string, routesByParentId: Record<string, ServerRouteManifestEntry[]>): ServerRoute[] {
  const childEntries = routesByParentId[parentId] ?? [];
  return childEntries.map((routeEntry) => ({
    ...routeEntry,
    children: buildRouteTreeRecursive(routeEntry.id, routesByParentId),
  }));
}

/**
 * Groups route manifest entries by their `parentId`.
 * Filters out any null or undefined entries in the manifest.
 * Routes without a `parentId` are grouped under the key `''`.
 *
 * @param serverRouteManifest The flat route manifest object.
 * @returns A record where keys are parent IDs and values are arrays of route manifest entries
 *          belonging to that parent.
 */
function groupServerRoutesByParentId(serverRouteManifest: ServerRouteManifest): Record<string, ServerRouteManifestEntry[]> {
  const routesByParent: Record<string, ServerRouteManifestEntry[]> = {};

  for (const routeEntry of Object.values(serverRouteManifest).filter((routeEntry) => routeEntry !== undefined)) {
    const parentId = routeEntry.parentId ?? '';
    routesByParent[parentId] ??= [];
    routesByParent[parentId].push(routeEntry);
  }

  return routesByParent;
}

/**
 * Represents a route object shape that is agnostic enough to be used by
 * React Router's utility functions like `matchRoutes`. It's derived directly
 * from the type expected by `matchRoutes`. This type distinguishes between
 * index routes (which cannot have children) and non-index routes (which can).
 */
type AgnosticRoute = Parameters<typeof matchRoutes>[0][number];

/**
 * Converts an array of server-defined routes (`ServerRoute[]`), typically representing
 * the top level of a route tree, into an array of `AgnosticRoute` objects
 * compatible with React Router utilities like `matchRoutes`.
 *
 * @param serverRoutes An array of ServerRoute objects representing the route hierarchy.
 *                     Each object in this top-level array is treated as a root or
 *                     a main branch in the route tree.
 * @returns An array of AgnosticRoute objects, preserving the hierarchy defined
 *          in `serverRoutes`, ready for use with React Router. Returns an empty
 *          array if the input is empty.
 */
export function createAgnosticRoutes(serverRoutes: ServerRoute[]): AgnosticRoute[] {
  return serverRoutes.map((route) => {
    return mapServerRouteToAgnosticRoute(route);
  });
}

/**
 * Recursively transforms a single ServerRoute node (and its descendants)
 * into the AgnosticRoute format. It handles the distinction between index
 * and non-index routes and processes children accordingly.
 *
 * @param serverRoute The input ServerRoute object to transform.
 * @returns The corresponding AgnosticRoute object. If it's a non-index route
 *          with children, the returned object will contain a `children` property
 *          populated with recursively transformed AgnosticRoute objects.
 *          Index routes will not have a `children` property in the returned object.
 */
function mapServerRouteToAgnosticRoute(serverRoute: ServerRoute): AgnosticRoute {
  const { children, ...agnosticRoute } = serverRoute;

  // Check if the route is an index route (index: true).
  if (agnosticRoute.index === true) {
    return agnosticRoute;
  }
  // Handle non-index routes (index: false or undefined).
  else {
    const nonIndexRoute: AgnosticRoute = agnosticRoute;

    if (children.length > 0) {
      nonIndexRoute.children = children.map((route) => {
        return mapServerRouteToAgnosticRoute(route);
      });
    }

    return nonIndexRoute;
  }
}
