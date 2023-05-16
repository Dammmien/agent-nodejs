import CandidateFinder from './reference-candidates';
import CandidateVerifier from './reference-verification';
import Structure from './structure';
import { ModelStudy, ModelStudyDef, MongoDb, NodeStudy, NodeStudyDef, PrimitiveDef } from './types';
import { IntrospectOptions } from '../type';

export default class Introspector {
  static async introspect(
    connection: MongoDb,
    options: IntrospectOptions['introspectionOptions'],
  ): Promise<ModelStudyDef[]> {
    const structure = await Structure.introspect(
      connection,
      options?.collectionSampleSize ?? 100,
      options?.referenceSampleSize ?? 10,
    );

    const references = await this.findReferences(connection, structure);

    return structure
      .map(({ name, analysis }) => ({
        name,
        analysis: this.convert(analysis, references, options?.maxPropertiesPerObject ?? 30),
      }))
      .sort(({ name: name1 }, { name: name2 }) => name1.localeCompare(name2));
  }

  static async findReferences(
    connection: MongoDb,
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

  private static convert(
    node: NodeStudy,
    references: Map<NodeStudy, string>,
    maxProps: number,
  ): NodeStudyDef {
    const type = this.getNodeType(node, maxProps);

    return {
      type,
      nullable: 'null' in node.types,
      referenceTo: references.get(node),
      arrayElement:
        type === 'array' ? this.convert(node.arrayElement, references, maxProps) : undefined,
      object:
        type === 'object'
          ? Object.fromEntries(
              Object.entries(node.object)
                .map(
                  ([k, v]) => [k, this.convert(v, references, maxProps)] as [string, NodeStudyDef],
                )
                .sort(([k1], [k2]) => k1.localeCompare(k2)),
            )
          : undefined,
    };
  }

  private static getNodeType(node: NodeStudy, maxPropsPerObject: number): PrimitiveDef {
    let type: PrimitiveDef = 'Mixed';

    // If there is only one type, it's the type of the node
    const nonNullTypes = Object.keys(node.types).filter(t => t !== 'null') as PrimitiveDef[];
    if (nonNullTypes.length === 1) [type] = nonNullTypes;

    // If the node only contains empty objects, it's a Mixed, as it could be anything
    if (type === 'object' && Object.keys(node.object).length === 0) type = 'Mixed';

    // If the node contains more than 20 keys, it's a Mixed, as it probably uses dynamic keys
    if (type === 'object' && Object.keys(node.object).length > maxPropsPerObject) type = 'Mixed';

    return type;
  }
}
