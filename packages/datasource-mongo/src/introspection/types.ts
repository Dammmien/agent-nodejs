export type CollectionIntrospection = { name: string; analysis: NodeAnalysis };

export type NodeAnalysis = {
  types: Partial<Record<Primitive, number>>;
  seen: number;
  samples: Set<unknown>;
  object?: Record<string, NodeAnalysis>;
  arrayElement?: NodeAnalysis;
};

export type Primitive =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'
  | 'Binary'
  | 'Date'
  | 'ObjectId';
