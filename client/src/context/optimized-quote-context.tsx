export { OptimizedQuoteProvider, useOptimizedQuote };
const loadPersonnel = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/personnel"] });
  }, [queryClient]);