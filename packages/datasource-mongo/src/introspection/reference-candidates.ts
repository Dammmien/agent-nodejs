/* eslint-disable no-underscore-dangle */

import { ModelStudy, NodeStudy, Primitive } from './types';

export default class CandidateFinder {
  /** Build the list of potential reference candidates nodes by model */
  static findCandidates(introspection: ModelStudy[]): Record<string, NodeStudy[]> {
    const candidatesByModel: Record<string, NodeStudy[]> = {};
    const modelByPkType: Record<Primitive, string[]> = this.getModelsByPkType(introspection);
    for (const model of introspection)
      this.findCandidatesRec(model.analysis, modelByPkType, candidatesByModel);

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
    if (node.isCandidateForReference) {
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
