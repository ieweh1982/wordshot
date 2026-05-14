// Stub path module for browser environment
export const path = {
  join: (...args: string[]) => args.join('/'),
  resolve: (...args: string[]) => '/' + args.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
  basename: (p: string) => p.split('/').pop() || '',
  extname: (p: string) => {
    const i = p.lastIndexOf('.');
    return i > 0 ? p.slice(i) : '';
  },
  isAbsolute: (p: string) => p.startsWith('/'),
  relative: (from: string, to: string) => to,
};

export default path;