import CollectionCustomizationContext from '../../context/collection-context';
import { TCollectionName, TConditionTree, TSchema } from '../../templates';

export type SearchDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (
  value: string,
  extended: boolean,
  context: CollectionCustomizationContext<S, N>,
) => Promise<TConditionTree<S, N>> | TConditionTree<S, N>;
