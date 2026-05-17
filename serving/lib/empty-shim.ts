export const appendFileSync = () => {};
export const existsSync = () => false;
export const readFileSync = () => '';
export const statSync = () => ({ size: 0 });
export const createReadStream = () => ({ on: () => {}, destroy: () => {} });
export const promises = {
  readFile: () => Promise.resolve(new ArrayBuffer(0)),
  mkdir: () => Promise.resolve(),
  unlink: () => Promise.resolve(),
};

const defaultExport = new Proxy({}, {
  get: (target, prop) => {
    if (prop === 'promises') return promises;
    if (prop === 'existsSync') return existsSync;
    if (prop === 'readFileSync') return readFileSync;
    if (prop === 'statSync') return statSync;
    if (prop === 'createReadStream') return createReadStream;
    return () => {};
  }
});

export default defaultExport;
