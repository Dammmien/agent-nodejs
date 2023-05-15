/* eslint-disable no-underscore-dangle */
import { Collection, Db } from 'mongodb';

import { NodeStudy } from './types';

export default class CandidateVerifier {
  static async filterCandidates(
    connection: Db,
    candidatesByModel: Record<string, NodeStudy[]>,
  ): Promise<Record<string, NodeStudy[]>> {
    // Filter out all candidates where references can't be found
    const entries = Object.entries(candidatesByModel).map(
      async ([modelName, candidates]): Promise<[string, NodeStudy[]]> => {
        const collection = connection.collection(modelName);
        const refs = await this.filterCandidatesForModel(collection, candidates);

        return [modelName, refs];
      },
    );

    return Object.fromEntries(await Promise.all(entries));
  }

  /**
   * For a given model, query the database for samples of the potential reference candidates
   * and check if they are indeed references.
   *
   * @param modelName the name of the model
   * @param nodes the nodes that are potential reference candidates
   * @returns the nodes that are indeed references
   */
  private static async filterCandidatesForModel(
    collection: Collection,
    nodes: NodeStudy[],
  ): Promise<NodeStudy[]> {
    const samples = nodes.reduce((memo, node) => [...memo, ...node.samples], []);
    const found = new Set(
      await collection
        .find({ _id: { $in: samples } }, { projection: { _id: 1 } })
        .map(d => this.toString(d._id))
        .toArray(),
    );

    return nodes.filter(node => {
      return [...node.samples].every(sample => found.has(this.toString(sample)));
    });
  }

  private static toString(sample: unknown): string {
    return typeof sample === 'object' &&
      'toHexString' in sample &&
      typeof sample.toHexString === 'function'
      ? sample.toHexString()
      : String(sample);
  }
}
