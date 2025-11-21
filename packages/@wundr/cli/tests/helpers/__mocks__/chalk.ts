// Mock implementation for chalk
const createChainedMethod = (): unknown => {
  const fn = (str: string): string => str;
  return new Proxy(fn, {
    get: () => createChainedMethod(),
  });
};

export default createChainedMethod();
module.exports = createChainedMethod();
module.exports.default = module.exports;
