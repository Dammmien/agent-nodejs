/* eslint-disable no-underscore-dangle */

import { ModelStudy, NodeStudy, Primitive } from './types';

/**
 * Build the list of potential reference candidates nodes by model.
 *
 * This works by walking the node tree and comparing the type of each node to the types of the
 * primary key of each model.
 */
export default class CandidateFinder {
  static findCandidates(introspection: ModelStudy[]): Record<string, NodeStudy[]> {
    const candidatesByModel: Record<string, NodeStudy[]> = {};
    const modelByPkType: Record<Primitive, string[]> = this.getModelsByPkType(introspection);

    // Perform the first level here to skip root _id field
    // (instead of calling findCandidatesRec on model.analysis directly)
    for (const model of introspection)
      for (const [key, subNode] of Object.entries(model.analysis.object))
        if (key !== '_id') this.findCandidatesRec(subNode, modelByPkType, candidatesByModel);

    return candidatesByModel;
  }

  private static getModelsByPkType(introspection: ModelStudy[]): Record<Primitive, string[]> {
    return introspection.reduce((memo, model) => {
      const pkTypes = Object.keys(model.analysis.object._id.types).filter(
        t => t !== 'null',
      ) as Primitive[];

      if (pkTypes.length === 1) {
        memo[pkTypes[0]] = memo[pkTypes[0]] || [];
        memo[pkTypes[0]].push(model.name);
      }

      return memo;
    }, {} as Record<Primitive, string[]>);
  }

  /** Recursive helper of findCandidate */
  private static findCandidatesRec(
    node: NodeStudy,
    modelByPkType: Record<Primitive, string[]>,
    candidatesByModel: Record<string, NodeStudy[]>,
  ): void {
    // Recurse
    if (node.object)
      for (const [, subNode] of Object.entries(node.object))
        this.findCandidatesRec(subNode, modelByPkType, candidatesByModel);

    if (node.arrayElement)
      this.findCandidatesRec(node.arrayElement, modelByPkType, candidatesByModel);

    // Push node to potentialRefs[] if it is a potential reference
    if (node.referenceSamples) {
      const nodeTypes = Object.keys(node.types).filter(t => t !== 'null') as Primitive[];

      // nodeTypes.length may be zero if the node only contains null values (=> we skip it)
      if (nodeTypes.length === 1)
        for (const modelName of modelByPkType[nodeTypes[0]] ?? []) {
          if (!candidatesByModel[modelName]) candidatesByModel[modelName] = [];
          candidatesByModel[modelName].push(node);
        }
    }
  }
}
