import { Db } from 'mongodb';

import CandidateFinder from './reference-candidates';
import CandidateVerifier from './reference-verification';
import Structure from './structure';
import { ModelStudy, ModelStudyDef, NodeStudy, NodeStudyDef, PrimitiveDef } from './types';

export default class Introspector {
  static async introspect(connection: Db): Promise<ModelStudyDef[]> {
    const structure = await Structure.introspect(connection);
    const references = await this.findReferences(connection, structure);

    return structure.map(({ name, analysis }) => ({
      name,
      analysis: this.convert(analysis, references),
    }));
  }

  static async findReferences(
    connection: Db,
    introspection: ModelStudy[],
  ): Promise<Map<NodeStudy, string>> {
    // Build a list of candidates by model.
    const candidatesByModel = CandidateFinder.findCandidates(introspection);

    // Filter out all candidates where references can't be found
    const referencesByModel = await CandidateVerifier.filterCandidates(
      connection,
      candidatesByModel,
    );

    // Build a map of references by node
    const inverseMap = new Map<NodeStudy, string>();
    for (const [modelName, nodes] of Object.entries(referencesByModel))
      for (const node of nodes) inverseMap.set(node, modelName);

    return inverseMap;
  }

  private static convert(node: NodeStudy, references: Map<NodeStudy, string>): NodeStudyDef {
    const types = Object.keys(node.types).filter(type => type !== 'null') as PrimitiveDef[];
    const type = types.length === 1 ? types[0] : 'Mixed';

    return {
      type,
      nullable: 'null' in node.types,
      referenceTo: references.get(node),
      arrayElement: type === 'array' ? this.convert(node.arrayElement, references) : undefined,
      object:
        type === 'object'
          ? Object.fromEntries(
              Object.entries(node.object).map(([key, value]) => [
                key,
                this.convert(value, references),
              ]),
            )
          : undefined,
    };
  }
}
