/* eslint-disable import/prefer-default-export */
import { MongooseDatasource, MongooseOptions } from '@forestadmin/datasource-mongoose';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import stringify from 'json-stringify-pretty-compact';
import mongoose from 'mongoose';

import connect from './connection';
import Introspection from './introspection';
import OdmBuilder from './orm-builder';

export function createMongoDataSource(
  url: string,
  options: MongooseOptions = {},
): DataSourceFactory {
  return async (logger: Logger) => {
    const client = await connect(url, false);
    const introspection = await Introspection.introspect(client);

    const connection = mongoose.createConnection(url);
    OdmBuilder.defineModels(connection, introspection);

    return new MongooseDatasource(connection, options, logger);
  };
}

async function main() {
  const url = 'mongodb://root:password@localhost:27027';
  const client = await connect(url, false);
  const introspection = await Introspection.introspect(client);

  console.log(stringify(introspection, { maxLength: 100, indent: 2 }));
}

main();
