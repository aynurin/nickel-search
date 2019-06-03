
export default interface ITransform<TSource, TDestination> {
    apply(key: string, sourceItem: TSource): TDestination;
}
