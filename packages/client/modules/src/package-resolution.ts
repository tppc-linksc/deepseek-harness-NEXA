/** Ordered package-manifest resolution across profile and installation anchors. */

import { createRequire } from 'node:module'

/**
 * Create a package.json resolver that tries anchors in order.
 * @param anchors - File URLs or absolute paths used to create Node require functions.
 * @returns A resolver for exported package manifests.
 */
export function createPackageJsonResolver(anchors: readonly string[]): (packageName: string) => string {
  if (anchors.length === 0) {
    throw new Error('client-modules: package resolver requires at least one anchor')
  }
  const resolvers = anchors.map(anchor => createRequire(anchor))
  return (packageName) => {
    let failure: unknown
    for (const resolver of resolvers) {
      try {
        return resolver.resolve(`${packageName}/package.json`)
      } catch (error) {
        failure = error
      }
    }
    throw failure
  }
}
