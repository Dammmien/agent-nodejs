export type ModelStudy = { name: string; analysis: NodeStudy };

export type NodeStudy = {
  types: Partial<Record<Primitive, number>>;
  seen: number;
  object?: Record<string, NodeStudy>;
  arrayElement?: NodeStudy;
  isCandidateForReference: boolean;
  samples: Set<unknown>;
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

export type PrimitiveDef = Exclude<Primitive, 'null'> | 'Mixed';

export type ModelStudyDef = {
  name: string;
  analysis: NodeStudyDef;
};

export type NodeStudyDef = {
  type: PrimitiveDef;
  nullable: boolean;
  referenceTo?: string;
  arrayElement?: NodeStudyDef;
  object?: Record<string, NodeStudyDef>;
};
