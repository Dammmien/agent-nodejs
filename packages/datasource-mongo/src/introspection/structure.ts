/* eslint-disable no-underscore-dangle */

import { Collection, Db } from 'mongodb';

import { ModelStudy, NodeStudy, Primitive } from './types';

export default class Structure {
  private static readonly MAX_NODES = 100;
  private static readonly MAX_SAMPLES = 10;

  static async introspect(connection: Db): Promise<ModelStudy[]> {
    const collections = await connection.collections();
    const structure = collections.map(c => this.analyzeCollection(c));

    return Promise.all(structure);
  }

  private static async analyzeCollection(collection: Collection): Promise<ModelStudy> {
    const node = this.createNode();

    for await (const sample of collection.find().limit(this.MAX_NODES)) {
      this.walkNode(node, sample);
    }

    return { name: collection.collectionName, analysis: node };
  }

  private static createNode(): NodeStudy {
    return { types: {}, seen: 0, isCandidateForReference: true, samples: new Set() };
  }

  private static walkNode(node: NodeStudy, sample: unknown): void {
    if (Array.isArray(sample)) this.walkArrayNode(node, sample);
    if (sample?.constructor === Object)
      this.walkObjectNode(node, sample as Record<string, unknown>);

    this.annotateNode(node, sample);
  }

  private static walkArrayNode(node: NodeStudy, sample: unknown[]): void {
    if (!node.arrayElement) node.arrayElement = this.createNode();
    for (const subSample of sample) this.walkNode(node.arrayElement, subSample);
  }

  private static walkObjectNode(node: NodeStudy, sample: Record<string, unknown>): void {
    if (!node.object) node.object = {};

    for (const [key, subSample] of Object.entries(sample)) {
      if (!node.object[key]) node.object[key] = this.createNode();
      this.walkNode(node.object[key], subSample);
    }
  }

  private static annotateNode(node: NodeStudy, sample: unknown): void {
    const type = this.getSampleType(sample);

    // Increment counters
    node.seen += 1;
    node.types[type] = (node.types[type] || 0) + 1;

    // Check if node is a potential reference candidate
    if (node.isCandidateForReference) {
      const isSingleType = Object.keys(node.types).every(t => t === type || t === 'null');

      if (isSingleType && this.isCandidateForReference(type, sample)) {
        if (sample && node.samples.size < this.MAX_SAMPLES) node.samples.add(sample);
      } else {
        node.isCandidateForReference = false;
        node.samples.clear();
      }
    }
  }

  private static getSampleType(sample: unknown): Primitive {
    if (sample === null) return 'null';
    if (typeof sample === 'object' && '_bsontype' in sample) return sample._bsontype as Primitive;
    if (sample instanceof Date) return 'Date';
    if (Array.isArray(sample)) return 'array';
    if (sample?.constructor === Object) return 'object';

    return typeof sample as Primitive;
  }

  private static isCandidateForReference(type: Primitive, sample: unknown): boolean {
    return (
      type === 'null' ||
      type === 'ObjectId' ||
      (type === 'Binary' && (sample as Buffer).length <= 16) ||
      (type === 'string' && (sample as string).length <= 36)
    );
  }
}
