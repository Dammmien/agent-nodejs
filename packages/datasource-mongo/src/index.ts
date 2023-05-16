/* eslint-disable import/prefer-default-export */
import { MongooseDatasource } from '@forestadmin/datasource-mongoose';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { readFile, writeFile } from 'fs/promises';
import stringify from 'json-stringify-pretty-compact';
import mongoose from 'mongoose';

import Introspection from './introspection';
import OdmBuilder from './orm-builder';
import { MongoOptions } from './type';

export function createMongoDataSource(options: MongoOptions): DataSourceFactory {
  const { uri, introspectionPath } = options;
  let { introspection } = options;

  if (!introspection && !introspectionPath)
    throw new Error('You must provide either introspection or introspectionPath');
  if (introspection && introspectionPath)
    throw new Error('You cannot provide both introspection and introspectionPath');

  return async (logger: Logger) => {
    const connection = mongoose.createConnection(uri, options);

    if (!introspection) {
      try {
        introspection = JSON.parse(await readFile(introspectionPath, 'utf-8'));
      } catch {
        introspection = await Introspection.introspect(connection.db);
        await writeFile(introspectionPath, stringify(introspection, { indent: 2, maxLength: 100 }));
      }
    }

    OdmBuilder.defineModels(connection, introspection);

    return new MongooseDatasource(connection, options, logger);
  };
}
