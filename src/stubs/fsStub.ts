// Stub fs module for browser environment
export const fs = {
  existsSync: () => false,
  readFileSync: () => '',
  writeFileSync: () => {},
  mkdirSync: () => {},
  readdirSync: () => [],
  statSync: () => ({}),
  accessSync: () => {},
  appendFileSync: () => {},
  createReadStream: () => null,
  createWriteStream: () => null,
};

export default fs;