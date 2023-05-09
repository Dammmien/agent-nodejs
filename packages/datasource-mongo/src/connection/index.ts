import { Db, MongoClient } from 'mongodb';

export default async function connect(url: string, ssl: boolean): Promise<Db> {
  const client = new MongoClient(url, { ssl });
  await client.connect();

  return client.db('test');
}
